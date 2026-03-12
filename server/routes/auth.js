const express = require('express');
const router = express.Router();

// Staff PINs — change these as needed
const PINS = {
  waiter:  '4321',
  kitchen: '5678',
  admin:   '1234',
};

// Simple token — role + secret (enough for a restaurant context)
const SECRET = process.env.AUTH_SECRET || 'besta-secret-2025';

function makeToken(role) {
  const payload = `${role}:${SECRET}`;
  return Buffer.from(payload).toString('base64');
}

function verifyToken(role, token) {
  return token === makeToken(role);
}

// POST /api/auth/verify  { role, pin } → { ok, token }
router.post('/verify', (req, res) => {
  const { role, pin } = req.body;
  if (!role || !PINS[role]) return res.status(400).json({ ok: false, error: 'Invalid role' });
  if (pin !== PINS[role])  return res.status(401).json({ ok: false, error: 'Wrong PIN' });
  res.json({ ok: true, token: makeToken(role), role });
});

// POST /api/auth/register-token { role, token }
router.post('/register-token', async (req, res) => {
  const { role, token } = req.body;
  const authHeader = req.headers.authorization;
  const authToken = authHeader ? authHeader.split(' ')[1] : null;

  if (!role || !token) return res.status(400).json({ ok: false, error: 'Role and token required' });
  if (!verifyToken(role, authToken)) return res.status(401).json({ ok: false, error: 'Unauthorized' });

  try {
    const { getDb } = require('../db');
    const db = await getDb();
    await db.run('INSERT OR IGNORE INTO staff_tokens (role, token) VALUES (?, ?)', [role, token]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
