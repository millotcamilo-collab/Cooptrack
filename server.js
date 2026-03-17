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
  ssl: {
    rejectUnauthorized: false,
  },
});

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

function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        ok: false,
        error: 'Token requerido',
      });
    }

    const token = authHeader.slice(7);
    const decoded = jwt.verify(token, JWT_SECRET);

    req.auth = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      ok: false,
      error: 'Token inválido o expirado',
    });
  }
}

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
    const {
      nickname,
      email,
      phone,
      password,
      password_hash,
      profile_photo_url,
      birth_date,
    } = req.body;

    const rawPassword = password || password_hash;

    if (!nickname) {
      return res.status(400).json({
        ok: false,
        error: 'nickname is required',
      });
    }

    if (!email && !phone) {
      return res.status(400).json({
        ok: false,
        error: 'email or phone is required',
      });
    }

    if (!rawPassword) {
      return res.status(400).json({
        ok: false,
        error: 'password is required',
      });
    }

    if (isProvided(birth_date) && !isValidDateString(birth_date)) {
      return res.status(400).json({
        ok: false,
        error: 'birth_date inválida',
      });
    }

    const hashedPassword = await bcrypt.hash(rawPassword, SALT_ROUNDS);

    const query = `
      INSERT INTO users
      (
        nickname,
        email,
        phone,
        password_hash,
        profile_photo_url,
        birth_date
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING
        id,
        nickname,
        email,
        phone,
        profile_photo_url,
        birth_date,
        user_type,
        created_at,
        updated_at
    `;

    const values = [
      nickname,
      email || null,
      phone || null,
      hashedPassword,
      profile_photo_url || null,
      normalizeDate(birth_date),
    ];

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
      SELECT id, nickname, email, phone, profile_photo_url, birth_date, user_type, created_at
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

// Borrar usuario
app.delete('/users/:id', async (req, res) => {
  const { id } = req.params;
  const userId = Number(id);

  if (Number.isNaN(userId)) {
    return res.status(400).json({
      ok: false,
      error: 'Invalid user id',
    });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const userCheck = await client.query(
      `
      SELECT id, nickname, email, phone
      FROM users
      WHERE id = $1
      `,
      [userId]
    );

    if (userCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        ok: false,
        error: 'User not found',
      });
    }

    const decksResult = await client.query(
      `
      SELECT id
      FROM decks
      WHERE created_by = $1
      `,
      [userId]
    );

    const deckIds = decksResult.rows.map((row) => row.id);

    await client.query(
      `
      DELETE FROM records
      WHERE user_id = $1
      `,
      [userId]
    );

    await client.query(
      `
      DELETE FROM deck_members
      WHERE user_id = $1
      `,
      [userId]
    );

    if (deckIds.length > 0) {
      await client.query(
        `
        DELETE FROM records
        WHERE deck_id = ANY($1::int[])
        `,
        [deckIds]
      );

      await client.query(
        `
        DELETE FROM deck_members
        WHERE deck_id = ANY($1::int[])
        `,
        [deckIds]
      );

      await client.query(
        `
        DELETE FROM decks
        WHERE id = ANY($1::int[])
        `,
        [deckIds]
      );
    }

    const deleteResult = await client.query(
      `
      DELETE FROM users
      WHERE id = $1
      RETURNING id, nickname, email, phone
      `,
      [userId]
    );

    await client.query('COMMIT');

    res.json({
      ok: true,
      message: 'User deleted',
      user: deleteResult.rows[0],
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('DELETE /users/:id error:', error);

    res.status(500).json({
      ok: false,
      error: 'Could not delete user',
    });
  } finally {
    client.release();
  }
});

