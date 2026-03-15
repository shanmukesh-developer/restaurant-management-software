const express = require('express');
const router = express.Router();

// PINs are now stored in the database.
// Default PINs seeded on first run: admin:1234, kitchen:5678, waiter:4321

const jwt = require('jsonwebtoken');

// Role-based JWT Secret
const SECRET = process.env.AUTH_SECRET || 'besta-secret-2025';

function makeToken(role) {
    return jwt.sign({ role }, SECRET, { expiresIn: '24h' });
}

function verifyToken(role, token) {
    try {
        if (!token) return false;
        const decoded = jwt.verify(token, SECRET);
        if (decoded.role !== role) {
            console.log(`[Auth] Token role mismatch for ${role}: expected ${role}, got ${decoded.role}`);
            return false;
        }
        return true;
    } catch (e) {
        console.log(`[Auth] Token verification failed for ${role}: ${e.message}`);
        return false;
    }
}

// POST /api/auth/verify  { role, pin } → { ok, token }
router.post('/verify', async (req, res) => {
  const { role, pin } = req.body;
  if (!role) return res.status(400).json({ ok: false, error: 'Invalid role' });
  
  try {
    const { getDb } = require('../db');
    const db = await getDb();
    const row = await db.get('SELECT pin FROM staff_pins WHERE role = ?', [role]);
    
    if (!row) return res.status(404).json({ ok: false, error: 'Role not found' });
    if (pin !== row.pin) return res.status(401).json({ ok: false, error: 'Wrong PIN' });
    
    res.json({ ok: true, token: makeToken(role), role });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/auth/pins (Admin only)
router.get('/pins', async (req, res) => {
  const authHeader = req.headers.authorization;
  const authToken = authHeader ? authHeader.split(' ')[1] : null;

  if (!verifyToken('admin', authToken)) {
    return res.status(401).json({ ok: false, error: 'Unauthorized — Admin only' });
  }

  try {
    const { getDb } = require('../db');
    const db = await getDb();
    const pins = await db.all('SELECT role, pin FROM staff_pins');
    res.json(pins);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/auth/pins (Admin only)
router.put('/pins', async (req, res) => {
  const authHeader = req.headers.authorization;
  const authToken = authHeader ? authHeader.split(' ')[1] : null;

  if (!verifyToken('admin', authToken)) {
    return res.status(401).json({ ok: false, error: 'Unauthorized — Admin only' });
  }

  const { role, pin } = req.body;
  if (!role || !pin) return res.status(400).json({ ok: false, error: 'Role and pin required' });

  try {
    const { getDb } = require('../db');
    const db = await getDb();
    await db.run('UPDATE staff_pins SET pin = ? WHERE role = ?', [pin, role]);
    res.json({ ok: true, message: 'PIN updated successfully' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
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
    await db.run('INSERT INTO staff_tokens (role, token) VALUES (?, ?) ON CONFLICT DO NOTHING', [role, token]);
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

module.exports = {
    router,
    verifyToken,
    makeToken,
    requireAuth: (roles = []) => (req, res, next) => {
        const authHeader = req.headers.authorization;
        const authToken = authHeader ? authHeader.split(' ')[1] : null;

        if (!authToken) {
            console.log(`[Auth] 401: No token for ${req.path}`);
            return res.status(401).json({ ok: false, error: 'Authentication token required' });
        }

        try {
            const decoded = jwt.verify(authToken, SECRET);
            const allowedRoles = Array.isArray(roles) ? roles : [roles];
            
            if (allowedRoles.length > 0 && !allowedRoles.includes(decoded.role)) {
                console.log(`[Auth] 403: Role mismatch for ${req.path}. Got: ${decoded.role}, Allowed: ${allowedRoles}`);
                return res.status(403).json({ ok: false, error: 'Access denied: insufficient permissions' });
            }

            console.log(`[Auth] 200: ${decoded.role} authorized for ${req.path}`);
            req.user = decoded;
            next();
        } catch (err) {
            console.log(`[Auth] 401: Token invalid for ${req.path} - ${err.message}`);
            const msg = err.name === 'TokenExpiredError' ? 'Session expired' : 'Invalid session token';
            return res.status(401).json({ ok: false, error: msg });
        }
    }
};
