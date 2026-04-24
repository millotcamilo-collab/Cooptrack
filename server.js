const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');

require('dotenv').config();

const getDeckMembershipStatusFromPlays = require('./services/deck-membership');

const { parseAndValidatePlayCode } = require('./engine/playParser');

const app = express();
const PORT = process.env.PORT || 3000;
const SALT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET;

const {
  handleReadersOnPlayCreate,
  expandReadersForQSpadeSend,
  expandReadersForKSend,
} = require('./services/play-readers');

const {
  setPlayReaders,
  addReadersToPlay,
} = require('./services/readers');

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

function normalizeReaders(rawReaders) {
  if (!Array.isArray(rawReaders)) return [];

  return [...new Set(
    rawReaders
      .map((item) => String(item || '').trim())
      .filter(Boolean)
      .map((item) => item.toUpperCase() === 'TODOS' ? 'TODOS' : item)
  )];
}

function buildReadersVisibilityWhereClause({
  readersColumn = 'p.reader_user_ids',
  userIdParamIndex,
}) {
  return `
    (
      ${readersColumn} IS NULL
      OR jsonb_typeof(${readersColumn}) <> 'array'
      OR jsonb_array_length(${readersColumn}) = 0
      OR ${readersColumn} ? 'TODOS'
      OR ${readersColumn} ? $${userIdParamIndex}
      OR ${readersColumn} ? $${userIdParamIndex + 1}
    )
  `;
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

async function getApprovedJHeartsByDeck(client, deckId) {
  const result = await client.query(
    `
      SELECT id
      FROM plays
      WHERE deck_id = $1
        AND card_rank = 'J'
        AND card_suit = 'HEART'
        AND UPPER(COALESCE(play_status, '')) = 'APPROVED'
      ORDER BY id ASC
    `,
    [deckId]
  );

  return result.rows.map((row) => Number(row.id)).filter(Boolean);
}

async function getDeckTitleAHeartPlayId(client, deckId) {
  const result = await client.query(
    `
      SELECT id
      FROM plays
      WHERE deck_id = $1
        AND card_rank = 'A'
        AND card_suit = 'HEART'
      ORDER BY id ASC
      LIMIT 1
    `,
    [deckId]
  );

  return result.rows[0] ? Number(result.rows[0].id) : null;
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

function parsePlayCodeRaw(code) {
  const parts = String(code || '').split('§');

  return {
    deckId: parts[0] || '',
    userId: parts[1] || '',
    date: parts[2] || '',
    rank: parts[3] || '',
    suit: parts[4] || '',
    action: parts[5] || '',
    authorized: parts[6] || '',
    flow: parts[7] || '',
    recipients: parts[8] || '',
  };
}

function parseFlowChunks(flowValue) {
  return String(flowValue || '')
    .split(';')
    .map((item) => item.trim())
    .filter(Boolean);
}

function getSettlementInfoFromPlayCode(playCode) {
  const parsed = parsePlayCodeRaw(playCode);
  const chunks = parseFlowChunks(parsed.flow);

  let settlement = null;

  chunks.forEach((chunk) => {
    if (!chunk.startsWith('settlement:')) return;

    const [head, ...parts] = chunk.split('|');
    const status = String(head.split(':')[1] || '').trim().toUpperCase();

    const data = { status };

    parts.forEach((part) => {
      const idx = part.indexOf(':');
      if (idx === -1) return;

      const key = part.slice(0, idx).trim();
      const value = part.slice(idx + 1).trim();
      data[key] = value;
    });

    settlement = data;
  });

  return settlement;
}

async function appendProfileEntryOnce(client, {
  userId,
  fieldName,
  entry,
  sourcePlayId
}) {
  const allowedFields = {
    awards: true,
    complaints: true,
    moustaches: true,
  };

  if (!allowedFields[fieldName]) {
    throw new Error('Campo de perfil inválido');
  }

  const selectResult = await client.query(
    `SELECT ${fieldName} FROM users WHERE id = $1 LIMIT 1`,
    [userId]
  );

  if (!selectResult.rows.length) {
    throw new Error('Usuario no encontrado para actualizar perfil');
  }

  const currentValue = Array.isArray(selectResult.rows[0][fieldName])
    ? selectResult.rows[0][fieldName]
    : [];

  const alreadyExists = currentValue.some((item) => {
    return Number(item?.source_play_id || 0) === Number(sourcePlayId || 0);
  });

  if (alreadyExists) {
    return false;
  }

  await client.query(
    `
    UPDATE users
    SET ${fieldName} = COALESCE(${fieldName}, '[]'::jsonb) || $2::jsonb,
        updated_at = NOW()
    WHERE id = $1
    `,
    [userId, JSON.stringify([entry])]
  );

  return true;
}

async function applySettlementToUserProfile(client, play, settlementInfo) {
  const targetUserId = Number(play?.target_user_id || 0);
  const sourcePlayId = Number(play?.id || 0);

  if (!targetUserId || !sourcePlayId || !settlementInfo?.status) {
    return false;
  }

  const normalizedStatus = String(settlementInfo.status || '').trim().toUpperCase();

  let fieldName = null;
  let entryType = null;

  if (normalizedStatus === 'PAID') {
    fieldName = 'awards';
    entryType = 'GOOD_PAYER';
  } else if (normalizedStatus === 'COMPLAINED') {
    fieldName = 'complaints';
    entryType = 'COMPLAINT';
  } else if (normalizedStatus === 'MOUSTACHE') {
    fieldName = 'moustaches';
    entryType = 'MOUSTACHE';
  } else {
    return false;
  }

  const entry = {
    source_play_id: sourcePlayId,
    deck_id: Number(play.deck_id || 0),
    granted_by_user_id: Number(play.created_by_user_id || 0),
    type: entryType,
    created_at: new Date().toISOString(),
  };

  return appendProfileEntryOnce(client, {
    userId: targetUserId,
    fieldName,
    entry,
    sourcePlayId,
  });
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
app.get('/users', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         id,
         nickname,
         email,
         phone,
         profile_photo_url,
         user_type,
         created_at
       FROM users
       ORDER BY id DESC`
    );

    return res.json({
      ok: true,
      users: result.rows,
    });
  } catch (error) {
    console.error('Error en GET /users', error);
    return res.status(500).json({
      ok: false,
      error: 'Error cargando usuarios',
    });
  }
});

app.delete('/users/:id', async (req, res) => {
  const userId = Number(req.params.id);

  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({
      ok: false,
      error: 'userId inválido',
    });
  }

  try {
    const result = await pool.query(
      `DELETE FROM users
       WHERE id = $1
       RETURNING id, nickname`,
      [userId]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        ok: false,
        error: 'Usuario no encontrado',
      });
    }

    return res.json({
      ok: true,
      user: result.rows[0],
    });
  } catch (error) {
    console.error('Error en DELETE /users/:id', error);
    return res.status(500).json({
      ok: false,
      error: 'No se pudo borrar el usuario',
    });
  }
});

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
    const rawPassword = String(req.body.password || '');
    const rawPasswordConfirm = String(req.body.passwordConfirm || '');

    const email = normalizeEmail(rawEmail);
    const phone = normalizePhone(rawPhone);

    if (!email && !phone) {
      return res.status(400).json({
        ok: false,
        error: 'Ingresá email o teléfono',
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
        is_admin,
        awards,
        complaints,
        moustaches
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

app.get('/plays/almanaque', requireAuth, async (req, res) => {
  try {
    const userId = req.auth.userId;
    const { from, to } = req.query;

    if (!from || !to) {
      return res.status(400).json({
        ok: false,
        error: 'Faltan parámetros from/to'
      });
    }

    const visibilityWhere = buildReadersVisibilityWhereClause({
      readersColumn: 'p.reader_user_ids',
      userIdParamIndex: 1,
    });

    const result = await pool.query(
      `
      SELECT
        p.*,
        creator.nickname AS created_by_nickname,
        target.nickname AS target_user_nickname,
        d.name AS deck_name,

        CASE
          WHEN UPPER(COALESCE(p.card_suit, '')) = 'SPADE'
               AND UPPER(COALESCE(p.spade_mode, '')) = 'APPOINTMENT'
            THEN p.start_date

          WHEN UPPER(COALESCE(p.card_suit, '')) = 'SPADE'
               AND UPPER(COALESCE(p.spade_mode, '')) = 'DEADLINE'
            THEN p.end_date

          ELSE p.created_at
        END AS calendar_date

      FROM plays p
      LEFT JOIN users creator
        ON creator.id = p.created_by_user_id
      LEFT JOIN users target
        ON target.id = p.target_user_id
      LEFT JOIN decks d
        ON d.id = p.deck_id

      WHERE
        ${visibilityWhere}

        AND (
          CASE
            WHEN UPPER(COALESCE(p.card_suit, '')) = 'SPADE'
                 AND UPPER(COALESCE(p.spade_mode, '')) = 'APPOINTMENT'
              THEN p.start_date::date

            WHEN UPPER(COALESCE(p.card_suit, '')) = 'SPADE'
                 AND UPPER(COALESCE(p.spade_mode, '')) = 'DEADLINE'
              THEN p.end_date::date

            ELSE p.created_at::date
          END
        ) BETWEEN $3 AND $4

      ORDER BY
        CASE
          WHEN UPPER(COALESCE(p.card_suit, '')) = 'SPADE'
               AND UPPER(COALESCE(p.spade_mode, '')) = 'APPOINTMENT'
            THEN p.start_date

          WHEN UPPER(COALESCE(p.card_suit, '')) = 'SPADE'
               AND UPPER(COALESCE(p.spade_mode, '')) = 'DEADLINE'
            THEN p.end_date

          ELSE p.created_at
        END ASC,
        p.id ASC
      `,
      [String(userId), `U:${userId}`, from, to]
    );

    return res.json({
      ok: true,
      plays: result.rows
    });

  } catch (error) {
    console.error('Error en GET /plays/almanaque', error);
    return res.status(500).json({
      ok: false,
      error: 'Error obteniendo almanaque'
    });
  }
});

app.get('/plays/bitacora', requireAuth, async (req, res) => {
  try {
    const userId = req.auth.userId;

    const visibilityWhere = buildReadersVisibilityWhereClause({
      readersColumn: 'p.reader_user_ids',
      userIdParamIndex: 1,
    });

    const result = await pool.query(
      `
      SELECT
        p.*,
        creator.nickname AS created_by_nickname,
        target.nickname AS target_user_nickname,
        d.name AS deck_name
      FROM plays p
      LEFT JOIN users creator
        ON creator.id = p.created_by_user_id
      LEFT JOIN users target
        ON target.id = p.target_user_id
      LEFT JOIN decks d
        ON d.id = p.deck_id
      WHERE ${visibilityWhere}
      ORDER BY p.created_at DESC, p.id DESC
      `,
      [String(userId), `U:${userId}`]
    );

    return res.json({
      ok: true,
      plays: result.rows,
    });
  } catch (error) {
    console.error('Error en GET /plays/bitacora', error);
    return res.status(500).json({
      ok: false,
      error: 'Error obteniendo bitácora',
    });
  }
});

app.get('/plays/my-jotas', requireAuth, async (req, res) => {
  try {
    const userId = req.auth.userId;

    const result = await pool.query(
      `
      SELECT id
      FROM plays
      WHERE created_by_user_id = $1
        AND card_rank = 'J'
      LIMIT 1
      `,
      [userId]
    );

    return res.json({
      ok: true,
      hasJ: result.rows.length > 0
    });

  } catch (error) {
    console.error('Error en /plays/my-jotas', error);
    return res.status(500).json({ ok: false });
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
    joker_type,
  } = req.body;

  const userId = req.auth.userId;

  const normalizedJokerType =
    String(joker_type || 'RED').trim().toUpperCase() === 'BLUE'
      ? 'BLUE'
      : 'RED';

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
      { rank: 'K', suit: 'HEART', action: 'puedeJugar', status: 'ACTIVE' },
      { rank: 'K', suit: 'SPADE', action: 'puedeJugar', status: 'ACTIVE' },
      {
        rank: 'K',
        suit: 'DIAMOND',
        action: 'puedeJugar',
        status: normalizedJokerType === 'BLUE' ? 'ACTIVE' : 'BLOCKED',
      },
      {
        rank: 'K',
        suit: 'CLUB',
        action: 'puedeJugar',
        status: normalizedJokerType === 'BLUE' ? 'ACTIVE' : 'BLOCKED',
      },

      {
        rank: 'Q',
        suit: 'HEART',
        action: 'puedeJugar',
        status: normalizedJokerType === 'BLUE' ? 'ACTIVE' : 'BLOCKED',
      },
      { rank: 'Q', suit: 'SPADE', action: 'puedeJugar', status: 'ACTIVE' },
      {
        rank: 'Q',
        suit: 'DIAMOND',
        action: 'puedeJugar',
        status: normalizedJokerType === 'BLUE' ? 'ACTIVE' : 'BLOCKED',
      },
      {
        rank: 'Q',
        suit: 'CLUB',
        action: 'puedeJugar',
        status: normalizedJokerType === 'BLUE' ? 'ACTIVE' : 'BLOCKED',
      },

      { rank: 'A', suit: 'HEART', action: 'init_ace', status: 'BLOCKED' },
      { rank: 'A', suit: 'SPADE', action: 'init_ace', status: 'BLOCKED' },
      { rank: 'A', suit: 'DIAMOND', action: 'init_ace', status: 'BLOCKED' },
      { rank: 'A', suit: 'CLUB', action: 'init_ace', status: 'BLOCKED' },
    ];

    // 1. ACL (K y Q)
    for (const seed of seedPlays.filter((s) => s.rank === 'K' || s.rank === 'Q')) {
      const playCode = buildPlayCode({
        mazoId: mazo.id,
        userId,
        rank: seed.rank,
        suit: seed.suit,
        action: seed.action,
        authorized: `U:${userId}`,
        flow: 'acl',
        recipients: '',
      });

      const created = await insertInstitutionalPlay(client, {
        mazoId: mazo.id,
        createdByUserId: userId,
        playCode,
        playStatus: seed.status,
      });

      await setPlayReaders(client, created.row.id, [userId]);
    }

    // 2. Joker del mazo
    const jokerAction =
      normalizedJokerType === 'BLUE'
        ? 'init_joker_blue'
        : 'request_joker_blue';

    const jokerStatus =
      normalizedJokerType === 'BLUE'
        ? 'ACTIVE'
        : 'PENDING';

    const jokerPlayCode = buildPlayCode({
      mazoId: mazo.id,
      userId,
      rank: 'JOKER',
      suit: 'BLUE',
      action: jokerAction,
      authorized: `U:${userId}`,
      flow: 'admin',
      recipients: '',
    });

    const createdJoker = await insertInstitutionalPlay(client, {
      mazoId: mazo.id,
      createdByUserId: userId,
      playCode: jokerPlayCode,
      playStatus: jokerStatus,
    });

    await setPlayReaders(client, createdJoker.row.id, [userId]);

    // 3. Ases (propiedad)
    for (const seed of seedPlays.filter((s) => s.rank === 'A')) {
      const playCode = buildPlayCode({
        mazoId: mazo.id,
        userId,
        rank: seed.rank,
        suit: seed.suit,
        action: seed.action,
        authorized: `U:${userId}`,
        flow: 'foundation',
        recipients: `U:${userId}`,
      });

      const created = await insertInstitutionalPlay(client, {
        mazoId: mazo.id,
        createdByUserId: userId,
        playCode,
        playStatus: seed.status,
      });

      await setPlayReaders(client, created.row.id, [userId]);
    }
    await client.query('COMMIT');

    return res.json({
      ok: true,
      mazo,
      seededPlaysCount: seedPlays.length + 1
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
}

async function listMazosHandler(req, res) {
  try {
    const userId = req.auth.userId;
    const wantsArchived =
      String(req.query.archived || '').trim().toLowerCase() === 'true';

    const membershipResult = wantsArchived
      ? await pool.query(
        `
      SELECT
        d.*,
        false AS is_active_member
      FROM decks d
      INNER JOIN ex_deck_members edm
        ON edm.deck_id = d.id
      WHERE edm.user_id = $1
        AND NOT EXISTS (
          SELECT 1
          FROM deck_members dm
          WHERE dm.deck_id = d.id
            AND dm.user_id = $1
        )
      ORDER BY d.id DESC
      `,
        [userId]
      )
      : await pool.query(
        `
      SELECT
        d.*,
        true AS is_active_member
      FROM decks d
      INNER JOIN deck_members dm
        ON dm.deck_id = d.id
      WHERE dm.user_id = $1
      ORDER BY d.id DESC
      `,
        [userId]
      );

    const mazosBase = membershipResult.rows;

    const mazos = await Promise.all(
      mazosBase.map(async (deck) => {
        try {
          const playsResult = await pool.query(
            `
            SELECT
              p.id,
              p.created_by_user_id,
              p.target_user_id,
              p.card_rank,
              p.card_suit,
              p.play_status,
              p.play_code,
              p.created_at,
              p.updated_at
            FROM plays p
            WHERE p.deck_id = $1
            ORDER BY p.id ASC
            `,
            [deck.id]
          );

          const plays = Array.isArray(playsResult.rows) ? playsResult.rows : [];
          const membership = getDeckMembershipStatusFromPlays(plays, userId);

          const hasActiveBlueJoker = plays.some((play) => {
            const rank = String(play.card_rank || '').toUpperCase();
            const suit = String(play.card_suit || '').toUpperCase();
            const status = String(play.play_status || '').toUpperCase();

            return rank === 'JOKER' && suit === 'BLUE' && status === 'ACTIVE';
          });

          const joker_type = hasActiveBlueJoker ? 'BLUE' : 'RED';

          const activeStatuses = ['ACTIVE', 'APPROVED', 'SENT', 'ACKNOWLEDGED'];
          const archivedVisibleStatuses = [
            ...activeStatuses,
            'REJECTED', // Q
            'CANCELLED', // Q
            'QUIT',     // K/A
            'FIRED'     // K/A
          ];

          const corporateCards = plays
            .filter((play) => {
              const playCode = String(play.play_code || '');
              const parts = playCode.split('§');

              const rank = String(play.card_rank || parts[3] || '').toUpperCase();
              const suit = String(play.card_suit || parts[4] || '').toUpperCase();
              const flow = String(parts[7] || '').toLowerCase();
              const status = String(play.play_status || '').toUpperCase();

              if (!['A', 'K'].includes(rank)) return false;
              if (!['HEART', 'SPADE', 'DIAMOND', 'CLUB'].includes(suit)) return false;

              const ownerUserId = Number(
                play.target_user_id || play.created_by_user_id || 0
              );

              if (ownerUserId !== Number(userId)) return false;

              // A reales del libro: foundation, aunque estén BLOCKED
              if (rank === 'A') {
                return flow === 'foundation';
              }

              // K reales: no mostrar las ACL iniciales
              if (rank === 'K') {
                if (flow === 'acl') return false;
                return activeStatuses.includes(status);
              }

              return false;
            })
            .map((play) => {
              const rank = String(play.card_rank || '').toUpperCase();
              const suit = String(play.card_suit || '').toUpperCase();
              return `${rank}_${suit}`;
            });

          let current_user_cards = [...new Set(corporateCards)];

          // Si no tiene A/K reales, mostrar Q♠ / Q♣ como carta visible de referencia
          if (!current_user_cards.length) {
            const fallbackStatuses = wantsArchived
              ? archivedVisibleStatuses
              : activeStatuses;

            const fallbackQCards = plays
              .filter((play) => {
                const rank = String(play.card_rank || '').toUpperCase();
                const suit = String(play.card_suit || '').toUpperCase();
                const status = String(play.play_status || '').toUpperCase();
                const targetUserId = Number(play.target_user_id || 0);

                if (rank !== 'Q') return false;
                if (!['SPADE', 'CLUB'].includes(suit)) return false;
                if (!fallbackStatuses.includes(status)) return false;

                return targetUserId === Number(userId);
              })
              .map((play) => {
                const suit = String(play.card_suit || '').toUpperCase();
                return `Q_${suit}`;
              });

            current_user_cards = [...new Set(fallbackQCards)].slice(0, 1);
          }
          return {
            ...deck,
            joker_type,
            current_user_cards,
            membership_status: membership.status,
            is_active_member: wantsArchived ? false : true
          };
        } catch (error) {
          console.error('Error armando mazo', {
            deckId: deck?.id,
            deckName: deck?.name,
            error
          });
          throw error;
        }
      })
    );

    return res.json({
      ok: true,
      mazos
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

    const visibilityWhere = buildReadersVisibilityWhereClause({
      readersColumn: 'p.reader_user_ids',
      userIdParamIndex: 3,
    });

    const result = await pool.query(
      `
      SELECT
        p.*,
        creator.nickname AS created_by_nickname,
        creator.profile_photo_url AS created_by_profile_photo_url,
        target.nickname AS target_user_nickname,
        target.profile_photo_url AS target_user_profile_photo_url,
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
        AND ${visibilityWhere}
      ORDER BY p.id ASC
      `,
      [mazoId, userId, String(userId), `U:${userId}`]
    );

    const plays = result.rows;

    const corporateCards = plays
      .filter((play) => {
        const rank = String(play.card_rank || '').toUpperCase();
        const suit = String(play.card_suit || '').toUpperCase();
        const flow = String(play.play_code || '').split('§')[7] || '';
        const targetId = Number(play.target_user_id || 0);
        const authorId = Number(play.created_by_user_id || 0);

        const isAce = rank === 'A';
        const isCorporateSuit =
          suit === 'HEART' ||
          suit === 'SPADE' ||
          suit === 'DIAMOND' ||
          suit === 'CLUB';

        const isActive =
          String(play.play_status || '').toUpperCase() !== 'BLOCKED';

        const isFoundation = String(flow).trim().toLowerCase() === 'foundation';

        return (
          isAce &&
          isCorporateSuit &&
          isActive &&
          isFoundation &&
          (targetId === userId || authorId === userId)
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

app.patch('/decks/:id', requireAuth, async (req, res) => {
  const client = await pool.connect();

  try {
    const deckId = Number(req.params.id);
    const { deck_image_url } = req.body || {};

    if (!deckId) {
      return res.status(400).json({
        ok: false,
        error: 'deckId inválido'
      });
    }

    const result = await client.query(
      `
      UPDATE decks
      SET
        deck_image_url = $1,
        updated_at = NOW()
      WHERE id = $2
      RETURNING *
      `,
      [deck_image_url || null, deckId]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        ok: false,
        error: 'Mazo no encontrado'
      });
    }

    return res.json({
      ok: true,
      deck: result.rows[0]
    });

  } catch (error) {
    console.error('Error actualizando deck:', error);
    return res.status(500).json({
      ok: false,
      error: 'No se pudo actualizar el mazo'
    });
  } finally {
    client.release();
  }
});

function parseAclAuthorizedList(value) {
  return String(value || '')
    .split(',')
    .map((item) => String(item || '').trim())
    .filter(Boolean);
}

function stringifyAclAuthorizedList(entries) {
  return [...new Set(
    (Array.isArray(entries) ? entries : [])
      .map((item) => String(item || '').trim())
      .filter(Boolean)
  )].join(',');
}

function rebuildPlayCodeWithAuthorized(playCode, nextAuthorized) {
  const parts = String(playCode || '').split('§');

  while (parts.length < 9) {
    parts.push('');
  }

  parts[6] = stringifyAclAuthorizedList(nextAuthorized);
  return parts.join('§');
}

async function addUserToAclLines(client, deckId, userId) {
  const normalizedUser = `U:${Number(userId || 0)}`;
  if (!Number(deckId || 0) || !Number(userId || 0)) return;

  const result = await client.query(
    `
    SELECT id, play_code
    FROM plays
    WHERE deck_id = $1
      AND UPPER(COALESCE(card_rank, '')) IN ('K', 'Q')
      AND UPPER(COALESCE(card_suit, '')) IN ('HEART', 'SPADE', 'DIAMOND', 'CLUB')
      AND UPPER(COALESCE(play_status, '')) = 'ACTIVE'
    ORDER BY id ASC
    `,
    [deckId]
  );

  for (const row of result.rows) {
    const parts = String(row.play_code || '').split('§');
    const action = String(parts[5] || '').trim();
    const flow = String(parts[7] || '').trim().toLowerCase();

    if (action !== 'puedeJugar') continue;
    if (flow !== 'acl') continue;

    const currentAuthorized = parseAclAuthorizedList(parts[6] || '');
    const nextAuthorized = stringifyAclAuthorizedList([
      ...currentAuthorized,
      normalizedUser
    ]);

    const nextPlayCode = rebuildPlayCodeWithAuthorized(row.play_code, nextAuthorized);

    await client.query(
      `
      UPDATE plays
      SET play_code = $1,
          updated_at = NOW()
      WHERE id = $2
      `,
      [nextPlayCode, row.id]
    );
  }
}

async function removeUserFromAclLines(client, deckId, userId) {
  const normalizedUser = `U:${Number(userId || 0)}`;
  if (!Number(deckId || 0) || !Number(userId || 0)) return;

  const result = await client.query(
    `
    SELECT id, play_code
    FROM plays
    WHERE deck_id = $1
      AND UPPER(COALESCE(card_rank, '')) IN ('K', 'Q')
      AND UPPER(COALESCE(card_suit, '')) IN ('HEART', 'SPADE', 'DIAMOND', 'CLUB')
      AND UPPER(COALESCE(play_status, '')) = 'ACTIVE'
    ORDER BY id ASC
    `,
    [deckId]
  );

  for (const row of result.rows) {
    const parts = String(row.play_code || '').split('§');
    const action = String(parts[5] || '').trim();
    const flow = String(parts[7] || '').trim().toLowerCase();

    if (action !== 'puedeJugar') continue;
    if (flow !== 'acl') continue;

    const currentAuthorized = parseAclAuthorizedList(parts[6] || '');
    const nextAuthorized = currentAuthorized.filter((entry) => entry !== normalizedUser);
    const nextPlayCode = rebuildPlayCodeWithAuthorized(row.play_code, nextAuthorized);

    await client.query(
      `
      UPDATE plays
      SET play_code = $1,
          updated_at = NOW()
      WHERE id = $2
      `,
      [nextPlayCode, row.id]
    );
  }
}

app.patch('/plays/:id', requireAuth, async (req, res) => {
  const client = await pool.connect();

  try {
    const playId = Number(req.params.id);
    const userId = req.auth.userId;

    const {
      text,
      spadeMode,
      startDate,
      endDate,
      location,
      amount,
      play_status,
      card_suit,
      play_code
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
    let parsedPatchedPlayCode = null;

    if (play_code !== undefined && play_code !== null && String(play_code).trim()) {
      const parsed = parseAndValidatePlayCode(String(play_code).trim());

      if (!parsed.ok) {
        return res.status(400).json({
          ok: false,
          error: `play_code inválido: ${parsed.errors.join(', ')}`
        });
      }

      if (String(parsed.deckId) !== String(current.deck_id)) {
        return res.status(400).json({
          ok: false,
          error: 'play_code.deckId no coincide con la jugada'
        });
      }

      if (parsed.userId && String(parsed.userId) !== String(current.created_by_user_id)) {
        return res.status(400).json({
          ok: false,
          error: 'play_code.userId no coincide con el autor original'
        });
      }

      parsedPatchedPlayCode = parsed;
    }

    const wantsAcknowledged =
      String(play_status || '').trim().toUpperCase() === 'ACKNOWLEDGED';

    const isDirectParticipant =
      Number(current.created_by_user_id || 0) === Number(userId) ||
      Number(current.target_user_id || 0) === Number(userId);

    const mazo = await getMazoByIdForUser(client, current.deck_id, userId);

    if (!mazo && !(wantsAcknowledged && isDirectParticipant)) {
      return res.status(403).json({
        ok: false,
        error: 'Sin acceso a esta jugada'
      });
    }

    const currentRank = String(current.card_rank || '').trim().toUpperCase();
    const currentSuit = String(current.card_suit || '').trim().toUpperCase();
    const currentStatus = String(current.play_status || '').trim().toUpperCase();

    // ---------------------------------------------------
    // VALIDACIONES DE TRANSICIÓN DE ESTADO
    // ---------------------------------------------------

    if (play_status === 'SENT') {
      const isQSpade = currentRank === 'Q' && currentSuit === 'SPADE';
      const isKCard = currentRank === 'K';

      if (!isQSpade && !isKCard) {
        return res.status(400).json({
          ok: false,
          error: 'Solo una Q♠ o una K pueden enviarse'
        });
      }

      const creatorUserId = Number(current.created_by_user_id || 0);

      if (!creatorUserId || Number(userId) !== creatorUserId) {
        return res.status(403).json({
          ok: false,
          error: 'Solo el anfitrión puede enviar esta jugada'
        });
      }

      if (
        currentStatus === 'SENT' ||
        currentStatus === 'APPROVED' ||
        currentStatus === 'REJECTED' ||
        currentStatus === 'CANCELLED' ||
        currentStatus === 'QUIT' ||
        currentStatus === 'FIRED' ||
        currentStatus === 'ACKNOWLEDGED'
      ) {
        return res.status(400).json({
          ok: false,
          error: 'Esta jugada ya no puede enviarse'
        });
      }

      if (isKCard && !Number(current.target_user_id || 0)) {
        return res.status(400).json({
          ok: false,
          error: 'La K enviada debe tener target_user_id'
        });
      }
    }

    if (play_status === 'APPROVED') {
      // -----------------------------------------
      // CASO 1: Q♠ = invitación
      // -----------------------------------------
      if (currentRank === 'Q' && currentSuit === 'SPADE') {
        const targetUserId = Number(current.target_user_id || 0);

        if (!targetUserId || Number(userId) !== targetUserId) {
          return res.status(403).json({
            ok: false,
            error: 'Solo el invitado puede aceptar esta Q♠'
          });
        }

        if (currentStatus !== 'SENT' && currentStatus !== 'PENDING') {
          return res.status(400).json({
            ok: false,
            error: 'Solo una Q♠ enviada puede aprobarse'
          });
        }
      }

      // -----------------------------------------
      // CASO 2: J♠ = actividad / cita / deadline
      // -----------------------------------------
      else if (currentRank === 'J' && currentSuit === 'SPADE') {
        const nextSpadeModeToCheck =
          spadeMode !== undefined
            ? String(spadeMode || '').trim().toUpperCase()
            : String(current.spade_mode || '').trim().toUpperCase();

        const startToCheck =
          startDate !== undefined ? startDate || null : current.start_date;

        const endToCheck =
          endDate !== undefined ? endDate || null : current.end_date;

        const locationToCheck =
          location !== undefined
            ? String(location || '').trim()
            : String(current.location || '').trim();

        if (nextSpadeModeToCheck === 'APPOINTMENT') {
          if (!startToCheck || !locationToCheck) {
            return res.status(400).json({
              ok: false,
              error: 'Para aprobar una J♠ cita, fecha inicio y locación son obligatorias'
            });
          }
        } else if (nextSpadeModeToCheck === 'DEADLINE') {
          if (!endToCheck) {
            return res.status(400).json({
              ok: false,
              error: 'Para aprobar una J♠ bomba, fecha límite es obligatoria'
            });
          }
        } else {
          return res.status(400).json({
            ok: false,
            error: 'La J♠ debe tener spade_mode APPOINTMENT o DEADLINE antes de aprobarse'
          });
        }

        if (currentStatus === 'CANCELLED' || currentStatus === 'REJECTED') {
          return res.status(400).json({
            ok: false,
            error: 'Esta J♠ ya no puede aprobarse'
          });
        }
      }

      // -----------------------------------------
      // CASO 3: J♥ / J♣ / J♦
      // -----------------------------------------
      else if (currentRank === 'J' && ['HEART', 'CLUB', 'DIAMOND'].includes(currentSuit)) {
        if (currentStatus === 'CANCELLED' || currentStatus === 'REJECTED') {
          return res.status(400).json({
            ok: false,
            error: 'Esta jugada ya no puede aprobarse'
          });
        }
      }

      // -----------------------------------------
      // CASO 2b: K = incorporación / permiso
      // -----------------------------------------
      else if (currentRank === 'K') {
        const targetUserId = Number(current.target_user_id || 0);

        if (!targetUserId || Number(userId) !== targetUserId) {
          return res.status(403).json({
            ok: false,
            error: 'Solo el destinatario puede aceptar esta K'
          });
        }

        if (currentStatus !== 'SENT' && currentStatus !== 'PENDING') {
          return res.status(400).json({
            ok: false,
            error: 'Solo una K enviada puede aprobarse'
          });
        }
      }

      // -----------------------------------------
      // OTROS CASOS
      // -----------------------------------------
      else {
        return res.status(400).json({
          ok: false,
          error: 'Esta jugada no admite aprobación'
        });
      }
    }

    if (play_status === 'ACKNOWLEDGED') {
      const isQSpadeAck =
        currentRank === 'Q' &&
        currentSuit === 'SPADE';

      const isKAck =
        currentRank === 'K';

      const isAAck =
        currentRank === 'A';

      if (!isQSpadeAck && !isKAck && !isAAck) {
        return res.status(400).json({
          ok: false,
          error: 'Solo una Q♠ o una K pueden marcarse como leídas'
        });
      }

      const creatorUserId = Number(current.created_by_user_id || 0);
      const targetUserId = Number(current.target_user_id || 0);

      const canAcknowledge =
        (isQSpadeAck && creatorUserId && Number(userId) === creatorUserId) ||
        (isKAck && (
          (creatorUserId && Number(userId) === creatorUserId) ||
          (targetUserId && Number(userId) === targetUserId)
        ));

      if (!canAcknowledge) {
        return res.status(403).json({
          ok: false,
          error: 'No podés marcar esta notificación como leída'
        });
      }

      if (isQSpadeAck) {
        if (
          currentStatus !== 'APPROVED' &&
          currentStatus !== 'REJECTED' &&
          currentStatus !== 'CANCELLED'
        ) {
          return res.status(400).json({
            ok: false,
            error: 'Solo una Q♠ finalizada puede marcarse como leída'
          });
        }
      }

      if (isKAck || isAAck) {
        if (
          currentStatus !== 'APPROVED' &&
          currentStatus !== 'REJECTED' &&
          currentStatus !== 'QUIT' &&
          currentStatus !== 'FIRED'
        ) {
          return res.status(400).json({
            ok: false,
            error: 'Solo una K o A finalizada puede marcarse como leída'
          });
        }

        // 👇 NO tocar play_status
        return res.json({
          ok: true,
          acknowledged: true,
          play: current
        });
      }
    }


    // ---------------------------------------------------
    // NORMALIZACIÓN DE CAMPOS
    // ---------------------------------------------------

    const nextText =
      text !== undefined ? String(text || '').trim() : current.play_text;

    const nextStatus =
      play_status !== undefined
        ? String(play_status || '').trim().toUpperCase()
        : current.play_status;

    const nextSuit =
      card_suit !== undefined
        ? String(card_suit || '').trim().toUpperCase()
        : current.card_suit;

    const nextStartDate =
      startDate !== undefined ? startDate || null : current.start_date;

    const nextEndDate =
      endDate !== undefined ? endDate || null : current.end_date;

    const nextLocation =
      location !== undefined
        ? String(location || '').trim() || null
        : current.location;

    const nextAmount =
      amount !== undefined && amount !== null && amount !== ''
        ? Number(amount)
        : amount === ''
          ? null
          : current.amount;

    const nextSpadeMode =
      spadeMode !== undefined
        ? String(spadeMode || '').trim() || null
        : current.spade_mode;

    const nextPlayCode =
      play_code !== undefined && play_code !== null && String(play_code).trim()
        ? String(play_code).trim()
        : current.play_code;

    await client.query('BEGIN');

    const updateResult = await client.query(
      `
  UPDATE plays
  SET
    play_text = $1,
    play_status = $2,
    card_suit = $3,
    start_date = $4,
    end_date = $5,
    location = $6,
    amount = $7,
    spade_mode = $8,
    play_code = $9,
    updated_at = NOW()
  WHERE id = $10
  RETURNING *
  `,
      [
        nextText || null,
        nextStatus || null,
        nextSuit || null,
        nextStartDate,
        nextEndDate,
        nextLocation,
        nextAmount,
        nextSpadeMode,
        nextPlayCode,
        playId
      ]
    );

    const updatedPlay = updateResult.rows[0];

    const previousSettlement = getSettlementInfoFromPlayCode(current.play_code);
    const nextSettlement = getSettlementInfoFromPlayCode(updatedPlay.play_code);

    const settlementChangedNow =
      currentRank === 'Q' &&
      currentSuit === 'SPADE' &&
      nextSettlement &&
      ['PAID', 'COMPLAINED'].includes(nextSettlement.status) &&
      (
        !previousSettlement ||
        previousSettlement.status !== nextSettlement.status
      );

    // ---------------------------------------------------
    // EFECTOS POSTERIORES AL UPDATE
    // ---------------------------------------------------

    if (settlementChangedNow) {
      await applySettlementToUserProfile(client, updatedPlay, nextSettlement);
    }

    const isSendingQSpadeNow =
      currentRank === 'Q' &&
      currentSuit === 'SPADE' &&
      currentStatus !== 'SENT' &&
      nextStatus === 'SENT';

    const isSendingKNow =
      currentRank === 'K' &&
      currentStatus !== 'SENT' &&
      nextStatus === 'SENT';

    if (isSendingKNow) {
      const invitedUserId = Number(updatedPlay.target_user_id || 0);

      if (!invitedUserId) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          ok: false,
          error: 'La K enviada debe tener target_user_id'
        });
      }

      await expandReadersForKSend(client, updatedPlay);

      await client.query(
        `
        INSERT INTO deck_members (deck_id, user_id)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING
        `,
        [updatedPlay.deck_id, invitedUserId]
      );

      await client.query(
        `
  DELETE FROM ex_deck_members
  WHERE deck_id = $1
    AND user_id = $2
  `,
        [updatedPlay.deck_id, invitedUserId]
      );

    }

    if (isSendingQSpadeNow) {
      const invitedUserId = Number(updatedPlay.target_user_id || 0);

      if (!invitedUserId) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          ok: false,
          error: 'La Q♠ enviada debe tener target_user_id'
        });
      }

      await expandReadersForQSpadeSend(client, updatedPlay);
    }

    const isApprovingQSpadeNow =
      currentRank === 'Q' &&
      currentSuit === 'SPADE' &&
      currentStatus !== 'APPROVED' &&
      nextStatus === 'APPROVED';

    if (isApprovingQSpadeNow) {
      const invitedUserId = Number(updatedPlay.target_user_id || 0);
      const deckId = Number(updatedPlay.deck_id || 0);

      if (!invitedUserId || !deckId) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          ok: false,
          error: 'La Q♠ aprobada debe tener target_user_id y deck_id válidos'
        });
      }

      await client.query(
        `
        INSERT INTO deck_members (deck_id, user_id)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING
        `,
        [deckId, invitedUserId]
      );

      await client.query(
        `
  DELETE FROM ex_deck_members
  WHERE deck_id = $1
    AND user_id = $2
  `,
        [deckId, invitedUserId]
      );
    }

    const isApprovingKNow =
      currentRank === 'K' &&
      currentStatus !== 'APPROVED' &&
      nextStatus === 'APPROVED';

    if (isApprovingKNow) {
      const invitedUserId = Number(updatedPlay.target_user_id || 0);
      const deckId = Number(updatedPlay.deck_id || 0);

      if (!invitedUserId || !deckId) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          ok: false,
          error: 'La K aprobada debe tener target_user_id y deck_id válidos'
        });
      }

      await client.query(
        `
    INSERT INTO deck_members (deck_id, user_id)
    VALUES ($1, $2)
    ON CONFLICT DO NOTHING
    `,
        [deckId, invitedUserId]
      );

      await client.query(
        `
    DELETE FROM ex_deck_members
    WHERE deck_id = $1
      AND user_id = $2
    `,
        [deckId, invitedUserId]
      );

      await expandReadersForKSend(client, updatedPlay);
      await addUserToAclLines(client, deckId, invitedUserId);
    }

    const isRejectingQSpadeNow =
      currentRank === 'Q' &&
      currentSuit === 'SPADE' &&
      currentStatus !== 'REJECTED' &&
      nextStatus === 'REJECTED';

    if (isRejectingQSpadeNow) {
      const invitedUserId = Number(updatedPlay.target_user_id || 0);
      const deckId = Number(updatedPlay.deck_id || 0);

      if (!invitedUserId || !deckId) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          ok: false,
          error: 'La Q♠ rechazada debe tener target_user_id y deck_id válidos'
        });
      }

      const tieCheck = await client.query(
        `
    SELECT 1
    FROM plays
    WHERE deck_id = $1
      AND target_user_id = $2
      AND id <> $3
      AND UPPER(COALESCE(play_status, '')) NOT IN ('REJECTED', 'CANCELLED', 'BLOCKED','QUIT', 'FIRED')
      AND UPPER(COALESCE(card_rank, '')) IN ('A', 'K', 'Q')
    LIMIT 1
    `,
        [deckId, invitedUserId, updatedPlay.id]
      );

      const hasAnotherTie = tieCheck.rows.length > 0;

      if (!hasAnotherTie) {
        await client.query(
          `
      DELETE FROM deck_members
      WHERE deck_id = $1
        AND user_id = $2
      `,
          [deckId, invitedUserId]
        );

        await client.query(
          `
      INSERT INTO ex_deck_members (
        deck_id,
        user_id,
        reason,
        source_play_id,
        created_at
      )
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT DO NOTHING
      `,
          [deckId, invitedUserId, 'Q_SPADE_REJECTED', updatedPlay.id]
        );
      }
    }

    const isQuittingKNow =
      currentRank === 'K' &&
      currentStatus !== 'QUIT' &&
      nextStatus === 'QUIT';

    if (isQuittingKNow) {
      const invitedUserId = Number(updatedPlay.target_user_id || 0);
      const deckId = Number(updatedPlay.deck_id || 0);

      if (!invitedUserId || !deckId) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          ok: false,
          error: 'La K renunciada debe tener target_user_id y deck_id válidos'
        });
      }

      await removeUserFromAclLines(client, deckId, invitedUserId);

      const tieCheck = await client.query(
        `
    SELECT 1
    FROM plays
    WHERE deck_id = $1
      AND target_user_id = $2
      AND id <> $3
      AND UPPER(COALESCE(play_status, '')) NOT IN ('REJECTED', 'CANCELLED', 'QUIT', 'FIRED', 'BLOCKED')
      AND UPPER(COALESCE(card_rank, '')) IN ('A', 'K', 'Q')
    LIMIT 1
    `,
        [deckId, invitedUserId, updatedPlay.id]
      );

      const hasAnotherTie = tieCheck.rows.length > 0;

      if (!hasAnotherTie) {
        await client.query(
          `
      DELETE FROM deck_members
      WHERE deck_id = $1
        AND user_id = $2
      `,
          [deckId, invitedUserId]
        );

        await client.query(
          `
      INSERT INTO ex_deck_members (
        deck_id,
        user_id,
        reason,
        source_play_id,
        created_at
      )
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT DO NOTHING
      `,
          [deckId, invitedUserId, 'K_QUIT', updatedPlay.id]
        );
      }
    }

    const isFiringKNow =
      currentRank === 'K' &&
      currentStatus !== 'FIRED' &&
      nextStatus === 'FIRED';

    if (isFiringKNow) {
      const invitedUserId = Number(updatedPlay.target_user_id || 0);
      const deckId = Number(updatedPlay.deck_id || 0);

      if (!invitedUserId || !deckId) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          ok: false,
          error: 'La K despedida debe tener target_user_id y deck_id válidos'
        });
      }

      await removeUserFromAclLines(client, deckId, invitedUserId);

      const tieCheck = await client.query(
        `
    SELECT 1
    FROM plays
    WHERE deck_id = $1
      AND target_user_id = $2
      AND id <> $3
      AND UPPER(COALESCE(play_status, '')) NOT IN ('REJECTED', 'CANCELLED', 'QUIT', 'FIRED', 'BLOCKED')
      AND UPPER(COALESCE(card_rank, '')) IN ('A', 'K', 'Q')
    LIMIT 1
    `,
        [deckId, invitedUserId, updatedPlay.id]
      );

      const hasAnotherTie = tieCheck.rows.length > 0;

      if (!hasAnotherTie) {
        await client.query(
          `
      DELETE FROM deck_members
      WHERE deck_id = $1
        AND user_id = $2
      `,
          [deckId, invitedUserId]
        );

        await client.query(
          `
      INSERT INTO ex_deck_members (
        deck_id,
        user_id,
        reason,
        source_play_id,
        created_at
      )
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT DO NOTHING
      `,
          [deckId, invitedUserId, 'K_FIRED', updatedPlay.id]
        );
      }
    }

    await client.query('COMMIT');

    return res.json({
      ok: true,
      play: updatedPlay
    });
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('Error haciendo ROLLBACK en PATCH /plays/:id', rollbackError);
    }

    console.error('Error en PATCH /plays/:id', error);

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
    const userId = req.auth.userId;
    const mazoId = Number(req.query.mazoId || req.query.deckId);

    if (!Number.isInteger(mazoId) || mazoId <= 0) {
      return res.status(400).json({
        ok: false,
        error: 'Falta mazoId válido',
      });
    }

    const visibilityWhere = buildReadersVisibilityWhereClause({
      readersColumn: 'p.reader_user_ids',
      userIdParamIndex: 2,
    });

    const result = await pool.query(
      `
      SELECT
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
         AND ${visibilityWhere}
       ORDER BY p.created_at DESC, p.id DESC
      `,
      [mazoId, String(userId), `U:${userId}`]
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

    const visibilityWhere = buildReadersVisibilityWhereClause({
      readersColumn: 'p.reader_user_ids',
      userIdParamIndex: 3,
    });

    const result = await pool.query(
      `
      SELECT
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
         AND ${visibilityWhere}
       ORDER BY p.id ASC
      `,
      [mazoId, userId, String(userId), `U:${userId}`]
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
      `
      SELECT
        p.id,
        p.deck_id,
        p.parent_play_id,
        p.created_by_user_id,
        p.target_user_id,
        p.card_rank,
        p.card_suit,
        p.play_status,
        p.play_text,
        p.play_code,
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
      WHERE

        (
          p.card_rank = 'Q'
          AND p.card_suit = 'SPADE'
          AND (
            (
              p.target_user_id = $1
              AND COALESCE(p.play_status, '') IN ('SENT', 'PENDING')
            )
            OR
            (
              p.created_by_user_id = $1
              AND COALESCE(p.play_status, '') IN ('APPROVED', 'REJECTED', 'CANCELLED')
            )
            OR
            (
              p.target_user_id = $1
              AND COALESCE(p.play_status, '') = 'APPROVED'
              AND (
                p.play_code LIKE '%settlement:PAID%'
                OR p.play_code LIKE '%settlement:COMPLAINED%'
              )
            )
          )
        )

        OR

        (
          p.card_rank = 'K'
          AND p.target_user_id = $1
          AND COALESCE(p.play_status, '') IN (
            'SENT',
            'PENDING',
            'FIRED',
            'QUIT'
          )
        )

        OR

        (
          p.card_rank = 'K'
          AND p.created_by_user_id = $1
          AND COALESCE(p.play_status, '') IN (
            'APPROVED',
            'REJECTED',
            'QUIT'
          )
        )

      ORDER BY p.created_at DESC
      `,
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

app.get('/plays/:id', requireAuth, async (req, res) => {
  try {
    const playId = Number(req.params.id);
    const userId = req.auth.userId;

    if (!Number.isInteger(playId) || playId <= 0) {
      return res.status(400).json({
        ok: false,
        error: 'playId inválido',
      });
    }

    const visibilityWhere = buildReadersVisibilityWhereClause({
      readersColumn: 'p.reader_user_ids',
      userIdParamIndex: 2,
    });

    const result = await pool.query(
      `
      SELECT
        p.*,
        creator.nickname AS created_by_nickname,
        creator.profile_photo_url AS created_by_profile_photo_url,
        target.nickname AS target_user_nickname,
        target.profile_photo_url AS target_user_profile_photo_url,
        d.name AS deck_name,
        d.deck_image_url,
        d.currency_symbol,
        d.currency_name,
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
      LEFT JOIN decks d
        ON d.id = p.deck_id
      WHERE p.id = $1
        AND ${visibilityWhere}
      LIMIT 1
      `,
      [playId, String(userId), `U:${userId}`]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        ok: false,
        error: 'Jugada no encontrada',
      });
    }

    return res.json({
      ok: true,
      play: result.rows[0],
    });
  } catch (error) {
    console.error('Error en GET /plays/:id', error);
    return res.status(500).json({
      ok: false,
      error: 'Error obteniendo jugada',
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

app.get('/admin/joker-blue-requests', requireAuth, async (req, res) => {
  try {
    const userId = req.auth.userId;

    const adminResult = await pool.query(
      `
      SELECT is_admin
      FROM users
      WHERE id = $1
      LIMIT 1
      `,
      [userId]
    );

    if (!adminResult.rows.length || !adminResult.rows[0].is_admin) {
      return res.status(403).json({
        ok: false,
        error: 'Acceso solo para administradores'
      });
    }

    const result = await pool.query(
      `
      SELECT
        p.id,
        p.deck_id,
        p.created_by_user_id,
        p.target_user_id,
        p.play_status,
        p.play_text,
        p.play_code,
        p.created_at,
        p.updated_at,
        creator.nickname AS creator_nickname,
        creator.profile_photo_url AS creator_profile_photo_url,
        d.name AS deck_name
      FROM plays p
      LEFT JOIN users creator
        ON creator.id = p.created_by_user_id
      LEFT JOIN decks d
        ON d.id = p.deck_id
      WHERE UPPER(COALESCE(p.card_rank, '')) = 'JOKER'
        AND UPPER(COALESCE(p.card_suit, '')) = 'BLUE'
        AND UPPER(COALESCE(p.play_status, '')) = 'PENDING'
      ORDER BY p.created_at DESC, p.id DESC
      `
    );

    return res.json({
      ok: true,
      requests: result.rows
    });
  } catch (error) {
    console.error('Error en GET /admin/joker-blue-requests', error);
    return res.status(500).json({
      ok: false,
      error: 'Error cargando solicitudes Joker azul'
    });
  }
});

app.get("/decks/:deckId/archive-state", requireAuth, async (req, res) => {
  const client = await pool.connect();

  try {
    const userId = req.auth.userId;
    const deckId = Number(req.params.deckId);

    if (!deckId) {
      return res.status(400).json({ ok: false });
    }

    // 🔐 verificar que sea ex miembro
    const membership = await client.query(
      `
      SELECT 1
      FROM ex_deck_members
      WHERE deck_id = $1 AND user_id = $2
      LIMIT 1
      `,
      [deckId, userId]
    );

    if (!membership.rows.length) {
      return res.status(403).json({ ok: false });
    }

    // 📜 traer jugadas
    const playsResult = await client.query(
      `
      SELECT *
      FROM plays
      WHERE deck_id = $1
      ORDER BY id ASC
      `,
      [deckId]
    );

    return res.json({
      ok: true,
      plays: playsResult.rows
    });

  } catch (error) {
    console.error("archive-state error", error);
    return res.status(500).json({ ok: false });
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