// Login
app.post('/login', async (req, res) => {
  try {
    const { login, password } = req.body;

    if (!login) {
      return res.status(400).json({
        ok: false,
        error: 'login is required',
      });
    }

    if (!password) {
      return res.status(400).json({
        ok: false,
        error: 'password is required',
      });
    }

    const result = await pool.query(
      `
      SELECT
        id,
        nickname,
        email,
        phone,
        password_hash,
        profile_photo_url,
        birth_date,
        user_type,
        created_at,
        updated_at
      FROM users
      WHERE email = $1 OR phone = $1
      LIMIT 1
      `,
      [login]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        ok: false,
        error: 'User not found',
      });
    }

    const user = result.rows[0];
    const passwordMatches = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatches) {
      return res.status(401).json({
        ok: false,
        error: 'Invalid password',
      });
    }

    const token = jwt.sign(
      {
        userId: user.id,
        nickname: user.nickname,
        userType: user.user_type,
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
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
        created_at: user.created_at,
        updated_at: user.updated_at,
      },
    });
  } catch (error) {
    console.error('POST /login error:', error);

    res.status(500).json({
      ok: false,
      error: 'Could not login',
    });
  }
});

// Perfil del usuario autenticado
app.get('/me', requireAuth, async (req, res) => {
  try {
    const userId = req.auth.userId;

    const result = await pool.query(
      `
      SELECT
        id,
        nickname,
        email,
        phone,
        profile_photo_url,
        birth_date,
        user_type,
        created_at,
        updated_at
      FROM users
      WHERE id = $1
      LIMIT 1
      `,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        error: 'User not found',
      });
    }

    res.json({
      ok: true,
      user: result.rows[0],
    });
  } catch (error) {
    console.error('GET /me error:', error);

    res.status(500).json({
      ok: false,
      error: 'Could not fetch profile',
    });
  }
});

// Editar perfil del usuario autenticado
app.put('/me', requireAuth, async (req, res) => {
  try {
    const userId = req.auth.userId;
    const {
      nickname,
      email,
      phone,
      profile_photo_url,
      birth_date,
    } = req.body;

    if (!isNonEmptyString(nickname)) {
      return res.status(400).json({
        ok: false,
        error: 'nickname es obligatorio',
      });
    }

    if (!isNonEmptyString(email)) {
      return res.status(400).json({
        ok: false,
        error: 'email es obligatorio',
      });
    }

    if (isProvided(birth_date) && !isValidDateString(birth_date)) {
      return res.status(400).json({
        ok: false,
        error: 'birth_date inválida',
      });
    }

    const result = await pool.query(
      `
      UPDATE users
      SET
        nickname = $1,
        email = $2,
        phone = $3,
        profile_photo_url = $4,
        birth_date = $5,
        updated_at = NOW()
      WHERE id = $6
      RETURNING
        id,
        nickname,
        email,
        phone,
        profile_photo_url,
        birth_date,
        user_type,
        created_at,
        updated_at
      `,
      [
        normalizeString(nickname),
        normalizeString(email),
        normalizeString(phone),
        normalizeString(profile_photo_url),
        normalizeDate(birth_date),
        userId,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        error: 'User not found',
      });
    }

    res.json({
      ok: true,
      message: 'Perfil actualizado',
      user: result.rows[0],
    });
  } catch (error) {
    console.error('PUT /me error:', error);

    if (error.code === '23505') {
      return res.status(409).json({
        ok: false,
        error: 'email o phone ya existe',
      });
    }

    res.status(500).json({
      ok: false,
      error: 'Could not update profile',
    });
  }
});

