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
  handleApproveJHeart,
  expandReadersForKSend,
  expandReadersForASend,
} = require('./services/play-readers');

const {
  setPlayReaders,
  addReadersToPlay,
  markPlayAsPublic,
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

async function createPlayValidation(client, {
  playId,
  validatorUserId,
  validatorRole,
  validationOrder = 1
}) {
  if (!playId || !validatorUserId || !validatorRole) return;

  await client.query(
    `
    INSERT INTO play_validations (
      play_id,
      validator_user_id,
      validator_role,
      validation_order,
      validation_status
    )
    VALUES ($1, $2, $3, $4, 'PENDING')
    ON CONFLICT (play_id, validator_role)
    DO NOTHING
    `,
    [playId, validatorUserId, validatorRole, validationOrder]
  );
}

async function getAceOwnerUserId(client, deckId, suit) {
  const result = await client.query(
    `
    SELECT COALESCE(target_user_id, created_by_user_id) AS owner_user_id
    FROM plays
    WHERE deck_id = $1
      AND card_rank = 'A'
      AND card_suit = $2
      AND split_part(play_code, '§', 8) = 'foundation'
    ORDER BY id DESC
    LIMIT 1
    `,
    [deckId, suit]
  );

  return Number(result.rows[0]?.owner_user_id || 0);
}

function getFinalTargetFromPlayCode(playCode) {
  const parsed = parsePlayCodeRaw(playCode);
  const chunks = parseFlowChunks(parsed.flow);

  let finalTargetUserId = null;

  chunks.forEach((chunk) => {
    if (!chunk.startsWith('finalTarget:')) return;

    const raw = chunk.split(':')[1] || '';
    const cleaned = raw.replace('U:', '').trim();

    const id = Number(cleaned);
    if (id) {
      finalTargetUserId = id;
    }
  });

  return finalTargetUserId;
}

async function getAceClubOwnerUserId(client, deckId) {
  const result = await client.query(
    `
    SELECT COALESCE(target_user_id, created_by_user_id) AS owner_user_id
    FROM plays
    WHERE deck_id = $1
      AND card_rank = 'A'
      AND card_suit = 'CLUB'
      AND split_part(play_code, '§', 8) = 'foundation'
    ORDER BY id DESC
    LIMIT 1
    `,
    [deckId]
  );

  return Number(result.rows[0]?.owner_user_id || 0);
}

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


function normalizeCredentialList(value) {
  const raw = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? (() => {
        try {
          const parsed = JSON.parse(value);
          return Array.isArray(parsed) ? parsed : [];
        } catch (_) {
          return [];
        }
      })()
      : [];

  return [...new Set(
    raw
      .map((item) => String(item || '').trim().toUpperCase())
      .filter(Boolean)
  )];
}

function credentialForCard(rank, suit) {
  const normalizedRank = String(rank || '').trim().toUpperCase();
  const normalizedSuit = String(suit || '').trim().toUpperCase();
  if (!['A', 'K'].includes(normalizedRank)) return null;
  if (!['HEART', 'SPADE', 'DIAMOND', 'CLUB'].includes(normalizedSuit)) return null;
  return `${normalizedRank}_${normalizedSuit}`;
}

const CORPORATE_ACE_PLAYBOOK_LINES = new Set([10, 11, 12, 13]);
const CORPORATE_K_MIN_PLAYBOOK_LINE = 14;
const CORPORATE_ALLOWED_SUITS = ['HEART', 'SPADE', 'DIAMOND', 'CLUB'];
const CORPORATE_EXCLUDED_STATUSES = ['REJECTED', 'CANCELLED', 'DELETED', 'QUIT', 'FIRED'];
const CORPORATE_K_ACTIVE_STATUS = 'ACTIVE';

function getCorporateCardEntriesFromPlays(plays, ownerUserId) {
  const normalizedOwnerUserId = Number(ownerUserId || 0);
  if (!normalizedOwnerUserId) return [];

  const sortedPlays = [...(Array.isArray(plays) ? plays : [])]
    .sort((a, b) => Number(a?.id || 0) - Number(b?.id || 0));

  const entries = [];

  sortedPlays.forEach((play, index) => {
    const playBookLine = index + 1;

    const parts = String(play?.play_code || '').split('§');
    const rank = String(play?.card_rank || parts[3] || '').trim().toUpperCase();
    const suit = String(play?.card_suit || parts[4] || '').trim().toUpperCase();
    const status = String(play?.play_status || '').trim().toUpperCase();
    const action = String(parts[5] || '').trim().toLowerCase();
    const flow = String(parts[7] || '').trim().toLowerCase();

    if (!['A', 'K'].includes(rank)) return;
    if (!CORPORATE_ALLOWED_SUITS.includes(suit)) return;
    if (CORPORATE_EXCLUDED_STATUSES.includes(status)) return;

    const ownerId = Number(play?.target_user_id || play?.created_by_user_id || 0);
    if (ownerId !== normalizedOwnerUserId) return;

    if (rank === 'A') {
      if (!CORPORATE_ACE_PLAYBOOK_LINES.has(playBookLine)) return;
      if (flow !== 'foundation') return;
    }

    if (rank === 'K') {
      if (playBookLine < CORPORATE_K_MIN_PLAYBOOK_LINE) return;
      if (flow === 'acl') return;
      if (action === 'puedejugar') return;
      if (status !== CORPORATE_K_ACTIVE_STATUS) return;
    }

    const credential = credentialForCard(rank, suit);
    if (!credential) return;

    entries.push({
      play_id: Number(play?.id || 0),
      play_book_line: playBookLine,
      owner_user_id: ownerId,
      card_rank: rank,
      card_suit: suit,
      play_status: status,
      credential,
    });
  });

  return entries;
}

async function getIssuedWithForUser(client, deckId, userId) {
  const normalizedDeckId = Number(deckId || 0);
  const normalizedUserId = Number(userId || 0);

  if (!normalizedDeckId || !normalizedUserId) return [];

  const result = await client.query(
    `
    SELECT
      id,
      created_by_user_id,
      target_user_id,
      card_rank,
      card_suit,
      play_status,
      play_code
    FROM plays
    WHERE deck_id = $1
    ORDER BY id ASC
    `,
    [normalizedDeckId]
  );

  const entries = getCorporateCardEntriesFromPlays(result.rows, normalizedUserId);
  return normalizeCredentialList(entries.map((entry) => entry.credential));
}

async function buildCorporateIssuedWithByUserForDeck(client, deckId) {
  const normalizedDeckId = Number(deckId || 0);
  if (!normalizedDeckId) return new Map();

  const result = await client.query(
    `
    SELECT
      id,
      created_by_user_id,
      target_user_id,
      card_rank,
      card_suit,
      play_status,
      play_code
    FROM plays
    WHERE deck_id = $1
    ORDER BY id ASC
    `,
    [normalizedDeckId]
  );

  const fullPlays = Array.isArray(result.rows) ? result.rows : [];
  const ownerIds = new Set();

  fullPlays.forEach((play) => {
    const createdBy = Number(play?.created_by_user_id || 0);
    const target = Number(play?.target_user_id || 0);
    if (createdBy > 0) ownerIds.add(createdBy);
    if (target > 0) ownerIds.add(target);
  });

  const issuedWithByUser = new Map();
  ownerIds.forEach((ownerId) => {
    const entries = getCorporateCardEntriesFromPlays(fullPlays, ownerId);
    issuedWithByUser.set(
      ownerId,
      normalizeCredentialList(entries.map((entry) => entry.credential))
    );
  });

  return issuedWithByUser;
}

function mergeIssuedWith(...values) {
  return normalizeCredentialList(values.flatMap((value) => normalizeCredentialList(value)));
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
  issuedWith = [],
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
      play_text,
      issued_with
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
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
      JSON.stringify(normalizeCredentialList(issuedWith)),
    ]
  );

  return {
    row: result.rows[0],
    parsed,
  };
}

