// services/deck-membership.js

function getDeckMembershipStatusFromPlays(plays = [], userId) {
  const userIdStr = String(userId);

  let hasActiveAorK = false;
  let hasActiveQ = false;
  let hasOwnJ = false;

  for (const play of plays) {
    const rank = String(play.card_rank || '').toUpperCase();
    const suit = String(play.card_suit || '').toUpperCase();
    const status = String(play.play_status || '').toUpperCase();

    const authorId = String(play.created_by_user_id || '');
    const targetId = String(play.target_user_id || '');

    const isActive = status !== 'REJECTED' && status !== 'CANCELLED';

    // A o K propios
    if (isActive && (rank === 'A' || rank === 'K')) {
      if (authorId === userIdStr || targetId === userIdStr) {
        hasActiveAorK = true;
      }
    }

    // Q donde soy destinatario
    if (isActive && rank === 'Q') {
      if (targetId === userIdStr) {
        hasActiveQ = true;
      }
    }

    // J propia
    if (isActive && rank === 'J') {
      if (authorId === userIdStr) {
        hasOwnJ = true;
      }
    }
  }

  const isActive = hasActiveAorK || hasActiveQ || hasOwnJ;

  return {
    isMember: hasActive || plays.length > 0,
    isActive,
    status: isActive ? 'ACTIVE' : 'ARCHIVED'
  };
}

module.exports = {
  getDeckMembershipStatusFromPlays
};