const express = require('express');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(express.static('public'));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

// Health check
app.get('/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW() AS database_time');
    res.json({
      ok: true,
      message: 'CoopTrack server running',
      databaseTime: result.rows[0].database_time,
    });
  } catch (error) {
    console.error('Health error:', error);
    res.status(500).json({
      ok: false,
      error: 'Database connection failed',
    });
  }
});

// Crear usuario
app.post('/users', async (req, res) => {
  try {
    const { nickname, email, phone, password_hash, profile_photo_url } = req.body;

    if (!nickname) {
      return res.status(400).json({ ok: false, error: 'nickname is required' });
    }

    if (!email && !phone) {
      return res.status(400).json({ ok: false, error: 'email or phone is required' });
    }

    if (!password_hash) {
      return res.status(400).json({ ok: false, error: 'password_hash is required' });
    }

    const query = `
      INSERT INTO users (nickname, email, phone, password_hash, profile_photo_url)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, nickname, email, phone, profile_photo_url, user_type, created_at, updated_at
    `;

    const values = [nickname, email || null, phone || null, password_hash, profile_photo_url || null];

    const result = await pool.query(query, values);

    res.status(201).json({
      ok: true,
      user: result.rows[0],
    });
  } catch (error) {
    console.error('POST /users error:', error);

    if (error.code === '23505') {
      return res.status(409).json({
        ok: false,
        error: 'email or phone already exists',
      });
    }

    res.status(500).json({
      ok: false,
      error: 'Could not create user',
    });
  }
});

// Obtener todos los usuarios
app.get('/users', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, nickname, email, phone, user_type, created_at
      FROM users
      ORDER BY id
    `);

    res.json({
      ok: true,
      users: result.rows,
    });
  } catch (error) {
    console.error('GET /users error:', error);
    res.status(500).json({
      ok: false,
      error: 'Could not fetch users',
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`CoopTrack server listening on port ${PORT}`);
});