function buildUsersByDeckModel(plays, usersMap) {
  const rows = {};

  plays.forEach((p) => {
    const rank = String(p.rank || "").toUpperCase();
    const suit = String(p.suit || "").toUpperCase();
    const status = String(p.status || "").toUpperCase();

    if (status !== "ACTIVE" && status !== "APPROVED") return;

    let userId = null;

    if (rank === "A") {
      userId = Number(p.created_by_user_id || 0);
    }

    if (rank === "K" || rank === "Q") {
      userId = Number(p.target_user_id || 0);
    }

    if (!userId) return;

    if (!rows[userId]) {
      rows[userId] = {
        userId,
        name: usersMap[userId]?.nickname || `U${userId}`,
        cards: []
      };
    }

    rows[userId].cards.push(`${rank}${getSuitSymbol(suit)}`);
  });

  return Object.values(rows);
}

function renderUsersByDeck(container, model) {
  container.innerHTML = `
    <div class="users-deck">
      ${model.map(row => `
        <div class="users-deck__row">
          <div class="users-deck__name">${row.name}</div>
          <div class="users-deck__cards">${row.cards.join(" ")}</div>
        </div>
      `).join("")}
    </div>
  `;
}

document.addEventListener("mazobar:showUsersByDeck", () => {
  const container = document.getElementById("administradores-container");

  if (!container) return;

  const state = window.__currentState;
  if (!state) return;

  const plays = state.plays || [];
  const usersMap = state.usersMap || {}; // por ahora puede estar vacío

  const model = buildUsersByDeckModel(plays, usersMap);

  renderUsersByDeck(container, model);
});

window.buildUsersByDeckModel = buildUsersByDeckModel;
window.renderUsersByDeck = renderUsersByDeck;