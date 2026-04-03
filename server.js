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

const {
  handleReadersOnPlayCreate,
} = require('./services/play-readers');

app.use(cors({
  origin: 'https://cooptrack.com',
}));

app.use(express.json());
app.use(express.static('public'));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// =====================================================
// AUTH
// =====================================================

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
  return String(value || '').trim().toLowerCase();
}

function normalizePhone(value) {
  return String(value || '').replace(/\D+/g, '');
}

function generateActivationCode() {
  const partA = Math.random().toString(36).slice(2, 6).toUpperCase();
  const partB = Math.floor(1000 + Math.random() * 9000);
  return `${partA}-${partB}`;
}

function mapUserCategory(user) {
  const normalizedType = String(user?.user_type || '').toLowerCase();

  return {
    ...user,
    qCategory:
      normalizedType === 'senior'
        ? 'Senior'
        : normalizedType === 'active'
          ? 'Active'
          : 'Pop',
  };
}

// =====================================================
// HELPERS DE MAZO
// =====================================================

async function userIsMazoMember(client, mazoId, userId) {
  const result = await client.query(
    `SELECT 1
     FROM deck_members
     WHERE deck_id = $1
       AND user_id = $2
     LIMIT 1`,
    [mazoId, userId]
  );

  return result.rows.length > 0;
}

function buildPlayCode({
  mazoId,
  userId,
  rank,
  suit,
  action,
  authorized,
  flow,
  recipients,
  date = null,
}) {
  const when = date || new Date().toISOString();

  return [
    mazoId,
    userId,
    when,
    rank,
    suit,
    action || '',
    authorized || '',
    flow || '',
    recipients || '',
  ].join('§');
}

async function insertInstitutionalPlay(client, {
  mazoId,
  createdByUserId,
  parentPlayId = null,
  targetUserId = null,
  playCode,
  playText = '',
  playStatus = 'ACTIVE',
}) {
  const parsed = parseAndValidatePlayCode(playCode);

  if (!parsed.ok) {
    const err = new Error(`play_code inválido: ${parsed.errors.join(', ')}`);
    err.statusCode = 400;
    throw err;
  }

  if (String(parsed.deckId) !== String(mazoId)) {
    const err = new Error('play_code.deckId no coincide con el mazo');
    err.statusCode = 400;
    throw err;
  }

  if (parsed.userId && String(parsed.userId) !== String(createdByUserId)) {
    const err = new Error('play_code.userId no coincide con el autor');
    err.statusCode = 400;
    throw err;
  }

  const result = await client.query(
    `INSERT INTO plays (
      deck_id,
      created_by_user_id,
      parent_play_id,
      target_user_id,
      play_code,
      card_rank,
      card_suit,
      play_status,
      play_text
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    RETURNING *`,
    [
      mazoId,
      createdByUserId,
      parentPlayId,
      targetUserId,
      playCode,
      parsed.rank,
      parsed.suit,
      playStatus,
      playText || null,
    ]
  );

  return {
    row: result.rows[0],
    parsed,
  };
}

async function getMazoByIdForUser(client, mazoId, userId) {
  const result = await client.query(
    `SELECT d.*
     FROM decks d
     INNER JOIN deck_members dm
       ON dm.deck_id = d.id
     WHERE d.id = $1
       AND dm.user_id = $2
     LIMIT 1`,
    [mazoId, userId]
  );

  return result.rows[0] || null;
}

// =====================================================
// HEALTH
// =====================================================

app.get('/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({
      ok: true,
      message: 'CoopTrack server running',
      databaseTime: result.rows[0].now,
    });
  } catch (error) {
    console.error('Error en /health', error);
    res.status(500).json({ ok: false });
  }
});

