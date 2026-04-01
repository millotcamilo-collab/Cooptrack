// services/play-readers.js

const {
  addReadersToPlay,
  computeReadersForNewJHeart,
  computeReadersForPendingJHeart,
  expandReadersForApprovedJHeart
} = require('./readers');

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

  // --- J♥ ---
  if (card_rank === 'J' && card_suit === 'HEART') {
    // nace privada: solo autor
    const readers = await computeReadersForNewJHeart(
      client,
      deck_id,
      created_by_user_id
    );

    await addReadersToPlay(client, id, readers);
  }

  // ⚠️ más adelante:
  // if (card_rank === 'Q' && card_suit === 'SPADE') { ... }
  // if (card_rank === 'K' && card_suit === 'HEART') { ... }
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

  if (card_rank === 'J' && card_suit === 'HEART') {
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

  if (card_rank === 'J' && card_suit === 'HEART') {
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
  handleApproveJHeart
};
