const express = require('express');
const { open } = require('sqlite');
const sqlite3 = require('sqlite3');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const axios = require('axios');
const fs = require('fs');

const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));

let db;

// --- CONFIGURACIÓN DE WHATSAPP (Meta Business API) ---
const WHATSAPP_TOKEN = "TU_TOKEN_DE_ACCESO_PERMANENTE";
const PHONE_NUMBER_ID = "ID_DE_TU_NUMERO_CONFIGURADO";
const TU_NUMERO_DESTINO = "52XXXXXXXXXX";

// Función para enviar la notificación
const enviarNotificacionPedido = async (pedido, items) => {
    const url = `https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`;
    
    const listaProductos = items.map(item => `- ${item.name} (Cant: ${item.qty})`).join('\n');
    
    const data = {
        messaging_product: "whatsapp",
        to: TU_NUMERO_DESTINO,
        type: "template",
        template: {
            name: "notificacion_nuevo_pedido",
            language: { code: "es" },
            components: [
                {
                    type: "body",
                    parameters: [
                        { type: "text", text: pedido.id.toString() },
                        { type: "text", text: listaProductos },
                        { type: "text", text: `$${pedido.total.toFixed(2)}` }
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

// --- SISTEMA DE AUDITORÍA (BITÁCORA) ---
const registrarMovimiento = async (username, module, action, description, details = {}) => {
    try {
        const timestamp = new Date().toISOString();
        const user = username || 'Sistema';
        await db.run(
            `INSERT INTO audit_logs (timestamp, username, module, action, description, details) VALUES (?, ?, ?, ?, ?, ?)`,
            [timestamp, user, module, action, description, JSON.stringify(details)]
        );
    } catch (error) {
        console.error("❌ Error guardando bitácora:", error);
    }
};

// Función auxiliar para extraer el usuario de la petición
// Función auxiliar para extraer el usuario de la petición
const getActionUser = (req) => req.body?.actionUser || req.headers?.['x-action-user'] || 'Sistema';

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
            
            -- Tabla de auditoría
            CREATE TABLE IF NOT EXISTS audit_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp TEXT, username TEXT, module TEXT, action TEXT, description TEXT, details TEXT);
            
            -- NUEVA TABLA DE CONFIGURACIÓN
            CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
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
            
            await registrarMovimiento('Sistema', 'Sistema', 'INICIALIZACIÓN', 'Creación de usuario administrador maestro.');
        }

        // Insertar configuración por defecto si la tabla está vacía
        const settingsCount = await db.get('SELECT COUNT(*) as count FROM settings');
        if (settingsCount.count === 0) {
            await db.run(`INSERT INTO settings (key, value) VALUES ('app_title', 'MI TIENDITA')`);
            await db.run(`INSERT INTO settings (key, value) VALUES ('color_primary', '#1F2937')`);
            await db.run(`INSERT INTO settings (key, value) VALUES ('color_accent', '#3B82F6')`);
            console.log('🎨 Configuración visual por defecto inicializada.');
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
        
        await registrarMovimiento(username, 'Sistema', 'SETUP', 'El sistema fue configurado por primera vez.');
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
        
        await registrarMovimiento(username, 'Autenticación', 'LOGIN', 'El usuario inició sesión exitosamente.');
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
    const actionUser = getActionUser(req);
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        await db.run(`INSERT INTO users (name, username, password, role, permissions) VALUES (?, ?, ?, ?, ?)`, [name, username, hashedPassword, role, JSON.stringify(permissions)]);
        
        await registrarMovimiento(actionUser, 'Usuarios', 'CREAR', `Se creó un nuevo usuario: ${username} (${role}).`);
        res.json({ success: true });
    } catch (e) {
        if (e.message.includes('UNIQUE')) res.status(400).json({ error: 'El nombre de usuario ya está en uso.' });
        else res.status(500).json({ error: e.message });
    }
});

// 🚀 RUTA ACTUALIZADA PARA BLOQUEAR BORRADO SI NO ES ADMINISTRADOR
app.delete('/api/users/:id', async (req, res) => {
    const actionUser = getActionUser(req);
    try { 
        // 1. Verificar si el usuario que solicita la acción es realmente un Administrador
        const requestingUser = await db.get('SELECT role FROM users WHERE username = ?', [actionUser]);
        
        if (!requestingUser || requestingUser.role !== 'Administrador') {
            return res.status(403).json({ error: 'Acceso denegado: Solo un Administrador puede eliminar usuarios del sistema.' });
        }

        // 2. Buscar al usuario que se desea eliminar
        const userToDelete = await db.get('SELECT username FROM users WHERE id = ?', [req.params.id]);
        
        if (userToDelete) {
            // Protección extra: Evitar que el administrador se borre a sí mismo
            if (userToDelete.username === actionUser) {
                return res.status(400).json({ error: 'Acción no permitida: No puedes eliminar tu propia cuenta de usuario.' });
            }

            await db.run('DELETE FROM users WHERE id = ?', [req.params.id]); 
            await registrarMovimiento(actionUser, 'Usuarios', 'ELIMINAR', `Se eliminó al usuario: ${userToDelete.username}.`);
        }
        res.json({ success: true }); 
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- RUTAS DE PROVEEDORES ---
app.get('/api/providers', async (req, res) => {
    try { res.json(await db.all('SELECT * FROM providers')); }
    catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/providers', async (req, res) => {
    const { name, rfc } = req.body;
    const actionUser = getActionUser(req);
    try {
        await db.run(`INSERT INTO providers (name, rfc) VALUES (?, ?)`, [name, rfc]);
        await registrarMovimiento(actionUser, 'Proveedores', 'CREAR', `Se agregó el proveedor: ${name}.`);
        res.json({ success: true });
    } catch (e) {
        if (e.message.includes('UNIQUE')) res.status(400).json({ error: 'Ya existe un proveedor.' });
        else res.status(500).json({ error: e.message });
    }
});

app.delete('/api/providers/:id', async (req, res) => {
    const actionUser = getActionUser(req);
    try { 
        const prov = await db.get('SELECT name FROM providers WHERE id = ?', [req.params.id]);
        if (prov) {
            await db.run('DELETE FROM providers WHERE id = ?', [req.params.id]); 
            await registrarMovimiento(actionUser, 'Proveedores', 'ELIMINAR', `Se eliminó el proveedor: ${prov.name}.`);
        }
        res.json({ success: true }); 
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- RUTAS DE PRODUCTOS ---
app.get('/api/products', async (req, res) => {
    res.json(await db.all('SELECT * FROM products'));
});

app.post('/api/products', async (req, res) => {
    const { sku, name, category, stock, costPrice, salePrice, expiry, image } = req.body;
    const actionUser = getActionUser(req);
    
    try {
        const prodExistente = await db.get('SELECT * FROM products WHERE sku = ?', [sku]);
        
        await db.run(
            `INSERT INTO products (sku, name, category, stock, costPrice, salePrice, expiry, image) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?) 
            ON CONFLICT(sku) DO UPDATE SET 
            name=excluded.name, stock=excluded.stock, salePrice=excluded.salePrice, image=excluded.image`, 
            [sku, name, category, stock, costPrice, salePrice, expiry, image]
        );

        if (prodExistente) {
            let accion = 'EDITAR';
            let desc = `Se editó el producto: ${name}.`;
            
            if (prodExistente.stock < stock) {
                accion = 'AUMENTO_STOCK';
                desc = `El stock de ${name} se incrementó de ${prodExistente.stock} a ${stock}.`;
            } else if (prodExistente.stock > stock) {
                accion = 'DISMINUCION_STOCK';
                desc = `El stock de ${name} disminuyó de ${prodExistente.stock} a ${stock}.`;
            } else if (prodExistente.salePrice !== salePrice) {
                accion = 'CAMBIO_PRECIO';
                desc = `El precio de ${name} cambió de $${prodExistente.salePrice} a $${salePrice}.`;
            }

            await registrarMovimiento(actionUser, 'Productos', accion, desc, { anterior: prodExistente, nuevo: req.body });
        } else {
            await registrarMovimiento(actionUser, 'Productos', 'CREAR', `Se agregó el nuevo producto: ${name} con ${stock} unidades.`, req.body);
        }

        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// --- RUTAS DE VENTAS ---
app.get('/api/sales', async (req, res) => {
    const sales = await db.all('SELECT * FROM sales ORDER BY id DESC');
    res.json(sales.map(s => ({ ...s, items: JSON.parse(s.items) })));
});

app.post('/api/sales', async (req, res) => {
    const { id, date, items, subtotal, commission, total, profit, method } = req.body;
    const actionUser = getActionUser(req);

    try {
        await db.run('BEGIN TRANSACTION');
        
        await db.run(`INSERT INTO sales VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [id, date, JSON.stringify(items), subtotal, commission, total, profit, method]);
        
        for (const item of items) { 
            await db.run('UPDATE products SET stock = stock - ? WHERE sku = ?', [item.qty, item.sku]); 
        }
        await db.run('COMMIT');

        await registrarMovimiento(actionUser, 'Ventas', 'NUEVA_VENTA', `Se registró la venta ${id} por un total de $${total.toFixed(2)}.`, items);
        enviarNotificacionPedido({ id, total }, items);

        res.json({ success: true });
    } catch (e) { 
        await db.run('ROLLBACK'); 
        res.status(500).json({ error: e.message }); 
    }
});

// --- RUTAS DE TICKETS (COMPRAS) ---
app.get('/api/tickets', async (req, res) => {
    const tickets = await db.all('SELECT * FROM tickets ORDER BY id DESC');
    res.json(tickets.map(t => ({ ...t, items: JSON.parse(t.items) })));
});

app.post('/api/tickets', async (req, res) => {
    const { id, date, provider, items, subtotal, iva, total } = req.body;
    const actionUser = getActionUser(req);
    try {
        await db.run(`INSERT INTO tickets VALUES (?, ?, ?, ?, ?, ?, ?)`, [id, date, provider, JSON.stringify(items), subtotal, iva, total]);
        await registrarMovimiento(actionUser, 'Compras', 'NUEVO_TICKET', `Se registró el ticket ${id} del proveedor ${provider} por $${total}.`);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/tickets/:id', async (req, res) => {
    const actionUser = getActionUser(req);
    try { 
        await db.run('DELETE FROM tickets WHERE id = ?', [req.params.id]); 
        await registrarMovimiento(actionUser, 'Compras', 'ELIMINAR_TICKET', `Se eliminó el ticket de compra con ID: ${req.params.id}.`);
        res.json({ success: true }); 
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- RUTAS DE AUDITORÍA ---
app.get('/api/audit', async (req, res) => {
    try {
        const logs = await db.all('SELECT * FROM audit_logs ORDER BY id DESC');
        res.json(logs.map(log => ({ ...log, details: JSON.parse(log.details) })));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/audit/clear', async (req, res) => {
    const actionUser = getActionUser(req);
    try {
        await db.run('DELETE FROM audit_logs');
        // Registramos como la primera acción post-limpieza
        await registrarMovimiento(actionUser, 'Sistema', 'LIMPIAR_BITACORA', 'El usuario eliminó intencionalmente todo el historial del sistema.');
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- RUTAS DE CONFIGURACIÓN DEL SISTEMA (NUEVO) ---
app.get('/api/settings', async (req, res) => {
    try {
        const rows = await db.all('SELECT * FROM settings');
        const settings = {};
        rows.forEach(row => settings[row.key] = row.value);
        res.json(settings);
    } catch (e) { 
        res.status(500).json({ error: e.message }); 
    }
});

app.post('/api/settings', async (req, res) => {
    const { title, colorPrimary, colorAccent } = req.body;
    const actionUser = getActionUser(req);
    
    try {
        await db.run('BEGIN TRANSACTION');
        
        if (title) await db.run('UPDATE settings SET value = ? WHERE key = ?', [title, 'app_title']);
        if (colorPrimary) await db.run('UPDATE settings SET value = ? WHERE key = ?', [colorPrimary, 'color_primary']);
        if (colorAccent) await db.run('UPDATE settings SET value = ? WHERE key = ?', [colorAccent, 'color_accent']);
        
        await db.run('COMMIT');

        // Registro en la bitácora
        await registrarMovimiento(actionUser, 'Configuración', 'ACTUALIZAR_APARIENCIA', `Se actualizaron los ajustes visuales del sistema (Título/Colores).`);
        
        res.json({ success: true, message: 'Configuración guardada correctamente' });
    } catch (e) { 
        await db.run('ROLLBACK'); 
        res.status(500).json({ error: e.message }); 
    }
});

// --- MANTENIMIENTO ---
app.post('/api/db/clear', async (req, res) => { 
    const actionUser = getActionUser(req);
    try {
        await db.run('DELETE FROM products'); 
        await db.run('DELETE FROM sales'); 
        await db.run('DELETE FROM tickets'); 
        await registrarMovimiento(actionUser, 'Mantenimiento', 'VACIAR_BASE_DATOS', 'El usuario eliminó todos los productos, ventas y tickets del sistema.');
        res.json({ success: true }); 
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/db/backup', async (req, res) => {
    const actionUser = req.query.actionUser || 'Sistema';
    await registrarMovimiento(actionUser, 'Mantenimiento', 'BACKUP', 'Se generó y descargó una copia de la base de datos.');
    res.download(path.join(__dirname, 'tienda.db'));
});

// --- NUEVA RUTA PARA CARGAR/RESTAURAR BASE DE DATOS (.db) ---
app.post('/api/db/upload', async (req, res) => {
    const { dbData, actionUser } = req.body;
    
    try {
        if (!dbData) return res.status(400).json({ error: 'No se enviaron datos del archivo.' });

        // 1. Cerramos la conexión actual a la base de datos para liberar el archivo
        if (db) {
            await db.close();
        }

        // 2. Sobrescribimos el archivo tienda.db físico con los datos nuevos
        const targetPath = path.join(__dirname, 'tienda.db');
        fs.writeFileSync(targetPath, Buffer.from(dbData, 'base64'));

        // 3. Volvemos a abrir la conexión con la nueva base de datos
        db = await open({
            filename: targetPath,
            driver: sqlite3.Database
        });
        await db.exec('PRAGMA journal_mode = WAL;');

        // 4. Intentamos registrar el movimiento en la nueva bitácora (si existe)
        try {
            await db.run(
                `INSERT INTO audit_logs (timestamp, username, module, action, description, details) VALUES (?, ?, ?, ?, ?, ?)`,
                [new Date().toISOString(), actionUser || 'Sistema', 'Mantenimiento', 'RESTAURAR_BD', 'El usuario restauró un archivo de base de datos externo.', '{}']
            );
        } catch (ignored) {} // Ignoramos el error si la DB que subiste es muy vieja y aún no tenía la tabla audit_logs

        res.json({ success: true, message: 'Base de datos restaurada correctamente.' });
    } catch (e) {
        console.error('❌ Error al restaurar DB:', e);
        res.status(500).json({ error: e.message });
        
        // Intento de reconexión de emergencia en caso de fallo
        try {
            db = await open({ filename: path.join(__dirname, 'tienda.db'), driver: sqlite3.Database });
        } catch(err) {}
    }
});

// CONFIGURACIÓN FRONTEND
app.use(express.static(path.join(__dirname, 'dist')));
app.use((req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')));

const PORT = 5000;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Servidor en puerto ${PORT}`));