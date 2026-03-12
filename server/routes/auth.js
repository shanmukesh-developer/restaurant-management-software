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

// POST /api/auth/test-notification { role }
router.post('/test-notification', async (req, res) => {
  const { role } = req.body;
  const authHeader = req.headers.authorization;
  const authToken = authHeader ? authHeader.split(' ')[1] : null;

  // Only allow admins to send test notifications
  if (!verifyToken('admin', authToken)) {
    return res.status(401).json({ ok: false, error: 'Unauthorized — Admin only' });
  }

  if (!role || !['kitchen', 'waiter'].includes(role)) {
    return res.status(400).json({ ok: false, error: 'Invalid role for testing' });
  }

  try {
    const { sendNotification } = require('../notifications');
    await sendNotification(role, '🚀 Besta Test Push', `This is a test notification for the ${role} role.`);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
