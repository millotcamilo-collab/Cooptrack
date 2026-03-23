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

// ================= HELPERS =================

async function userIsDeckMember(client, deckId, userId) {
  const result = await client.query(
    `SELECT 1
     FROM deck_members
     WHERE deck_id = $1
       AND user_id = $2
     LIMIT 1`,
    [deckId, userId]
  );

  return result.rows.length > 0;
}

async function insertValidatedPlay(client, {
  deckId,
  createdByUserId,
  parentPlayId = null,
  playCode,
  cardRank,
  cardSuit,
  playStatus = 'ACTIVE',
}) {
  const parsed = parseAndValidatePlayCode(playCode);

  if (!parsed.ok) {
    const err = new Error(`play_code inválido: ${parsed.errors.join(', ')}`);
    err.statusCode = 400;
    throw err;
  }

  if (String(parsed.deckId) !== String(deckId)) {
    const err = new Error('play_code.deckId no coincide con deck_id');
    err.statusCode = 400;
    throw err;
  }

  if (parsed.userId && String(parsed.userId) !== String(createdByUserId)) {
    const err = new Error('play_code.userId no coincide con created_by_user_id');
    err.statusCode = 400;
    throw err;
  }

  if (parsed.rank !== String(cardRank).toUpperCase()) {
    const err = new Error('play_code.rank no coincide con card_rank');
    err.statusCode = 400;
    throw err;
  }

  if (parsed.suit !== String(cardSuit).toUpperCase()) {
    const err = new Error('play_code.suit no coincide con card_suit');
    err.statusCode = 400;
    throw err;
  }

  const result = await client.query(
    `INSERT INTO plays (
      deck_id,
      created_by_user_id,
      parent_play_id,
      play_code,
      card_rank,
      card_suit,
      play_status
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *`,
    [
      deckId,
      createdByUserId,
      parentPlayId,
      playCode,
      cardRank,
      cardSuit,
      playStatus,
    ]
  );

  return result.rows[0];
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
      `SELECT
        id,
        nickname,
        email,
        phone,
        profile_photo_url,
        birth_date,
        user_type
       FROM users
       WHERE id = $1`,
      [userId]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        ok: false,
        error: 'Usuario no encontrado',
      });
    }

    res.json({
      ok: true,
      user: result.rows[0],
    });
  } catch (error) {
    console.error('Error en GET /me', error);
    res.status(500).json({
      ok: false,
      error: 'Error al cargar perfil',
    });
  }
});

app.put('/me', requireAuth, async (req, res) => {
  try {
    const userId = req.auth.userId;
    const {
      nickname,
      email,
      phone,
      birth_date,
      profile_photo_url,
    } = req.body;

    if (!nickname || !nickname.trim()) {
      return res.status(400).json({
        ok: false,
        error: 'nickname es obligatorio',
      });
    }

    const result = await pool.query(
      `UPDATE users
       SET
         nickname = $1,
         email = $2,
         phone = $3,
         birth_date = $4,
         profile_photo_url = $5,
         updated_at = NOW()
       WHERE id = $6
       RETURNING
         id,
         nickname,
         email,
         phone,
         profile_photo_url,
         birth_date,
         user_type`,
      [
        nickname.trim(),
        email || null,
        phone || null,
        birth_date || null,
        profile_photo_url || null,
        userId,
      ]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        ok: false,
        error: 'Usuario no encontrado',
      });
    }

    res.json({
      ok: true,
      user: result.rows[0],
    });
  } catch (error) {
    console.error('Error en PUT /me', error);
    res.status(500).json({
      ok: false,
      error: 'Error al guardar perfil',
    });
  }
});

// ================= DECKS =================

