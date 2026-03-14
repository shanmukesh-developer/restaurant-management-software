const express = require('express');
const router = express.Router();
const { getDb } = require('../db');
const { requireAuth } = require('./auth');

// GET all reservations
router.get('/', requireAuth(['admin', 'waiter']), async (req, res) => {
    try {
        const db = await getDb();
        const reservations = await db.all('SELECT * FROM reservations ORDER BY date ASC, time ASC');
        res.json(reservations);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// POST new reservation
router.post('/', async (req, res) => {
    try {
        const { customer_name, phone, guests, date, time } = req.body;
        if (!customer_name || !phone || !date || !time) {
            return res.status(400).json({ error: 'All fields are required' });
        }
        const db = await getDb();
        const result = await db.run(
            'INSERT INTO reservations (customer_name, phone, guests, date, time) VALUES (?, ?, ?, ?, ?)',
            [customer_name, phone, guests || 1, date, time]
        );
        const reservation = await db.get('SELECT * FROM reservations WHERE id = ?', result.lastID);
        
        // Notify staff via Socket.io
        const io = req.app.get('io');
        if (io) io.emit('new-reservation', reservation);
        
        res.json(reservation);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// PUT update reservation status
router.put('/:id/status', requireAuth(['admin', 'waiter']), async (req, res) => {
    try {
        const { status } = req.body;
        const valid = ['Confirmed', 'Direct Seated', 'Cancelled', 'No Show'];
        if (!valid.includes(status)) return res.status(400).json({ error: 'Invalid status' });

        const db = await getDb();
        const result = await db.run(
            'UPDATE reservations SET status = ? WHERE id = ?',
            [status, req.params.id]
        );
        if (result.changes === 0) return res.status(404).json({ error: 'Reservation not found' });
        
        const updated = await db.get('SELECT * FROM reservations WHERE id = ?', req.params.id);
        res.json(updated);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
