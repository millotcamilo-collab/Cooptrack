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

async function expandReadersForKSend(client, play) {
  const invitedUserId = Number(play?.target_user_id || 0);
  const deckId = Number(play?.deck_id || 0);
  const kSuit = String(play?.card_suit || "").toUpperCase();

  if (!invitedUserId || !deckId || !kSuit) {
    return;
  }

  const invitedReaders = normalizeReaderEntries([invitedUserId]);
  if (!invitedReaders.length) return;

  // La propia K enviada debería quedar visible al anfitrión y al destinatario
  await addReadersToPlay(
    client,
    play.id,
    normalizeReaderEntries([play?.created_by_user_id, invitedUserId])
  );

  // Todas las jugadas A del mazo deben quedar legibles para quien recibe una K
  const acePlays = await getDeckPlaysByKinds(client, deckId, {
    rank: "A"
  });

  for (const targetPlay of acePlays) {
    await addReadersToPlay(client, targetPlay.id, invitedReaders);
  }

  // K♥ -> todas las J♥
  if (kSuit === "HEART") {
    const heartJs = await getDeckPlaysByKinds(client, deckId, {
      rank: "J",
      suit: "HEART"
    });

    for (const targetPlay of heartJs) {
      await addReadersToPlay(client, targetPlay.id, invitedReaders);
    }

    return;
  }

  // K♠ -> J♠ y Q♠ sin Q roja
  if (kSuit === "SPADE") {
    const spadeJs = await getDeckPlaysByKinds(client, deckId, {
      rank: "J",
      suit: "SPADE"
    });

    for (const targetPlay of spadeJs) {
      await addReadersToPlay(client, targetPlay.id, invitedReaders);
    }

    const spadeQs = await getDeckPlaysByKinds(client, deckId, {
      rank: "Q",
      suit: "SPADE"
    });

    for (const targetPlay of spadeQs) {
      if (qSpadeHasAttachedQHeart(targetPlay)) continue;
      await addReadersToPlay(client, targetPlay.id, invitedReaders);
    }

    return;
  }

  // K♦ -> J♣ + J♠ + Q♠ con o sin roja
  if (kSuit === "DIAMOND") {
    const clubJs = await getDeckPlaysByKinds(client, deckId, {
      rank: "J",
      suit: "CLUB"
    });

    const spadeJs = await getDeckPlaysByKinds(client, deckId, {
      rank: "J",
      suit: "SPADE"
    });

    const spadeQs = await getDeckPlaysByKinds(client, deckId, {
      rank: "Q",
      suit: "SPADE"
    });

    for (const targetPlay of [...clubJs, ...spadeJs, ...spadeQs]) {
      await addReadersToPlay(client, targetPlay.id, invitedReaders);
    }

    return;
  }

  // K♣ -> por ahora no hace nada
}

async function computeReadersForJSpade(client, play) {
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

async function computeReadersForJClub(client, play) {
  const deckId = Number(play?.deck_id || 0);
  const authorUserId = Number(play?.created_by_user_id || 0);

  const aceHolders = await getAllAceHolderUserIds(client, deckId);
  const kClubHolders = await getCurrentCardHolderUserIds(
    client,
    deckId,
    'K',
    'CLUB'
  );

  return normalizeReaderEntries([
    authorUserId,
    ...aceHolders,
    ...kClubHolders,
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

  // --- J♠ actividad ---
  if (rank === 'J' && suit === 'SPADE') {
    const readers = await computeReadersForJSpade(client, play);
    await setPlayReaders(client, id, readers);
    return;
  }

  // --- J♣ bien ---
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
  expandReadersForQSpadeSend,
  expandReadersForKSend
};
