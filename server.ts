import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import pg from 'pg';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database connection (SQLite) - Used for current features in the preview
const db = new Database('lifeline.db');

// Database connection (PostgreSQL) - For the "main system" as requested
const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Don't crash if connection fails immediately
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test Postgres connection and initialize schema if connected
pgPool.connect(async (err, client, release) => {
  if (err) {
    console.warn('PostgreSQL connection failed (expected in preview environment if DATABASE_URL is not set):', err.message);
    console.info('Falling back to SQLite for current features.');
  } else {
    console.info('Successfully connected to PostgreSQL.');
    try {
      // Initialize PostgreSQL schema for the "main system"
      await client.query(`
        CREATE TABLE IF NOT EXISTS messages (
          id SERIAL PRIMARY KEY,
          sender_id TEXT NOT NULL,
          recipient_id TEXT NOT NULL,
          content TEXT NOT NULL,
          is_read BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.info('PostgreSQL schema initialized.');
    } catch (schemaErr) {
      console.error('Error initializing PostgreSQL schema:', schemaErr);
    }
    release();
  }
});

// Initialize SQLite database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    uid TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL,
    display_name TEXT,
    photo_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS donors (
    user_id TEXT PRIMARY KEY REFERENCES users(uid),
    blood_type TEXT NOT NULL,
    last_donation_date DATETIME,
    is_eligible BOOLEAN DEFAULT TRUE,
    donation_count INTEGER DEFAULT 0,
    latitude REAL,
    longitude REAL,
    location_name TEXT,
    phone_number TEXT
  );

  CREATE TABLE IF NOT EXISTS blood_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hospital_name TEXT NOT NULL,
    blood_type TEXT NOT NULL,
    quantity_ml INTEGER NOT NULL,
    urgency TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    patient_name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS appointments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    donor_id TEXT REFERENCES users(uid),
    hospital_name TEXT,
    scheduled_at DATETIME NOT NULL,
    status TEXT DEFAULT 'scheduled',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recipient_id TEXT REFERENCES users(uid),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL,
    priority TEXT DEFAULT 'medium',
    is_read BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // --- API Routes ---

  // Health check
  app.get('/api/health', async (req, res) => {
    let pgStatus = 'disconnected';
    try {
      const client = await pgPool.connect();
      pgStatus = 'connected';
      client.release();
    } catch (err) {
      pgStatus = 'error: ' + (err as Error).message;
    }
    res.json({ 
      status: 'ok', 
      database: 'sqlite', 
      postgres: pgStatus 
    });
  });

  // Get all donors
  app.get('/api/donors', (req, res) => {
    try {
      const rows = db.prepare(`
        SELECT d.*, u.display_name, u.email 
        FROM donors d 
        JOIN users u ON d.user_id = u.uid
      `).all();
      res.json(rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  // Get donor profile
  app.get('/api/donors/:uid', (req, res) => {
    try {
      const row = db.prepare('SELECT * FROM donors WHERE user_id = ?').get(req.params.uid);
      res.json(row || null);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  // Update donor profile
  app.put('/api/donors/:uid', (req, res) => {
    const { bloodType, isEligible, locationName, phoneNumber } = req.body;
    try {
      // First ensure user exists in users table (simplified for preview)
      db.prepare('INSERT OR IGNORE INTO users (uid, email, role) VALUES (?, ?, ?)').run(req.params.uid, 'user@example.com', 'donor');
      
      db.prepare(`
        INSERT INTO donors (user_id, blood_type, is_eligible, location_name, phone_number)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
          blood_type = excluded.blood_type,
          is_eligible = excluded.is_eligible,
          location_name = excluded.location_name,
          phone_number = excluded.phone_number
      `).run(req.params.uid, bloodType, isEligible ? 1 : 0, locationName, phoneNumber);
      
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  // Get appointments for donor
  app.get('/api/appointments/donor/:uid', (req, res) => {
    try {
      const rows = db.prepare('SELECT * FROM appointments WHERE donor_id = ?').all(req.params.uid);
      res.json(rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  // Create appointment
  app.post('/api/appointments', (req, res) => {
    const { donorId, hospitalName, scheduledAt } = req.body;
    try {
      const info = db.prepare(`
        INSERT INTO appointments (donor_id, hospital_name, scheduled_at, status, created_at)
        VALUES (?, ?, ?, 'scheduled', CURRENT_TIMESTAMP)
      `).run(donorId, hospitalName, scheduledAt);
      
      const result = db.prepare('SELECT * FROM appointments WHERE id = ?').get(info.lastInsertRowid);
      res.json(result);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  // --- Message Routes (PostgreSQL) ---

  // Get messages for a user
  app.get('/api/messages/:uid', async (req, res) => {
    try {
      const result = await pgPool.query(
        'SELECT * FROM messages WHERE sender_id = $1 OR recipient_id = $1 ORDER BY created_at DESC',
        [req.params.uid]
      );
      res.json(result.rows);
    } catch (err) {
      console.error('PostgreSQL error:', err);
      res.status(500).json({ error: 'PostgreSQL database error', details: (err as Error).message });
    }
  });

  // Send a message
  app.post('/api/messages', async (req, res) => {
    const { senderId, recipientId, content } = req.body;
    try {
      const result = await pgPool.query(
        'INSERT INTO messages (sender_id, recipient_id, content) VALUES ($1, $2, $3) RETURNING *',
        [senderId, recipientId, content]
      );
      res.json(result.rows[0]);
    } catch (err) {
      console.error('PostgreSQL error:', err);
      res.status(500).json({ error: 'PostgreSQL database error', details: (err as Error).message });
    }
  });

  // --- Vite Middleware ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
