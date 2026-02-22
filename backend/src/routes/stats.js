import express from 'express';
import { getDb } from '../models/database.js';

const router = express.Router();

router.get('/', (req, res) => {
  const db = getDb();

  const totalOrders = db.prepare('SELECT COUNT(*) as count FROM orders').get().count;

  const ordersByStatus = db.prepare(`
    SELECT status, COUNT(*) as count 
    FROM orders 
    GROUP BY status
  `).all();

  const ordersByVendor = db.prepare(`
    SELECT vendor, COUNT(*) as count 
    FROM orders 
    GROUP BY vendor
    ORDER BY count DESC
  `).all();

  const recentOrders = db.prepare(`
    SELECT * FROM orders 
    ORDER BY created_at DESC 
    LIMIT 5
  `).all();

  const pendingDelivery = db.prepare(`
    SELECT COUNT(*) as count 
    FROM orders 
    WHERE status != 'Delivered'
  `).get().count;

  const deliveredThisMonth = db.prepare(`
    SELECT COUNT(*) as count 
    FROM orders 
    WHERE status = 'Delivered' 
    AND strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')
  `).get().count;

  res.json({
    totalOrders,
    ordersByStatus,
    ordersByVendor,
    recentOrders,
    pendingDelivery,
    deliveredThisMonth
  });
});

export default router;