// Cambiar password del usuario autenticado
app.put('/me/password', requireAuth, async (req, res) => {
  try {
    const userId = req.auth.userId;
    const { current_password, new_password } = req.body;

    if (!current_password) {
      return res.status(400).json({
        ok: false,
        error: 'current_password es obligatoria',
      });
    }

    if (!new_password) {
      return res.status(400).json({
        ok: false,
        error: 'new_password es obligatoria',
      });
    }

    if (String(new_password).length < 4) {
      return res.status(400).json({
        ok: false,
        error: 'La nueva password es demasiado corta',
      });
    }

    const userResult = await pool.query(
      `
      SELECT id, password_hash
      FROM users
      WHERE id = $1
      LIMIT 1
      `,
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        error: 'User not found',
      });
    }

    const user = userResult.rows[0];
    const passwordMatches = await bcrypt.compare(current_password, user.password_hash);

    if (!passwordMatches) {
      return res.status(401).json({
        ok: false,
        error: 'La password actual es incorrecta',
      });
    }

    const newPasswordHash = await bcrypt.hash(new_password, SALT_ROUNDS);

    await pool.query(
      `
      UPDATE users
      SET
        password_hash = $1,
        updated_at = NOW()
      WHERE id = $2
      `,
      [newPasswordHash, userId]
    );

    res.json({
      ok: true,
      message: 'Password actualizada',
    });
  } catch (error) {
    console.error('PUT /me/password error:', error);

    res.status(500).json({
      ok: false,
      error: 'Could not update password',
    });
  }
});