async function getMazoByIdForUser(client, mazoId, userId) {
  const result = await client.query(
    `
    SELECT DISTINCT d.*
    FROM decks d

    LEFT JOIN deck_members dm
      ON dm.deck_id = d.id
     AND dm.user_id = $2

    LEFT JOIN plays p
      ON p.deck_id = d.id

    WHERE d.id = $1
      AND (
        dm.user_id IS NOT NULL

        OR p.reader_user_ids ? $3
        OR p.reader_user_ids ? $4
        OR p.reader_user_ids ? 'TODOS'
      )

    LIMIT 1
    `,
    [mazoId, userId, String(userId), `U:${userId}`]
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

function playCodeHasFlowFlag(playCode, flag) {
  const wanted = String(flag || '').trim().toUpperCase();
  if (!wanted) return false;

  const parsed = parsePlayCodeRaw(playCode);
  const chunks = parseFlowChunks(parsed.flow);

  return chunks.some((chunk) => String(chunk || '').trim().toUpperCase() === wanted);
}

function appendFlowFlagToPlayCode(playCode, flag) {
  const wanted = String(flag || '').trim();
  if (!wanted) return String(playCode || '');

  const parts = String(playCode || '').split('§');

  while (parts.length < 9) {
    parts.push('');
  }

  const flowIndex = 7;
  const currentFlow = String(parts[flowIndex] || '');
  const chunks = parseFlowChunks(currentFlow);

  const exists = chunks.some((chunk) => {
    return String(chunk || '').trim().toUpperCase() === wanted.toUpperCase();
  });

  if (!exists) {
    chunks.push(wanted);
  }

  parts[flowIndex] = chunks.join(';');
  return parts.slice(0, 9).join('§');
}

async function propagateBombFlagToFamily(client, rootPlayId, flag) {
  const rootId = Number(rootPlayId || 0);
  const normalizedFlag = String(flag || '').trim().toUpperCase();

  if (!rootId || !normalizedFlag) return 0;

  const familyResult = await client.query(
    `
    SELECT id, play_code
    FROM plays
    WHERE (id = $1 OR parent_play_id = $1)
      AND card_rank IN ('J', 'Q')
      AND card_suit = 'SPADE'
    `,
    [rootId]
  );

  let updatedCount = 0;

  for (const row of familyResult.rows) {
    const currentCode = String(row.play_code || '');
    const nextCode = appendFlowFlagToPlayCode(currentCode, normalizedFlag);

    if (nextCode === currentCode) {
      continue;
    }

    await client.query(
      `
      UPDATE plays
      SET play_code = $1,
          updated_at = NOW()
      WHERE id = $2
      `,
      [nextCode, row.id]
    );

    updatedCount += 1;
  }

  return updatedCount;
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

async function upsertUserAccreditation(client, {
  subjectUserId,
  issuerUserId,
  accreditationType,
  status,
  sourcePlayId,
  note,
}) {
  if (!subjectUserId || !issuerUserId || subjectUserId === issuerUserId) {
    return false;
  }

  const currentResult = await client.query(
    `
    SELECT status
    FROM user_accreditations
    WHERE subject_user_id = $1
      AND issuer_user_id = $2
      AND accreditation_type = $3
    LIMIT 1
    `,
    [subjectUserId, issuerUserId, accreditationType]
  );

  const oldStatus = currentResult.rows[0]?.status || null;

  await client.query(
    `
    INSERT INTO user_accreditations (
      subject_user_id,
      issuer_user_id,
      accreditation_type,
      status,
      source_play_id,
      note
    )
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (subject_user_id, issuer_user_id, accreditation_type)
    DO UPDATE
    SET
      status = EXCLUDED.status,
      source_play_id = EXCLUDED.source_play_id,
      note = EXCLUDED.note,
      updated_at = NOW()
    `,
    [subjectUserId, issuerUserId, accreditationType, status, sourcePlayId || null, note || null]
  );

  const statusChanged = String(oldStatus || '') !== String(status || '');

  if (oldStatus === null || statusChanged) {
    await client.query(
      `
      INSERT INTO user_accreditation_events (
        subject_user_id,
        issuer_user_id,
        accreditation_type,
        old_status,
        new_status,
        source_play_id,
        note
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
      [subjectUserId, issuerUserId, accreditationType, oldStatus, status, sourcePlayId || null, note || null]
    );
  }

  return true;
}

async function applySettlementToUserProfile(client, play, settlementInfo) {
  const targetUserId = Number(play?.target_user_id || 0);
  const sourcePlayId = Number(play?.id || 0);
  const issuerUserId = Number(play?.created_by_user_id || 0);

  if (!targetUserId || !sourcePlayId || !issuerUserId || !settlementInfo?.status) {
    return false;
  }

  const normalizedStatus = String(settlementInfo.status || '').trim().toUpperCase();

  let accreditationType = null;
  let status = null;
  let note = null;

  if (normalizedStatus === 'PAID') {
    accreditationType = 'GOOD_PAYER_AWARD';
    status = 'POSITIVE';
    note = 'SETTLEMENT_PAID';
  } else if (normalizedStatus === 'COMPLAINED') {
    accreditationType = 'GOOD_PAYER_AWARD';
    status = 'NEUTRAL';
    note = 'SETTLEMENT_COMPLAINED';
  } else {
    return false;
  }

  return upsertUserAccreditation(client, {
    subjectUserId: targetUserId,
    issuerUserId,
    accreditationType,
    status,
    sourcePlayId,
    note,
  });
}

async function stampQSpadeContextOnce(client, play) {
  // TODO: implementar estampado real de contexto Q♠
  // Por ahora no hace nada, pero evita que SEND_Q_SPADE rompa.
  return;
}

async function stampPlayIfNeeded(client, play, options = {}) {
  const reason = String(options.reason || '').toUpperCase();

  if (reason === 'SEND_Q_SPADE') {
    await stampQSpadeContextOnce(client, play);
  }

  if (reason === 'SEND_K_CLUB') {
    await stampKClubFinancialSummaryOnce(client, play);
  }
}

const playMessagesSchemaCache = {
  loaded: false,
  tableSchema: null,
  attachmentsTableSchema: null,
  columns: new Set(),
  hasAttachmentsTable: false,
};

function quoteSqlIdent(value) {
  return `"${String(value || '').replace(/"/g, '""')}"`;
}

function getQualifiedTableName(schemaName, tableName) {
  if (!schemaName) return quoteSqlIdent(tableName);
  return `${quoteSqlIdent(schemaName)}.${quoteSqlIdent(tableName)}`;
}

async function loadPlayMessagesSchema(client) {
  if (playMessagesSchemaCache.loaded) return playMessagesSchemaCache;

  const playMessagesTableResult = await client.query(
    `
    SELECT table_schema
    FROM information_schema.tables
    WHERE table_name = 'play_messages'
    ORDER BY CASE WHEN table_schema = 'public' THEN 0 ELSE 1 END, table_schema ASC
    LIMIT 1
    `
  );

  const playMessagesSchema = playMessagesTableResult.rows[0]?.table_schema || null;

  if (!playMessagesSchema) {
    playMessagesSchemaCache.loaded = true;
    playMessagesSchemaCache.tableSchema = null;
    playMessagesSchemaCache.attachmentsTableSchema = null;
    playMessagesSchemaCache.columns = new Set();
    playMessagesSchemaCache.hasAttachmentsTable = false;
    return playMessagesSchemaCache;
  }

  const columnsResult = await client.query(
    `
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = $1
      AND table_name = 'play_messages'
    `,
    [playMessagesSchema]
  );

  const attachmentsTableResult = await client.query(
    `
    SELECT table_schema
    FROM information_schema.tables
    WHERE table_name = 'play_message_attachments'
    ORDER BY CASE WHEN table_schema = $1 THEN 0 WHEN table_schema = 'public' THEN 1 ELSE 2 END, table_schema ASC
    LIMIT 1
    `
    ,
    [playMessagesSchema]
  );

  const attachmentsSchema = attachmentsTableResult.rows[0]?.table_schema || null;

  playMessagesSchemaCache.loaded = true;
  playMessagesSchemaCache.tableSchema = playMessagesSchema;
  playMessagesSchemaCache.attachmentsTableSchema = attachmentsSchema;
  playMessagesSchemaCache.columns = new Set(
    (columnsResult.rows || []).map((row) => String(row.column_name || '').trim())
  );
  playMessagesSchemaCache.hasAttachmentsTable = Boolean(attachmentsSchema);

  return playMessagesSchemaCache;
}

function pickExistingPlayMessagesColumn(columnsSet, candidates = []) {
  for (const candidate of candidates) {
    if (columnsSet.has(candidate)) return candidate;
  }

  return null;
}

const TALUD_READ_REASON = 'TALUD_MESSAGES';

async function markTaludMessagesRead(client, playId, userId) {
  const normalizedPlayId = Number(playId || 0);
  const normalizedUserId = Number(userId || 0);

  if (!normalizedPlayId || !normalizedUserId) return;

  await client.query(
    `
    INSERT INTO play_reads (play_id, user_id, reason)
    VALUES ($1, $2, $3)
    ON CONFLICT (play_id, user_id, reason)
    DO UPDATE SET read_at = NOW()
    `,
    [normalizedPlayId, normalizedUserId, TALUD_READ_REASON]
  );
}

function parseReaderUserIds(readerUserIds) {
  if (!Array.isArray(readerUserIds)) return [];

  return readerUserIds
    .map((entry) => String(entry || '').trim())
    .filter(Boolean)
    .map((entry) => {
      if (entry === 'TODOS') return 'TODOS';

      if (/^U:\d+$/.test(entry)) {
        return Number(entry.slice(2));
      }

      const numeric = Number(entry);
      return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
    })
    .filter((entry) => entry === 'TODOS' || Number.isInteger(entry));
}

function playReadersArePublic(readerUserIds) {
  if (readerUserIds === null) return true;
  if (!Array.isArray(readerUserIds)) return true;
  if (!readerUserIds.length) return true;

  const normalized = parseReaderUserIds(readerUserIds);
  return normalized.includes('TODOS');
}

function getPlayParticipantUserIds(play) {
  const set = new Set();

  const parsedReaders = parseReaderUserIds(play?.reader_user_ids);
  parsedReaders.forEach((entry) => {
    if (Number.isInteger(entry) && entry > 0) {
      set.add(entry);
    }
  });

  const authorId = Number(play?.created_by_user_id || 0);
  const targetId = Number(play?.target_user_id || 0);

  if (authorId) set.add(authorId);
  if (targetId) set.add(targetId);

  return [...set];
}

async function fetchPlayForChat(client, playId) {
  const result = await client.query(
    `
    SELECT
      p.id,
      p.deck_id,
      p.created_by_user_id,
      p.target_user_id,
      p.reader_user_ids,
      p.play_text,
      p.play_code,
      p.card_rank,
      p.card_suit,
      p.play_status
    FROM plays p
    WHERE p.id = $1
    LIMIT 1
    `,
    [playId]
  );

  return result.rows[0] || null;
}

async function fetchUsersMapByIds(client, userIds = []) {
  const normalizedIds = [...new Set(
    userIds
      .map((id) => Number(id))
      .filter((id) => Number.isInteger(id) && id > 0)
  )];

  if (!normalizedIds.length) return {};

  const result = await client.query(
    `
    SELECT id, nickname, profile_photo_url
    FROM users
    WHERE id = ANY($1::int[])
    `,
    [normalizedIds]
  );

  return result.rows.reduce((acc, row) => {
    acc[Number(row.id)] = {
      id: Number(row.id),
      nickname: row.nickname || `Usuario ${row.id}`,
      profile_photo_url: row.profile_photo_url || '/assets/icons/singeta120.gif',
    };
    return acc;
  }, {});
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
        u.id,
        u.nickname,
        u.email,
        u.phone,
        u.profile_photo_url,
        u.birth_date,
        u.user_type,
        u.country,
        u.is_admin,
        COALESCE(s.awards_count, 0) AS awards_count,
        COALESCE(s.moustaches_count, 0) AS moustaches_count,
        COALESCE(s.hats_count, 0) AS hats_count
       FROM users
       u
       LEFT JOIN user_accreditation_summary s
         ON s.user_id = u.id
       WHERE u.id = $1`,
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

app.post('/plays/from-news', requireAuth, async (req, res) => {
  const client = await pool.connect();

  try {
    const userId = Number(req.auth.userId || 0);
    const parentPlayId = Number(req.body.parent_play_id || 0);

    if (!parentPlayId) {
      return res.status(400).json({
        ok: false,
        error: 'parent_play_id inválido'
      });
    }

    await client.query('BEGIN');

    const parentResult = await client.query(
      `
      SELECT *
      FROM plays
      WHERE id = $1
        AND card_rank = 'J'
        AND card_suit = 'SPADE'
        AND UPPER(COALESCE(play_status, '')) = 'APPROVED'
        AND reader_user_ids ? 'TODOS'
      LIMIT 1
      `,
      [parentPlayId]
    );

    const parent = parentResult.rows[0];

    if (!parent) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        ok: false,
        error: 'Publicación no encontrada'
      });
    }

    const deckId = Number(parent.deck_id || 0);

    const existingResult = await client.query(
      `
      SELECT *
      FROM plays
      WHERE deck_id = $1
        AND parent_play_id = $2
        AND target_user_id = $3
        AND card_rank = 'Q'
        AND card_suit = 'SPADE'
        AND UPPER(COALESCE(play_status, '')) NOT IN ('REJECTED', 'CANCELLED')
      ORDER BY id DESC
      LIMIT 1
      `,
      [deckId, parentPlayId, userId]
    );

    if (existingResult.rows.length) {
      await client.query('COMMIT');
      return res.json({
        ok: true,
        play: existingResult.rows[0],
        existing: true
      });
    }

    const parsedParent = parsePlayCodeRaw(parent.play_code);
    const parentFlow = String(parsedParent.flow || '');

    const hasQHeart = parentFlow.toLowerCase().includes('pay:qheart');

    const flow = hasQHeart
      ? parentFlow
      : `child_of:${parentPlayId};from_news:${parentPlayId}`;

    const playCode = buildPlayCode({
      mazoId: deckId,
      userId,
      rank: 'Q',
      suit: 'SPADE',
      action: 'from_news',
      authorized: `U:${userId}`,
      flow,
      recipients: `U:${userId}`,
    });

    const created = await insertInstitutionalPlay(client, {
      mazoId: deckId,
      createdByUserId: userId,
      parentPlayId,
      targetUserId: userId,
      playCode,
      playText: parent.play_text || '',
      playStatus: 'ACTIVE',
    });

    await handleReadersOnPlayCreate(client, created.row);

    await client.query('COMMIT');

    return res.json({
      ok: true,
      play: created.row,
      existing: false
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error en POST /plays/from-news', error);

    return res.status(500).json({
      ok: false,
      error: 'No se pudo iniciar la jugada desde la noticia'
    });

  } finally {
    client.release();
  }
});

app.get('/plays/noticias', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
        p.*,
        creator.nickname AS created_by_nickname,
        creator.profile_photo_url AS created_by_profile_photo_url,
        d.name AS deck_name,
        d.deck_image_url,
        d.currency_symbol,
        d.currency_name
      FROM plays p
      LEFT JOIN users creator
        ON creator.id = p.created_by_user_id
      LEFT JOIN decks d
        ON d.id = p.deck_id
      WHERE p.card_rank = 'J'
        AND p.card_suit = 'SPADE'
        AND UPPER(COALESCE(p.play_status, '')) = 'APPROVED'
        AND p.reader_user_ids ? 'TODOS'
      ORDER BY p.created_at DESC, p.id DESC
      `
    );

    return res.json({
      ok: true,
      plays: result.rows
    });

  } catch (error) {
    console.error('Error en GET /plays/noticias', error);
    return res.status(500).json({
      ok: false,
      error: 'Error obteniendo noticias'
    });
  }
});


