const express = require('express');
const router = express.Router();
const { getDb } = require('../db');
const QRCode = require('qrcode');

// GET all tables
router.get('/', async (req, res) => {
    try {
        const db = await getDb();
        const tables = await db.all('SELECT * FROM tables_list ORDER BY table_number');
        res.json(tables);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// POST add table
router.post('/', async (req, res) => {
    try {
        const { table_number, label } = req.body;
        if (!table_number) return res.status(400).json({ error: 'table_number is required' });
        const db = await getDb();
        const result = await db.run(
            'INSERT INTO tables_list (table_number, label) VALUES (?, ?)',
            [table_number, label ?? `Table ${table_number}`]
        );
        res.json(await db.get('SELECT * FROM tables_list WHERE id = ?', result.lastID));
    } catch (e) {
        res.status(400).json({ error: 'Table number may already exist' });
    }
});

// GET QR code for a table
router.get('/:id/qr', async (req, res) => {
    try {
        const db = await getDb();
        const table = await db.get('SELECT * FROM tables_list WHERE id = ?', req.params.id);
        if (!table) return res.status(404).json({ error: 'Table not found' });

        const host = req.headers.host || 'localhost:3000';
        const protocol = req.protocol || 'http';
        const url = `${protocol}://${host}/?table=${table.id}`;

        const qrDataUrl = await QRCode.toDataURL(url, {
            width: 400, margin: 2,
            color: { dark: '#3D1F1A', light: '#F5EFE0' }
        });
        res.json({ table, url, qr: qrDataUrl });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// DELETE table
router.delete('/:id', async (req, res) => {
    try {
        const db = await getDb();
        const result = await db.run('DELETE FROM tables_list WHERE id = ?', req.params.id);
        if (result.changes === 0) return res.status(404).json({ error: 'Table not found' });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
