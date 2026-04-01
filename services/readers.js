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
  expandReadersForApprovedJHeart
};