// Crear deck
app.post('/decks', requireAuth, async (req, res) => {
  const { name, description, is_private } = req.body;
  const created_by = req.auth.userId;

  if (!name) {
    return res.status(400).json({
      ok: false,
      message: 'name es obligatorio',
    });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const deckResult = await client.query(
      `
      INSERT INTO decks (name, description, created_by, is_private, updated_at)
      VALUES ($1, $2, $3, $4, NOW())
      RETURNING *;
      `,
      [name, description || null, created_by, is_private ?? false]
    );

    const deck = deckResult.rows[0];

    await client.query(
      `
      INSERT INTO deck_members (deck_id, user_id)
      VALUES ($1, $2);
      `,
      [deck.id, created_by]
    );

    await client.query('COMMIT');

    res.status(201).json({
      ok: true,
      message: 'Deck creado correctamente',
      deck,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al crear deck:', error);

    res.status(500).json({
      ok: false,
      message: 'Error al crear deck',
    });
  } finally {
    client.release();
  }
});

// Listar decks
app.get('/decks', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        d.id,
        d.name,
        d.description,
        d.created_by,
        d.is_private,
        d.created_at,
        d.updated_at,
        u.nickname AS creator_nickname
      FROM decks d
      JOIN users u ON d.created_by = u.id
      ORDER BY d.created_at DESC;
    `);

    res.json({
      ok: true,
      decks: result.rows,
    });
  } catch (error) {
    console.error('Error al listar decks:', error);

    res.status(500).json({
      ok: false,
      message: 'Error al listar decks',
    });
  }
});

// Obtener deck por id
app.get('/decks/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `
      SELECT
        d.*,
        u.nickname AS creator_nickname
      FROM decks d
      JOIN users u ON d.created_by = u.id
      WHERE d.id = $1;
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        message: 'Deck no encontrado',
      });
    }

    res.json({
      ok: true,
      deck: result.rows[0],
    });
  } catch (error) {
    console.error('Error al obtener deck:', error);

    res.status(500).json({
      ok: false,
      message: 'Error al obtener deck',
    });
  }
});
// Obtener estado de gobernanza de un deck
app.get('/decks/:id/governance', async (req, res) => {
  const { id } = req.params;
  const deckId = Number(id);

  if (Number.isNaN(deckId)) {
    return res.status(400).json({
      ok: false,
      error: 'Invalid deck id',
    });
  }

  try {
    const deckResult = await pool.query(
      `
      SELECT id, name, created_by
      FROM decks
      WHERE id = $1
      LIMIT 1
      `,
      [deckId]
    );

    if (deckResult.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        error: 'Deck not found',
      });
    }

    const acesResult = await pool.query(
      `
      SELECT
        da.ace_type,
        da.user_id,
        u.nickname
      FROM deck_aces da
      JOIN users u ON u.id = da.user_id
      WHERE da.deck_id = $1
      ORDER BY da.ace_type
      `,
      [deckId]
    );

    const kingsResult = await pool.query(
      `
      SELECT
        dk.king_type,
        dk.user_id,
        u.nickname,
        dk.granted_by_user_id,
        gu.nickname AS granted_by_nickname,
        dk.granted_at
      FROM deck_kings dk
      JOIN users u ON u.id = dk.user_id
      LEFT JOIN users gu ON gu.id = dk.granted_by_user_id
      WHERE dk.deck_id = $1
        AND dk.revoked_at IS NULL
      ORDER BY dk.king_type, dk.user_id
      `,
      [deckId]
    );

    const stateResult = await pool.query(
      `
      SELECT
        deck_id,
        is_blocked,
        blocked_reason,
        blocker_transaction_id,
        has_red_joker,
        updated_at
      FROM deck_governance_state
      WHERE deck_id = $1
      LIMIT 1
      `,
      [deckId]
    );

    const aces = acesResult.rows;
    const kings = kingsResult.rows;
    const state = stateResult.rows[0] || {
      deck_id: deckId,
      is_blocked: false,
      blocked_reason: null,
      blocker_transaction_id: null,
      has_red_joker: false,
      updated_at: null,
    };

    const heartHolder = aces.find((ace) => ace.ace_type === 'A_HEART') || null;

    const aceCountByUser = {};
    for (const ace of aces) {
      aceCountByUser[ace.user_id] = (aceCountByUser[ace.user_id] || 0) + 1;
    }

    const computedRedJokerHolder = Object.entries(aceCountByUser).find(
      ([, count]) => Number(count) === 4
    );

    const hasRedJoker = Boolean(computedRedJokerHolder);
    const redJokerUserId = computedRedJokerHolder
      ? Number(computedRedJokerHolder[0])
      : null;

    const redJokerHolder =
      hasRedJoker
        ? aces.find((ace) => Number(ace.user_id) === redJokerUserId) || null
        : null;

    res.json({
      ok: true,
      deck: deckResult.rows[0],
      governance: {
        deck_id: deckId,
        is_blocked: state.is_blocked,
        blocked_reason: state.blocked_reason,
        blocker_transaction_id: state.blocker_transaction_id,
        has_red_joker: hasRedJoker,
        red_joker_user_id: redJokerUserId,
        red_joker_nickname: redJokerHolder ? redJokerHolder.nickname : null,
        heart_holder_user_id: heartHolder ? heartHolder.user_id : null,
        heart_holder_nickname: heartHolder ? heartHolder.nickname : null,
        aces,
        kings,
        stored_state: state,
      },
    });
  } catch (error) {
    console.error('GET /decks/:id/governance error:', error);

    res.status(500).json({
      ok: false,
      error: 'Could not fetch governance state',
    });
  }
});
// Obtener miembros de un deck
app.get('/decks/:id/members', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `
      SELECT
        dm.id,
        dm.joined_at,
        u.id AS user_id,
        u.nickname,
        u.email,
        u.phone,
        u.profile_photo_url,
        u.birth_date
      FROM deck_members dm
      JOIN users u ON dm.user_id = u.id
      WHERE dm.deck_id = $1
      ORDER BY dm.joined_at ASC;
      `,
      [id]
    );

    res.json({
      ok: true,
      members: result.rows,
    });
  } catch (error) {
    console.error('Error al obtener miembros del deck:', error);

    res.status(500).json({
      ok: false,
      message: 'Error al obtener miembros del deck',
    });
  }
});

