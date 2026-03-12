const express = require('express');
const router = express.Router();
const { getDb } = require('../db');

// GET all menu items
router.get('/', async (req, res) => {
    try {
        const db = await getDb();
        const items = await db.all('SELECT * FROM menu_items ORDER BY category, name');
        const grouped = {};
        items.forEach(item => {
            if (!grouped[item.category]) grouped[item.category] = [];
            grouped[item.category].push(item);
        });
        res.json({ items, grouped });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// POST add menu item
router.post('/', async (req, res) => {
    try {
        const { name, price, category, is_veg, description, image_url, spice_level } = req.body;
        if (!name || !price || !category) return res.status(400).json({ error: 'name, price and category are required' });
        const db = await getDb();
        const result = await db.run(
            'INSERT INTO menu_items (name, price, category, is_veg, description, image_url, spice_level) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [name, price, category, is_veg ?? 1, description ?? '', image_url ?? '', spice_level ?? 'Medium']
        );
        const item = await db.get('SELECT * FROM menu_items WHERE id = ?', result.lastID);
        res.json(item);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// PUT update menu item
router.put('/:id', async (req, res) => {
    try {
        const db = await getDb();
        const existing = await db.get('SELECT * FROM menu_items WHERE id = ?', req.params.id);
        if (!existing) return res.status(404).json({ error: 'Item not found' });
        const { name, price, category, is_veg, description, image_url, available, spice_level } = req.body;
        await db.run(
            'UPDATE menu_items SET name=?, price=?, category=?, is_veg=?, description=?, image_url=?, available=?, spice_level=? WHERE id=?',
            [name ?? existing.name, price ?? existing.price, category ?? existing.category,
            is_veg ?? existing.is_veg, description ?? existing.description,
            image_url ?? existing.image_url, available ?? existing.available,
            spice_level ?? existing.spice_level, req.params.id]
        );
        res.json(await db.get('SELECT * FROM menu_items WHERE id = ?', req.params.id));
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// DELETE menu item
router.delete('/:id', async (req, res) => {
    try {
        const db = await getDb();
        const result = await db.run('DELETE FROM menu_items WHERE id = ?', req.params.id);
        if (result.changes === 0) return res.status(404).json({ error: 'Item not found' });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
