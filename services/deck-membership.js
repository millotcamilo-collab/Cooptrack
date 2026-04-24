// services/deck-membership.js

function getDeckMembershipStatusFromPlays(plays, userId) {
  const safePlays = Array.isArray(plays) ? plays : [];
  const userIdStr = String(userId);

  let hasActiveAorK = false;
  let hasActiveQ = false;
  let hasOwnJ = false;

  for (const play of safePlays) {
    const rank = String(play.card_rank || '').toUpperCase();
    const status = String(play.play_status || '').toUpperCase();

    const authorId = String(play.created_by_user_id || '');
    const targetId = String(play.target_user_id || '');

    const isActive =
      status !== 'REJECTED' &&
      status !== 'CANCELLED' &&
      status !== 'QUIT' &&
      status !== 'FIRED' &&
      status !== 'BLOCKED';

    if (isActive && (rank === 'A' || rank === 'K')) {
      if (authorId === userIdStr || targetId === userIdStr) {
        hasActiveAorK = true;
      }
    }

    if (isActive && rank === 'Q') {
      if (targetId === userIdStr) {
        hasActiveQ = true;
      }
    }

    if (isActive && rank === 'J') {
      if (authorId === userIdStr) {
        hasOwnJ = true;
      }
    }
  }

  const isActive = hasActiveAorK || hasActiveQ || hasOwnJ;

  return {
    isMember: isActive || safePlays.length > 0,
    isActive,
    status: isActive ? 'ACTIVE' : 'ARCHIVED'
  };
}

module.exports = getDeckMembershipStatusFromPlays;