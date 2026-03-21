const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const SALT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET;

app.use(express.json());
app.use(express.static('public'));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// ================= HELPERS =================

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim() !== '';
}

function isProvided(value) {
  return value !== undefined && value !== null && value !== '';
}

function isValidDateString(value) {
  if (!isProvided(value)) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
}

function normalizeString(value) {
  return isNonEmptyString(value) ? value.trim() : null;
}

function normalizeDate(value) {
  return isProvided(value) ? value : null;
}

function isValidNumber(value) {
  if (!isProvided(value)) return false;
  return !Number.isNaN(Number(value));
}

function normalizeAmount(value) {
  if (!isProvided(value)) return null;
  const num = Number(value);
  return Number.isNaN(num) ? null : num;
}

// ================= AUTH =================

function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ ok: false, error: 'Token requerido' });
    }

    const token = authHeader.slice(7);
    const decoded = jwt.verify(token, JWT_SECRET);

    req.auth = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ ok: false, error: 'Token inválido o expirado' });
  }
}

// ================= HEALTH =================

app.get('/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ ok: true, databaseTime: result.rows[0].now });
  } catch (error) {
    res.status(500).json({ ok: false });
  }
});

// ================= USERS =================

app.post('/users', async (req, res) => {
  try {
    const { nickname, email, phone, password } = req.body;

    if (!nickname || !password || (!email && !phone)) {
      return res.status(400).json({ ok: false });
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    const result = await pool.query(
      `INSERT INTO users (nickname, email, phone, password_hash)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [nickname, email || null, phone || null, hashedPassword]
    );

    res.json({ ok: true, user: result.rows[0] });
  } catch (error) {
    res.status(500).json({ ok: false });
  }
});

app.post('/login', async (req, res) => {
  try {
    const { login, password } = req.body;

    const result = await pool.query(
      `SELECT * FROM users WHERE email=$1 OR phone=$1 LIMIT 1`,
      [login]
    );

    if (!result.rows.length) {
      return res.status(401).json({ ok: false });
    }

    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password_hash);

    if (!match) {
      return res.status(401).json({ ok: false });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET);

    res.json({ ok: true, token });
  } catch (error) {
    res.status(500).json({ ok: false });
  }
});

// ================= DECKS =================

app.post('/decks', requireAuth, async (req, res) => {
  const { name, description } = req.body;
  const userId = req.auth.userId;

  if (!name) {
    return res.status(400).json({ ok: false });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const deckResult = await client.query(
      `INSERT INTO decks (name, description, created_by_user_id, owner_user_id)
       VALUES ($1,$2,$3,$3) RETURNING *`,
      [name, description || null, userId]
    );

    const deck = deckResult.rows[0];

    await client.query(
      `INSERT INTO deck_members (deck_id, user_id) VALUES ($1,$2)`,
      [deck.id, userId]
    );

    await client.query('COMMIT');

    res.json({ ok: true, deck });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ ok: false });
  } finally {
    client.release();
  }
});

app.get('/decks', async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM decks ORDER BY id DESC`);
    res.json({ ok: true, decks: result.rows });
  } catch (error) {
    res.status(500).json({ ok: false });
  }
});

// ================= START =================

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