// Crear record inicial: solo J_HEART
app.post('/records', requireAuth, async (req, res) => {
  const { deck_id, description, title } = req.body;
  const user_id = req.auth.userId;

  if (!deck_id) {
    return res.status(400).json({
      ok: false,
      message: 'deck_id es obligatorio',
    });
  }

  if (!isNonEmptyString(description)) {
    return res.status(400).json({
      ok: false,
      message: 'J_HEART requiere description',
    });
  }

  try {
    const deckCheck = await pool.query(
      `
      SELECT id
      FROM decks
      WHERE id = $1
      `,
      [deck_id]
    );

    if (deckCheck.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        message: 'Deck no encontrado',
      });
    }

    const result = await pool.query(
      `
      INSERT INTO records
      (
        deck_id,
        user_id,
        card_type,
        title,
        description,
        amount,
        activity_date,
        start_date,
        end_date,
        location,
        parent_record_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
      `,
      [
        deck_id,
        user_id,
        'J_HEART',
        normalizeString(title) || 'Anotación',
        normalizeString(description),
        null,
        null,
        null,
        null,
        null,
        null,
      ]
    );

    res.status(201).json({
      ok: true,
      record: result.rows[0],
    });
  } catch (error) {
    console.error('Error creando J_HEART:', error);

    res.status(500).json({
      ok: false,
      message: 'Error creando record',
    });
  }
});

