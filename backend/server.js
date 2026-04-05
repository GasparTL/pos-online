const express = require('express');
const { open } = require('sqlite');
const sqlite3 = require('sqlite3');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const axios = require('axios'); // Asegúrate de tener instalado axios: npm install axios

const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));

let db;

// --- CONFIGURACIÓN DE WHATSAPP (Meta Business API) ---
const WHATSAPP_TOKEN = "TU_TOKEN_DE_ACCESO_PERMANENTE";
const PHONE_NUMBER_ID = "ID_DE_TU_NUMERO_CONFIGURADO";
const TU_NUMERO_DESTINO = "52XXXXXXXXXX"; // Tu número con código de país

// Función para enviar la notificación
const enviarNotificacionPedido = async (pedido, items) => {
    const url = `https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`;
    
    // Formateamos los productos para el mensaje
    const listaProductos = items.map(item => `- ${item.name} (Cant: ${item.qty})`).join('\n');
    
    const data = {
        messaging_product: "whatsapp",
        to: TU_NUMERO_DESTINO,
        type: "template",
        template: {
            name: "notificacion_nuevo_pedido", // Debe coincidir con el nombre en Meta
            language: { code: "es" },
            components: [
                {
                    type: "body",
                    parameters: [
                        { type: "text", text: pedido.id.toString() }, // {{1}} ID
                        { type: "text", text: listaProductos },        // {{2}} Productos
                        { type: "text", text: `$${pedido.total.toFixed(2)}` } // {{3}} Total
                    ]
                }
            ]
        }
    };

    try {
        await axios.post(url, data, {
            headers: { 'Authorization': `Bearer ${WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' }
        });
        console.log("✅ Notificación de WhatsApp enviada.");
    } catch (error) {
        console.error("❌ Error enviando WhatsApp:", error.response ? error.response.data : error.message);
    }
};

// Conexión a DB y Creación de Tablas
(async () => {
    try {
        db = await open({
            filename: path.join(__dirname, 'tienda.db'),
            driver: sqlite3.Database
        });
        await db.exec('PRAGMA journal_mode = WAL;');
        
        await db.exec(`
            CREATE TABLE IF NOT EXISTS products (sku TEXT PRIMARY KEY, name TEXT, category TEXT, stock INTEGER, costPrice REAL, salePrice REAL, expiry TEXT, image TEXT);
            CREATE TABLE IF NOT EXISTS sales (id TEXT PRIMARY KEY, date TEXT, items TEXT, subtotal REAL, commission REAL, total REAL, profit REAL, method TEXT);
            CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, username TEXT UNIQUE, password TEXT, role TEXT, permissions TEXT);
            CREATE TABLE IF NOT EXISTS tickets (id TEXT PRIMARY KEY, date TEXT, provider TEXT, items TEXT, subtotal REAL, iva REAL, total REAL);
            CREATE TABLE IF NOT EXISTS providers (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, rfc TEXT);
        `);

        const userCount = await db.get('SELECT COUNT(*) as count FROM users');
        if (userCount.count === 0) {
            const defaultHash = await bcrypt.hash('admin123', 10);
            const defaultPerms = JSON.stringify({ ventas: true, inventario: true, reportes: true, compras: true, usuarios: true, configuracion: true });
            
            await db.run(
                `INSERT INTO users (name, username, password, role, permissions) VALUES ('Administrador Maestro', 'admin', ?, 'Administrador', ?)`,
                [defaultHash, defaultPerms]
            );
            console.log('👑 Usuario Maestro creado automáticamente. Usuario: admin | Clave: admin123');
        }

        console.log('✅ Base de datos lista.');
    } catch (err) {
        console.error('❌ Error DB:', err);
    }
})();

// --- RUTAS DE AUTENTICACIÓN Y USUARIOS ---
app.get('/api/system/check-setup', async (req, res) => {
    try {
        const userCount = await db.get('SELECT COUNT(*) as count FROM users');
        res.json({ isSetupComplete: userCount.count > 0 });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/system/setup', async (req, res) => {
    const { name, username, password, permissions } = req.body;
    try {
        const userCount = await db.get('SELECT COUNT(*) as count FROM users');
        if (userCount.count > 0) return res.status(400).json({ error: 'El sistema ya está configurado.' });
        const hashedPassword = await bcrypt.hash(password, 10);
        await db.run(`INSERT INTO users (name, username, password, role, permissions) VALUES (?, ?, ?, 'Administrador', ?)`, [name, username, hashedPassword, JSON.stringify(permissions)]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: 'Error al crear el primer administrador.' }); }
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await db.get('SELECT * FROM users WHERE username = ?', [username]);
        if (!user) return res.status(401).json({ error: 'Usuario no encontrado.' });
        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) return res.status(401).json({ error: 'Contraseña incorrecta.' });
        const { password: _, ...userSession } = user;
        userSession.permissions = JSON.parse(user.permissions);
        res.json(userSession);
    } catch (e) { res.status(500).json({ error: 'Error en el servidor.' }); }
});

app.get('/api/users', async (req, res) => {
    try {
        const users = await db.all('SELECT id, name, username, role, permissions FROM users');
        const parsedUsers = users.map(u => ({ ...u, permissions: JSON.parse(u.permissions) }));
        res.json(parsedUsers);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/users', async (req, res) => {
    const { name, username, password, role, permissions } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        await db.run(`INSERT INTO users (name, username, password, role, permissions) VALUES (?, ?, ?, ?, ?)`, [name, username, hashedPassword, role, JSON.stringify(permissions)]);
        res.json({ success: true });
    } catch (e) {
        if (e.message.includes('UNIQUE')) res.status(400).json({ error: 'El nombre de usuario ya está en uso.' });
        else res.status(500).json({ error: e.message });
    }
});

app.delete('/api/users/:id', async (req, res) => {
    try { await db.run('DELETE FROM users WHERE id = ?', [req.params.id]); res.json({ success: true }); }
    catch (e) { res.status(500).json({ error: e.message }); }
});

// --- RUTAS DE PROVEEDORES ---
app.get('/api/providers', async (req, res) => {
    try { res.json(await db.all('SELECT * FROM providers')); }
    catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/providers', async (req, res) => {
    const { name, rfc } = req.body;
    try {
        await db.run(`INSERT INTO providers (name, rfc) VALUES (?, ?)`, [name, rfc]);
        res.json({ success: true });
    } catch (e) {
        if (e.message.includes('UNIQUE')) res.status(400).json({ error: 'Ya existe un proveedor.' });
        else res.status(500).json({ error: e.message });
    }
});

app.delete('/api/providers/:id', async (req, res) => {
    try { await db.run('DELETE FROM providers WHERE id = ?', [req.params.id]); res.json({ success: true }); }
    catch (e) { res.status(500).json({ error: e.message }); }
});

// --- RUTAS DE PRODUCTOS Y VENTAS (CON WHATSAPP) ---
app.get('/api/products', async (req, res) => {
    res.json(await db.all('SELECT * FROM products'));
});

app.post('/api/products', async (req, res) => {
    const { sku, name, category, stock, costPrice, salePrice, expiry, image } = req.body;
    await db.run(`INSERT INTO products (sku, name, category, stock, costPrice, salePrice, expiry, image) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(sku) DO UPDATE SET name=excluded.name, stock=excluded.stock, salePrice=excluded.salePrice, image=excluded.image`, [sku, name, category, stock, costPrice, salePrice, expiry, image]);
    res.json({ success: true });
});

app.get('/api/sales', async (req, res) => {
    const sales = await db.all('SELECT * FROM sales ORDER BY id DESC');
    res.json(sales.map(s => ({ ...s, items: JSON.parse(s.items) })));
});

// 🚀 RUTA DE VENTA ACTUALIZADA CON NOTIFICACIÓN 🚀
app.post('/api/sales', async (req, res) => {
    const { id, date, items, subtotal, commission, total, profit, method } = req.body;
    try {
        await db.run('BEGIN TRANSACTION');
        // Insertar venta
        await db.run(`INSERT INTO sales VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [id, date, JSON.stringify(items), subtotal, commission, total, profit, method]);
        // Actualizar stock de productos existentes
        for (const item of items) { 
            await db.run('UPDATE products SET stock = stock - ? WHERE sku = ?', [item.qty, item.sku]); 
        }
        await db.run('COMMIT');

        // ENVIAR NOTIFICACIÓN DE WHATSAPP AL FINALIZAR
        enviarNotificacionPedido({ id, total }, items);

        res.json({ success: true });
    } catch (e) { 
        await db.run('ROLLBACK'); 
        res.status(500).json({ error: e.message }); 
    }
});