// =====================================================
// LOGIN / USERS / ME
// =====================================================
// MANTENER ESTOS BLOQUES TAL COMO LOS TENÉS HOY
// - POST /login
// - POST /users/activate
// - GET /me
// - PUT /me
// - GET /users-picker
// - POST /users/resolve
//
// Te los dejo abajo sin tocar semántica.
// =====================================================

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
      user: {
        id: user.id,
        nickname: user.nickname,
        email: user.email,
        phone: user.phone,
        profile_photo_url: user.profile_photo_url,
        birth_date: user.birth_date,
        user_type: user.user_type,
        account_status: user.account_status,
      },
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
        user_type,
        country,
        is_admin
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
      country,
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
         country = $6,
         updated_at = NOW()
       WHERE id = $7
       RETURNING
         id,
         nickname,
         email,
         phone,
         profile_photo_url,
         birth_date,
         country,
         user_type`,
      [
        nickname.trim(),
        email || null,
        phone || null,
        birth_date || null,
        profile_photo_url || null,
        country || null,
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

// =====================================================
// MAZOS
// =====================================================

async function createMazoHandler(req, res) {
  const {
    name,
    description,
    deck_image_url,
    currency_symbol,
    currency_name,
  } = req.body;

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

    const mazoResult = await client.query(
      `INSERT INTO decks (
         name,
         description,
         created_by_user_id,
         owner_user_id,
         deck_image_url,
         currency_symbol,
         currency_name
       )
       VALUES ($1, $2, $3, $3, $4, $5, $6)
       RETURNING *`,
      [
        name.trim(),
        description || null,
        userId,
        deck_image_url || null,
        currency_symbol
          ? String(currency_symbol).trim().toUpperCase().slice(0, 3)
          : null,
        currency_name
          ? String(currency_name).trim().slice(0, 120)
          : null,
      ]
    );

    const mazo = mazoResult.rows[0];

    await client.query(
      `INSERT INTO deck_members (deck_id, user_id)
       VALUES ($1, $2)`,
      [mazo.id, userId]
    );

    const seedPlays = [
      { rank: 'A', suit: 'HEART', action: 'init_ace', status: 'ACTIVE' },
      { rank: 'A', suit: 'SPADE', action: 'init_ace', status: 'ACTIVE' },
      { rank: 'A', suit: 'DIAMOND', action: 'init_ace', status: 'ACTIVE' },
      { rank: 'A', suit: 'CLUB', action: 'init_ace', status: 'ACTIVE' },

      { rank: 'K', suit: 'HEART', action: 'puedeJugar', status: 'ACTIVE' },
      { rank: 'K', suit: 'SPADE', action: 'puedeJugar', status: 'ACTIVE' },
      { rank: 'K', suit: 'DIAMOND', action: 'puedeJugar', status: 'BLOCKED' },
      { rank: 'K', suit: 'CLUB', action: 'puedeJugar', status: 'BLOCKED' },

      { rank: 'Q', suit: 'HEART', action: 'puedeJugar', status: 'BLOCKED' },
      { rank: 'Q', suit: 'SPADE', action: 'puedeJugar', status: 'ACTIVE' },
      { rank: 'Q', suit: 'DIAMOND', action: 'puedeJugar', status: 'BLOCKED' },
      { rank: 'Q', suit: 'CLUB', action: 'puedeJugar', status: 'BLOCKED' },
    ];

    for (const seed of seedPlays) {
      const playCode = buildPlayCode({
        mazoId: mazo.id,
        userId,
        rank: seed.rank,
        suit: seed.suit,
        action: seed.action,
        authorized: `U:${userId}`,
        flow: 'system',
        recipients: `U:${userId}`,
      });

      await insertInstitutionalPlay(client, {
        mazoId: mazo.id,
        createdByUserId: userId,
        playCode,
        playStatus: seed.status,
      });
    }

    await client.query('COMMIT');

    return res.json({
      ok: true,
      mazo,
      seededPlaysCount: seedPlays.length,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error en crear mazo', error);

    return res.status(500).json({
      ok: false,
      error: 'Error al crear mazo',
    });
  } finally {
    client.release();
  }
} async function listMazosHandler(req, res) {
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

    return res.json({
      ok: true,
      mazos: result.rows,
    });
  } catch (error) {
    console.error('Error en listar mazos', error);
    return res.status(500).json({ ok: false });
  }
}

async function getMazoHandler(req, res) {
  try {
    const mazoId = Number(req.params.mazoId || req.params.deckId);
    const userId = req.auth.userId;

    if (!Number.isInteger(mazoId) || mazoId <= 0) {
      return res.status(400).json({
        ok: false,
        error: 'mazoId inválido',
      });
    }

    const mazo = await getMazoByIdForUser(pool, mazoId, userId);

    if (!mazo) {
      return res.status(404).json({
        ok: false,
        error: 'Mazo no encontrado',
      });
    }

    return res.json({
      ok: true,
      mazo,
    });
  } catch (error) {
    console.error('Error en GET mazo', error);
    return res.status(500).json({
      ok: false,
      error: 'Error al cargar mazo',
    });
  }
}
// Alias compatibles
app.post('/mazos', requireAuth, createMazoHandler);
app.post('/decks', requireAuth, createMazoHandler);

app.get('/mazos', requireAuth, listMazosHandler);
app.get('/decks', requireAuth, listMazosHandler);

app.get('/mazos/:mazoId', requireAuth, getMazoHandler);
app.get('/decks/:deckId', requireAuth, getMazoHandler);
// =====================================================
// ESTADO DEL MAZO
// =====================================================

async function getMazoStateHandler(req, res) {
  try {
    const userId = req.auth.userId;
    const mazoId = Number(req.params.mazoId || req.params.deckId);

    if (!Number.isInteger(mazoId) || mazoId <= 0) {
      return res.status(400).json({
        ok: false,
        error: 'mazoId inválido',
      });
    }

    const mazo = await getMazoByIdForUser(pool, mazoId, userId);

    if (!mazo) {
      return res.status(404).json({
        ok: false,
        error: 'Mazo no encontrado',
      });
    }

    const result = await pool.query(
      `SELECT
         p.*,
         creator.nickname AS created_by_nickname,
         target.nickname AS target_user_nickname,
         EXISTS (
           SELECT 1
           FROM play_recurrences pr
           WHERE pr.play_id = p.id
         ) AS has_recurrence
       FROM plays p
       INNER JOIN deck_members dm
         ON dm.deck_id = p.deck_id
       LEFT JOIN users creator
         ON creator.id = p.created_by_user_id
       LEFT JOIN users target
         ON target.id = p.target_user_id
       WHERE p.deck_id = $1
         AND dm.user_id = $2
       ORDER BY p.id ASC`,
      [mazoId, userId]
    );

    const plays = result.rows;

    const corporateCards = plays
      .filter((play) => {
        const rank = String(play.card_rank || '').toUpperCase();
        const suit = String(play.card_suit || '').toUpperCase();
        const authorId = Number(play.created_by_user_id || 0);
        const targetId = Number(play.target_user_id || 0);

        const isCorporateRank = rank === 'A' || rank === 'K';
        const isCorporateSuit =
          suit === 'HEART' ||
          suit === 'SPADE' ||
          suit === 'DIAMOND' ||
          suit === 'CLUB';

        const isActive =
          String(play.play_status || '').toUpperCase() !== 'BLOCKED';

        return (
          isCorporateRank &&
          isCorporateSuit &&
          isActive &&
          (authorId === userId || targetId === userId)
        );
      })
      .map((play) => ({
        play_id: play.id,
        owner_user_id: Number(
          play.target_user_id || play.created_by_user_id || 0
        ),
        card_rank: String(play.card_rank || '').toUpperCase(),
        card_suit: String(play.card_suit || '').toUpperCase(),
        play_status: play.play_status,
      }));

    return res.json({
      ok: true,
      mazoId,
      userId,
      mazo,
      deck: mazo,
      plays,
      corporateCards,
    });
  } catch (error) {
    console.error('Error en GET state del mazo', error);
    return res.status(500).json({
      ok: false,
      error: 'Error obteniendo estado del mazo',
    });
  }
}

app.get('/mazos/:mazoId/state', requireAuth, getMazoStateHandler);
app.get('/mazo/:deckId/state', requireAuth, getMazoStateHandler);

// =====================================================
// JUGADAS
// =====================================================

app.post('/plays', requireAuth, async (req, res) => {
  const userId = req.auth.userId;

  const {
    mazo_id,
    deck_id,
    parent_play_id = null,
    target_user_id = null,
    play_code,
    text = '',
    play_status = 'ACTIVE',
  } = req.body;

  const mazoId = mazo_id || deck_id;

  if (!mazoId) {
    return res.status(400).json({
      ok: false,
      error: 'Falta mazo_id',
    });
  }

  if (!play_code) {
    return res.status(400).json({
      ok: false,
      error: 'Falta play_code',
    });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const mazo = await getMazoByIdForUser(client, mazoId, userId);

    if (!mazo) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        ok: false,
        error: 'Mazo no encontrado o sin acceso',
      });
    }

    const parsed = parseAndValidatePlayCode(play_code);

    if (!parsed.ok) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        ok: false,
        error: `play_code inválido: ${parsed.errors.join(', ')}`,
      });
    }

    if (String(parsed.deckId) !== String(mazoId)) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        ok: false,
        error: 'play_code.deckId no coincide con mazo_id',
      });
    }

    if (parsed.userId && String(parsed.userId) !== String(userId)) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        ok: false,
        error: 'play_code.userId no coincide con el usuario autenticado',
      });
    }

    if (parent_play_id) {
      const parentCheck = await client.query(
        `
          SELECT id, deck_id, card_rank, card_suit, play_code
          FROM plays
          WHERE id = $1
          LIMIT 1
        `,
        [parent_play_id]
      );

      if (!parentCheck.rows.length) {
        await client.query('ROLLBACK');
        return res.status(404).json({
          ok: false,
          error: 'parent_play_id no encontrado',
        });
      }

      if (String(parentCheck.rows[0].deck_id) !== String(mazoId)) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          ok: false,
          error: 'La jugada madre pertenece a otro mazo',
        });
      }

      // Regla mínima conservada del modelo actual:
      // Q♠ debe colgar de una J♠
      if (parsed.rank === 'Q' && parsed.suit === 'SPADE') {
        const parent = parentCheck.rows[0];

        if (
          String(parent.card_rank || '').toUpperCase() !== 'J' ||
          String(parent.card_suit || '').toUpperCase() !== 'SPADE'
        ) {
          await client.query('ROLLBACK');
          return res.status(400).json({
            ok: false,
            error: 'La Q♠ debe tener una J♠ como madre',
          });
        }
      }
    }

    if (target_user_id) {
      const targetCheck = await client.query(
        `
          SELECT id
          FROM users
          WHERE id = $1
          LIMIT 1
        `,
        [target_user_id]
      );

      if (!targetCheck.rows.length) {
        await client.query('ROLLBACK');
        return res.status(404).json({
          ok: false,
          error: 'target_user_id no encontrado',
        });
      }
    }

    const created = await insertInstitutionalPlay(client, {
      mazoId,
      createdByUserId: userId,
      parentPlayId: parent_play_id,
      targetUserId: target_user_id,
      playCode: play_code,
      playText: text,
      playStatus: play_status,
    });

    // Readers iniciales de la jugada recién creada
    await handleReadersOnPlayCreate(client, created.row);

    // Si se envía una Q♠ con destinatario,
    // se incorpora ese usuario al mazo si aún no está
    if (
      parsed.rank === 'Q' &&
      parsed.suit === 'SPADE' &&
      target_user_id
    ) {
      const memberCheck = await client.query(
        `
          SELECT 1
          FROM deck_members
          WHERE deck_id = $1
            AND user_id = $2
          LIMIT 1
        `,
        [mazoId, target_user_id]
      );

      if (!memberCheck.rows.length) {
        await client.query(
          `
            INSERT INTO deck_members (deck_id, user_id)
            VALUES ($1, $2)
          `,
          [mazoId, target_user_id]
        );
      }
    }

    await client.query('COMMIT');

    return res.json({
      ok: true,
      play: created.row,
      parsed: created.parsed,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error en POST /plays', error);

    return res.status(error.statusCode || 500).json({
      ok: false,
      error: error.message || 'Error guardando jugada',
    });
  } finally {
    client.release();
  }
});
app.patch('/plays/:id', requireAuth, async (req, res) => {
  const client = await pool.connect();

  try {
    console.log("PATCH /plays/:id req.body =", req.body);

    const playId = Number(req.params.id);
    const {
      text,
      spadeMode,
      startDate,
      endDate,
      location,
      amount,
      play_status,
      card_suit
    } = req.body || {};

    if (!playId) {
      return res.status(400).json({
        ok: false,
        error: 'playId inválido'
      });
    }

    const existingResult = await client.query(
      `
      SELECT *
      FROM plays
      WHERE id = $1
      LIMIT 1
      `,
      [playId]
    );

    if (!existingResult.rows.length) {
      return res.status(404).json({
        ok: false,
        error: 'Jugada no encontrada'
      });
    }

    const current = existingResult.rows[0];

    // -----------------------------
    // NORMALIZACIÓN DE CAMPOS
    // -----------------------------

    const nextPlayText =
      text !== undefined
        ? (String(text || '').trim() || null)
        : current.play_text;

    const nextSpadeMode =
      spadeMode !== undefined
        ? (String(spadeMode || '').trim().toUpperCase() || null)
        : current.spade_mode;

    const nextStartDate =
      startDate !== undefined ? (startDate || null) : current.start_date;

    const nextEndDate =
      endDate !== undefined ? (endDate || null) : current.end_date;

    const nextLocation =
      location !== undefined
        ? (String(location || '').trim() || null)
        : current.location;

    const nextAmount =
      amount !== undefined
        ? (
          String(amount).trim() === ''
            ? null
            : Number(amount)
        )
        : current.amount;

    if (amount !== undefined && nextAmount !== null && Number.isNaN(nextAmount)) {
      return res.status(400).json({
        ok: false,
        error: 'amount inválido'
      });
    }

    const nextPlayStatus =
      play_status !== undefined
        ? (String(play_status || '').trim().toUpperCase() || null)
        : current.play_status;

    const nextCardSuit =
      card_suit !== undefined
        ? (String(card_suit || '').trim().toUpperCase() || null)
        : current.card_suit;

    // -----------------------------
    // RECONSTRUCCIÓN DE play_code
    // -----------------------------

    let nextPlayCode = current.play_code;

    if (card_suit !== undefined && current.play_code) {
      const parts = String(current.play_code).split('§');

      // asegurar 9 segmentos
      while (parts.length < 9) parts.push('');

      if (parts.length === 9) {
        parts[4] = nextCardSuit; // posición del palo
        nextPlayCode = parts.join('§');
      }
    }

    // -----------------------------
    // UPDATE
    // -----------------------------

    const result = await client.query(
      `
      UPDATE plays
      SET
        play_text = $1,
        spade_mode = $2,
        start_date = $3,
        end_date = $4,
        location = $5,
        amount = $6,
        play_status = $7,
        card_suit = $8,
        play_code = $9,
        updated_at = NOW()
      WHERE id = $10
      RETURNING *
      `,
      [
        nextPlayText,
        nextSpadeMode,
        nextStartDate,
        nextEndDate,
        nextLocation,
        nextAmount,
        nextPlayStatus,
        nextCardSuit,
        nextPlayCode,
        playId
      ]
    );

    return res.json({
      ok: true,
      play: result.rows[0]
    });

  } catch (error) {
    console.error('Error actualizando play:', error);
    return res.status(500).json({
      ok: false,
      error: 'No se pudo actualizar la jugada'
    });
  } finally {
    client.release();
  }
});

app.delete('/plays/:id', requireAuth, async (req, res) => {
  const playId = Number(req.params.id);
  const userId = req.auth.userId;

  if (!Number.isInteger(playId) || playId <= 0) {
    return res.status(400).json({
      ok: false,
      error: 'playId inválido',
    });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const existingResult = await client.query(
      `SELECT *
       FROM plays
       WHERE id = $1
       LIMIT 1`,
      [playId]
    );

    if (!existingResult.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        ok: false,
        error: 'Play no encontrada',
      });
    }

    const existingPlay = existingResult.rows[0];

    const mazo = await getMazoByIdForUser(client, existingPlay.deck_id, userId);

    if (!mazo) {
      await client.query('ROLLBACK');
      return res.status(403).json({
        ok: false,
        error: 'Sin acceso a esta jugada',
      });
    }

    await client.query(
      `DELETE FROM plays
       WHERE id = $1`,
      [playId]
    );

    await client.query('COMMIT');

    return res.json({
      ok: true,
      deletedPlayId: playId,
    });
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('Error haciendo ROLLBACK en DELETE /plays/:id', rollbackError);
    }

    console.error('Error en DELETE /plays/:id', error);

    return res.status(500).json({
      ok: false,
      error: 'Error borrando jugada',
    });
  } finally {
    client.release();
  }
});
app.get('/plays', requireAuth, async (req, res) => {
  try {
    const mazoId = Number(req.query.mazoId || req.query.deckId);

    if (!Number.isInteger(mazoId) || mazoId <= 0) {
      return res.status(400).json({
        ok: false,
        error: 'Falta mazoId válido',
      });
    }

    const result = await pool.query(
      `SELECT
         p.*,
         creator.nickname AS created_by_nickname,
         target.nickname AS target_user_nickname,
         EXISTS (
           SELECT 1
           FROM play_recurrences pr
           WHERE pr.play_id = p.id
         ) AS has_recurrence
       FROM plays p
       LEFT JOIN users creator
         ON creator.id = p.created_by_user_id
       LEFT JOIN users target
         ON target.id = p.target_user_id
       WHERE p.deck_id = $1
       ORDER BY p.created_at DESC, p.id DESC`,
      [mazoId]
    );

    return res.json({
      ok: true,
      plays: result.rows,
    });
  } catch (error) {
    console.error('Error en GET /plays', error);
    return res.status(500).json({
      ok: false,
      error: 'Error obteniendo jugadas',
    });
  }
});

app.get('/mazos/:mazoId/plays', requireAuth, async (req, res) => {
  try {
    const userId = req.auth.userId;
    const mazoId = Number(req.params.mazoId);

    if (!Number.isInteger(mazoId) || mazoId <= 0) {
      return res.status(400).json({
        ok: false,
        error: 'mazoId inválido',
      });
    }

    const result = await pool.query(
      `SELECT
         p.*,
         creator.nickname AS created_by_nickname,
         target.nickname AS target_user_nickname,
         EXISTS (
           SELECT 1
           FROM play_recurrences pr
           WHERE pr.play_id = p.id
         ) AS has_recurrence
       FROM plays p
       INNER JOIN deck_members dm
         ON dm.deck_id = p.deck_id
       LEFT JOIN users creator
         ON creator.id = p.created_by_user_id
       LEFT JOIN users target
         ON target.id = p.target_user_id
       WHERE p.deck_id = $1
         AND dm.user_id = $2
       ORDER BY p.id ASC`,
      [mazoId, userId]
    );

    return res.json({
      ok: true,
      plays: result.rows,
    });
  } catch (error) {
    console.error('Error en GET /mazos/:mazoId/plays', error);
    return res.status(500).json({
      ok: false,
      error: 'Error obteniendo jugadas del mazo',
    });
  }
});

// Alias viejo
app.get('/decks/:deckId/plays', requireAuth, async (req, res) => {
  req.params.mazoId = req.params.deckId;
  return app._router.handle(req, res, () => { });
});

app.get('/plays/pending', requireAuth, async (req, res) => {
  try {
    const userId = req.auth.userId;

    const result = await pool.query(
      `SELECT
         p.id,
         p.deck_id,
         p.parent_play_id,
         p.created_by_user_id,
         p.target_user_id,
         p.card_rank,
         p.card_suit,
         p.play_status,
         p.play_text,
         p.created_at,
         p.updated_at,
         parent.play_text AS parent_play_text,
         author.nickname AS author_nickname,
         deck.name AS deck_name
       FROM plays p
       LEFT JOIN plays parent
         ON parent.id = p.parent_play_id
       LEFT JOIN users author
         ON author.id = p.created_by_user_id
       LEFT JOIN decks deck
         ON deck.id = p.deck_id
       WHERE p.target_user_id = $1
         AND p.card_rank = 'Q'
         AND p.card_suit = 'SPADE'
         AND COALESCE(p.play_status, '') IN ('SENT', 'PENDING')
       ORDER BY p.created_at DESC`,
      [userId]
    );

    return res.json({
      ok: true,
      plays: result.rows,
    });
  } catch (error) {
    console.error('Error en GET /plays/pending', error);
    return res.status(500).json({
      ok: false,
      error: 'Error obteniendo pendientes',
    });
  }
});

// =====================================================
// RECURRENCIAS
// =====================================================

app.post('/plays/:id/recurrence', requireAuth, async (req, res) => {
  console.log("RECURRENCE BODY =", req.body);
  const playId = parseInt(req.params.id, 10);
  const {
    recurrence_type,
    weekdays,
    day_of_month,
    months,
    start_time,
    end_time,
    until_date,
    timezone,
  } = req.body;

  try {
    await pool.query(
      `DELETE FROM play_recurrences WHERE play_id = $1`,
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
        timezone || null,
      ]
    );

    return res.json({ ok: true, recurrence: result.rows[0] });
  } catch (error) {
    console.error('Error en POST /plays/:id/recurrence', error);
    return res.status(500).json({
      ok: false,
      error: 'Error guardando recurrencia',
    });
  }
});

app.get('/plays/:id/recurrence', requireAuth, async (req, res) => {
  const playId = parseInt(req.params.id, 10);

  try {
    const result = await pool.query(
      `SELECT * FROM play_recurrences WHERE play_id = $1`,
      [playId]
    );

    return res.json({
      ok: true,
      recurrence: result.rows[0] || null,
    });
  } catch (error) {
    console.error('Error en GET /plays/:id/recurrence', error);
    return res.status(500).json({ ok: false });
  }
});

// =====================================================
// USUARIOS PARA Q
// =====================================================

app.get('/mazos/:mazoId/q-users', requireAuth, async (req, res) => {
  const userId = req.auth.userId;
  const mazoId = Number(req.params.mazoId);

  if (!Number.isInteger(mazoId) || mazoId <= 0) {
    return res.status(400).json({
      ok: false,
      error: 'mazoId inválido',
    });
  }

  const client = await pool.connect();

  try {
    const isMember = await userIsMazoMember(client, mazoId, userId);

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
      [mazoId]
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

    return res.json({
      ok: true,
      mazoId,
      users,
    });
  } catch (error) {
    console.error('Error en GET /mazos/:mazoId/q-users', error);
    return res.status(500).json({
      ok: false,
      error: 'Error cargando usuarios para Q',
    });
  } finally {
    client.release();
  }
});

// Alias viejo
app.get('/decks/:deckId/q-users', requireAuth, async (req, res) => {
  req.params.mazoId = req.params.deckId;
  return app._router.handle(req, res, () => { });
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
    const activationExpiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);
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
        null,
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

// =====================================================
// START
// =====================================================

console.log('PORT recibido:', PORT);
app.listen(PORT, '0.0.0.0', () => {
  console.log(`CoopTrack server running on port ${PORT}`);
});
