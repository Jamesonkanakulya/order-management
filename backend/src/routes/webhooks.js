import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../models/database.js';
import { classifyEmail, extractOrderData } from '../services/ai.js';

const router = express.Router();

router.post('/order', async (req, res) => {
  const db = getDb();
  const { subject, body, from, snippet } = req.body;

  if (!body && !snippet) {
    return res.status(400).json({ error: 'Missing email content (body or snippet)' });
  }

  const emailContent = body || snippet;

  try {
    const classification = await classifyEmail(subject || '', emailContent);

    if (!classification.isOrderEmail) {
      return res.json({
        message: 'Email is not order-related',
        classification,
        action: 'skipped'
      });
    }

    const extraction = await extractOrderData(subject || '', emailContent);

    if (!extraction.extraction_success) {
      return res.json({
        message: 'Failed to extract order data',
        classification,
        extraction,
        action: 'failed'
      });
    }

    const { 
      order_number, 
      vendor, 
      customer_name, 
      order_status, 
      delivery_info, 
      items, 
      order_total 
    } = extraction;

    if (!order_number) {
      return res.status(400).json({ error: 'Could not extract order number' });
    }

    const existingOrder = db.prepare('SELECT * FROM orders WHERE order_number = ?').get(order_number);

    if (existingOrder) {
      const updateOrder = db.prepare(`
        UPDATE orders 
        SET vendor = ?, customer_name = ?, status = ?, 
            location = ?, expected_date = ?, updated_at = datetime('now')
        WHERE id = ?
      `);
      
      updateOrder.run(
        vendor ?? existingOrder.vendor,
        customer_name ?? existingOrder.customer_name,
        order_status ?? existingOrder.status,
        delivery_info?.location ?? existingOrder.location,
        delivery_info?.expected_date ?? existingOrder.expected_date,
        existingOrder.id
      );

      if (items && items.length > 0) {
        db.prepare('DELETE FROM order_items WHERE order_id = ?').run(existingOrder.id);
        
        const insertItem = db.prepare(`
          INSERT INTO order_items (id, order_id, item_name, quantity, price, currency)
          VALUES (?, ?, ?, ?, ?, ?)
        `);
        
        for (const item of items) {
          const price = item.price ? parseFloat(item.price.replace(/[^0-9.-]+/g, '')) : null;
          insertItem.run(uuidv4(), existingOrder.id, item.item_name, item.quantity || 1, price, item.currency || 'AED');
        }
      }

      const updatedOrder = db.prepare('SELECT * FROM orders WHERE id = ?').get(existingOrder.id);
      const orderItems = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(existingOrder.id);

      return res.json({ 
        message: 'Order updated successfully', 
        order: { ...updatedOrder, items: orderItems },
        action: 'updated',
        classification,
        extraction
      });
    } else {
      const id = uuidv4();
      
      const insertOrder = db.prepare(`
        INSERT INTO orders (id, order_number, vendor, customer_name, status, location, expected_date)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      
      insertOrder.run(
        id,
        order_number,
        vendor || 'Unknown',
        customer_name || 'Unknown',
        order_status || 'Ordered',
        delivery_info?.location || '',
        delivery_info?.expected_date || ''
      );

      if (items && items.length > 0) {
        const insertItem = db.prepare(`
          INSERT INTO order_items (id, order_id, item_name, quantity, price, currency)
          VALUES (?, ?, ?, ?, ?, ?)
        `);
        
        for (const item of items) {
          const price = item.price ? parseFloat(item.price.replace(/[^0-9.-]+/g, '')) : null;
          insertItem.run(uuidv4(), id, item.item_name, item.quantity || 1, price, item.currency || 'AED');
        }
      }

      const newOrder = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
      const orderItems = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(id);

      return res.status(201).json({ 
        message: 'Order created successfully', 
        order: { ...newOrder, items: orderItems },
        action: 'created',
        classification,
        extraction
      });
    }
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