// Convertir record existente
app.post('/records/:id/convert', requireAuth, async (req, res) => {
  const { id } = req.params;
  const {
    target_card_type,
    description,
    start_date,
    end_date,
    location,
    title,
    amount,
  } = req.body;

  const user_id = req.auth.userId;

  if (!target_card_type) {
    return res.status(400).json({
      ok: false,
      message: 'target_card_type es obligatorio',
    });
  }

  if (!['J_CLUB', 'J_SPADE'].includes(target_card_type)) {
    return res.status(400).json({
      ok: false,
      message: 'Solo se permite convertir a J_CLUB o J_SPADE',
    });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const recordResult = await client.query(
      `
      SELECT *
      FROM records
      WHERE id = $1
      `,
      [id]
    );

    if (recordResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        ok: false,
        message: 'Record no encontrado',
      });
    }

    const originalRecord = recordResult.rows[0];

    if (Number(originalRecord.user_id) !== Number(user_id)) {
      await client.query('ROLLBACK');
      return res.status(403).json({
        ok: false,
        message: 'Solo el autor del registro puede convertirlo',
      });
    }

    if (originalRecord.card_type !== 'J_HEART') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        ok: false,
        message: 'Solo se pueden convertir registros J_HEART',
      });
    }

    if (target_card_type === 'J_CLUB') {
      const finalDescription =
        normalizeString(description) || normalizeString(originalRecord.description);

      if (!isNonEmptyString(finalDescription)) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          ok: false,
          message: 'J_CLUB requiere description',
        });
      }

      if (isProvided(amount) && !isValidNumber(amount)) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          ok: false,
          message: 'amount inválido',
        });
      }

      const updateResult = await client.query(
        `
        UPDATE records
        SET
          card_type = $1,
          title = $2,
          description = $3,
          amount = NULL,
          activity_date = NULL,
          start_date = NULL,
          end_date = NULL,
          location = NULL,
          parent_record_id = NULL
        WHERE id = $4
        RETURNING *
        `,
        [
          'J_CLUB',
          normalizeString(title) || 'Bien',
          finalDescription,
          id,
        ]
      );

      const clubRecord = updateResult.rows[0];
      let diamondRecord = null;

      await client.query(
        `
        DELETE FROM records
        WHERE parent_record_id = $1
          AND card_type = 'J_DIAMOND'
        `,
        [clubRecord.id]
      );

      if (isProvided(amount)) {
        const diamondInsert = await client.query(
          `
          INSERT INTO records
          (
            deck_id,
            user_id,
            card_type,
            title,
            description,
            amount,
            activity_date,
            start_date,
            end_date,
            location,
            parent_record_id
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          RETURNING *
          `,
          [
            clubRecord.deck_id,
            clubRecord.user_id,
            'J_DIAMOND',
            'Monto',
            finalDescription,
            normalizeAmount(amount),
            null,
            null,
            null,
            null,
            clubRecord.id,
          ]
        );

        diamondRecord = diamondInsert.rows[0];
      }

      await client.query('COMMIT');

      return res.json({
        ok: true,
        message: diamondRecord
          ? 'Record convertido a J_CLUB y se creó J_DIAMOND'
          : 'Record convertido a J_CLUB',
        record: clubRecord,
        diamond_record: diamondRecord,
      });
    }

    if (target_card_type === 'J_SPADE') {
      const finalDescription =
        normalizeString(description) || normalizeString(originalRecord.description);

      if (!isNonEmptyString(finalDescription)) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          ok: false,
          message: 'J_SPADE requiere description',
        });
      }

      if (!isProvided(start_date) && !isProvided(end_date)) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          ok: false,
          message: 'J_SPADE requiere start_date o end_date',
        });
      }

      if (isProvided(start_date) && !isValidDateString(start_date)) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          ok: false,
          message: 'start_date inválida',
        });
      }

      if (isProvided(end_date) && !isValidDateString(end_date)) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          ok: false,
          message: 'end_date inválida',
        });
      }

      if (isProvided(start_date) && isProvided(end_date)) {
        const start = new Date(start_date);
        const end = new Date(end_date);

        if (end < start) {
          await client.query('ROLLBACK');
          return res.status(400).json({
            ok: false,
            message: 'end_date no puede ser anterior a start_date',
          });
        }
      }

      if (isProvided(amount) && !isValidNumber(amount)) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          ok: false,
          message: 'amount inválido',
        });
      }

      const updateResult = await client.query(
        `
        UPDATE records
        SET
          card_type = $1,
          title = $2,
          description = $3,
          amount = NULL,
          activity_date = NULL,
          start_date = $4,
          end_date = $5,
          location = $6,
          parent_record_id = NULL
        WHERE id = $7
        RETURNING *
        `,
        [
          'J_SPADE',
          normalizeString(title) || 'Actividad',
          finalDescription,
          normalizeDate(start_date),
          normalizeDate(end_date),
          normalizeString(location),
          id,
        ]
      );

      const spadeRecord = updateResult.rows[0];
      let diamondRecord = null;

      await client.query(
        `
        DELETE FROM records
        WHERE parent_record_id = $1
          AND card_type = 'J_DIAMOND'
        `,
        [spadeRecord.id]
      );

      if (isProvided(amount)) {
        const diamondInsert = await client.query(
          `
          INSERT INTO records
          (
            deck_id,
            user_id,
            card_type,
            title,
            description,
            amount,
            activity_date,
            start_date,
            end_date,
            location,
            parent_record_id
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          RETURNING *
          `,
          [
            spadeRecord.deck_id,
            spadeRecord.user_id,
            'J_DIAMOND',
            'Monto',
            finalDescription,
            normalizeAmount(amount),
            null,
            null,
            null,
            null,
            spadeRecord.id,
          ]
        );

        diamondRecord = diamondInsert.rows[0];
      }

      await client.query('COMMIT');

      return res.json({
        ok: true,
        message: diamondRecord
          ? 'Record convertido a J_SPADE y se creó J_DIAMOND'
          : 'Record convertido a J_SPADE',
        record: spadeRecord,
        diamond_record: diamondRecord,
      });
    }

    await client.query('ROLLBACK');

    return res.status(400).json({
      ok: false,
      message: 'Conversión no válida',
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error convirtiendo record:', error);

    res.status(500).json({
      ok: false,
      message: 'Error convirtiendo record',
    });
  } finally {
    client.release();
  }
});

// Obtener records del usuario autenticado
app.get('/records', requireAuth, async (req, res) => {
  const user_id = req.auth.userId;

  try {
    const result = await pool.query(
      `
      SELECT
        r.*,
        d.name AS deck_name
      FROM records r
      JOIN decks d ON r.deck_id = d.id
      WHERE r.user_id = $1
      ORDER BY r.created_at DESC, r.id DESC
      `,
      [user_id]
    );

    res.json({
      ok: true,
      records: result.rows,
    });
  } catch (error) {
    console.error('Error obteniendo records:', error);

    res.status(500).json({
      ok: false,
      message: 'Error obteniendo records',
    });
  }
});

