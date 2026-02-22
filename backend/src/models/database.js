import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '../../data/orders.db');

let db;

export function getDb() {
  if (!db) {
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
  }
  return db;
}

export function initDatabase() {
  const db = getDb();
  
  db.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      order_number TEXT UNIQUE NOT NULL,
      vendor TEXT,
      customer_name TEXT,
      status TEXT DEFAULT 'Ordered',
      location TEXT,
      expected_date TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      item_name TEXT,
      quantity INTEGER DEFAULT 1,
      price REAL,
      currency TEXT DEFAULT 'AED',
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
    CREATE INDEX IF NOT EXISTS idx_orders_vendor ON orders(vendor);
  `);

  const defaultVendors = [
    { key: 'vendors', value: JSON.stringify(['Amazon', 'Noon', 'Namshi', 'Sharaf DG', 'Carrefour', 'Other']) }
  ];
  
  const defaultStatuses = [
    { key: 'statuses', value: JSON.stringify(['Ordered', 'Shipped', 'Out for Delivery', 'Delivered']) }
  ];

  const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  for (const setting of [...defaultVendors, ...defaultStatuses]) {
    insertSetting.run(setting.key, setting.value);
  }

  console.log('Database initialized successfully');
}