app.post('/decks', requireAuth, async (req, res) => {
  const { name, description } = req.body;
  const userId = req.auth.userId;

  if (!name || !name.trim()) {
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
      [name.trim(), description || null, userId]
    );

    const deck = deckResult.rows[0];

    await client.query(
      `INSERT INTO deck_members (deck_id, user_id)
       VALUES ($1, $2)`,
      [deck.id, userId]
    );

    const nowIso = new Date().toISOString();

    const buildPlayCode = (rank, suit, action) =>
      `${deck.id}§${userId}§${nowIso}§${rank}§${suit}§${action}§U:${userId}§system§U:${userId}`;

    const seedPlays = [
      // 4 ases fundacionales
      { rank: 'A', suit: 'HEART', action: 'init_ace', status: 'ACTIVE' },
      { rank: 'A', suit: 'SPADE', action: 'init_ace', status: 'ACTIVE' },
      { rank: 'A', suit: 'DIAMOND', action: 'init_ace', status: 'ACTIVE' },
      { rank: 'A', suit: 'CLUB', action: 'puedeJugar', status: 'ACTIVE' },

      // 4 K estructurales
      { rank: 'K', suit: 'HEART', action: 'puedeJugar', status: 'ACTIVE' },
      { rank: 'K', suit: 'SPADE', action: 'puedeJugar', status: 'ACTIVE' },
      { rank: 'K', suit: 'DIAMOND', action: 'puedeJugar', status: 'BLOCKED' },
      { rank: 'K', suit: 'CLUB', action: 'puedeJugar', status: 'BLOCKED' },

      // 4 Q estructurales
      { rank: 'Q', suit: 'HEART', action: 'puedeJugar', status: 'BLOCKED' },
      { rank: 'Q', suit: 'SPADE', action: 'puedeJugar', status: 'ACTIVE' },
      { rank: 'Q', suit: 'DIAMOND', action: 'puedeJugar', status: 'BLOCKED' },
      { rank: 'Q', suit: 'CLUB', action: 'puedeJugar', status: 'BLOCKED' },
    ];

    for (const p of seedPlays) {
      const playCode = buildPlayCode(p.rank, p.suit, p.action);

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
          p.rank,
          p.suit,
          p.status,
        ]
      );
    }

    await client.query('COMMIT');

    res.json({
      ok: true,
      deck,
      seededPlaysCount: seedPlays.length,
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

app.get('/decks', requireAuth, async (req, res) => {
  try {
    const userId = req.auth.userId;

    const result = await pool.query(
      `SELECT d.*
       FROM decks d
       INNER JOIN deck_members dm
         ON dm.deck_id = d.id
       WHERE dm.user_id = $1
       ORDER BY d.id DESC`,
      [userId]
    );

    res.json({
      ok: true,
      decks: result.rows,
    });
  } catch (error) {
    console.error('Error en GET /decks', error);
    res.status(500).json({ ok: false });
  }
});

app.get('/decks/:deckId', requireAuth, async (req, res) => {
  try {
    const { deckId } = req.params;
    const userId = req.auth.userId;

    const result = await pool.query(
      `SELECT d.*
       FROM decks d
       INNER JOIN deck_members dm
         ON dm.deck_id = d.id
       WHERE d.id = $1
         AND dm.user_id = $2
       LIMIT 1`,
      [deckId, userId]
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

    const memberCheck = await pool.query(
      `SELECT 1
       FROM deck_members
       WHERE deck_id = $1
         AND user_id = $2
       LIMIT 1`,
      [deckId, userId]
    );

    if (!memberCheck.rows.length) {
      return res.status(404).json({
        ok: false,
        error: 'Mazo no encontrado',
      });
    }

    const result = await pool.query(
      `SELECT p.*
       FROM plays p
       INNER JOIN deck_members dm
         ON dm.deck_id = p.deck_id
       WHERE p.deck_id = $1
         AND dm.user_id = $2
       ORDER BY p.id ASC`,
      [deckId, userId]
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
        (p) => p.parsed.rank === 'JOKER' && p.parsed.suit === 'BLUE'
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

// ================= PLAYS =================

app.post('/plays', requireAuth, async (req, res) => {
  const userId = req.auth.userId;
  const {
    deck_id,
    parent_play_id = null,
    play_code,
    card_rank,
    card_suit,
    play_status = 'ACTIVE',
    text = '',
  } = req.body;

  if (!deck_id) {
    return res.status(400).json({
      ok: false,
      error: 'Falta deck_id',
    });
  }

  if (!play_code) {
    return res.status(400).json({
      ok: false,
      error: 'Falta play_code',
    });
  }

  if (!card_rank) {
    return res.status(400).json({
      ok: false,
      error: 'Falta card_rank',
    });
  }

  if (!card_suit) {
    return res.status(400).json({
      ok: false,
      error: 'Falta card_suit',
    });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const deckCheck = await client.query(
      `SELECT id FROM decks WHERE id = $1 LIMIT 1`,
      [deck_id]
    );

    if (!deckCheck.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        ok: false,
        error: 'Deck no encontrado',
      });
    }

    const isMember = await userIsDeckMember(client, deck_id, userId);

    if (!isMember) {
      await client.query('ROLLBACK');
      return res.status(403).json({
        ok: false,
        error: 'No pertenecés a este mazo',
      });
    }

    if (parent_play_id) {
      const parentCheck = await client.query(
        `SELECT id, deck_id FROM plays WHERE id = $1 LIMIT 1`,
        [parent_play_id]
      );

      if (!parentCheck.rows.length) {
        await client.query('ROLLBACK');
        return res.status(404).json({
          ok: false,
          error: 'parent_play_id no encontrado',
        });
      }

      if (String(parentCheck.rows[0].deck_id) !== String(deck_id)) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          ok: false,
          error: 'parent_play_id pertenece a otro deck',
        });
      }
    }

    const createdPlay = await insertValidatedPlay(client, {
      deckId: deck_id,
      createdByUserId: userId,
      parentPlayId: parent_play_id,
      playCode: play_code,
      cardRank: String(card_rank).toUpperCase(),
      cardSuit: String(card_suit).toUpperCase(),
      playStatus: play_status,
      playText: text,
    });

    await client.query('COMMIT');

    res.json({
      ok: true,
      play: createdPlay,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error en POST /plays', error);
    res.status(error.statusCode || 500).json({
      ok: false,
      error: error.message || 'Error guardando play',
    });
  } finally {
    client.release();
  }
});

// Listado general de plays
app.get('/plays', requireAuth, async (req, res) => {
  try {
    const userId = req.auth.userId;

    const result = await pool.query(
      `SELECT p.*
       FROM plays p
       INNER JOIN deck_members dm
         ON dm.deck_id = p.deck_id
       WHERE dm.user_id = $1
       ORDER BY p.created_at DESC`,
      [userId]
    );

    res.json({
      ok: true,
      plays: result.rows,
    });
  } catch (error) {
    console.error('Error en GET /plays', error);
    res.status(500).json({
      ok: false,
      error: 'Error obteniendo plays',
    });
  }
});

// Plays de un deck
app.get('/decks/:deckId/plays', requireAuth, async (req, res) => {
  try {
    const { deckId } = req.params;
    const userId = req.auth.userId;

    const memberCheck = await pool.query(
      `SELECT 1
       FROM deck_members
       WHERE deck_id = $1
         AND user_id = $2
       LIMIT 1`,
      [deckId, userId]
    );

    if (!memberCheck.rows.length) {
      return res.status(404).json({
        ok: false,
        error: 'Mazo no encontrado',
      });
    }

    const result = await pool.query(
      `SELECT p.*
       FROM plays p
       INNER JOIN deck_members dm
         ON dm.deck_id = p.deck_id
       WHERE p.deck_id = $1
         AND dm.user_id = $2
       ORDER BY p.id ASC`,
      [deckId, userId]
    );

    const plays = result.rows.map((row) => ({
      ...row,
      parsed: parseAndValidatePlayCode(row.play_code),
    }));

    res.json({
      ok: true,
      deckId,
      playsCount: plays.length,
      plays,
    });
  } catch (error) {
    console.error('Error en GET /decks/:deckId/plays', error);
    res.status(500).json({
      ok: false,
      error: 'Error obteniendo plays del deck',
    });
  }
});

// ================= START =================

console.log('PORT recibido:', PORT);
app.listen(PORT, '0.0.0.0', () => {
  console.log(`CoopTrack server running on port ${PORT}`);
});
