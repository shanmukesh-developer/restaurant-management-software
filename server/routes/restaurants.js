const express = require('express');
const router = express.Router();
const { getDb } = require('../db');

// POST /api/restaurants — Register a new restaurant
router.post('/', async (req, res) => {
  try {
    const { name, slug, cuisine, city, tagline, brand_color, table_count, pin, owner_name, phone, email, notes } = req.body;
    if (!name || !slug || !pin) return res.status(400).json({ error: 'name, slug and pin are required' });
    if (!/^[a-z0-9][a-z0-9-]{1,38}$/.test(slug)) return res.status(400).json({ error: 'Invalid slug format' });
    if (!/^\d{4}$/.test(pin)) return res.status(400).json({ error: 'PIN must be 4 digits' });

    const db = await getDb();
    const result = await db.run(
      `INSERT INTO restaurants (name, slug, cuisine, city, tagline, brand_color, table_count, pin, owner_name, phone, email, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, slug, cuisine || '', city || '', tagline || '', brand_color || '#C9A84C',
       table_count || 10, pin, owner_name || '', phone || '', email || '', notes || '']
    );

    // Seed tables for this restaurant
    const count = parseInt(table_count) || 10;
    for (let i = 1; i <= count; i++) {
      await db.run(
        'INSERT INTO restaurant_tables (restaurant_id, table_number, label) VALUES (?, ?, ?)',
        [result.lastID, i, `Table ${i}`]
      );
    }

    const restaurant = await db.get('SELECT * FROM restaurants WHERE id = ?', result.lastID);
    res.json({ success: true, restaurant });
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(409).json({ error: 'That restaurant URL is already taken. Try a different slug.' });
    res.status(500).json({ error: e.message });
  }
});

// GET /api/restaurants/:slug — Get restaurant info (public, no auth)
router.get('/:slug', async (req, res) => {
  try {
    const db = await getDb();
    const restaurant = await db.get('SELECT id, name, slug, cuisine, city, tagline, brand_color, table_count FROM restaurants WHERE slug = ?', req.params.slug);
    if (!restaurant) return res.status(404).json({ error: 'Restaurant not found' });
    res.json(restaurant);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/restaurants/:slug/verify-pin — Verify admin PIN
router.post('/:slug/verify-pin', async (req, res) => {
  try {
    const db = await getDb();
    const restaurant = await db.get('SELECT pin FROM restaurants WHERE slug = ?', req.params.slug);
    if (!restaurant) return res.status(404).json({ error: 'Restaurant not found' });
    if (restaurant.pin !== req.body.pin) return res.status(401).json({ error: 'Incorrect PIN' });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/restaurants — List all (for internal/demo use)
router.get('/', async (req, res) => {
  try {
    const db = await getDb();
    const restaurants = await db.all('SELECT id, name, slug, cuisine, city, created_at FROM restaurants ORDER BY created_at DESC');
    res.json(restaurants);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
