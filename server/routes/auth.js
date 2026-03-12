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

// POST /api/auth/check  { role, token } → { ok }
router.post('/check', (req, res) => {
  const { role, token } = req.body;
  res.json({ ok: verifyToken(role, token) });
});

module.exports = router;