// Obtener records de un deck
app.get('/decks/:id/records', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `
      SELECT
        r.*,
        u.nickname AS user_nickname
      FROM records r
      JOIN users u ON r.user_id = u.id
      WHERE r.deck_id = $1
      ORDER BY r.created_at DESC, r.id DESC
      `,
      [id]
    );

    res.json({
      ok: true,
      records: result.rows,
    });
  } catch (error) {
    console.error('Error obteniendo records del deck:', error);

    res.status(500).json({
      ok: false,
      message: 'Error obteniendo records del deck',
    });
  }
});

app.post('/ace-transfers', requireAuth, async (req, res) => {
  const actorUserId = Number(req.auth.userId);
  const { deck_id, ace_type, to_user_id } = req.body;

  if (!Number.isInteger(Number(deck_id))) {
    return res.status(400).json({ ok: false, error: 'deck_id inválido' });
  }

  if (!['A_SPADE', 'A_DIAMOND', 'A_CLUB'].includes(ace_type)) {
    return res.status(400).json({ ok: false, error: 'ace_type inválido' });
  }

  if (!Number.isInteger(Number(to_user_id))) {
    return res.status(400).json({ ok: false, error: 'to_user_id inválido' });
  }

  if (actorUserId === Number(to_user_id)) {
    return res.status(400).json({ ok: false, error: 'No puedes transferirte el As a ti mismo' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const blockedResult = await client.query(
      `
      SELECT is_blocked
      FROM deck_governance_state
      WHERE deck_id = $1
      LIMIT 1
      `,
      [deck_id]
    );

    if (blockedResult.rows[0]?.is_blocked) {
      await client.query('ROLLBACK');
      return res.status(409).json({ ok: false, error: 'El mazo está bloqueado' });
    }

    const memberResult = await client.query(
      `
      SELECT user_id
      FROM deck_members
      WHERE deck_id = $1 AND user_id IN ($2, $3)
      `,
      [deck_id, actorUserId, Number(to_user_id)]
    );

    if (memberResult.rows.length !== 2) {
      await client.query('ROLLBACK');
      return res.status(400).json({ ok: false, error: 'Ambos usuarios deben pertenecer al mazo' });
    }

    const aceResult = await client.query(
      `
      SELECT deck_id, ace_type, user_id
      FROM deck_aces
      WHERE deck_id = $1 AND ace_type = $2
      LIMIT 1
      FOR UPDATE
      `,
      [deck_id, ace_type]
    );

    if (aceResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ ok: false, error: 'As no encontrado en el mazo' });
    }

    if (Number(aceResult.rows[0].user_id) !== actorUserId) {
      await client.query('ROLLBACK');
      return res.status(403).json({ ok: false, error: 'No eres el titular actual de ese As' });
    }

    const pendingResult = await client.query(
      `
      SELECT id
      FROM ace_transfers
      WHERE deck_id = $1
        AND ace_type = $2
        AND status = 'PENDING'
      LIMIT 1
      `,
      [deck_id, ace_type]
    );

    if (pendingResult.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ ok: false, error: 'Ya existe una transferencia pendiente para ese As' });
    }

    const insertResult = await client.query(
      `
      INSERT INTO ace_transfers
      (deck_id, ace_type, from_user_id, to_user_id, status)
      VALUES ($1, $2, $3, $4, 'PENDING')
      RETURNING *
      `,
      [deck_id, ace_type, actorUserId, Number(to_user_id)]
    );

    await client.query('COMMIT');

    res.status(201).json({
      ok: true,
      transfer: insertResult.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('POST /ace-transfers error:', error);
    res.status(500).json({ ok: false, error: 'No se pudo crear la transferencia' });
  } finally {
    client.release();
  }
});

