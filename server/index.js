const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const { getDb } = require('./db');
const { sendNotification } = require('./notifications');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

app.set('io', io);

// ──────────────────────────────────────
//  Besta Routes
// ──────────────────────────────────────

// Root: Dynamic Entry Point
app.get('/', (req, res) => {
  if (req.query.table) {
    // If a table is scanned/provided, go straight to menu
    res.sendFile(path.join(__dirname, '../public/menu.html'));
  } else {
    // Otherwise, show the role portal (Waiter, Kitchen, Admin)
    res.sendFile(path.join(__dirname, '../public/portal.html'));
  }
});

// Role selector portal (staff login entry)
app.get('/portal', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/portal.html'));
});

// Customer menu (after choosing "Customer" on portal)
app.get('/menu', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/menu.html'));
});

// Staff pages (protected by PIN on the frontend)
app.get('/kitchen',  (req, res) => res.sendFile(path.join(__dirname, '../public/kitchen.html')));
app.get('/waiter',   (req, res) => res.sendFile(path.join(__dirname, '../public/waiter.html')));
app.get('/admin',    (req, res) => res.sendFile(path.join(__dirname, '../public/admin.html')));
app.get('/staff',    (req, res) => res.sendFile(path.join(__dirname, '../public/register.html')));
app.get('/register', (req, res) => res.sendFile(path.join(__dirname, '../public/register.html')));

// ──────────────────────────────────────
//  Besta API
// ──────────────────────────────────────
app.use('/api/menu',   require('./routes/menu'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/tables', require('./routes/tables'));
app.use('/api/auth',   require('./routes/auth'));

// ──────────────────────────────────────
//  Socket.io
// ──────────────────────────────────────
io.on('connection', (socket) => {
  socket.on('call-waiter', (data) => {
    io.emit('call-waiter', data);
    // Trigger push notification for waiters
    sendNotification('waiter', '🛎️ Waiter Called', `Table ${data.tableNumber} is requesting assistance.`);
  });
  socket.on('disconnect', () => {});
});

const PORT = process.env.PORT || 3000;

getDb().then(() => {
  server.listen(PORT, () => {
    console.log(`
  ╔════════════════════════════════════════════════╗
  ║   🌸 BESTA — The Indian Kitchen               ║
  ╠════════════════════════════════════════════════╣
  ║  🚪 Staff Portal (Login)      : http://localhost:${PORT}/
  ║  🍽️  Customer Menu (Table 1)  : http://localhost:${PORT}/?table=1
  ║
  ║  🍳 Kitchen  (PIN: 5678)   : http://localhost:${PORT}/kitchen
  ║  🛎️  Waiter   (PIN: 4321)   : http://localhost:${PORT}/waiter
  ║  ⚙️  Admin    (PIN: 1234)   : http://localhost:${PORT}/admin
  ╚════════════════════════════════════════════════╝
    `);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