// --- RUTAS DE TICKETS ---
app.get('/api/tickets', async (req, res) => {
    const tickets = await db.all('SELECT * FROM tickets ORDER BY id DESC');
    res.json(tickets.map(t => ({ ...t, items: JSON.parse(t.items) })));
});

app.post('/api/tickets', async (req, res) => {
    const { id, date, provider, items, subtotal, iva, total } = req.body;
    try {
        await db.run(`INSERT INTO tickets VALUES (?, ?, ?, ?, ?, ?, ?)`, [id, date, provider, JSON.stringify(items), subtotal, iva, total]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/tickets/:id', async (req, res) => {
    try { await db.run('DELETE FROM tickets WHERE id = ?', [req.params.id]); res.json({ success: true }); }
    catch (e) { res.status(500).json({ error: e.message }); }
});

// --- MANTENIMIENTO ---
app.post('/api/db/clear', async (req, res) => { 
    try {
        await db.run('DELETE FROM products'); 
        await db.run('DELETE FROM sales'); 
        await db.run('DELETE FROM tickets'); 
        res.json({ success: true }); 
    } catch (e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/db/backup', (req, res) => res.download(path.join(__dirname, 'tienda.db')));

// CONFIGURACIÓN FRONTEND
app.use(express.static(path.join(__dirname, 'dist')));
app.use((req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')));

const PORT = 5000;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Servidor en puerto ${PORT}`));