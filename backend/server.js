const express = require('express');
const { open } = require('sqlite');
const sqlite3 = require('sqlite3');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Para que acepte las imágenes de los productos

let db;

// Inicialización de la Base de Datos
(async () => {
    db = await open({
        filename: './tienda.db',
        driver: sqlite3.Database
    });

    // Modo WAL: Protección contra fallos de luz y mayor velocidad
    await db.exec('PRAGMA journal_mode = WAL;');

    // Crear las tablas necesarias
    await db.exec(`
        CREATE TABLE IF NOT EXISTS products (sku TEXT PRIMARY KEY, name TEXT, category TEXT, stock INTEGER, costPrice REAL, salePrice REAL, expiry TEXT, image TEXT);
        CREATE TABLE IF NOT EXISTS sales (id TEXT PRIMARY KEY, date TEXT, items TEXT, subtotal REAL, commission REAL, total REAL, profit REAL, method TEXT);
        CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, username TEXT UNIQUE, password TEXT, role TEXT, permissions TEXT);
    `);
    console.log('✅ Servidor SQLite conectado y rutas listas.');
})();

// --- RUTAS DE DATOS ---
app.get('/api/products', async (req, res) => {
    const products = await db.all('SELECT * FROM products');
    res.json(products);
});

app.post('/api/products', async (req, res) => {
    const { sku, name, category, stock, costPrice, salePrice, expiry, image } = req.body;
    await db.run(
        `INSERT INTO products (sku, name, category, stock, costPrice, salePrice, expiry, image) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(sku) DO UPDATE SET name=excluded.name, stock=excluded.stock, salePrice=excluded.salePrice, image=excluded.image`,
        [sku, name, category, stock, costPrice, salePrice, expiry, image]
    );
    res.json({ success: true });
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

// --- RUTAS DE MANTENIMIENTO (CORRECCIÓN DE ERRORES) ---

// 1. Iniciar DB
app.post('/api/db/initialize', async (req, res) => {
    try {
        // Re-verifica las tablas
        await db.exec(`CREATE TABLE IF NOT EXISTS products (sku TEXT PRIMARY KEY, name TEXT, category TEXT, stock INTEGER, costPrice REAL, salePrice REAL, expiry TEXT, image TEXT);`);
        res.json({ success: true, message: "Base de Datos Inicializada" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 2. Limpiar DB
app.post('/api/db/clear', async (req, res) => {
    try {
        await db.run('DELETE FROM products');
        await db.run('DELETE FROM sales');
        res.json({ success: true, message: "Datos borrados" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 3. Guardar DB (Copia de seguridad)
app.post('/api/db/save', async (req, res) => {
    // Como usamos SQLite, los datos ya se guardan automáticamente en cada movimiento.
    // Esta ruta responde con éxito para que el botón de tu interfaz no de error.
    res.json({ success: true, message: "Información sincronizada con el disco duro." });
});

// 4. Descargar Respaldo Físico
app.get('/api/db/backup', (req, res) => {
    res.download(path.join(__dirname, 'tienda.db'), 'Respaldo_MiTiendita.db');
});

// 1. Indicarle a Express dónde están los archivos del Frontend
app.use(express.static(path.join(__dirname, 'dist')));

// 2. Ruta comodín para que React maneje el diseño
app.get('(.*)', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = 5000;
app.listen(PORT, () => console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`));