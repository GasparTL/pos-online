const express = require('express');
const { open } = require('sqlite');
const sqlite3 = require('sqlite3');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs'); // Librería para encriptar contraseñas

const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));

let db;

// Conexión a DB
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
        `);
        console.log('✅ Base de datos lista.');
    } catch (err) {
        console.error('❌ Error DB:', err);
    }
})();

// --- RUTAS DE AUTENTICACIÓN Y USUARIOS ---

// Verificar si existe al menos un usuario (Para el primer registro)
app.get('/api/system/check-setup', async (req, res) => {
    try {
        const userCount = await db.get('SELECT COUNT(*) as count FROM users');
        res.json({ isSetupComplete: userCount.count > 0 });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Crear el PRIMER usuario (Forzado a Administrador)
app.post('/api/system/setup', async (req, res) => {
    const { name, username, password, permissions } = req.body;
    try {
        const userCount = await db.get('SELECT COUNT(*) as count FROM users');
        if (userCount.count > 0) return res.status(400).json({ error: 'El sistema ya está configurado.' });

        const hashedPassword = await bcrypt.hash(password, 10);
        await db.run(
            `INSERT INTO users (name, username, password, role, permissions) VALUES (?, ?, ?, 'Administrador', ?)`,
            [name, username, hashedPassword, JSON.stringify(permissions)]
        );
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Error al crear el primer administrador.' });
    }
});

// Login
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await db.get('SELECT * FROM users WHERE username = ?', [username]);
        if (!user) return res.status(401).json({ error: 'Usuario no encontrado.' });

        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) return res.status(401).json({ error: 'Contraseña incorrecta.' });

        // Retornamos sin la contraseña
        const { password: _, ...userSession } = user;
        userSession.permissions = JSON.parse(user.permissions);
        res.json(userSession);
    } catch (e) {
        res.status(500).json({ error: 'Error en el servidor.' });
    }
});

// Obtener todos los usuarios
app.get('/api/users', async (req, res) => {
    try {
        const users = await db.all('SELECT id, name, username, role, permissions FROM users');
        const parsedUsers = users.map(u => ({ ...u, permissions: JSON.parse(u.permissions) }));
        res.json(parsedUsers);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Crear nuevo usuario (Solo Admin desde el frontend)
app.post('/api/users', async (req, res) => {
    const { name, username, password, role, permissions } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        await db.run(
            `INSERT INTO users (name, username, password, role, permissions) VALUES (?, ?, ?, ?, ?)`,
            [name, username, hashedPassword, role, JSON.stringify(permissions)]
        );
        res.json({ success: true });
    } catch (e) {
        if (e.message.includes('UNIQUE')) {
            res.status(400).json({ error: 'El nombre de usuario ya está en uso.' });
        } else {
            res.status(500).json({ error: e.message });
        }
    }
});

// Eliminar usuario
app.delete('/api/users/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await db.run('DELETE FROM users WHERE id = ?', [id]);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});


// --- RUTAS DE PRODUCTOS Y VENTAS ---
app.get('/api/products', async (req, res) => {
    const products = await db.all('SELECT * FROM products');
    res.json(products);
});

app.post('/api/products', async (req, res) => {
    const { sku, name, category, stock, costPrice, salePrice, expiry, image } = req.body;
    await db.run(`INSERT INTO products (sku, name, category, stock, costPrice, salePrice, expiry, image) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(sku) DO UPDATE SET name=excluded.name, stock=excluded.stock, salePrice=excluded.salePrice, image=excluded.image`, [sku, name, category, stock, costPrice, salePrice, expiry, image]);
    res.json({ success: true });
});

app.get('/api/sales', async (req, res) => {
    const sales = await db.all('SELECT * FROM sales ORDER BY id DESC');
    const parsedSales = sales.map(s => ({ ...s, items: JSON.parse(s.items) }));
    res.json(parsedSales);
});

app.post('/api/sales', async (req, res) => {
    const { id, date, items, subtotal, commission, total, profit, method } = req.body;
    try {
        await db.run('BEGIN TRANSACTION');
        await db.run(`INSERT INTO sales VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [id, date, JSON.stringify(items), subtotal, commission, total, profit, method]);
        for (const item of items) { await db.run('UPDATE products SET stock = stock - ? WHERE sku = ?', [item.qty, item.sku]); }
        await db.run('COMMIT');
        res.json({ success: true });
    } catch (e) { await db.run('ROLLBACK'); res.status(500).json({ error: e.message }); }
});

// Rutas de mantenimiento
app.post('/api/db/initialize', (req, res) => res.json({ success: true }));
app.post('/api/db/clear', async (req, res) => { await db.run('DELETE FROM products'); await db.run('DELETE FROM sales'); res.json({ success: true }); });
app.post('/api/db/save', (req, res) => res.json({ success: true }));
app.get('/api/db/backup', (req, res) => res.download(path.join(__dirname, 'tienda.db')));

// --- CONFIGURACIÓN FRONTEND ---
app.use(express.static(path.join(__dirname, 'dist')));
app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = 5000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor en puerto ${PORT}`);
});