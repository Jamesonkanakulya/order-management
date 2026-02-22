import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../models/database.js';

const router = express.Router();

router.get('/', (req, res) => {
  const db = getDb();
  const { status, vendor, search, limit = 50, offset = 0 } = req.query;
  
  let query = 'SELECT * FROM orders WHERE 1=1';
  const params = [];

  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }
  if (vendor) {
    query += ' AND vendor = ?';
    params.push(vendor);
  }
  if (search) {
    query += ' AND (order_number LIKE ? OR customer_name LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }

  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));

  const orders = db.prepare(query).all(...params);
  
  const countQuery = 'SELECT COUNT(*) as total FROM orders WHERE 1=1' + 
    (status ? ' AND status = ?' : '') +
    (vendor ? ' AND vendor = ?' : '') +
    (search ? ' AND (order_number LIKE ? OR customer_name LIKE ?)' : '');
  
  const countParams = [];
  if (status) countParams.push(status);
  if (vendor) countParams.push(vendor);
  if (search) countParams.push(`%${search}%`, `%${search}%`);
  
  const { total } = db.prepare(countQuery).get(...countParams);

  const getItems = db.prepare('SELECT * FROM order_items WHERE order_id = ?');
  const ordersWithItems = orders.map(order => ({
    ...order,
    items: getItems.all(order.id)
  }));

  res.json({ orders: ordersWithItems, total });
});

router.get('/:id', (req, res) => {
  const db = getDb();
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }

  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
  res.json({ ...order, items });
});

router.post('/', (req, res) => {
  const db = getDb();
  const { order_number, vendor, customer_name, status, location, expected_date, notes, items } = req.body;

  const id = uuidv4();

  try {
    const insertOrder = db.prepare(`
      INSERT INTO orders (id, order_number, vendor, customer_name, status, location, expected_date, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    insertOrder.run(id, order_number, vendor, customer_name, status || 'Ordered', location, expected_date, notes);

    if (items && items.length > 0) {
      const insertItem = db.prepare(`
        INSERT INTO order_items (id, order_id, item_name, quantity, price, currency)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      
      for (const item of items) {
        insertItem.run(uuidv4(), id, item.item_name, item.quantity || 1, item.price, item.currency || 'AED');
      }
    }

    const newOrder = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
    const orderItems = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(id);

    res.status(201).json({ ...newOrder, items: orderItems });
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'Order number already exists' });
    }
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', (req, res) => {
  const db = getDb();
  const { order_number, vendor, customer_name, status, location, expected_date, notes, items } = req.body;

  const existing = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Order not found' });
  }

  try {
    const updateOrder = db.prepare(`
      UPDATE orders 
      SET order_number = ?, vendor = ?, customer_name = ?, status = ?, 
          location = ?, expected_date = ?, notes = ?, updated_at = datetime('now')
      WHERE id = ?
    `);
    
    updateOrder.run(
      order_number ?? existing.order_number,
      vendor ?? existing.vendor,
      customer_name ?? existing.customer_name,
      status ?? existing.status,
      location ?? existing.location,
      expected_date ?? existing.expected_date,
      notes ?? existing.notes,
      req.params.id
    );

    if (items) {
      db.prepare('DELETE FROM order_items WHERE order_id = ?').run(req.params.id);
      
      const insertItem = db.prepare(`
        INSERT INTO order_items (id, order_id, item_name, quantity, price, currency)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      
      for (const item of items) {
        insertItem.run(uuidv4(), req.params.id, item.item_name, item.quantity || 1, item.price, item.currency || 'AED');
      }
    }

    const updatedOrder = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    const orderItems = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(req.params.id);

    res.json({ ...updatedOrder, items: orderItems });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', (req, res) => {
  const db = getDb();
  
  const existing = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Order not found' });
  }

  db.prepare('DELETE FROM orders WHERE id = ?').run(req.params.id);
  res.json({ message: 'Order deleted successfully' });
});

router.get('/search/:orderNumber', (req, res) => {
  const db = getDb();
  const order = db.prepare('SELECT * FROM orders WHERE order_number = ?').get(req.params.orderNumber);
  
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }

  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
  res.json({ ...order, items });
});

export default router;
