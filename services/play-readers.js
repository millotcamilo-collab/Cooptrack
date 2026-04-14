// services/play-readers.js

const {
  addReadersToPlay,
  computeReadersForNewJHeart,
  computeReadersForPendingJHeart,
  expandReadersForApprovedJHeart,
  computeReadersForQSpade,
  expandReadersForQSpadeContext
} = require('./readers');

/**
 * Se ejecuta cuando se CREA una jugada
 */
async function handleReadersOnPlayCreate(client, play) {
  if (!play) return;

  const {
    id,
    deck_id,
    parent_play_id,
    target_user_id,
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
    return;
  }

  // --- Q♠ ---
  if (card_rank === 'Q' && card_suit === 'SPADE') {
    // 1) lectores base de la Q: anfitrión + invitado
    const qReaders = await computeReadersForQSpade(
      client,
      deck_id,
      created_by_user_id,
      target_user_id
    );

    await addReadersToPlay(client, id, qReaders);

    // 2) propagar contexto al invitado:
    //    - J♠ madre
    //    - A♥ titular del mazo
    //    - J♥ aprobadas
    await expandReadersForQSpadeContext(client, {
      deckId: deck_id,
      parentPlayId: parent_play_id,
      invitedUserId: target_user_id
    });

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