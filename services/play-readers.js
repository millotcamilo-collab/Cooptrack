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

const {
  getCurrentCardHolderUserIds
} = require('./card-holders');


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

  const clubAceHolders = await getCurrentCardHolderUserIds(
    client,
    deckId,
    'A',
    'CLUB'
  );

  const hasQHeart = qSpadeHasAttachedQHeart(play);

  let diamondAceHolders = [];

  if (hasQHeart) {
    diamondAceHolders = await getCurrentCardHolderUserIds(
      client,
      deckId,
      'A',
      'DIAMOND'
    );
  }

  return normalizeReaderEntries([
    authorUserId,
    ...clubAceHolders,
    ...diamondAceHolders,
  ]);
}

async function expandReadersForQSpadeSend(client, play) {
  async function getAceClubPlayId(client, deckId) {
    const result = await client.query(
      `
    SELECT id
    FROM plays
    WHERE deck_id = $1
      AND card_rank = 'A'
      AND card_suit = 'CLUB'
      AND split_part(play_code, '§', 8) = 'foundation'
    ORDER BY id ASC
    LIMIT 1
    `,
      [deckId]
    );

    return result.rows[0] ? Number(result.rows[0].id) : null;
  }

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

  const aceClubPlayId = await getAceClubPlayId(client, deckId);
  if (aceClubPlayId) {
    await addReadersToPlay(client, aceClubPlayId, invitedReader);
  }

  const approvedJHeartIds = await getApprovedJHeartsByDeck(client, deckId);
  for (const approvedPlayId of approvedJHeartIds) {
    await addReadersToPlay(client, approvedPlayId, invitedReader);
  }
}

function parsePlayCodeRaw(code) {
  const parts = String(code || "").split("§");

  return {
    deckId: parts[0] || "",
    userId: parts[1] || "",
    date: parts[2] || "",
    rank: parts[3] || "",
    suit: parts[4] || "",
    action: parts[5] || "",
    authorized: parts[6] || "",
    flow: parts[7] || "",
    recipients: parts[8] || ""
  };
}



function qSpadeHasAttachedQHeart(play) {
  const rank = String(play?.card_rank || "").trim().toUpperCase();
  const suit = String(play?.card_suit || "").trim().toUpperCase();

  if (rank !== "Q" || suit !== "SPADE") return false;

  const parsed = parsePlayCodeRaw(play?.play_code || "");
  const rawFlow = String(parsed.flow || "").trim();

  if (!rawFlow) return false;

  const chunks = rawFlow
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean);

  return chunks.some((chunk) => chunk.startsWith("pay:QHEART"));
}

async function getDeckPlaysByKinds(client, deckId, filters = {}) {
  const result = await client.query(
    `
  SELECT
    id,
    deck_id,
    parent_play_id,
    created_by_user_id,
    target_user_id,
    card_rank,
    card_suit,
    play_status,
    play_text,
    play_code,
    reader_user_ids
  FROM plays
  WHERE deck_id = $1
    AND UPPER(COALESCE(play_status, '')) NOT IN ('REJECTED', 'CANCELLED')
  ORDER BY id ASC
  `,
    [deckId]
  );

  const plays = result.rows || [];

  return plays.filter((play) => {
    const rank = String(play.card_rank || "").toUpperCase();
    const suit = String(play.card_suit || "").toUpperCase();

    if (filters.rank && rank !== String(filters.rank).toUpperCase()) {
      return false;
    }

    if (filters.suit && suit !== String(filters.suit).toUpperCase()) {
      return false;
    }

    if (Array.isArray(filters.ranks) && filters.ranks.length) {
      if (!filters.ranks.map((v) => String(v).toUpperCase()).includes(rank)) {
        return false;
      }
    }

    if (Array.isArray(filters.suits) && filters.suits.length) {
      if (!filters.suits.map((v) => String(v).toUpperCase()).includes(suit)) {
        return false;
      }
    }

    return true;
  });
}

async function expandReadersForASend(client, play) {
  const authorUserId = Number(play?.created_by_user_id || 0);
  const targetUserId = Number(play?.target_user_id || 0);
  const deckId = Number(play?.deck_id || 0);

  if (!deckId || !targetUserId) return;

  const readers = normalizeReaderEntries([
    authorUserId,
    targetUserId
  ]);

  // La propia transferencia A
  await setPlayReaders(client, play.id, readers);

  // El invitado al As ve todos los documentos/jugadas del mazo
  const result = await client.query(
    `
    SELECT id
    FROM plays
    WHERE deck_id = $1
    `,
    [deckId]
  );

  for (const row of result.rows) {
    await addReadersToPlay(client, row.id, [targetUserId]);
  }
}

async function expandReadersForKSend(client, play) {
  const invitedUserId = Number(play?.target_user_id || 0);
  const authorUserId = Number(play?.created_by_user_id || 0);
  const deckId = Number(play?.deck_id || 0);

  if (!invitedUserId || !deckId) return;

  const invitedReaders = normalizeReaderEntries([invitedUserId]);

  // La propia K queda visible para quien la creó y quien la recibe.
  await addReadersToPlay(
    client,
    play.id,
    normalizeReaderEntries([authorUserId, invitedUserId])
  );

  // Quien recibe una K pasa a leer el cuerpo institucional A/K/JOKER.
  const adminPlays = await getDeckPlaysByKinds(client, deckId, {
    ranks: ["A", "K", "JOKER"]
  });

  for (const targetPlay of adminPlays) {
    await addReadersToPlay(client, targetPlay.id, invitedReaders);
  }
}

async function computeReadersForJSpade(client, play) {
  const deckId = Number(play?.deck_id || 0);
  const authorUserId = Number(play?.created_by_user_id || 0);

  const spadeAceHolders = await getCurrentCardHolderUserIds(
    client,
    deckId,
    'A',
    'SPADE'
  );

  return normalizeReaderEntries([
    authorUserId,
    ...spadeAceHolders,
  ]);
}

async function computeReadersForJClub(client, play) {
  const deckId = Number(play?.deck_id || 0);
  const authorUserId = Number(play?.created_by_user_id || 0);

  const diamondAceHolders = await getCurrentCardHolderUserIds(
    client,
    deckId,
    'A',
    'DIAMOND'
  );

  return normalizeReaderEntries([
    authorUserId,
    ...diamondAceHolders,
  ]);
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
    target_user_id,
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

  // --- K recién creada ---
  if (rank === 'K') {
    const readers = normalizeReaderEntries([
      created_by_user_id,
      target_user_id
    ]);

    await setPlayReaders(client, id, readers);
    return;
  }

  // --- A transferencia recién creada ---
  if (rank === 'A') {
    const readers = normalizeReaderEntries([
      created_by_user_id,
      target_user_id
    ]);

    await setPlayReaders(client, id, readers);
    return;
  }

  // --- J♠ actividad ---
  if (rank === 'J' && suit === 'SPADE') {
    const readers = await computeReadersForJSpade(client, play);
    await setPlayReaders(client, id, readers);
    return;
  }

  // --- J♣ ---
  if (rank === 'J' && suit === 'CLUB') {
    const readers = await computeReadersForJClub(client, play);
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

    await setPlayReaders(client, id, readers);
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
  expandReadersForQSpadeSend,
  expandReadersForKSend,
  expandReadersForASend
};
