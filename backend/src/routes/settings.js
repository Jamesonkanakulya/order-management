import express from 'express';
import { getDb } from '../models/database.js';

const router = express.Router();

router.get('/', (req, res) => {
  const db = getDb();
  const settings = db.prepare('SELECT * FROM settings').all();
  const settingsObj = {};
  settings.forEach(s => {
    try {
      settingsObj[s.key] = JSON.parse(s.value);
    } catch {
      settingsObj[s.key] = s.value;
    }
  });
  res.json(settingsObj);
});

router.get('/:key', (req, res) => {
  const db = getDb();
  const setting = db.prepare('SELECT * FROM settings WHERE key = ?').get(req.params.key);
  
  if (!setting) {
    return res.status(404).json({ error: 'Setting not found' });
  }

  try {
    res.json({ key: setting.key, value: JSON.parse(setting.value) });
  } catch {
    res.json({ key: setting.key, value: setting.value });
  }
});

router.put('/:key', (req, res) => {
  const db = getDb();
  const { key } = req.params;
  const { value } = req.body;

  const stringValue = typeof value === 'string' ? value : JSON.stringify(value);

  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, stringValue);
  
  res.json({ key, value });
});

router.get('/vendors', (req, res) => {
  const db = getDb();
  const setting = db.prepare('SELECT * FROM settings WHERE key = ?').get('vendors');
  
  if (!setting) {
    return res.json({ vendors: ['Amazon', 'Noon', 'Namshi', 'Sharaf DG', 'Carrefour', 'Other'] });
  }

  try {
    res.json({ vendors: JSON.parse(setting.value) });
  } catch {
    res.json({ vendors: [setting.value] });
  }
});

router.put('/vendors', (req, res) => {
  const db = getDb();
  const { vendors } = req.body;

  if (!Array.isArray(vendors)) {
    return res.status(400).json({ error: 'Vendors must be an array' });
  }

  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('vendors', JSON.stringify(vendors));
  
  res.json({ vendors });
});

router.get('/statuses', (req, res) => {
  const db = getDb();
  const setting = db.prepare('SELECT * FROM settings WHERE key = ?').get('statuses');
  
  if (!setting) {
    return res.json({ statuses: ['Ordered', 'Shipped', 'Out for Delivery', 'Delivered'] });
  }

  try {
    res.json({ statuses: JSON.parse(setting.value) });
  } catch {
    res.json({ statuses: [setting.value] });
  }
});

router.put('/statuses', (req, res) => {
  const db = getDb();
  const { statuses } = req.body;

  if (!Array.isArray(statuses)) {
    return res.status(400).json({ error: 'Statuses must be an array' });
  }

  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('statuses', JSON.stringify(statuses));
  
  res.json({ statuses });
});

export default router;
