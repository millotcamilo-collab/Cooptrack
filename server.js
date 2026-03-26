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
function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizePhone(value) {
  return String(value || "").replace(/\D+/g, "");
}
function generateActivationCode() {
  const partA = Math.random().toString(36).slice(2, 6).toUpperCase();
  const partB = Math.floor(1000 + Math.random() * 9000);
  return `${partA}-${partB}`;
}
function mapUserCategory(user) {
  const normalizedType = String(user?.user_type || "").toLowerCase();

  return {
    ...user,
    qCategory:
      normalizedType === "senior"
        ? "Senior"
        : normalizedType === "active"
        ? "Active"
        : "Pop",
  };
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
  playText = '',
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
      play_status,
      play_text
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *`,
    [
      deckId,
      createdByUserId,
      parentPlayId,
      playCode,
      cardRank,
      cardSuit,
      playStatus,
      playText || null,
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
    const rawLogin = String(req.body.login || '').trim();
    const password = String(req.body.password || '');

    const loginEmail = normalizeEmail(rawLogin);
    const loginPhone = normalizePhone(rawLogin);

    const result = await pool.query(
      `SELECT * 
       FROM users 
       WHERE LOWER(email) = $1 OR phone = $2
       LIMIT 1`,
      [loginEmail, loginPhone]
    );

    if (!result.rows.length) {
      return res.status(401).json({
        ok: false,
        error: 'Credenciales inválidas',
      });
    }

    const user = result.rows[0];
    const accountStatus = String(user.account_status || 'ACTIVE').toUpperCase();

    if (accountStatus === 'PENDING') {
      return res.status(403).json({
        ok: false,
        code: 'ACCOUNT_PENDING',
        error: 'Tu cuenta todavía no fue activada',
      });
    }

    if (!user.password_hash) {
      return res.status(401).json({
        ok: false,
        error: 'Credenciales inválidas',
      });
    }

    const match = await bcrypt.compare(password, user.password_hash);

    if (!match) {
      return res.status(401).json({
        ok: false,
        error: 'Credenciales inválidas',
      });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET);

    return res.json({
      ok: true,
      token,
    });
  } catch (error) {
    console.error('Error en /login', error);
    return res.status(500).json({
      ok: false,
      error: 'Error al iniciar sesión',
    });
  }
});

app.post('/users/activate', async (req, res) => {
  const client = await pool.connect();
  let transactionStarted = false;

  try {
    const rawEmail = String(req.body.email || '').trim();
    const rawPhone = String(req.body.phone || '').trim();
    const rawActivationCode = String(req.body.activationCode || '').trim();
    const rawPassword = String(req.body.password || '');
    const rawPasswordConfirm = String(req.body.passwordConfirm || '');

    const email = normalizeEmail(rawEmail);
    const phone = normalizePhone(rawPhone);
    const activationCode = rawActivationCode.toUpperCase();

    if (!email && !phone) {
      return res.status(400).json({
        ok: false,
        error: 'Ingresá email o teléfono',
      });
    }

    if (!activationCode) {
      return res.status(400).json({
        ok: false,
        error: 'El código de activación es obligatorio',
      });
    }

    if (!rawPassword || rawPassword.length < 6) {
      return res.status(400).json({
        ok: false,
        error: 'La contraseña debe tener al menos 6 caracteres',
      });
    }

    if (rawPassword !== rawPasswordConfirm) {
      return res.status(400).json({
        ok: false,
        error: 'Las contraseñas no coinciden',
      });
    }

    await client.query('BEGIN');
    transactionStarted = true;

    let userResult;

    if (email) {
      userResult = await client.query(
        `SELECT *
         FROM users
         WHERE LOWER(email) = $1
         LIMIT 1`,
        [email]
      );
    } else {
      userResult = await client.query(
        `SELECT *
         FROM users
         WHERE phone = $1
         LIMIT 1`,
        [phone]
      );
    }

    if (!userResult.rows.length) {
      await client.query('ROLLBACK');
      transactionStarted = false;

      return res.status(404).json({
        ok: false,
        error: 'Usuario no encontrado',
      });
    }

    const user = userResult.rows[0];
    const accountStatus = String(user.account_status || 'ACTIVE').toUpperCase();

    if (accountStatus !== 'PENDING') {
      await client.query('ROLLBACK');
      transactionStarted = false;

      return res.status(400).json({
        ok: false,
        error: 'La cuenta ya está activa',
      });
    }

    if (!user.activation_code || String(user.activation_code).toUpperCase() !== activationCode) {
      await client.query('ROLLBACK');
      transactionStarted = false;

      return res.status(400).json({
        ok: false,
        error: 'Código de activación inválido',
      });
    }

    if (user.activation_expires_at && new Date(user.activation_expires_at) < new Date()) {
      await client.query('ROLLBACK');
      transactionStarted = false;

      return res.status(400).json({
        ok: false,
        error: 'El código de activación venció',
      });
    }

    const passwordHash = await bcrypt.hash(rawPassword, SALT_ROUNDS);

    const updateResult = await client.query(
      `UPDATE users
       SET
         password_hash = $2,
         account_status = 'ACTIVE',
         activation_code = NULL,
         activation_expires_at = NULL,
         updated_at = NOW()
       WHERE id = $1
       RETURNING
         id,
         nickname,
         email,
         phone,
         profile_photo_url,
         birth_date,
         user_type,
         account_status`,
      [user.id, passwordHash]
    );

    await client.query('COMMIT');
    transactionStarted = false;

    const activatedUser = updateResult.rows[0];
    const token = jwt.sign({ userId: activatedUser.id }, JWT_SECRET);

    return res.json({
      ok: true,
      message: 'Cuenta activada correctamente',
      token,
      user: activatedUser,
    });
  } catch (error) {
    if (transactionStarted) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('Error haciendo ROLLBACK en /users/activate', rollbackError);
      }
    }

    console.error('Error en POST /users/activate', error);

    return res.status(500).json({
      ok: false,
      error: 'Error activando usuario',
    });
  } finally {
    client.release();
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
    const userId = req.auth.userId;
    const deckId = Number(req.params.deckId);

    if (!Number.isInteger(deckId) || deckId <= 0) {
      return res.status(400).json({
        ok: false,
        error: 'deckId inválido',
      });
    }

    const result = await pool.query(
      `SELECT
         p.*,
         EXISTS (
           SELECT 1
           FROM play_recurrences pr
           WHERE pr.play_id = p.id
         ) AS has_recurrence
       FROM plays p
       INNER JOIN deck_members dm
         ON dm.deck_id = p.deck_id
       WHERE p.deck_id = $1
         AND dm.user_id = $2
       ORDER BY p.id ASC`,
      [deckId, userId]
    );

    const plays = result.rows;

    res.json({
      ok: true,
      deckId,
      plays,
    });
  } catch (error) {
    console.error('Error en GET /mazo/:deckId/state', error);
    res.status(500).json({
      ok: false,
      error: 'Error obteniendo estado del mazo',
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

app.patch('/plays/:playId', requireAuth, async (req, res) => {
  const { playId } = req.params;
  const userId = req.auth.userId;

  const {
    play_text,
    card_suit,
    play_status,
    amount,
    start_date,
    end_date,
    location,
    spade_mode
  } = req.body;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const playCheck = await client.query(
      `SELECT * FROM plays WHERE id = $1 LIMIT 1`,
      [playId]
    );

    if (!playCheck.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ ok: false, error: 'Play no encontrada' });
    }

    const play = playCheck.rows[0];

    const isMember = await userIsDeckMember(client, play.deck_id, userId);

    if (!isMember) {
      await client.query('ROLLBACK');
      return res.status(403).json({ ok: false, error: 'Sin acceso' });
    }

    const result = await client.query(
      `UPDATE plays
       SET
         play_text = COALESCE($2, play_text),
         card_suit = COALESCE($3, card_suit),
         play_status = COALESCE($4, play_status),
         amount = COALESCE($5, amount),
         start_date = COALESCE($6, start_date),
         end_date = COALESCE($7, end_date),
         location = COALESCE($8, location),
         spade_mode = COALESCE($9, spade_mode),
         approved_at = CASE
           WHEN $4 = 'APPROVED' AND approved_at IS NULL THEN NOW()
           ELSE approved_at
         END
       WHERE id = $1
       RETURNING *`,
      [
        playId,
        play_text,
        card_suit,
        play_status,
        amount,
        start_date,
        end_date,
        location,
        spade_mode
      ]
    );

    await client.query('COMMIT');

    res.json({
      ok: true,
      play: result.rows[0]
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error en PATCH /plays/:id', error);
    res.status(500).json({ ok: false, error: 'Error actualizando play' });
  } finally {
    client.release();
  }
});

app.delete('/plays/:playId', requireAuth, async (req, res) => {
  const { playId } = req.params;
  const userId = req.auth.userId;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const playCheck = await client.query(
      `SELECT * FROM plays WHERE id = $1 LIMIT 1`,
      [playId]
    );

    if (!playCheck.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ ok: false });
    }

    const play = playCheck.rows[0];

    const isMember = await userIsDeckMember(client, play.deck_id, userId);

    if (!isMember) {
      await client.query('ROLLBACK');
      return res.status(403).json({ ok: false });
    }

    await client.query(
      `DELETE FROM plays WHERE id = $1`,
      [playId]
    );

    await client.query('COMMIT');

    res.json({ ok: true });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error en DELETE /plays/:id', error);
    res.status(500).json({ ok: false });
  } finally {
    client.release();
  }
});

// Listado general de plays
app.get('/plays', requireAuth, async (req, res) => {
  try {
    const deckId = req.query.deckId;

    if (!deckId) {
      return res.status(400).json({
        ok: false,
        error: 'Falta deckId',
      });
    }

    const result = await pool.query(
      `
      SELECT 
        p.*,
        EXISTS (
          SELECT 1
          FROM play_recurrences pr
          WHERE pr.play_id = p.id
        ) AS has_recurrence
      FROM plays p
      WHERE p.deck_id = $1
      ORDER BY p.created_at DESC
      `,
      [deckId]
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
    const userId = req.auth.userId;
    const deckId = Number(req.params.deckId);

    if (!Number.isInteger(deckId) || deckId <= 0) {
      return res.status(400).json({
        ok: false,
        error: 'deckId inválido',
      });
    }

    const result = await pool.query(
      `SELECT
         p.*,
         EXISTS (
           SELECT 1
           FROM play_recurrences pr
           WHERE pr.play_id = p.id
         ) AS has_recurrence
       FROM plays p
       INNER JOIN deck_members dm
         ON dm.deck_id = p.deck_id
       WHERE p.deck_id = $1
         AND dm.user_id = $2
       ORDER BY p.id ASC`,
      [deckId, userId]
    );

    res.json({
      ok: true,
      plays: result.rows,
    });
  } catch (error) {
    console.error('Error en GET /decks/:deckId/plays', error);
    res.status(500).json({
      ok: false,
      error: 'Error obteniendo plays del mazo',
    });
  }
});
// Recurrencias
app.post("/plays/:id/recurrence", requireAuth, async (req, res) => {
  const playId = parseInt(req.params.id, 10);
  const {
    recurrence_type,
    weekdays,
    day_of_month,
    months,
    start_time,
    end_time,
    until_date,
    timezone
  } = req.body;

  try {
    // eliminar anterior (MVP: una sola regla por play)
    await pool.query(
      "DELETE FROM play_recurrences WHERE play_id = $1",
      [playId]
    );

    const result = await pool.query(
      `INSERT INTO play_recurrences
      (play_id, recurrence_type, weekdays, day_of_month, months,
       start_time, end_time, until_date, timezone)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING *`,
      [
        playId,
        recurrence_type,
        weekdays || null,
        day_of_month || null,
        months || null,
        start_time || null,
        end_time || null,
        until_date || null,
        timezone || null
      ]
    );

    res.json({ ok: true, recurrence: result.rows[0] });

  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: "Error saving recurrence" });
  }
});

app.get("/plays/:id/recurrence", requireAuth, async (req, res) => {
  const playId = parseInt(req.params.id, 10);

  try {
    const result = await pool.query(
      "SELECT * FROM play_recurrences WHERE play_id = $1",
      [playId]
    );

    res.json({
      ok: true,
      recurrence: result.rows[0] || null
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false });
  }
});

app.get('/decks/:deckId/q-users', requireAuth, async (req, res) => {
  const userId = req.auth.userId;
  const deckId = Number(req.params.deckId);

  if (!Number.isInteger(deckId) || deckId <= 0) {
    return res.status(400).json({
      ok: false,
      error: 'deckId inválido',
    });
  }

  const client = await pool.connect();

  try {
    const isMember = await userIsDeckMember(client, deckId, userId);

    if (!isMember) {
      return res.status(403).json({
        ok: false,
        error: 'No pertenecés a este mazo',
      });
    }

    const result = await client.query(
      `SELECT
         u.id,
         u.nickname,
         u.email,
         u.phone,
         u.profile_photo_url,
         u.user_type
       FROM deck_members dm
       INNER JOIN users u
         ON u.id = dm.user_id
       WHERE dm.deck_id = $1
       ORDER BY
         CASE
           WHEN u.user_type = 'senior' THEN 1
           WHEN u.user_type = 'active' THEN 2
           ELSE 3
         END,
         LOWER(COALESCE(u.nickname, '')) ASC,
         u.id ASC`,
      [deckId]
    );

    const users = result.rows.map((u) => {
      const normalizedType = String(u.user_type || '').toLowerCase();

      let qCategory = 'Pop';
      let categoryIcon = '/assets/icons/q-pop.gif';

      if (normalizedType === 'senior') {
        qCategory = 'Senior';
        categoryIcon = '/assets/icons/q-senior.gif';
      } else if (normalizedType === 'active') {
        qCategory = 'Active';
        categoryIcon = '/assets/icons/q-active.gif';
      }

      return {
        ...u,
        qCategory,
        categoryIcon,
      };
    });

    res.json({
      ok: true,
      deckId,
      users,
    });
  } catch (error) {
    console.error('Error en GET /decks/:deckId/q-users', error);
    res.status(500).json({
      ok: false,
      error: 'Error cargando usuarios para Q',
    });
  } finally {
    client.release();
  }
});

app.get('/users-picker', requireAuth, async (req, res) => {
  const client = await pool.connect();

  try {
    const result = await client.query(`
      SELECT
        id,
        nickname,
        email,
        phone,
        profile_photo_url,
        user_type
      FROM users
      ORDER BY
        CASE
          WHEN user_type = 'senior' THEN 1
          WHEN user_type = 'active' THEN 2
          ELSE 3
        END,
        LOWER(COALESCE(nickname, '')) ASC,
        id ASC
    `);

    const users = result.rows.map((u) => ({
      ...u,
      qCategory:
        String(u.user_type || '').toLowerCase() === 'senior' ? 'Senior'
        : String(u.user_type || '').toLowerCase() === 'active' ? 'Active'
        : 'Pop'
    }));

    res.json({
      ok: true,
      users
    });
  } catch (error) {
    console.error('Error en GET /users-picker', error);
    res.status(500).json({
      ok: false,
      error: 'Error cargando usuarios'
    });
  } finally {
    client.release();
  }
});

app.post('/users/resolve', requireAuth, async (req, res) => {
  const client = await pool.connect();
  let transactionStarted = false;

  try {
    const rawNickname = String(req.body.nickname || '').trim();
    const rawEmail = String(req.body.email || '').trim();
    const rawPhone = String(req.body.phone || '').trim();

    const email = normalizeEmail(rawEmail);
    const phone = normalizePhone(rawPhone);

    if (!rawNickname) {
      return res.status(400).json({
        ok: false,
        error: 'nickname es obligatorio',
      });
    }

    if (!email && !phone) {
      return res.status(400).json({
        ok: false,
        error: 'Debe ingresar email o teléfono',
      });
    }

    await client.query('BEGIN');
    transactionStarted = true;

    let existingByEmail = null;
    let existingByPhone = null;

    if (email) {
      const emailResult = await client.query(
        `SELECT
           id,
           nickname,
           email,
           phone,
           profile_photo_url,
           birth_date,
           user_type,
           account_status,
           activation_code,
           activation_expires_at,
           invited_by_user_id
         FROM users
         WHERE LOWER(email) = $1
         LIMIT 1`,
        [email]
      );
      existingByEmail = emailResult.rows[0] || null;
    }

    if (phone) {
      const phoneResult = await client.query(
        `SELECT
           id,
           nickname,
           email,
           phone,
           profile_photo_url,
           birth_date,
           user_type,
           account_status,
           activation_code,
           activation_expires_at,
           invited_by_user_id
         FROM users
         WHERE phone = $1
         LIMIT 1`,
        [phone]
      );
      existingByPhone = phoneResult.rows[0] || null;
    }

    if (
      existingByEmail &&
      existingByPhone &&
      String(existingByEmail.id) !== String(existingByPhone.id)
    ) {
      await client.query('ROLLBACK');
      transactionStarted = false;

      return res.status(409).json({
        ok: false,
        error: 'El email y el teléfono pertenecen a usuarios distintos',
        existingUsers: [
          mapUserCategory(existingByEmail),
          mapUserCategory(existingByPhone),
        ],
      });
    }

    const existingUser = existingByEmail || existingByPhone;

    if (existingUser) {
      await client.query('COMMIT');
      transactionStarted = false;

      return res.json({
        ok: true,
        mode: 'existing',
        user: mapUserCategory(existingUser),
        accountStatus: existingUser.account_status || 'ACTIVE',
        message:
          (existingUser.account_status || 'ACTIVE') === 'PENDING'
            ? 'El contacto ya existe como usuario pendiente.'
            : 'El contacto ya existe. Seleccionalo para continuar.',
      });
    }

    const activationCode = generateActivationCode();
    const activationExpiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7); // 7 días
    const invitedByUserId = req.auth?.userId || null;

    const insertUserResult = await client.query(
      `INSERT INTO users (
         nickname,
         email,
         phone,
         password_hash,
         user_type,
         account_status,
         activation_code,
         activation_expires_at,
         invited_by_user_id
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING
         id,
         nickname,
         email,
         phone,
         profile_photo_url,
         birth_date,
         user_type,
         account_status,
         activation_code,
         activation_expires_at,
         invited_by_user_id`,
      [
        rawNickname,
        email || null,
        phone || null,
        null,            // todavía no tiene contraseña real
        'guest',
        'PENDING',
        activationCode,
        activationExpiresAt,
        invitedByUserId,
      ]
    );

    const createdUser = insertUserResult.rows[0];

    if (email) {
      await client.query(
        `INSERT INTO user_contacts_history (
           user_id,
           contact_type,
           contact_value,
           is_current
         )
         VALUES ($1, 'EMAIL', $2, true)`,
        [createdUser.id, email]
      );
    }

    if (phone) {
      await client.query(
        `INSERT INTO user_contacts_history (
           user_id,
           contact_type,
           contact_value,
           is_current
         )
         VALUES ($1, 'PHONE', $2, true)`,
        [createdUser.id, phone]
      );
    }

    await client.query('COMMIT');
    transactionStarted = false;

    return res.json({
      ok: true,
      mode: 'created_pending',
      user: mapUserCategory(createdUser),
      accountStatus: createdUser.account_status,
      activationCode: createdUser.activation_code,
      activationExpiresAt: createdUser.activation_expires_at,
      message: 'Usuario pendiente creado correctamente',
    });
  } catch (error) {
    if (transactionStarted) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('Error haciendo ROLLBACK en /users/resolve', rollbackError);
      }
    }

    console.error('Error en POST /users/resolve', error);

    return res.status(500).json({
      ok: false,
      error: 'Error resolviendo usuario',
    });
  } finally {
    client.release();
  }
});
// ================= START =================

console.log('PORT recibido:', PORT);
app.listen(PORT, '0.0.0.0', () => {
  console.log(`CoopTrack server running on port ${PORT}`);
});
