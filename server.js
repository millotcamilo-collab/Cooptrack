const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
require('dotenv').config();

const { parseAndValidatePlayCode } = require('./engine/playParser');

const app = express();
const PORT = process.env.PORT || 3000;
const SALT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET;

app.use(cors({
  origin: 'https://cooptrack.com',
}));

app.use(express.json());
app.use(express.static('public'));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

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
    return res.status(401).json({ ok: false, error: 'Token inválido' });
  }
}

// ================= HEALTH =================

app.get('/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ ok: true, databaseTime: result.rows[0].now });
  } catch (error) {
    console.error('Error en /health', error);
    res.status(500).json({ ok: false });
  }
});

// ================= LOGIN =================

app.post('/login', async (req, res) => {
  try {
    const { login, password } = req.body;

    const result = await pool.query(
      `SELECT * FROM users WHERE email = $1 OR phone = $1 LIMIT 1`,
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
    console.error('Error en /login', error);
    res.status(500).json({ ok: false });
  }
});

// ================= ME =================

app.get('/me', requireAuth, async (req, res) => {
  try {
    const userId = req.auth.userId;

    const result = await pool.query(
      `SELECT id, nickname, email, phone FROM users WHERE id = $1`,
      [userId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ ok: false });
    }

    res.json({ ok: true, user: result.rows[0] });
  } catch (error) {
    console.error('Error en /me', error);
    res.status(500).json({ ok: false });
  }
});

// ================= DECKS =================

app.post('/decks', requireAuth, async (req, res) => {
  const { name, description } = req.body;
  const userId = req.auth.userId;

  if (!name) {
    return res.status(400).json({
      ok: false,
      error: 'Falta name',
    });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const deckResult = await client.query(
      `INSERT INTO decks (name, description, created_by_user_id, owner_user_id)
       VALUES ($1, $2, $3, $3)
       RETURNING *`,
      [name, description || null, userId]
    );

    const deck = deckResult.rows[0];

    await client.query(
      `INSERT INTO deck_members (deck_id, user_id)
       VALUES ($1, $2)`,
      [deck.id, userId]
    );

    const playCode =
      `${deck.id}§${userId}§${new Date().toISOString()}§A§HEART§create_deck§U:${userId}§system§U:${userId}`;

    await client.query(
      `INSERT INTO plays (
        deck_id,
        created_by_user_id,
        parent_play_id,
        play_code,
        card_rank,
        card_suit,
        play_status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        deck.id,
        userId,
        null,
        playCode,
        'A',
        'HEART',
        'ACTIVE',
      ]
    );

    await client.query('COMMIT');

    res.json({
      ok: true,
      deck,
      createdPlayCode: playCode,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error en POST /decks', error);
    res.status(500).json({
      ok: false,
      error: 'Error al crear mazo',
    });
  } finally {
    client.release();
  }
});

app.get('/decks', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM decks ORDER BY id DESC`
    );

    res.json({ ok: true, decks: result.rows });
  } catch (error) {
    console.error('Error en GET /decks', error);
    res.status(500).json({ ok: false });
  }
});
app.get('/decks/:deckId', async (req, res) => {
  try {
    const { deckId } = req.params;

    const result = await pool.query(
      `SELECT * FROM decks WHERE id = $1 LIMIT 1`,
      [deckId]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        ok: false,
        message: 'Mazo no encontrado',
      });
    }

    res.json({
      ok: true,
      deck: result.rows[0],
    });
  } catch (error) {
    console.error('Error en GET /decks/:deckId', error);
    res.status(500).json({
      ok: false,
      message: 'Error al cargar mazo',
    });
  }
});
// ================= MAZO STATE =================

app.get('/mazo/:deckId/state', requireAuth, async (req, res) => {
  try {
    const { deckId } = req.params;
    const userId = req.auth.userId;

    const result = await pool.query(
      `SELECT * FROM plays WHERE deck_id = $1 ORDER BY id ASC`,
      [deckId]
    );

    const plays = result.rows.map((row) => {
      const parsed = parseAndValidatePlayCode(row.play_code);

      return {
        ...row,
        parsed,
      };
    });

    const flags = {
      hasAHeart: plays.some(
        (p) => p.parsed.rank === 'A' && p.parsed.suit === 'HEART'
      ),
      hasBlueJoker: plays.some(
        (p) => p.parsed.rank === 'JOKER' || p.parsed.suit === 'BLUE'
      ),
      hasCorporateCards: plays.some(
        (p) => p.parsed.suit === 'CLUB'
      ),
    };

    res.json({
      ok: true,
      deckId,
      userId,
      playsCount: plays.length,
      plays,
      flags,
    });
  } catch (error) {
    console.error('Error en GET /mazo/:deckId/state', error);
    res.status(500).json({
      ok: false,
      error: 'Error al construir estado del mazo',
    });
  }
});

// ================= START =================

app.listen(PORT, () => {
  console.log(`CoopTrack server running on port ${PORT}`);
});
