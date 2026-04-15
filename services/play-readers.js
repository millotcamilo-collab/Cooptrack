// services/play-readers.js

const {
  setPlayReaders,
  addReadersToPlay,
  normalizeReaderEntries,
  computeReadersForNewJHeart,
  computeReadersForPendingJHeart,
  expandReadersForApprovedJHeart,
  getApprovedJHeartsByDeck,
  getDeckTitleAHeartPlayId
} = require('./readers');

async function getCurrentCardHolderUserIds(client, deckId, rank, suit) {
  const result = await client.query(
    `
    SELECT DISTINCT
      COALESCE(target_user_id, created_by_user_id) AS user_id
    FROM plays
    WHERE deck_id = $1
      AND UPPER(COALESCE(card_rank, '')) = $2
      AND UPPER(COALESCE(card_suit, '')) = $3
      AND UPPER(COALESCE(play_status, '')) <> 'BLOCKED'
      AND COALESCE(target_user_id, created_by_user_id) IS NOT NULL
    ORDER BY user_id ASC
    `,
    [deckId, String(rank || '').toUpperCase(), String(suit || '').toUpperCase()]
  );

  return result.rows
    .map((row) => Number(row.user_id))
    .filter((value) => Number.isInteger(value) && value > 0);
}

async function getAllAceHolderUserIds(client, deckId) {
  const suits = ['HEART', 'SPADE', 'DIAMOND', 'CLUB'];

  const groups = await Promise.all(
    suits.map((suit) => getCurrentCardHolderUserIds(client, deckId, 'A', suit))
  );

  return [...new Set(groups.flat())];
}

async function computeReadersForQSpadeDraft(client, play) {
  const deckId = Number(play?.deck_id || 0);
  const authorUserId = Number(play?.created_by_user_id || 0);

  const aceHolders = await getAllAceHolderUserIds(client, deckId);
  const kSpadeHolders = await getCurrentCardHolderUserIds(
    client,
    deckId,
    'K',
    'SPADE'
  );

  return normalizeReaderEntries([
    authorUserId,
    ...aceHolders,
    ...kSpadeHolders,
  ]);
}

async function expandReadersForQSpadeSend(client, play) {
  const invitedUserId = Number(play?.target_user_id || 0);
  const authorUserId = Number(play?.created_by_user_id || 0);
  const parentPlayId = Number(play?.parent_play_id || 0);
  const deckId = Number(play?.deck_id || 0);

  if (!invitedUserId || !deckId) {
    return;
  }

  const invitedReader = normalizeReaderEntries([invitedUserId]);
  const baseQReaders = normalizeReaderEntries([authorUserId, invitedUserId]);

  await addReadersToPlay(client, play.id, baseQReaders);

  if (parentPlayId) {
    await addReadersToPlay(client, parentPlayId, invitedReader);
  }

  const deckTitleAHeartPlayId = await getDeckTitleAHeartPlayId(client, deckId);
  if (deckTitleAHeartPlayId) {
    await addReadersToPlay(client, deckTitleAHeartPlayId, invitedReader);
  }

  const approvedJHeartIds = await getApprovedJHeartsByDeck(client, deckId);
  for (const approvedPlayId of approvedJHeartIds) {
    await addReadersToPlay(client, approvedPlayId, invitedReader);
  }
}

/**
 * Se ejecuta cuando se CREA una jugada
 */
async function handleReadersOnPlayCreate(client, play) {
  if (!play) return;

  const {
    id,
    deck_id,
    created_by_user_id,
    card_rank,
    card_suit
  } = play;

  const rank = String(card_rank || '').toUpperCase();
  const suit = String(card_suit || '').toUpperCase();

  // --- Q♠ guardada en borrador institucional ---
  if (rank === 'Q' && suit === 'SPADE') {
    const readers = await computeReadersForQSpadeDraft(client, play);
    await setPlayReaders(client, id, readers);
    return;
  }

  // --- J♥ recién creada ---
  if (rank === 'J' && suit === 'HEART') {
    const readers = await computeReadersForNewJHeart(
      client,
      deck_id,
      created_by_user_id
    );

    await addReadersToPlay(client, id, readers);
    return;
  }
}

/**
 * Se ejecuta cuando el usuario hace clic para "abrir" la J♥
 */
async function handleOpenJHeart(client, play) {
  if (!play) return;

  const {
    id,
    deck_id,
    created_by_user_id,
    card_rank,
    card_suit
  } = play;

  const rank = String(card_rank || '').toUpperCase();
  const suit = String(card_suit || '').toUpperCase();

  if (rank === 'J' && suit === 'HEART') {
    const readersToAdd = await computeReadersForPendingJHeart(
      client,
      deck_id,
      created_by_user_id
    );

    await addReadersToPlay(client, id, readersToAdd);
  }
}

/**
 * Se ejecuta cuando una J♥ es aprobada
 */
async function handleApproveJHeart(client, play) {
  if (!play) return;

  const {
    id,
    deck_id,
    card_rank,
    card_suit
  } = play;

  const rank = String(card_rank || '').toUpperCase();
  const suit = String(card_suit || '').toUpperCase();

  if (rank === 'J' && suit === 'HEART') {
    const readersToAdd = await expandReadersForApprovedJHeart(
      client,
      deck_id
    );

    await addReadersToPlay(client, id, readersToAdd);
  }
}

module.exports = {
  handleReadersOnPlayCreate,
  handleOpenJHeart,
  handleApproveJHeart,
  computeReadersForQSpadeDraft,
  expandReadersForQSpadeSend
};