// services/card-holders.js

/**
 * Devuelve los user_id que actualmente poseen una carta
 * según las jugadas vivas del mazo.
 *
 * Ejemplo:
 * getCurrentCardHolderUserIds(client, deckId, 'A', 'HEART')
 */
async function getCurrentCardHolderUserIds(client, deckId, rank, suit) {
  const normalizedRank = String(rank || '').trim().toUpperCase();
  const normalizedSuit = String(suit || '').trim().toUpperCase();

  const params = [
    deckId,
    normalizedRank,
    normalizedSuit
  ];

  let foundationClause = '';

  // Las A reales del mazo son las foundation
  if (normalizedRank === 'A') {
    foundationClause = `
      AND split_part(play_code, '§', 8) = 'foundation'
    `;
  }

  const result = await client.query(
    `
    SELECT DISTINCT
      COALESCE(target_user_id, created_by_user_id) AS user_id
    FROM plays
    WHERE deck_id = $1
      AND UPPER(COALESCE(card_rank, '')) = $2
      AND UPPER(COALESCE(card_suit, '')) = $3

      ${foundationClause}

      AND UPPER(COALESCE(play_status, '')) NOT IN (
        'REJECTED',
        'CANCELLED',
        'QUIT',
        'FIRED',
        'BLOCKED'
      )

      AND COALESCE(target_user_id, created_by_user_id) IS NOT NULL

    ORDER BY user_id ASC
    `,
    params
  );

  return result.rows
    .map((row) => Number(row.user_id))
    .filter((value) => Number.isInteger(value) && value > 0);
}

module.exports = {
  getCurrentCardHolderUserIds
};