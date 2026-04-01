// services/card-holders.js

/**
 * Devuelve los user_id que actualmente poseen una carta
 * según las jugadas del mazo.
 *
 * Ejemplo:
 * getCurrentCardHolderUserIds(client, deckId, 'A', 'HEART')
 */
async function getCurrentCardHolderUserIds(client, deckId, rank, suit) {
  const result = await client.query(
    `
    SELECT created_by_user_id
    FROM plays
    WHERE deck_id = $1
      AND card_rank = $2
      AND card_suit = $3
    ORDER BY created_at DESC
    `,
    [deckId, rank, suit]
  );

  if (!result.rows.length) {
    return [];
  }

  // ⚠️ versión simple:
  // asumimos que la última jugada representa el estado actual

  const latest = result.rows[0];

  if (!latest || !latest.created_by_user_id) {
    return [];
  }

  return [Number(latest.created_by_user_id)];
}

module.exports = {
  getCurrentCardHolderUserIds
};
