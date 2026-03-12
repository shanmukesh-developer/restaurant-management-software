const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const { getDb } = require('./db');

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

// Root: if ?table param present go to menu, otherwise also go to menu
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Besta pages
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

// ──────────────────────────────────────
//  Socket.io
// ──────────────────────────────────────
io.on('connection', (socket) => {
  socket.on('call-waiter', (data) => {
    io.emit('call-waiter', data);
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
  ║  📱 Customer Menu : http://localhost:${PORT}?table=1 ║
  ║  🍳 Kitchen       : http://localhost:${PORT}/kitchen ║
  ║  🛎️  Waiter        : http://localhost:${PORT}/waiter  ║
  ║  ⚙️  Admin Panel  : http://localhost:${PORT}/admin   ║
  ║  🔑 Admin PIN    : 1234                        ║
  ╚════════════════════════════════════════════════╝
    `);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
