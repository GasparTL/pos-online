const express = require('express');
const { open } = require('sqlite');
const sqlite3 = require('sqlite3');
const cors = require('cors');
const path = require('path');

const app = express();

// --- CONFIGURACIÓN DE SEGURIDAD Y CAPACIDAD ---
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Para las fotos de los productos
app.use(express.urlencoded({ limit: '50mb', extended: true }));

let db;

// --- INICIALIZACIÓN DE BASE DE DATOS ---
(async () => {
    try {
        db = await open({
            filename: path.join(__dirname, 'tienda.db'),
            driver: sqlite3.Database
        });

        // WAL Mode: Evita que el archivo se rompa si se apaga la PC de golpe
        await db.exec('PRAGMA journal_mode = WAL;');

        await db.exec(`
            CREATE TABLE IF NOT EXISTS products (sku TEXT PRIMARY KEY, name TEXT, category TEXT, stock INTEGER, costPrice REAL, salePrice REAL, expiry TEXT, image TEXT);
            CREATE TABLE IF NOT EXISTS sales (id TEXT PRIMARY KEY, date TEXT, items TEXT, subtotal REAL, commission REAL, total REAL, profit REAL, method TEXT);
            CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, username TEXT UNIQUE, password TEXT, role TEXT, permissions TEXT);
        `);
        console.log('✅ Base de datos SQLite lista y protegida.');
    } catch (err) {
        console.error('❌ Error crítico al iniciar la base de datos:', err);
    }
})();

// --- RUTAS DE LA API (INVENTARIO Y VENTAS) ---
app.get('/api/products', async (req, res) => {
    try {
        const products = await db.all('SELECT * FROM products');
        res.json(products);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/products', async (req, res) => {
    const { sku, name, category, stock, costPrice, salePrice, expiry, image } = req.body;
    try {
        await db.run(
            `INSERT INTO products (sku, name, category, stock, costPrice, salePrice, expiry, image) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(sku) DO UPDATE SET 
             name=excluded.name, stock=excluded.stock, salePrice=excluded.salePrice, image=excluded.image`,
            [sku, name, category, stock, costPrice, salePrice, expiry, image]
        );
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/sales', async (req, res) => {
    const { id, date, items, subtotal, commission, total, profit, method } = req.body;
    try {
        await db.run('BEGIN TRANSACTION');
        await db.run(`INSERT INTO sales VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [id, date, JSON.stringify(items), subtotal, commission, total, profit, method]);
        for (const item of items) {
            await db.run('UPDATE products SET stock = stock - ? WHERE sku = ?', [item.qty, item.sku]);
        }
        await db.run('COMMIT');
        res.json({ success: true });
    } catch (e) {
        await db.run('ROLLBACK');
        res.status(500).json({ error: e.message });
    }
});

// --- RUTAS DE MANTENIMIENTO ---
app.post('/api/db/initialize', (req, res) => res.json({ success: true }));
app.post('/api/db/clear', async (req, res) => {
    await db.run('DELETE FROM products');
    await db.run('DELETE FROM sales');
    res.json({ success: true });
});
app.post('/api/db/save', (req, res) => res.json({ success: true }));
app.get('/api/db/backup', (req, res) => res.download(path.join(__dirname, 'tienda.db')));

// --- SERVIR EL FRONTEND (ESTO CORRIGE EL PathError) ---
// 1. Apuntar a la carpeta 'dist' donde está tu React compilado
app.use(express.static(path.join(__dirname, 'dist')));

// 2. Ruta comodín corregida para Express 4.x/5.x y Node v24
// Usamos '(.*)' para capturar todo sin errores de parámetros
app.get('(.*)', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// --- INICIO DEL SERVIDOR ---
const PORT = 5000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Sistema ejecutándose en: http://localhost:${PORT}`);
    console.log(`💡 No cierres esta ventana mientras uses el programa.`);
});