app.post('/ace-transfers/:id/respond', requireAuth, async (req, res) => {
  const transferId = Number(req.params.id);
  const actorUserId = Number(req.auth.userId);
  const { decision } = req.body;

  if (!Number.isInteger(transferId)) {
    return res.status(400).json({ ok: false, error: 'transfer id inválido' });
  }

  if (!['ACCEPT', 'REJECT'].includes(decision)) {
    return res.status(400).json({ ok: false, error: 'decision inválida' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const transferResult = await client.query(
      `
      SELECT *
      FROM ace_transfers
      WHERE id = $1
      LIMIT 1
      FOR UPDATE
      `,
      [transferId]
    );

    if (transferResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ ok: false, error: 'Transferencia no encontrada' });
    }

    const transfer = transferResult.rows[0];

    if (transfer.status !== 'PENDING') {
      await client.query('ROLLBACK');
      return res.status(409).json({ ok: false, error: 'La transferencia ya fue respondida' });
    }

    if (Number(transfer.to_user_id) !== actorUserId) {
      await client.query('ROLLBACK');
      return res.status(403).json({ ok: false, error: 'Solo el receptor puede responder la transferencia' });
    }

    if (decision === 'REJECT') {
      const rejectResult = await client.query(
        `
        UPDATE ace_transfers
        SET status = 'REJECTED',
            responded_at = NOW(),
            responded_by_user_id = $2
        WHERE id = $1
        RETURNING *
        `,
        [transferId, actorUserId]
      );

      await client.query('COMMIT');
      return res.json({ ok: true, transfer: rejectResult.rows[0] });
    }

    const aceResult = await client.query(
      `
      SELECT *
      FROM deck_aces
      WHERE deck_id = $1 AND ace_type = $2
      LIMIT 1
      FOR UPDATE
      `,
      [transfer.deck_id, transfer.ace_type]
    );

    if (aceResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ ok: false, error: 'As no encontrado' });
    }

    const currentAce = aceResult.rows[0];

    if (Number(currentAce.user_id) !== Number(transfer.from_user_id)) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        ok: false,
        error: 'El As ya no pertenece al emisor original'
      });
    }

    await client.query(
      `
      UPDATE deck_aces
      SET user_id = $1
      WHERE deck_id = $2 AND ace_type = $3
      `,
      [transfer.to_user_id, transfer.deck_id, transfer.ace_type]
    );

    const acceptResult = await client.query(
      `
      UPDATE ace_transfers
      SET status = 'ACCEPTED',
          responded_at = NOW(),
          responded_by_user_id = $2
      WHERE id = $1
      RETURNING *
      `,
      [transferId, actorUserId]
    );

    await client.query('COMMIT');

    res.json({
      ok: true,
      transfer: acceptResult.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('POST /ace-transfers/:id/respond error:', error);
    res.status(500).json({ ok: false, error: 'No se pudo responder la transferencia' });
  } finally {
    client.release();
  }
});
app.get('/decks/:id/ace-transfers', requireAuth, async (req, res) => {
  const deckId = Number(req.params.id);
  const status = req.query.status;

  if (Number.isNaN(deckId)) {
    return res.status(400).json({ ok: false, error: 'deck id inválido' });
  }

  const allowedStatuses = ['PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED'];
  const useStatus = allowedStatuses.includes(status) ? status : null;

  try {
    const result = await pool.query(
      `
      SELECT
        t.*,
        fu.nickname AS from_nickname,
        tu.nickname AS to_nickname
      FROM ace_transfers t
      JOIN users fu ON fu.id = t.from_user_id
      JOIN users tu ON tu.id = t.to_user_id
      WHERE t.deck_id = $1
        AND ($2::text IS NULL OR t.status = $2)
      ORDER BY t.created_at DESC
      `,
      [deckId, useStatus]
    );

    res.json({
      ok: true,
      transfers: result.rows
    });
  } catch (error) {
    console.error('GET /decks/:id/ace-transfers error:', error);
    res.status(500).json({ ok: false, error: 'No se pudieron obtener las transferencias' });
  }
});

app.listen(PORT, () => {
  console.log(`CoopTrack server listening on port ${PORT}`);
});