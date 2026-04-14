// services/readers.js

function normalizeReaderEntry(value) {
  if (value === null || value === undefined) return null;

  const raw = String(value).trim();
  if (!raw) return null;

  if (raw === 'TODOS') return 'TODOS';

  // ya viene en formato U:123
  if (/^U:\d+$/.test(raw)) return raw;

  // si viene como numero o string numerico
  const numeric = Number(raw);
  if (Number.isInteger(numeric) && numeric > 0) {
    return `U:${numeric}`;
  }

  return null;
}

function normalizeReaderEntries(entries = []) {
  if (!Array.isArray(entries)) return [];

  const normalized = entries
    .map(normalizeReaderEntry)
    .filter(Boolean);

  return [...new Set(normalized)];
}

function mergeReaderEntries(currentEntries = [], newEntries = []) {
  const current = normalizeReaderEntries(currentEntries);
  const incoming = normalizeReaderEntries(newEntries);

  // Si aparece TODOS, ya no hace falta guardar el resto
  if (current.includes('TODOS') || incoming.includes('TODOS')) {
    return ['TODOS'];
  }

  return [...new Set([...current, ...incoming])];
}

async function getPlayReaders(client, playId) {
  const result = await client.query(
    `
      SELECT reader_user_ids
      FROM plays
      WHERE id = $1
      LIMIT 1
    `,
    [playId]
  );

  if (!result.rows.length) {
    return [];
  }

  const value = result.rows[0].reader_user_ids;

  if (!Array.isArray(value)) {
    return [];
  }

  return normalizeReaderEntries(value);
}

async function setPlayReaders(client, playId, readerEntries = []) {
  const normalized = normalizeReaderEntries(readerEntries);

  await client.query(
    `
      UPDATE plays
      SET reader_user_ids = $1::jsonb,
          updated_at = NOW()
      WHERE id = $2
    `,
    [JSON.stringify(normalized), playId]
  );

  return normalized;
}

async function addReadersToPlay(client, playId, readerEntries = []) {
  if (!playId) return [];

  const current = await getPlayReaders(client, playId);
  const merged = mergeReaderEntries(current, readerEntries);

  await setPlayReaders(client, playId, merged);

  return merged;
}

async function markPlayAsPublic(client, playId) {
  return addReadersToPlay(client, playId, ['TODOS']);
}

/**
 * Debe devolver los user_id actuales que poseen una carta dada en el mazo.
 * Por ahora la dejamos como stub hasta conectar con la logica real del mazo.
 */
async function getCurrentCardHolderUserIds(client, deckId, rank, suit) {
  void client;
  void deckId;
  void rank;
  void suit;

  return [];
}

/**
 * Debe devolver los user_id activos del mazo:
 * usuarios que actualmente poseen alguna A, K o Q.
 * Por ahora la dejamos como stub.
 */
async function getActiveDeckMemberUserIds(client, deckId) {
  void client;
  void deckId;

  return [];
}

/**
 * J♥ recien creada:
 * readers = solo autor
 */
async function computeReadersForNewJHeart(client, deckId, authorUserId) {
  void client;
  void deckId;

  return normalizeReaderEntries([authorUserId]);
}

/**
 * J♥ abierta a autoridades:
 * readers += holders(A♥) + holders(K♥)
 */
async function computeReadersForPendingJHeart(client, deckId, authorUserId) {
  const aHeartHolders = await getCurrentCardHolderUserIds(
    client,
    deckId,
    'A',
    'HEART'
  );

  const kHeartHolders = await getCurrentCardHolderUserIds(
    client,
    deckId,
    'K',
    'HEART'
  );

  return normalizeReaderEntries([
    authorUserId,
    ...aHeartHolders,
    ...kHeartHolders
  ]);
}

/**
 * J♥ aprobada:
 * readers += miembros activos del mazo (A, K, Q)
 */
async function expandReadersForApprovedJHeart(client, deckId) {
  const activeMemberUserIds = await getActiveDeckMemberUserIds(client, deckId);

  return normalizeReaderEntries(activeMemberUserIds);
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

async function computeReadersForQSpade(client, deckId, authorUserId, invitedUserId) {
  void client;
  void deckId;

  return normalizeReaderEntries([
    authorUserId,
    invitedUserId
  ]);
}

async function expandReadersForQSpadeContext(
  client,
  {
    deckId,
    parentPlayId,
    invitedUserId
  } = {}
) {
  const invitedReaders = normalizeReaderEntries([invitedUserId]);

  if (!invitedReaders.length) {
    return;
  }

  // 1) J♠ madre
  if (parentPlayId) {
    await addReadersToPlay(client, parentPlayId, invitedReaders);
  }

  // 2) A♥ titular del mazo
  const deckTitleAHeartPlayId = await getDeckTitleAHeartPlayId(client, deckId);
  if (deckTitleAHeartPlayId) {
    await addReadersToPlay(client, deckTitleAHeartPlayId, invitedReaders);
  }

  // 3) J♥ aprobadas del mazo
  const approvedJHeartIds = await getApprovedJHeartsByDeck(client, deckId);

  for (const playId of approvedJHeartIds) {
    await addReadersToPlay(client, playId, invitedReaders);
  }
}

module.exports = {
  normalizeReaderEntry,
  normalizeReaderEntries,
  mergeReaderEntries,
  getPlayReaders,
  setPlayReaders,
  addReadersToPlay,
  markPlayAsPublic,
  getCurrentCardHolderUserIds,
  getActiveDeckMemberUserIds,
  computeReadersForNewJHeart,
  computeReadersForPendingJHeart,
  expandReadersForApprovedJHeart,
  getApprovedJHeartsByDeck,
  getDeckTitleAHeartPlayId,
  computeReadersForQSpade,
  expandReadersForQSpadeContext
};