app.get('/plays/almanaque', requireAuth, async (req, res) => {
  try {
    const userId = req.auth.userId;
    const userIdText = String(userId);
    const userToken = `U:${userId}`;
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
      WITH visible_plays AS (
        SELECT
          p.*,
          creator.nickname AS created_by_nickname,
          target.nickname AS target_user_nickname,
          d.name AS deck_name,
          split_part(COALESCE(p.play_code, ''), '§', 8) AS flow_chunk,
          split_part(COALESCE(p.play_code, ''), '§', 9) AS recipients_chunk
        FROM plays p
        LEFT JOIN users creator
          ON creator.id = p.created_by_user_id
        LEFT JOIN users target
          ON target.id = p.target_user_id
        LEFT JOIN decks d
          ON d.id = p.deck_id
        WHERE
          ${visibilityWhere}
          AND UPPER(COALESCE(p.card_rank, '')) IN ('J', 'Q')
          AND (
            UPPER(COALESCE(p.card_rank, '')) <> 'Q'
            OR UPPER(COALESCE(p.play_status, '')) = 'APPROVED'
          )
          AND COALESCE(p.target_user_id, p.created_by_user_id, 0) = $5::int
      ),

      base_rows AS (
        SELECT
          vp.*,
          CASE
            WHEN UPPER(COALESCE(vp.card_suit, '')) = 'SPADE'
                 AND UPPER(COALESCE(vp.spade_mode, '')) = 'APPOINTMENT'
              THEN vp.start_date

            WHEN UPPER(COALESCE(vp.card_suit, '')) = 'SPADE'
                 AND UPPER(COALESCE(vp.spade_mode, '')) = 'DEADLINE'
              THEN vp.end_date

            ELSE vp.created_at
          END AS calendar_date,
          'BASE'::text AS calendar_entry_type,
          NULL::text AS calendar_suit_override,
          NULL::text AS payment_concept,
          NULL::text AS payment_amount
        FROM visible_plays vp
        WHERE (
          CASE
            WHEN UPPER(COALESCE(vp.card_suit, '')) = 'SPADE'
                 AND UPPER(COALESCE(vp.spade_mode, '')) = 'APPOINTMENT'
              THEN vp.start_date::date

            WHEN UPPER(COALESCE(vp.card_suit, '')) = 'SPADE'
                 AND UPPER(COALESCE(vp.spade_mode, '')) = 'DEADLINE'
              THEN vp.end_date::date

            ELSE vp.created_at::date
          END
        ) BETWEEN $3::date AND $4::date
      ),

      payment_rows AS (
        SELECT
          vp.*,
          to_timestamp(
            (regexp_match(vp.flow_chunk, 'pay:QHEART[^;]*\\|payDate:([0-9]{4}-[0-9]{2}-[0-9]{2})'))[1],
            'YYYY-MM-DD'
          ) AS calendar_date,
          'PAYMENT'::text AS calendar_entry_type,
          'DIAMOND'::text AS calendar_suit_override,
          NULLIF((regexp_match(vp.flow_chunk, 'pay:QHEART[^;]*\\|concept:([^|;]*)'))[1], '') AS payment_concept,
          NULLIF((regexp_match(vp.flow_chunk, 'pay:QHEART[^;]*\\|amount:([^|;]*)'))[1], '') AS payment_amount
        FROM visible_plays vp
        WHERE
          UPPER(COALESCE(vp.card_rank, '')) = 'Q'
          AND UPPER(COALESCE(vp.card_suit, '')) = 'SPADE'
          AND vp.flow_chunk ~ 'pay:QHEART[^;]*\\|payDate:[0-9]{4}-[0-9]{2}-[0-9]{2}'
          AND COALESCE(vp.target_user_id, vp.created_by_user_id, 0) = $5::int
          AND to_date(
            (regexp_match(vp.flow_chunk, 'pay:QHEART[^;]*\\|payDate:([0-9]{4}-[0-9]{2}-[0-9]{2})'))[1],
            'YYYY-MM-DD'
          ) BETWEEN $3::date AND $4::date
      )

      SELECT *
      FROM (
        SELECT * FROM base_rows
        UNION ALL
        SELECT * FROM payment_rows
      ) rows
      ORDER BY
        calendar_date ASC,
        id ASC,
        CASE WHEN calendar_entry_type = 'PAYMENT' THEN 1 ELSE 0 END
      `,
      [userIdText, userToken, from, to, userId]
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
  d.name AS deck_name,
  d.deck_image_url,
  d.currency_symbol,
  d.currency_name
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

app.get('/plays/ahora', requireAuth, async (req, res) => {
  try {
    const userId = req.auth.userId;

    // Bombas propias: J♠ DEADLINE dentro de los próximos 30 minutos
    const esAhoraJResult = await pool.query(
      `
      SELECT
        p.*, d.name AS deck_name
      FROM plays p
      LEFT JOIN decks d
        ON d.id = p.deck_id
      WHERE p.created_by_user_id = $1
        AND p.card_rank = 'J'
        AND p.card_suit = 'SPADE'
        AND UPPER(COALESCE(p.spade_mode, '')) = 'DEADLINE'
        AND UPPER(COALESCE(p.play_status, '')) IN ('ACTIVE', 'SENT', 'PENDING', 'APPROVED')
        AND p.end_date IS NOT NULL
        AND p.end_date BETWEEN NOW() AND NOW() + INTERVAL '30 minutes'
        AND COALESCE(p.play_code, '') NOT ILIKE '%bomb:DISABLED%'
        AND COALESCE(p.play_code, '') NOT ILIKE '%bomb:DONE%'
      ORDER BY p.end_date ASC, p.created_at DESC
      `,
      [userId]
    );

    // PayNow: Q♠ APPROVED con pay:QHEART y vencimiento dentro de los próximos 30 minutos
    const esAhoraQHeartResult = await pool.query(
      `
      WITH qheart_candidates AS (
        SELECT
          p.deck_id,
          p.id,
          p.card_rank,
          p.card_suit,
          p.play_status,
          p.play_code,
          d.name AS deck_name,
          p.created_by_user_id,
          p.target_user_id,
          COALESCE(
            NULLIF((regexp_match(COALESCE(split_part(p.play_code, '§', 8), ''), 'payAt:([^;|§]+)'))[1], ''),
            NULLIF((regexp_match(COALESCE(split_part(p.play_code, '§', 8), ''), 'payDate:([^;|§]+)'))[1], '')
          ) AS payment_at_raw
        FROM plays p
        LEFT JOIN decks d
          ON d.id = p.deck_id
        WHERE p.card_rank = 'Q'
          AND p.card_suit IN ('SPADE', 'CLUB')
          AND UPPER(COALESCE(p.play_status, '')) = 'APPROVED'
          AND COALESCE(p.play_code, '') ILIKE '%pay:QHEART%'
          AND COALESCE(p.play_code, '') NOT ILIKE '%settlement:PAID%'
          AND COALESCE(p.play_code, '') NOT ILIKE '%settlement:COMPLAINED%'
          AND (p.created_by_user_id = $1 OR p.target_user_id = $1)
      ),
      qheart_with_time AS (
        SELECT
          deck_id,
          id,
          card_rank,
          card_suit,
          play_status,
          play_code,
          deck_name,
          created_by_user_id,
          target_user_id,
          payment_at_raw,
          CASE
            WHEN payment_at_raw IS NULL THEN NULL
            WHEN payment_at_raw ~ '(Z|[+-][0-9]{2}(:?[0-9]{2})?)$'
              THEN payment_at_raw::timestamptz
            ELSE (payment_at_raw::timestamp AT TIME ZONE 'America/Montevideo')
          END AS payment_at_ts
        FROM qheart_candidates
      )
      SELECT
        deck_id,
        id,
        card_rank,
        card_suit,
        play_status,
        play_code,
        deck_name,
        created_by_user_id,
        target_user_id
      FROM qheart_with_time
      WHERE payment_at_ts IS NOT NULL
        AND payment_at_ts BETWEEN NOW() - INTERVAL '3 hours' AND NOW()
      ORDER BY payment_at_ts ASC, id DESC
      `,
      [userId]
    );

    // Bombas recibidas: Q♠ cuya J♠ madre es DEADLINE y está dentro de los próximos 30 minutos
    const esAhoraQResult = await pool.query(
      `
      SELECT
        q.*,
        d.name AS deck_name,
        parent.spade_mode AS parent_spade_mode,
        parent.start_date AS parent_start_date,
        parent.end_date AS parent_end_date,
        parent.location AS parent_location,
        parent.play_text AS parent_play_text
      FROM plays q
      LEFT JOIN plays parent
        ON parent.id = q.parent_play_id
      LEFT JOIN decks d
        ON d.id = q.deck_id
      WHERE q.target_user_id = $1
        AND q.card_rank = 'Q'
        AND q.card_suit = 'SPADE'
        AND UPPER(COALESCE(q.play_status, '')) = 'APPROVED'
        AND UPPER(COALESCE(parent.spade_mode, '')) = 'DEADLINE'
        AND parent.end_date IS NOT NULL
        AND parent.end_date BETWEEN NOW() AND NOW() + INTERVAL '30 minutes'
        AND COALESCE(parent.play_code, '') NOT ILIKE '%bomb:DISABLED%'
        AND COALESCE(parent.play_code, '') NOT ILIKE '%bomb:DONE%'
      ORDER BY parent.end_date ASC, q.created_at DESC
      `,
      [userId]
    );

    const teMandanAhoraResult = await pool.query(
      `
      SELECT
        p.id,
        p.deck_id,
        p.card_rank,
        p.card_suit,
        p.play_status,
        p.created_at,
        p.updated_at,
        d.name AS deck_name
      FROM plays p
      LEFT JOIN decks d
        ON d.id = p.deck_id
      WHERE p.target_user_id = $1
        AND UPPER(COALESCE(p.play_status, '')) IN ('SENT', 'PENDING')
        AND p.card_rank IN ('K', 'A')
      ORDER BY p.created_at DESC
      LIMIT 50
      `,
      [userId]
    );

    return res.json({
      ok: true,
      esAhora: [...esAhoraJResult.rows, ...esAhoraQResult.rows, ...esAhoraQHeartResult.rows],
      teMandanAhora: teMandanAhoraResult.rows,
    });
  } catch (error) {
    console.error('Error en GET /plays/ahora', error);
    return res.status(500).json({
      ok: false,
      error: 'Error obteniendo ahora',
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

          const activeStatuses = ['ACTIVE', 'APPROVED', 'SENT'];
          const archivedVisibleStatuses = [
            ...activeStatuses,
            'REJECTED', // Q
            'CANCELLED', // Q
            'QUIT',     // K/A
            'FIRED'     // K/A
          ];

          const corporateEntries = getCorporateCardEntriesFromPlays(plays, userId);
          let current_user_cards = normalizeCredentialList(
            corporateEntries.map((entry) => entry.credential)
          );

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
            is_active_member: Boolean(deck.is_active_member)
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

    // Filtrar mazos según membership_status para el usuario actual:
    // - si wantsArchived === false => membership_status === 'ACTIVE'
    // - si wantsArchived === true  => membership_status !== 'ACTIVE'
    const filteredMazos = wantsArchived
      ? mazos.filter((d) => String(d.membership_status || '').toUpperCase() !== 'ACTIVE')
      : mazos.filter((d) => String(d.membership_status || '').toUpperCase() === 'ACTIVE');

    return res.json({
      ok: true,
      mazos: filteredMazos
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
  final_target.id AS final_target_user_id,
  final_target.nickname AS final_target_nickname,
  final_target.profile_photo_url AS final_target_profile_photo_url,
  EXISTS (
    SELECT 1
    FROM play_recurrences pr
    WHERE pr.play_id = p.id
  ) AS has_recurrence
    FROM plays p
    LEFT JOIN deck_members dm
      ON dm.deck_id = p.deck_id
      AND dm.user_id = $2
      LEFT JOIN users creator
        ON creator.id = p.created_by_user_id
      LEFT JOIN users target
        ON target.id = p.target_user_id
      LEFT JOIN users final_target
         ON final_target.id = NULLIF(
           substring(p.play_code from 'finalTarget:U:([0-9]+)'),
            ''
         )::int  
      WHERE p.deck_id = $1
        AND (
    ${visibilityWhere}

    OR (
      p.card_rank IN ('A', 'K')
      AND p.card_suit IN ('HEART', 'SPADE', 'DIAMOND', 'CLUB')
      AND UPPER(COALESCE(p.play_status, '')) NOT IN ('QUIT', 'FIRED', 'REJECTED', 'CANCELLED')
      AND split_part(p.play_code, '§', 8) <> 'acl'
      AND split_part(p.play_code, '§', 6) <> 'puedeJugar'
      AND (
        p.created_by_user_id = $2
        OR p.target_user_id = $2
        OR split_part(p.play_code, '§', 2) = $2::text
      )
    )
  )
      ORDER BY p.id ASC
      `,
      [mazoId, userId, String(userId), `U:${userId}`]
    );

    const issuedWithByUser = await buildCorporateIssuedWithByUserForDeck(pool, mazoId);

    const plays = result.rows.map((play) => {
      const rank = String(play.card_rank || '').trim().toUpperCase();
      if (rank !== 'K') return play;

      const senderUserId = Number(play.created_by_user_id || 0);
      if (!senderUserId) return play;

      return {
        ...play,
        issued_with: issuedWithByUser.get(senderUserId) || [],
      };
    });

    const corporateCards = getCorporateCardEntriesFromPlays(plays, userId)
      .map((entry) => ({
        play_id: entry.play_id,
        owner_user_id: entry.owner_user_id,
        card_rank: entry.card_rank,
        card_suit: entry.card_suit,
        play_status: entry.play_status,
      }));

    return res.json({
      ok: true,
      mazoId,
      userId,
      mazo,
      deck: mazo,
      plays,
      corporateCards,
      canPlay: corporateCards.length > 0,
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

app.get('/plays/:id/messages', requireAuth, async (req, res) => {
  const client = await pool.connect();

  try {
    const playId = Number(req.params.id || 0);
    const userId = Number(req.auth.userId || 0);

    if (!playId) {
      return res.status(400).json({ ok: false, error: 'playId invalido' });
    }

    const play = await fetchPlayForChat(client, playId);

    if (!play) {
      return res.status(404).json({ ok: false, error: 'Jugada no encontrada' });
    }

    const mazo = await getMazoByIdForUser(client, Number(play.deck_id || 0), userId);
    if (!mazo) {
      return res.status(403).json({ ok: false, error: 'Sin acceso al mazo' });
    }

    const isPublic = playReadersArePublic(play.reader_user_ids);
    const participants = getPlayParticipantUserIds(play);

    if (!isPublic && !participants.includes(userId)) {
      return res.status(403).json({ ok: false, error: 'Sin acceso al talud de esta jugada' });
    }

    let messagesResult = { rows: [] };
    let schema = { columns: new Set(), hasAttachmentsTable: false };

    try {
      schema = await loadPlayMessagesSchema(client);

      if (!schema.columns.size) {
        return res.json({
          ok: true,
          play: {
            id: Number(play.id),
            deck_id: Number(play.deck_id || 0),
            play_text: play.play_text || '',
            card_rank: play.card_rank || '',
            card_suit: play.card_suit || '',
            play_status: play.play_status || '',
          },
          isPublic,
          participants: [],
          messages: [],
          warning: 'Talud aun no disponible en esta instalacion'
        });
      }

      const playRefColumn = pickExistingPlayMessagesColumn(schema.columns, [
        'play_id',
        'source_play_id',
        'parent_play_id',
        'playid',
      ]);
      const authorColumn = pickExistingPlayMessagesColumn(schema.columns, [
        'author_user_id',
        'created_by_user_id',
        'sender_user_id',
        'user_id',
      ]);
      const createdAtColumn = pickExistingPlayMessagesColumn(schema.columns, [
        'created_at',
        'createdat',
        'inserted_at',
      ]) || 'created_at';
      const idColumn = pickExistingPlayMessagesColumn(schema.columns, [
        'id',
        'message_id',
      ]) || 'id';

      if (!playRefColumn || !authorColumn) {
        return res.json({
          ok: true,
          play: {
            id: Number(play.id),
            deck_id: Number(play.deck_id || 0),
            play_text: play.play_text || '',
            card_rank: play.card_rank || '',
            card_suit: play.card_suit || '',
            play_status: play.play_status || '',
          },
          isPublic,
          participants: [],
          messages: [],
          warning: 'Schema de talud incompleto (play/author reference)'
        });
      }

      const playMessagesTableName = getQualifiedTableName(schema.tableSchema, 'play_messages');

      messagesResult = await client.query(
        `
        SELECT
          pm.*,
          pm.${quoteSqlIdent(idColumn)} AS message_primary_id,
          pm.${quoteSqlIdent(playRefColumn)} AS message_play_ref,
          pm.${quoteSqlIdent(createdAtColumn)} AS message_created_at,
          pm.${quoteSqlIdent(authorColumn)} AS message_author_user_id,
          author.nickname AS author_nickname,
          author.profile_photo_url AS author_profile_photo_url
        FROM ${playMessagesTableName} pm
        LEFT JOIN users author
          ON author.id = pm.${quoteSqlIdent(authorColumn)}
        WHERE pm.${quoteSqlIdent(playRefColumn)} = $1
        ORDER BY pm.${quoteSqlIdent(createdAtColumn)} ASC, pm.${quoteSqlIdent(idColumn)} ASC
        `,
        [playId]
      );
    } catch (queryError) {
      console.warn('play_messages table not ready, returning empty messages', queryError?.message);

      const usersMap = await fetchUsersMapByIds(client, participants);

      return res.json({
        ok: true,
        play: {
          id: Number(play.id),
          deck_id: Number(play.deck_id || 0),
          play_text: play.play_text || '',
          card_rank: play.card_rank || '',
          card_suit: play.card_suit || '',
          play_status: play.play_status || '',
        },
        isPublic,
        participants: participants.map((id) => {
          const user = usersMap[id];
          return {
            id,
            nickname: user?.nickname || `Usuario ${id}`,
            profile_photo_url: user?.profile_photo_url || '/assets/icons/singeta120.gif',
          };
        }),
        messages: [],
      });
    }

    const textColumn = pickExistingPlayMessagesColumn(schema.columns, [
      'message_text',
      'message',
      'text',
      'body',
      'content',
    ]);

    let attachmentsByMessageId = {};

    if (schema.hasAttachmentsTable && messagesResult.rows.length) {
      try {
        const messageIds = messagesResult.rows
          .map((row) => Number(row.message_primary_id || row.id || 0))
          .filter((id) => id > 0);

        if (messageIds.length) {
          const attachmentsTableName = getQualifiedTableName(
            schema.attachmentsTableSchema,
            'play_message_attachments'
          );

          const attachmentsResult = await client.query(
            `
            SELECT
              id,
              message_id,
              file_url,
              file_name,
              mime_type,
              file_size,
              created_at
            FROM ${attachmentsTableName}
            WHERE message_id = ANY($1::bigint[])
            ORDER BY id ASC
            `,
            [messageIds]
          );

          attachmentsByMessageId = attachmentsResult.rows.reduce((acc, row) => {
            const messageId = Number(row.message_id || 0);
            if (!messageId) return acc;

            if (!acc[messageId]) acc[messageId] = [];

            acc[messageId].push({
              id: Number(row.id || 0),
              file_url: row.file_url || '',
              file_name: row.file_name || '',
              mime_type: row.mime_type || '',
              file_size: Number(row.file_size || 0) || 0,
              created_at: row.created_at,
            });

            return acc;
          }, {});
        }
      } catch (attachError) {
        console.warn('Could not fetch attachments', attachError?.message);
      }
    }

    const usersMap = await fetchUsersMapByIds(client, participants);

    const messages = messagesResult.rows.map((row) => {
      const authorId = Number(row.message_author_user_id || row.author_user_id || 0);
      const userFromMap = usersMap[authorId] || null;
      const resolvedText = textColumn
        ? String(row[textColumn] || '')
        : String(row.message_text || row.message || row.text || row.body || row.content || '');

      return {
        id: Number(row.message_primary_id || row.id || 0),
        play_id: Number(row.message_play_ref || row.play_id || playId),
        author_user_id: authorId,
        text: resolvedText,
        is_system: Boolean(row.is_system),
        created_at: row.message_created_at || row.created_at,
        author_nickname:
          row.author_nickname ||
          userFromMap?.nickname ||
          (authorId ? `Usuario ${authorId}` : 'Sistema'),
        author_profile_photo_url:
          row.author_profile_photo_url ||
          userFromMap?.profile_photo_url ||
          '/assets/icons/singeta120.gif',
        attachments: attachmentsByMessageId[Number(row.message_primary_id || row.id || 0)] || [],
      };
    });

    try {
      await markTaludMessagesRead(client, playId, userId);
    } catch (readError) {
      console.warn('Could not mark talud messages as read', readError?.message);
    }

    return res.json({
      ok: true,
      play: {
        id: Number(play.id),
        deck_id: Number(play.deck_id || 0),
        play_text: play.play_text || '',
        card_rank: play.card_rank || '',
        card_suit: play.card_suit || '',
        play_status: play.play_status || '',
      },
      isPublic,
      participants: participants.map((id) => {
        const user = usersMap[id];
        return {
          id,
          nickname: user?.nickname || `Usuario ${id}`,
          profile_photo_url: user?.profile_photo_url || '/assets/icons/singeta120.gif',
        };
      }),
      messages,
    });
  } catch (error) {
    console.error('Error en GET /plays/:id/messages', error);
    return res.status(500).json({ ok: false, error: error?.message || 'No se pudo cargar el talud' });
  } finally {
    client.release();
  }
});

app.post('/plays/:id/messages', requireAuth, async (req, res) => {
  const client = await pool.connect();

  try {
    const playId = Number(req.params.id || 0);
    const userId = Number(req.auth.userId || 0);
    const messageText = String(req.body?.text || '').trim();
    const attachments = Array.isArray(req.body?.attachments) ? req.body.attachments : [];

    if (!playId) {
      return res.status(400).json({ ok: false, error: 'playId invalido' });
    }

    if (!messageText) {
      return res.status(400).json({ ok: false, error: 'El mensaje no puede estar vacio' });
    }

    const play = await fetchPlayForChat(client, playId);

    if (!play) {
      return res.status(404).json({ ok: false, error: 'Jugada no encontrada' });
    }

    const mazo = await getMazoByIdForUser(client, Number(play.deck_id || 0), userId);
    if (!mazo) {
      return res.status(403).json({ ok: false, error: 'Sin acceso al mazo' });
    }

    const isPublic = playReadersArePublic(play.reader_user_ids);
    const participants = getPlayParticipantUserIds(play);

    if (!isPublic && !participants.includes(userId)) {
      return res.status(403).json({ ok: false, error: 'No sos participante del talud' });
    }

    let schema = { columns: new Set(), hasAttachmentsTable: false };

    try {
      schema = await loadPlayMessagesSchema(client);

      if (!schema.columns.size) {
        return res.status(503).json({ ok: false, error: 'Talud no disponible aun' });
      }
    } catch (schemaError) {
      console.warn('Could not load play_messages schema', schemaError?.message);
      return res.status(503).json({ ok: false, error: 'Talud no disponible aun' });
    }

    const playRefColumn = pickExistingPlayMessagesColumn(schema.columns, [
      'play_id',
      'source_play_id',
      'parent_play_id',
      'playid',
    ]);
    const authorColumn = pickExistingPlayMessagesColumn(schema.columns, [
      'author_user_id',
      'created_by_user_id',
      'sender_user_id',
      'user_id',
    ]);
    const textColumn = pickExistingPlayMessagesColumn(schema.columns, [
      'message_text',
      'message',
      'text',
      'body',
      'content',
    ]);

    if (!playRefColumn || !authorColumn || !textColumn) {
      return res.status(503).json({ ok: false, error: 'Schema de talud incompleto' });
    }

    const insertColumns = [playRefColumn, authorColumn, textColumn];
    const values = [playId, userId, messageText];

    if (schema.columns.has('is_system')) {
      insertColumns.push('is_system');
      values.push(false);
    }

    const placeholders = values.map((_, index) => `$${index + 1}`);

    const playMessagesTableName = getQualifiedTableName(schema.tableSchema, 'play_messages');

    const insertSql = `
      INSERT INTO ${playMessagesTableName} (${insertColumns.map((name) => quoteSqlIdent(name)).join(', ')})
      VALUES (${placeholders.join(', ')})
      RETURNING *
    `;

    await client.query('BEGIN');

    const insertedResult = await client.query(insertSql, values);
    const insertedMessage = insertedResult.rows[0];
    const insertedMessageId = Number(insertedMessage?.id || 0);

    let insertedAttachments = [];

    if (schema.hasAttachmentsTable && insertedMessageId && attachments.length) {
      for (const rawAttachment of attachments) {
        const fileUrl = String(rawAttachment?.file_url || '').trim();
        if (!fileUrl) continue;

        try {
          const attachmentsTableName = getQualifiedTableName(
            schema.attachmentsTableSchema,
            'play_message_attachments'
          );

          const attachmentResult = await client.query(
            `
            INSERT INTO ${attachmentsTableName} (
              message_id,
              file_url,
              file_name,
              mime_type,
              file_size
            )
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id, message_id, file_url, file_name, mime_type, file_size, created_at
            `,
            [
              insertedMessageId,
              fileUrl,
              String(rawAttachment?.file_name || '').trim() || null,
              String(rawAttachment?.mime_type || '').trim() || null,
              Number(rawAttachment?.file_size || 0) || null,
            ]
          );

          if (attachmentResult.rows[0]) {
            insertedAttachments.push(attachmentResult.rows[0]);
          }
        } catch (attachError) {
          console.warn('Could not insert attachment', attachError?.message);
        }
      }
    }

    await client.query('COMMIT');

    const authorResult = await client.query(
      `
      SELECT id, nickname, profile_photo_url
      FROM users
      WHERE id = $1
      LIMIT 1
      `,
      [userId]
    );

    const author = authorResult.rows[0] || null;
    const resolvedText = String(
      insertedMessage?.[textColumn] ||
      insertedMessage?.message_text ||
      insertedMessage?.message ||
      insertedMessage?.text ||
      insertedMessage?.body ||
      insertedMessage?.content ||
      messageText
    );

    return res.status(201).json({
      ok: true,
      message: {
        id: insertedMessageId,
        play_id: Number(insertedMessage?.[playRefColumn] || insertedMessage?.play_id || playId),
        author_user_id: Number(insertedMessage?.[authorColumn] || userId),
        text: resolvedText,
        is_system: Boolean(insertedMessage?.is_system),
        created_at: insertedMessage?.created_at,
        author_nickname: author?.nickname || `Usuario ${userId}`,
        author_profile_photo_url: author?.profile_photo_url || '/assets/icons/singeta120.gif',
        attachments: insertedAttachments.map((item) => ({
          id: Number(item.id || 0),
          file_url: item.file_url || '',
          file_name: item.file_name || '',
          mime_type: item.mime_type || '',
          file_size: Number(item.file_size || 0) || 0,
          created_at: item.created_at,
        })),
      },
    });
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {
      // noop
    }

    console.error('Error en POST /plays/:id/messages', error);
    return res.status(500).json({ ok: false, error: error?.message || 'No se pudo guardar el mensaje' });
  } finally {
    client.release();
  }
});

app.get('/plays/messages/unread-first', requireAuth, async (req, res) => {
  const client = await pool.connect();

  try {
    const userId = Number(req.auth.userId || 0);

    if (!userId) {
      return res.status(401).json({ ok: false, error: 'Usuario no autenticado' });
    }

    let schema = { columns: new Set(), hasAttachmentsTable: false };

    try {
      schema = await loadPlayMessagesSchema(client);
    } catch (schemaError) {
      console.warn('Could not load play_messages schema for unread-first', schemaError?.message);
      return res.json({ ok: true, hasUnread: false, unread: null });
    }

    if (!schema.columns.size) {
      return res.json({ ok: true, hasUnread: false, unread: null });
    }

    const playRefColumn = pickExistingPlayMessagesColumn(schema.columns, [
      'play_id',
      'source_play_id',
      'parent_play_id',
      'playid',
    ]);
    const authorColumn = pickExistingPlayMessagesColumn(schema.columns, [
      'author_user_id',
      'created_by_user_id',
      'sender_user_id',
      'user_id',
    ]);
    const createdAtColumn = pickExistingPlayMessagesColumn(schema.columns, [
      'created_at',
      'createdat',
      'inserted_at',
    ]) || 'created_at';
    const idColumn = pickExistingPlayMessagesColumn(schema.columns, [
      'id',
      'message_id',
    ]) || 'id';

    if (!playRefColumn || !authorColumn) {
      return res.json({ ok: true, hasUnread: false, unread: null });
    }

    const playMessagesTableName = getQualifiedTableName(schema.tableSchema, 'play_messages');
    const unreadCandidatesResult = await client.query(
      `
      SELECT
        pm.${quoteSqlIdent(idColumn)} AS message_id,
        pm.${quoteSqlIdent(playRefColumn)} AS message_play_id,
        pm.${quoteSqlIdent(createdAtColumn)} AS message_created_at,
        pm.${quoteSqlIdent(authorColumn)} AS message_author_user_id
      FROM ${playMessagesTableName} pm
      WHERE pm.${quoteSqlIdent(authorColumn)} IS NOT NULL
      ORDER BY pm.${quoteSqlIdent(createdAtColumn)} ASC, pm.${quoteSqlIdent(idColumn)} ASC
      LIMIT 400
      `,
      []
    );

    console.log('TALUD unread-first candidates', {
      userId,
      count: unreadCandidatesResult.rows.length,
      sample: unreadCandidatesResult.rows.slice(0, 5).map((row) => ({
        play_id: row.message_play_id,
        message_id: row.message_id,
        message_author_user_id: row.message_author_user_id,
        message_created_at: row.message_created_at,
      })),
    });

    const candidatePlayIds = [...new Set(
      unreadCandidatesResult.rows
        .map((row) => Number(row.message_play_id || 0))
        .filter((id) => Number.isInteger(id) && id > 0)
    )];

    const playReadsResult = candidatePlayIds.length
      ? await client.query(
          `
          SELECT play_id, read_at
          FROM play_reads
          WHERE user_id = $1
            AND reason = $2
            AND play_id = ANY($3::int[])
          `,
          [userId, TALUD_READ_REASON, candidatePlayIds]
        )
      : { rows: [] };

    const playReadMap = playReadsResult.rows.reduce((acc, row) => {
      acc[Number(row.play_id || 0)] = row.read_at || null;
      return acc;
    }, {});

    const playsMap = {};

    for (const playId of candidatePlayIds) {
      const play = await fetchPlayForChat(client, playId);
      if (play) {
        playsMap[playId] = play;
      }
    }

    let unread = null;

    for (const row of unreadCandidatesResult.rows) {
      const playId = Number(row.message_play_id || 0);
      const authorUserId = Number(row.message_author_user_id || 0);
      if (!playId || !authorUserId || authorUserId === userId) continue;

      const play = playsMap[playId] || null;
      if (!play) continue;

      if (String(play.card_rank || '').toUpperCase() !== 'Q') continue;
      if (String(play.card_suit || '').toUpperCase() !== 'SPADE') continue;
      if (!String(play.play_code || '').includes('pay:QHEART')) continue;

      const isPublic = playReadersArePublic(play.reader_user_ids);
      const participants = getPlayParticipantUserIds(play);

      if (!isPublic && !participants.includes(userId)) {
        continue;
      }

      const createdAtMs = Date.parse(row.message_created_at || '');
      const readAtMs = playReadMap[playId] ? Date.parse(playReadMap[playId]) : NaN;

      if (Number.isFinite(createdAtMs) && Number.isFinite(readAtMs) && createdAtMs <= readAtMs) {
        continue;
      }

      unread = row;
      break;
    }

    console.log('TALUD unread-first selected', {
      userId,
      unread: unread
        ? {
            play_id: unread.play_id,
            deck_id: unread.deck_id,
            message_id: unread.message_id,
            message_author_user_id: unread.message_author_user_id,
            message_created_at: unread.message_created_at,
          }
        : null,
    });

    if (!unread) {
      return res.json({ ok: true, hasUnread: false, unread: null });
    }

    return res.json({
      ok: true,
      hasUnread: true,
      unread: {
        play_id: Number(unread.message_play_id || 0),
        deck_id: Number(playsMap[Number(unread.message_play_id || 0)]?.deck_id || 0),
        play_text: String(playsMap[Number(unread.message_play_id || 0)]?.play_text || ''),
        message_id: Number(unread.message_id || 0),
        message_created_at: unread.message_created_at,
      }
    });
  } catch (error) {
    console.error('Error en GET /plays/messages/unread-first', error);
    return res.status(500).json({
      ok: false,
      error: 'No se pudo obtener el talud no leido',
      detail: error?.message || 'UNKNOWN_ERROR'
    });
  } finally {
    client.release();
  }
});

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

    const issuedWith = await getIssuedWithForUser(client, mazoId, userId);

    const created = await insertInstitutionalPlay(client, {
      mazoId,
      createdByUserId: userId,
      parentPlayId: parent_play_id,
      targetUserId: target_user_id,
      playCode: play_code,
      playText: text,
      playStatus: play_status,
      issuedWith,
    });

    // Readers iniciales de la jugada recién creada
    await handleReadersOnPlayCreate(client, created.row);
    await stampPlayIfNeeded(client, created.row);

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

app.post('/plays/:id/transfer-ace', requireAuth, async (req, res) => {
  const client = await pool.connect();

  try {
    const sourceAceId = Number(req.params.id || 0);
    const currentUserId = Number(req.auth.userId || 0);
    const newOwnerId = Number(req.body.target_user_id || 0);

    if (!sourceAceId || !newOwnerId) {
      return res.status(400).json({
        ok: false,
        error: 'Faltan sourceAceId o target_user_id'
      });
    }

    await client.query('BEGIN');

    const sourceResult = await client.query(
      `
      SELECT *
      FROM plays
      WHERE id = $1
      LIMIT 1
      `,
      [sourceAceId]
    );

    const sourceAce = sourceResult.rows[0];

    if (!sourceAce) {
      await client.query('ROLLBACK');
      return res.status(404).json({ ok: false, error: 'As no encontrado' });
    }

    const rank = String(sourceAce.card_rank || '').toUpperCase();
    const suit = String(sourceAce.card_suit || '').toUpperCase();
    const flow = String(sourceAce.play_code || '').split('§')[7] || '';

    if (rank !== 'A' || flow !== 'foundation') {
      await client.query('ROLLBACK');
      return res.status(400).json({ ok: false, error: 'La jugada madre debe ser un As fundacional' });
    }

    if (suit === 'HEART') {
      await client.query('ROLLBACK');
      return res.status(400).json({ ok: false, error: 'El A♥ no se transfiere' });
    }

    const oldOwnerId = Number(sourceAce.target_user_id || sourceAce.created_by_user_id || 0);

    if (oldOwnerId !== currentUserId) {
      await client.query('ROLLBACK');
      return res.status(403).json({ ok: false, error: 'Solo el propietario actual puede transferir este As' });
    }

    if (newOwnerId === oldOwnerId) {
      await client.query('ROLLBACK');
      return res.status(400).json({ ok: false, error: 'El nuevo propietario debe ser otro usuario' });
    }

    const targetCheck = await client.query(
      `SELECT id FROM users WHERE id = $1 LIMIT 1`,
      [newOwnerId]
    );

    if (!targetCheck.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ ok: false, error: 'Usuario destino no encontrado' });
    }

    const issuedWith = await getIssuedWithForUser(
      client,
      sourceAce.deck_id,
      currentUserId
    );

    const acePlayCode = buildPlayCode({
      mazoId: sourceAce.deck_id,
      userId: currentUserId,
      rank: 'A',
      suit,
      action: 'transfer_ace',
      authorized: `U:${currentUserId}`,
      flow: `child_of:${sourceAce.id};transfer:${sourceAce.id};from:U:${oldOwnerId};to:U:${newOwnerId}`,
      recipients: `U:${newOwnerId}`
    });

    const createdAce = await insertInstitutionalPlay(client, {
      mazoId: sourceAce.deck_id,
      createdByUserId: currentUserId,
      parentPlayId: sourceAce.id,
      targetUserId: newOwnerId,
      playCode: acePlayCode,
      playText: '',
      playStatus: 'SENT',
      issuedWith
    });

    await handleReadersOnPlayCreate(client, createdAce.row);
    await expandReadersForASend(client, createdAce.row);

    await client.query('COMMIT');

    return res.json({
      ok: true,
      aceTransfer: createdAce.row,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error en transfer-ace', error);
    return res.status(error.statusCode || 500).json({
      ok: false,
      error: error.message || 'No se pudo transferir el As'
    });
  } finally {
    client.release();
  }
});

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
      play_code,
      target_user_id
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


    const mazo = await getMazoByIdForUser(client, current.deck_id, userId);

    if (!mazo) {
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
      const isQClub = currentRank === 'Q' && currentSuit === 'CLUB';
      const isKCard = currentRank === 'K';
      const isACard = currentRank === 'A';
      const isJHeart = currentRank === 'J' && currentSuit === 'HEART';

      if (!isQSpade && !isQClub && !isKCard && !isACard && !isJHeart) {
        return res.status(400).json({
          ok: false,
          error: 'Solo una Q♠/Q♣ o una K, A o una J♥ pueden enviarse'
        });
      }

      const creatorUserId = Number(current.created_by_user_id || 0);
      const aceClubOwnerUserId = await getAceClubOwnerUserId(client, current.deck_id);

      const isCreator = creatorUserId && Number(userId) === creatorUserId;

      const isAceClubFinalSender =
        (isKCard || isQSpade) &&
        Number(userId) === Number(aceClubOwnerUserId);

      if (!isCreator && !isAceClubFinalSender) {
        return res.status(403).json({
          ok: false,
          error: 'Solo el creador o el A♣ puede enviar esta jugada'
        });
      }
      if (
        currentStatus === 'SENT' ||
        currentStatus === 'APPROVED' ||
        currentStatus === 'REJECTED' ||
        currentStatus === 'CANCELLED' ||
        currentStatus === 'QUIT' ||
        currentStatus === 'FIRED'
      ) {
        return res.status(400).json({
          ok: false,
          error: 'Esta jugada ya no puede enviarse'
        });
      }

      if ((isKCard || isACard || isQSpade || isQClub) && !Number(current.target_user_id || 0)) {
        return res.status(400).json({
          ok: false,
          error: 'La invitación debe tener target_user_id'
        });
      }

      const needsAceClubFinalSend = isKCard || isQSpade;

      if (needsAceClubFinalSend && Number(userId) !== aceClubOwnerUserId) {
        return res.status(403).json({
          ok: false,
          error: 'Solo el A♣ puede enviar esta invitación al destinatario final'
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

      else if (currentRank === 'A') {
        const targetUserId = Number(current.target_user_id || 0);

        if (!targetUserId || Number(userId) !== targetUserId) {
          return res.status(403).json({
            ok: false,
            error: 'Solo el destinatario puede aceptar esta transferencia de A'
          });
        }

        if (currentStatus !== 'SENT' && currentStatus !== 'PENDING') {
          return res.status(400).json({
            ok: false,
            error: 'Solo una A enviada puede aprobarse'
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

    if (play_status === 'REJECTED') {
      const isQSpade = currentRank === 'Q' && currentSuit === 'SPADE';
      const isKCard = currentRank === 'K';
      const isACard = currentRank === 'A';
      const isJHeart = currentRank === 'J' && currentSuit === 'HEART';

      if (!isQSpade && !isKCard && !isACard && !isJHeart) {
        return res.status(400).json({
          ok: false,
          error: 'Esta jugada no admite rechazo'
        });
      }

      const targetUserId = Number(current.target_user_id || 0);
      const aceClubOwnerUserId = await getAceClubOwnerUserId(client, current.deck_id);
      const creatorUserId = Number(current.created_by_user_id || 0);
      const aceHeartOwnerUserId = await getAceOwnerUserId(
        client,
        current.deck_id,
        'HEART'
      );

      const isHeartAceReject =
        isJHeart &&
        Number(userId) === Number(aceHeartOwnerUserId);

      const isTargetReject =
        targetUserId &&
        Number(userId) === targetUserId;

      const pendingValidationForUser = await client.query(
        `
  SELECT 1
  FROM play_validations
  WHERE play_id = $1
    AND validator_user_id = $2
    AND validation_status = 'PENDING'
  LIMIT 1
  `,
        [current.id, userId]
      );

      const isValidatorReject =
        currentStatus === 'PENDING' &&
        pendingValidationForUser.rows.length > 0;

      if (!isTargetReject && !isValidatorReject && !isHeartAceReject) {
        return res.status(403).json({
          ok: false,
          error: 'Solo el destinatario o un validador pendiente puede rechazar esta invitación'
        });
      }

      if (isTargetReject && currentStatus !== 'SENT' && currentStatus !== 'PENDING') {
        return res.status(400).json({
          ok: false,
          error: 'Solo una invitación enviada puede rechazarse'
        });
      }

      if (isValidatorReject && currentStatus !== 'PENDING') {
        return res.status(400).json({
          ok: false,
          error: 'Solo una solicitud pendiente puede rechazarse'
        });
      }

      if (isValidatorReject && creatorUserId) {
        await addReadersToPlay(client, current.id, [creatorUserId]);
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

    const patchedFinalTargetUserId =
      play_code ? getFinalTargetFromPlayCode(play_code) : null;

    const currentFinalTargetUserId =
      getFinalTargetFromPlayCode(current.play_code || '');

    const finalTargetUserId =
      patchedFinalTargetUserId || currentFinalTargetUserId || null;

    let nextTargetUserId =
      target_user_id !== undefined
        ? Number(target_user_id || 0) || null
        : current.target_user_id;

    if (
      currentRank === 'K' &&
      nextStatus === 'SENT' &&
      finalTargetUserId
    ) {
      nextTargetUserId = finalTargetUserId;
    }

    await client.query('BEGIN');

    const actorIssuedWith = await getIssuedWithForUser(client, current.deck_id, userId);
    const nextIssuedWith = mergeIssuedWith(current.issued_with, actorIssuedWith);

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
    target_user_id = $10,
    issued_with = $11::jsonb,
updated_at = NOW()
WHERE id = $12
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
        nextTargetUserId,
        JSON.stringify(nextIssuedWith),
        playId
      ]
    );

    const updatedPlay = updateResult.rows[0];

    let deadlineBombRootPlayId = 0;
    const currentSpadeMode = String(current?.spade_mode || '').trim().toUpperCase();

    if (currentRank === 'J' && currentSuit === 'SPADE' && currentSpadeMode === 'DEADLINE') {
      deadlineBombRootPlayId = Number(current.id || 0);
    }

    if (currentRank === 'Q' && currentSuit === 'SPADE') {
      const parentPlayId = Number(current.parent_play_id || 0);

      if (parentPlayId) {
        const parentModeResult = await client.query(
          `
          SELECT spade_mode
          FROM plays
          WHERE id = $1
          LIMIT 1
          `,
          [parentPlayId]
        );

        const parentMode = String(parentModeResult.rows[0]?.spade_mode || '').trim().toUpperCase();

        if (parentMode === 'DEADLINE') {
          deadlineBombRootPlayId = parentPlayId;
        }
      }
    }

    const hadBombDoneBefore = playCodeHasFlowFlag(current.play_code, 'BOMB:DONE');
    const hasBombDoneNow = playCodeHasFlowFlag(updatedPlay.play_code, 'BOMB:DONE');

    const hadBombDisabledBefore = playCodeHasFlowFlag(current.play_code, 'BOMB:DISABLED');
    const hasBombDisabledNow = playCodeHasFlowFlag(updatedPlay.play_code, 'BOMB:DISABLED');

    if (deadlineBombRootPlayId && !hadBombDoneBefore && hasBombDoneNow) {
      await propagateBombFlagToFamily(client, deadlineBombRootPlayId, 'BOMB:DONE');
    }

    if (deadlineBombRootPlayId && !hadBombDisabledBefore && hasBombDisabledNow) {
      await propagateBombFlagToFamily(client, deadlineBombRootPlayId, 'BOMB:DISABLED');
    }

    if (
      currentRank === 'Q' &&
      currentSuit === 'SPADE' &&
      nextStatus === 'PENDING'
    ) {
      const creatorUserId = Number(updatedPlay.created_by_user_id || 0);

      const aceDiamondOwnerUserId = await getAceOwnerUserId(
        client,
        updatedPlay.deck_id,
        'DIAMOND'
      );

      const aceClubOwnerUserId = await getAceOwnerUserId(
        client,
        updatedPlay.deck_id,
        'CLUB'
      );

      const playCodeLower = String(updatedPlay.play_code || '').toLowerCase();

      const hasQHeartPayment =
        playCodeLower.includes('pay:qheart') ||
        playCodeLower.includes('qheart') ||
        playCodeLower.includes('q_heart') ||
        Number(updatedPlay.amount || 0) > 0;

      let order = 1;

      if (
        hasQHeartPayment &&
        aceDiamondOwnerUserId &&
        aceDiamondOwnerUserId !== creatorUserId
      ) {
        await createPlayValidation(client, {
          playId: updatedPlay.id,
          validatorUserId: aceDiamondOwnerUserId,
          validatorRole: 'A_DIAMOND',
          validationOrder: order++
        });

        await addReadersToPlay(client, updatedPlay.id, [aceDiamondOwnerUserId]);
      }

      if (
        aceClubOwnerUserId &&
        aceClubOwnerUserId !== creatorUserId
      ) {
        await createPlayValidation(client, {
          playId: updatedPlay.id,
          validatorUserId: aceClubOwnerUserId,
          validatorRole: 'A_CLUB',
          validationOrder: order++
        });

        await addReadersToPlay(client, updatedPlay.id, [aceClubOwnerUserId]);
      }
      const targetUserId = Number(updatedPlay.target_user_id || 0);

      if (targetUserId) {
        await addReadersToPlay(client, updatedPlay.id, [targetUserId]);
      }

    }

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

    const isSendingJHeartNow =
      currentRank === 'J' &&
      currentSuit === 'HEART' &&
      currentStatus !== 'SENT' &&
      nextStatus === 'SENT';

    const isSendingQSpadeNow =
      currentRank === 'Q' &&
      currentSuit === 'SPADE' &&
      currentStatus !== 'SENT' &&
      nextStatus === 'SENT';

    const isSendingKNow =
      currentRank === 'K' &&
      currentStatus !== 'SENT' &&
      nextStatus === 'SENT';

    const isRoutingKToValidatorNow =
      currentRank === 'K' &&
      currentStatus !== 'PENDING' &&
      nextStatus === 'PENDING';

    if (isRoutingKToValidatorNow) {
      const kSuit = String(updatedPlay.card_suit || '').trim().toUpperCase();

      const validatorSuitByKSuit = {
        HEART: 'HEART',
        SPADE: 'SPADE',
        DIAMOND: 'DIAMOND',
        CLUB: 'CLUB'
      };

      const validatorSuit = validatorSuitByKSuit[kSuit];

      if (!validatorSuit) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          ok: false,
          error: 'La K pendiente tiene un palo inválido'
        });
      }

      const validatorUserId = await getAceOwnerUserId(
        client,
        updatedPlay.deck_id,
        validatorSuit
      );

      if (!validatorUserId) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          ok: false,
          error: `No se encontró propietario del A ${validatorSuit} para validar la K`
        });
      }

      await addReadersToPlay(client, updatedPlay.id, [
        updatedPlay.created_by_user_id,
        validatorUserId
      ]);

      await createPlayValidation(client, {
        playId: updatedPlay.id,
        validatorUserId,
        validatorRole: `A_${validatorSuit}`,
        validationOrder: 1
      });
    }


    const isSendingANow =
      currentRank === 'A' &&
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

    if (isSendingANow) {
      const invitedUserId = Number(updatedPlay.target_user_id || 0);

      if (!invitedUserId) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          ok: false,
          error: 'La A enviada debe tener target_user_id'
        });
      }

      await expandReadersForASend(client, updatedPlay);

      await addReadersToPlay(
        client,
        updatedPlay.id,
        [updatedPlay.created_by_user_id, invitedUserId]
      );

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
      
      await stampPlayIfNeeded(client, updatedPlay, {
        reason: 'SEND_Q_SPADE'
      });
      await expandReadersForQSpadeSend(client, updatedPlay);
    }

    if (isSendingJHeartNow) {
      const deckId = Number(updatedPlay.deck_id || 0);

      const aceResult = await client.query(
        `
    SELECT
      COALESCE(target_user_id, created_by_user_id) AS owner_user_id
    FROM plays
    WHERE deck_id = $1
      AND card_rank = 'A'
      AND card_suit = 'HEART'
      AND split_part(play_code, '§', 8) = 'foundation'
    ORDER BY id ASC
    LIMIT 1
    `,
        [deckId]
      );

      const aceHeartOwnerId = Number(aceResult.rows[0]?.owner_user_id || 0);

      if (!aceHeartOwnerId) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          ok: false,
          error: 'No se encontró dueño de A♥ para enviar la J♥'
        });
      }

      await client.query(
        `
    UPDATE plays
    SET target_user_id = $1,
        updated_at = NOW()
    WHERE id = $2
    `,
        [aceHeartOwnerId, updatedPlay.id]
      );

      updatedPlay.target_user_id = aceHeartOwnerId;

      await addReadersToPlay(client, updatedPlay.id, [
        updatedPlay.created_by_user_id,
        aceHeartOwnerId
      ]);
    }

    const isApprovingJHeartNow =
      currentRank === 'J' &&
      currentSuit === 'HEART' &&
      currentStatus !== 'APPROVED' &&
      nextStatus === 'APPROVED';

    if (isApprovingJHeartNow) {
      await handleApproveJHeart(client, updatedPlay);
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

    const isApprovingANow =
      currentRank === 'A' &&
      currentStatus !== 'APPROVED' &&
      nextStatus === 'APPROVED';

    if (isApprovingANow) {
      const invitedUserId = Number(updatedPlay.target_user_id || 0);
      const deckId = Number(updatedPlay.deck_id || 0);
      const parentAceId = Number(updatedPlay.parent_play_id || 0);

      const previousAceOwnerResult = await client.query(
        `
  SELECT COALESCE(target_user_id, created_by_user_id) AS owner_user_id
  FROM plays
  WHERE id = $1
    AND deck_id = $2
    AND card_rank = 'A'
    AND card_suit = $3
    AND split_part(play_code, '§', 8) = 'foundation'
  LIMIT 1
  `,
        [parentAceId, deckId, currentSuit]
      );

      const previousAceOwnerId = Number(
        previousAceOwnerResult.rows[0]?.owner_user_id || 0
      );

      if (!invitedUserId || !deckId || !parentAceId) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          ok: false,
          error: 'La A aprobada debe tener target_user_id, deck_id y parent_play_id válidos'
        });
      }

      await client.query(
        `
    UPDATE plays
    SET target_user_id = $1,
        updated_at = NOW()
    WHERE id = $2
      AND deck_id = $3
      AND card_rank = 'A'
      AND card_suit = $4
      AND split_part(play_code, '§', 8) = 'foundation'
    `,
        [invitedUserId, parentAceId, deckId, currentSuit]
      );

      await addReadersToPlay(
        client,
        parentAceId,
        [updatedPlay.created_by_user_id, invitedUserId]
      );

      await client.query(
        `
    INSERT INTO deck_members (deck_id, user_id)
    VALUES ($1, $2)
    ON CONFLICT DO NOTHING
    `,
        [deckId, invitedUserId]
      );

      await addUserToAclLines(client, deckId, invitedUserId);

      if (
        currentSuit !== 'HEART' &&
        currentSuit !== 'CLUB' &&
        previousAceOwnerId
      ) {
        const fallbackKingPlayCode = buildPlayCode({
          mazoId: deckId,
          userId: previousAceOwnerId,
          rank: 'K',
          suit: currentSuit,
          action: 'ace_transfer_fallback_king',
          authorized: `U:${previousAceOwnerId}`,
          flow: 'ownership',
          recipients: `U:${previousAceOwnerId}`,
        });

        const createdFallbackKing = await insertInstitutionalPlay(client, {
          mazoId: deckId,
          createdByUserId: previousAceOwnerId,
          parentPlayId: parentAceId,
          targetUserId: null,
          playCode: fallbackKingPlayCode,
          playText: 'K conservada por transferencia de A',
          playStatus: 'APPROVED',
        });

        await setPlayReaders(client, createdFallbackKing.row.id, [previousAceOwnerId]);

        await addUserToAclLines(client, deckId, previousAceOwnerId);
      }
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

    const isRejectingKNow =
      currentRank === 'K' &&
      currentStatus !== 'REJECTED' &&
      nextStatus === 'REJECTED';

    if (isRejectingKNow) {
      const invitedUserId = Number(updatedPlay.target_user_id || 0);
      const deckId = Number(updatedPlay.deck_id || 0);

      if (!invitedUserId || !deckId) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          ok: false,
          error: 'La K rechazada debe tener target_user_id y deck_id válidos'
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
          [deckId, invitedUserId, 'K_REJECTED', updatedPlay.id]
        );
      }
    }

    const isRejectingANow =
      currentRank === 'A' &&
      currentStatus !== 'REJECTED' &&
      nextStatus === 'REJECTED';

    if (isRejectingANow) {
      const targetUserId = Number(updatedPlay.target_user_id || 0);
      const deckId = Number(updatedPlay.deck_id || 0);

      if (!targetUserId || !deckId) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          ok: false,
          error: 'La A rechazada debe tener target_user_id y deck_id válidos'
        });
      }

      await removeUserFromAclLines(client, deckId, targetUserId);

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
        [deckId, targetUserId, updatedPlay.id]
      );

      const hasAnotherTie = tieCheck.rows.length > 0;

      if (!hasAnotherTie) {
        await client.query(
          `
      DELETE FROM deck_members
      WHERE deck_id = $1
        AND user_id = $2
      `,
          [deckId, targetUserId]
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
          [deckId, targetUserId, 'A_REJECTED', updatedPlay.id]
        );
      }
    }

    const isQuittingANow =
      currentRank === 'A' &&
      currentStatus !== 'QUIT' &&
      nextStatus === 'QUIT';

    if (isQuittingANow) {
      const targetUserId = Number(updatedPlay.target_user_id || 0);
      const deckId = Number(updatedPlay.deck_id || 0);

      if (!targetUserId || !deckId) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          ok: false,
          error: 'La A renunciada debe tener target_user_id y deck_id válidos'
        });
      }

      await removeUserFromAclLines(client, deckId, targetUserId);

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
        [deckId, targetUserId, updatedPlay.id]
      );

      const hasAnotherTie = tieCheck.rows.length > 0;

      if (!hasAnotherTie) {
        await client.query(
          `
      DELETE FROM deck_members
      WHERE deck_id = $1
        AND user_id = $2
      `,
          [deckId, targetUserId]
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
          [deckId, targetUserId, 'A_QUIT', updatedPlay.id]
        );
      }
    }

    const isFiringANow =
      currentRank === 'A' &&
      currentStatus !== 'FIRED' &&
      nextStatus === 'FIRED';

    if (isFiringANow) {
      const targetUserId = Number(updatedPlay.target_user_id || 0);
      const deckId = Number(updatedPlay.deck_id || 0);

      if (!targetUserId || !deckId) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          ok: false,
          error: 'La A despedida debe tener target_user_id y deck_id válidos'
        });
      }

      await removeUserFromAclLines(client, deckId, targetUserId);

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
        [deckId, targetUserId, updatedPlay.id]
      );

      const hasAnotherTie = tieCheck.rows.length > 0;

      if (!hasAnotherTie) {
        await client.query(
          `
      DELETE FROM deck_members
      WHERE deck_id = $1
        AND user_id = $2
      `,
          [deckId, targetUserId]
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
          [deckId, targetUserId, 'A_FIRED', updatedPlay.id]
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

app.get('/plays/archive', requireAuth, async (req, res) => {
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
        p.amount,
        p.created_at,
        p.updated_at,

        deck.name AS deck_name,
        deck.currency_symbol AS deck_currency_symbol,
        deck.currency_name AS deck_currency_name,

        creator.nickname AS created_by_nickname,
        creator.profile_photo_url AS created_by_profile_photo_url,

        target.nickname AS target_user_nickname,
        target.profile_photo_url AS target_user_profile_photo_url,

        parent.play_text AS parent_play_text,
        parent.spade_mode AS parent_spade_mode,
        parent.start_date AS parent_start_date,
        parent.end_date AS parent_end_date,
        parent.location AS parent_location

      FROM plays p
      LEFT JOIN decks deck
        ON deck.id = p.deck_id
      LEFT JOIN users creator
        ON creator.id = p.created_by_user_id
      LEFT JOIN users target
        ON target.id = p.target_user_id
      LEFT JOIN plays parent
        ON parent.id = p.parent_play_id

      WHERE
        (
          p.created_by_user_id = $1
          OR p.target_user_id = $1
        )
        AND (
          (
            p.card_rank = 'K'
            AND COALESCE(p.play_status, '') IN ('REJECTED', 'QUIT', 'FIRED')
          )
          OR
          (
            p.card_rank = 'A'
            AND COALESCE(p.play_status, '') IN ('REJECTED', 'QUIT', 'FIRED')
          )
          OR
          (
            p.card_rank = 'Q'
            AND p.card_suit = 'SPADE'
            AND COALESCE(p.play_status, '') IN ('REJECTED', 'CANCELLED')
          )
        )

      ORDER BY p.updated_at DESC, p.created_at DESC, p.id DESC
      `,
      [userId]
    );

    return res.json({
      ok: true,
      plays: result.rows
    });

  } catch (error) {
    console.error('Error en GET /plays/archive', error);

    return res.status(500).json({
      ok: false,
      error: 'Error obteniendo archivo'
    });
  }
});

app.post('/plays/:id/read', requireAuth, async (req, res) => {
  const client = await pool.connect();

  try {
    const playId = Number(req.params.id);
    const userId = req.auth.userId;
    const reason = String(req.body?.reason || 'DEFAULT');

    if (!playId) {
      return res.status(400).json({
        ok: false,
        error: 'playId inválido'
      });
    }

    // Validar que la jugada exista
    const playResult = await client.query(
      `SELECT id FROM plays WHERE id = $1 LIMIT 1`,
      [playId]
    );

    if (!playResult.rows.length) {
      return res.status(404).json({
        ok: false,
        error: 'Jugada no encontrada'
      });
    }

    await client.query(
      `
      INSERT INTO play_reads (play_id, user_id, reason)
      VALUES ($1, $2, $3)
      ON CONFLICT (play_id, user_id, reason)
      DO UPDATE SET read_at = NOW()
      `,
      [playId, userId, reason]
    );

    return res.json({
      ok: true
    });

  } catch (error) {
    console.error('Error en POST /plays/:id/read', error);

    return res.status(500).json({
      ok: false,
      error: 'No se pudo registrar la lectura'
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

    const issuedWithByUser = await buildCorporateIssuedWithByUserForDeck(pool, mazoId);

    const hydratedPlays = result.rows.map((play) => {
      const rank = String(play.card_rank || '').trim().toUpperCase();
      if (rank !== 'K') return play;

      const senderUserId = Number(play.created_by_user_id || 0);
      if (!senderUserId) return play;

      return {
        ...play,
        issued_with: issuedWithByUser.get(senderUserId) || [],
      };
    });

    return res.json({
      ok: true,
      plays: hydratedPlays,
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

    const issuedWithByUser = await buildCorporateIssuedWithByUserForDeck(pool, mazoId);

    const hydratedPlays = result.rows.map((play) => {
      const rank = String(play.card_rank || '').trim().toUpperCase();
      if (rank !== 'K') return play;

      const senderUserId = Number(play.created_by_user_id || 0);
      if (!senderUserId) return play;

      return {
        ...play,
        issued_with: issuedWithByUser.get(senderUserId) || [],
      };
    });

    return res.json({
      ok: true,
      plays: hydratedPlays,
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

app.post('/plays/:id/validate', requireAuth, async (req, res) => {
  const client = await pool.connect();

  try {
    const playId = Number(req.params.id);
    const userId = Number(req.auth.userId);

    if (!playId) {
      return res.status(400).json({
        ok: false,
        error: 'playId inválido'
      });
    }

    await client.query('BEGIN');

    const playResult = await client.query(
      `
      SELECT *
      FROM plays
      WHERE id = $1
      LIMIT 1
      `,
      [playId]
    );

    if (!playResult.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        ok: false,
        error: 'Jugada no encontrada'
      });
    }

    const play = playResult.rows[0];

    const validationResult = await client.query(
      `
      SELECT *
      FROM play_validations
      WHERE play_id = $1
        AND validator_user_id = $2
        AND validation_status = 'PENDING'
      ORDER BY validation_order ASC, id ASC
      LIMIT 1
      `,
      [playId, userId]
    );

    if (!validationResult.rows.length) {
      await client.query('ROLLBACK');
      return res.status(403).json({
        ok: false,
        error: 'No tenés validaciones pendientes para esta jugada'
      });
    }

    const validation = validationResult.rows[0];

    await client.query(
      `
      UPDATE play_validations
      SET validation_status = 'APPROVED',
          decided_at = NOW()
      WHERE id = $1
      `,
      [validation.id]
    );

    await client.query(
      `
      UPDATE plays
      SET issued_with = $1::jsonb,
          updated_at = NOW()
      WHERE id = $2
      `,
      [JSON.stringify(mergeIssuedWith(play.issued_with, [validation.validator_role])), playId]
    );

    const remainingResult = await client.query(
      `
      SELECT 1
      FROM play_validations
      WHERE play_id = $1
        AND validation_status = 'PENDING'
      LIMIT 1
      `,
      [playId]
    );

    let updatedPlay = play;

    if (!remainingResult.rows.length) {
      const finalTargetUserId =
        getFinalTargetFromPlayCode(play.play_code) ||
        Number(play.target_user_id || 0);

      if (!finalTargetUserId) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          ok: false,
          error: 'No se encontró destinatario final'
        });
      }

      const updatePlayResult = await client.query(
        `
        UPDATE plays
        SET play_status = 'SENT',
            target_user_id = $1,
            issued_with = $2::jsonb,
            updated_at = NOW()
        WHERE id = $3
        RETURNING *
        `,
        [
          finalTargetUserId,
          JSON.stringify(mergeIssuedWith(play.issued_with, [validation.validator_role])),
          playId
        ]
      );

      updatedPlay = updatePlayResult.rows[0];

      if (
        String(updatedPlay.card_rank || '').toUpperCase() === 'Q' &&
        String(updatedPlay.card_suit || '').toUpperCase() === 'SPADE'
      ) {
        await expandReadersForQSpadeSend(client, updatedPlay);
      } else if (String(updatedPlay.card_rank || '').toUpperCase() === 'K') {
        await expandReadersForKSend(client, updatedPlay);
      }

      if (String(updatedPlay.card_rank || '').toUpperCase() === 'K') {
        await client.query(
          `
    INSERT INTO deck_members (deck_id, user_id)
    VALUES ($1, $2)
    ON CONFLICT DO NOTHING
    `,
          [updatedPlay.deck_id, finalTargetUserId]
        );

        await client.query(
          `
    DELETE FROM ex_deck_members
    WHERE deck_id = $1
      AND user_id = $2
    `,
          [updatedPlay.deck_id, finalTargetUserId]
        );
      }

    }

    await client.query('COMMIT');

    return res.json({
      ok: true,
      play: updatedPlay,
      validation
    });

  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (_) { }

    console.error('Error en POST /plays/:id/validate', error);

    return res.status(500).json({
      ok: false,
      error: 'No se pudo validar la jugada'
    });

  } finally {
    client.release();
  }
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
        deck.name AS deck_name,
        pv.validator_user_id,
        pv.validator_role,
        pv.validation_status
      FROM plays p
      LEFT JOIN plays parent
        ON parent.id = p.parent_play_id
      LEFT JOIN users author
        ON author.id = p.created_by_user_id
      LEFT JOIN decks deck
        ON deck.id = p.deck_id
      LEFT JOIN play_reads pr
        ON pr.play_id = p.id
       AND pr.user_id = $1
LEFT JOIN play_validations pv
  ON pv.play_id = p.id
 AND pv.validator_user_id = $1
 AND pv.validation_status = 'PENDING'
 AND pv.validation_order = (
   SELECT MIN(pv2.validation_order)
   FROM play_validations pv2
   WHERE pv2.play_id = p.id
     AND pv2.validation_status = 'PENDING'
 )
      WHERE
      (
        -- =========================
        -- Q♠
        -- =========================
        (
          p.card_rank = 'Q'
          AND p.card_suit = 'SPADE'
          AND (
            -- Invitación enviada al destinatario final
            (
              p.target_user_id = $1
              AND COALESCE(p.play_status, '') = 'SENT'
            )

            OR

            -- Notificación al creador
            (
              p.created_by_user_id = $1
              AND COALESCE(p.play_status, '') IN ('APPROVED', 'REJECTED', 'CANCELLED')
            )

            OR

            -- Settlement
            (
              p.target_user_id = $1
              AND COALESCE(p.play_status, '') = 'APPROVED'
              AND (
                p.play_code LIKE '%settlement:PAID%'
                OR p.play_code LIKE '%settlement:COMPLAINED%'
              )
            )

            OR

            -- Validación pendiente para A♣
            (
              pv.validator_user_id IS NOT NULL
              AND pv.validation_status = 'PENDING'
            )
          )
        )

        OR

        -- =========================
        -- Q♣
        -- =========================
        (
          p.card_rank = 'Q'
          AND p.card_suit = 'CLUB'
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
          )
        )

        OR

        -- =========================
        -- K
        -- =========================
        (
          p.card_rank = 'K'
          AND (
            (
              p.target_user_id = $1
              AND COALESCE(p.play_status, '') IN ('SENT', 'PENDING')
            )

            OR

            (
              p.play_code LIKE ('%finalTarget:U:' || $1 || '%')
              AND COALESCE(p.play_status, '') = 'PENDING'
            )

            OR

            (
              p.created_by_user_id = $1
              AND COALESCE(p.play_status, '') IN ('APPROVED', 'REJECTED', 'QUIT')
            )

            OR

            (
              p.target_user_id = $1
              AND COALESCE(p.play_status, '') = 'FIRED'
            )
          )
        )

        OR

        -- =========================
        -- A target
        -- =========================
        (
          p.card_rank = 'A'
          AND p.target_user_id = $1
          AND COALESCE(p.play_status, '') IN ('SENT', 'PENDING')
        )

        OR

        -- =========================
        -- A creador
        -- =========================
        (
          p.card_rank = 'A'
          AND p.created_by_user_id = $1
          AND COALESCE(p.play_status, '') IN ('APPROVED', 'REJECTED', 'QUIT', 'FIRED')
        )

        OR

        -- =========================
        -- J♥
        -- =========================
        (
          p.card_rank = 'J'
          AND p.card_suit = 'HEART'
          AND (
            (
              p.target_user_id = $1
              AND COALESCE(p.play_status, '') IN ('SENT', 'PENDING')
            )

            OR

            (
              p.created_by_user_id = $1
              AND p.target_user_id IS NOT NULL
              AND p.target_user_id <> p.created_by_user_id
              AND COALESCE(p.play_status, '') IN ('APPROVED', 'REJECTED')
            )
          )
        )
      )
      AND pr.id IS NULL
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

app.post('/plays/:id/readers/public', requireAuth, async (req, res) => {
  const client = await pool.connect();

  try {
    const playId = Number(req.params.id);
    const userId = Number(req.auth.userId || 0);

    if (!playId) {
      return res.status(400).json({
        ok: false,
        error: 'playId inválido'
      });
    }

    const playResult = await client.query(
      `
      SELECT *
      FROM plays
      WHERE id = $1
      LIMIT 1
      `,
      [playId]
    );

    const play = playResult.rows[0];

    if (!play) {
      return res.status(404).json({
        ok: false,
        error: 'Jugada no encontrada'
      });
    }

    if (Number(play.created_by_user_id || 0) !== userId) {
      return res.status(403).json({
        ok: false,
        error: 'Solo el autor puede publicar esta jugada'
      });
    }

    const deckId = Number(play.deck_id || 0);
    const parentPlayId = Number(play.parent_play_id || 0);

    await markPlayAsPublic(client, playId);

    if (parentPlayId) {
      await markPlayAsPublic(client, parentPlayId);
    }

    const aHeartResult = await client.query(
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

    const aHeartId = Number(aHeartResult.rows[0]?.id || 0);

    if (aHeartId) {
      await markPlayAsPublic(client, aHeartId);
    }

    const approvedJHearts = await client.query(
      `
      SELECT id
      FROM plays
      WHERE deck_id = $1
        AND card_rank = 'J'
        AND card_suit = 'HEART'
        AND UPPER(COALESCE(play_status, '')) = 'APPROVED'
      `,
      [deckId]
    );

    for (const row of approvedJHearts.rows) {
      await markPlayAsPublic(client, Number(row.id));
    }

    return res.json({
      ok: true,
      playId,
      deckId
    });

  } catch (error) {
    console.error('Error publicando readers públicos', error);

    return res.status(500).json({
      ok: false,
      error: 'No se pudo publicar la jugada'
    });

  } finally {
    client.release();
  }
});

