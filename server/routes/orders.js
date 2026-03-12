const express = require('express');
const router = express.Router();
const { getDb } = require('../db');

// GET all active orders
router.get('/', async (req, res) => {
  try {
    const db = await getDb();
    const orders = await db.all(`
      SELECT o.*, t.table_number FROM orders o
      JOIN tables_list t ON o.table_id = t.id
      WHERE o.status != 'Served'
      ORDER BY o.created_at DESC
    `);
    const ordersWithItems = await Promise.all(orders.map(async order => {
      const items = await db.all('SELECT * FROM order_items WHERE order_id = ?', order.id);
      return { ...order, items };
    }));
    res.json(ordersWithItems);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET analytics summary
router.get('/analytics/summary', async (req, res) => {
  try {
    const db = await getDb();
    const today = new Date().toISOString().split('T')[0];
    const todayOrders = await db.get(
      "SELECT COUNT(*) as count, COALESCE(SUM(total_price),0) as revenue FROM orders WHERE date(created_at) = ?",
      today
    );
    const bestSellers = await db.all(`
      SELECT name, SUM(quantity) as total_sold FROM order_items
      GROUP BY name ORDER BY total_sold DESC LIMIT 5
    `);
    res.json({ today: todayOrders, bestSellers });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET order by ID
router.get('/:id', async (req, res) => {
  try {
    const db = await getDb();
    const order = await db.get(`
      SELECT o.*, t.table_number FROM orders o
      JOIN tables_list t ON o.table_id = t.id WHERE o.id = ?
    `, req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    const items = await db.all('SELECT * FROM order_items WHERE order_id = ?', order.id);
    res.json({ ...order, items });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST place new order
router.post('/', async (req, res) => {
  try {
    const { table_id, items, special_request } = req.body;
    if (!table_id || !items || items.length === 0) return res.status(400).json({ error: 'table_id and items required' });
    const db = await getDb();
    const table = await db.get('SELECT * FROM tables_list WHERE id = ?', table_id);
    if (!table) return res.status(404).json({ error: 'Table not found' });

    const total_price = items.reduce((sum, i) => sum + (i.price * i.quantity), 0);
    const orderResult = await db.run(
      "INSERT INTO orders (table_id, status, total_price, special_request) VALUES (?, 'Pending', ?, ?)",
      [table_id, total_price, special_request ?? '']
    );
    const orderId = orderResult.lastID;

    for (const item of items) {
      await db.run(
        'INSERT INTO order_items (order_id, menu_item_id, name, price, quantity, customization) VALUES (?, ?, ?, ?, ?, ?)',
        [orderId, item.menu_item_id, item.name, item.price, item.quantity, item.customization ?? '']
      );
    }

    const order = await db.get(`
      SELECT o.*, t.table_number FROM orders o
      JOIN tables_list t ON o.table_id = t.id WHERE o.id = ?
    `, orderId);
    const orderItems = await db.all('SELECT * FROM order_items WHERE order_id = ?', orderId);
    const fullOrder = { ...order, items: orderItems };

    const io = req.app.get('io');
    if (io) io.emit('new-order', fullOrder);

    res.json(fullOrder);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT update order status
router.put('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const valid = ['Pending', 'Accepted', 'Preparing', 'Ready', 'Served'];
    if (!valid.includes(status)) return res.status(400).json({ error: 'Invalid status' });

    const db = await getDb();
    const result = await db.run(
      'UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [status, req.params.id]
    );
    if (result.changes === 0) return res.status(404).json({ error: 'Order not found' });

    const order = await db.get(`
      SELECT o.*, t.table_number FROM orders o
      JOIN tables_list t ON o.table_id = t.id WHERE o.id = ?
    `, req.params.id);
    const items = await db.all('SELECT * FROM order_items WHERE order_id = ?', req.params.id);
    const fullOrder = { ...order, items };

    const io = req.app.get('io');
    if (io) io.emit('order-updated', fullOrder);

    res.json(fullOrder);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
