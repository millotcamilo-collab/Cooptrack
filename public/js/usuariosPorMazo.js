(function () {
  function getSuitSymbol(suit) {
    switch (String(suit || "").toUpperCase()) {
      case "HEART": return "♥";
      case "SPADE": return "♠";
      case "DIAMOND": return "♦";
      case "CLUB": return "♣";
      default: return "";
    }
  }

  function getRank(play) {
    return String(play?.rank || play?.card_rank || "").toUpperCase();
  }

  function getSuit(play) {
    return String(play?.suit || play?.card_suit || "").toUpperCase();
  }

  function getStatus(play) {
    return String(play?.status || play?.play_status || "").toUpperCase();
  }

  function getUsersFromPlay(play) {
    const users = [];
    const created = Number(play?.created_by_user_id || 0);
    const target = Number(play?.target_user_id || 0);

    if (created) users.push(created);
    if (target && target !== created) users.push(target);

    return users;
  }

  function getOwnerName(play, userId, usersMap) {
    if (Number(play?.created_by_user_id || 0) === Number(userId)) {
      return (
        usersMap?.[userId]?.nickname ||
        play?.created_by_nickname ||
        play?.created_by_user_nickname ||
        `U${userId}`
      );
    }

    return (
      usersMap?.[userId]?.nickname ||
      play?.target_user_nickname ||
      play?.target_nickname ||
      `U${userId}`
    );
  }

  function getOwnerPhoto(play, userId, usersMap) {
    if (Number(play?.created_by_user_id || 0) === Number(userId)) {
      return (
        usersMap?.[userId]?.profile_photo_url ||
        play?.created_by_profile_photo_url ||
        "/assets/icons/singeta120.gif"
      );
    }

    return (
      usersMap?.[userId]?.profile_photo_url ||
      play?.target_user_profile_photo_url ||
      play?.target_profile_photo_url ||
      "/assets/icons/singeta120.gif"
    );
  }

  function buildUsersByDeckModel(plays, usersMap = {}, state = {}) {
    const rows = {};
    const safePlays = Array.isArray(plays) ? plays : [];

    safePlays.forEach((p) => {
      const rank = getRank(p);
      const suit = getSuit(p);
      const status = getStatus(p);

      if (!["A", "K", "Q"].includes(rank)) return;

      const isFoundationA =
        rank === "A" && String(p?.play_code || "").includes("§foundation§");

      if (!["ACTIVE", "APPROVED", "SENT"].includes(status) && !isFoundationA) {
        return;
      }

      const userIds = getUsersFromPlay(p);

      userIds.forEach((userId) => {
        if (!rows[userId]) {
          rows[userId] = {
            userId,
            name: getOwnerName(p, userId, usersMap),
            photo: getOwnerPhoto(p, userId, usersMap),
            cards: []
          };
        }

        rows[userId].cards.push(`${rank}${getSuitSymbol(suit)}`);
      });
    });

    return Object.values(rows);
  }

  function renderUsersByDeck(container, model) {
    container.innerHTML = `
      <section class="users-deck tablero">
        ${model.map(row => `
          <article class="tablero-row tablero-row--ak users-deck__row">
            <div class="users-deck__user">
              <img
                class="qpike-row__photo"
                src="${row.photo}"
                alt="${row.name}"
                onerror="this.onerror=null;this.src='/assets/icons/singeta120.gif';"
              />
              <span class="users-deck__name">${row.name}</span>
            </div>

            <div class="users-deck__cards">
              ${row.cards.join(" ")}
            </div>
          </article>
        `).join("")}
      </section>
    `;
  }

  document.addEventListener("mazobar:showUsersByDeck", () => {
    const container = document.getElementById("administradores-container");
    if (!container) return;

    const state = window.__currentState || {};
    const plays = state.plays || [];
    const usersMap = state.usersMap || {};

    const model = buildUsersByDeckModel(plays, usersMap, state);
    renderUsersByDeck(container, model);
  });

  window.buildUsersByDeckModel = buildUsersByDeckModel;
  window.renderUsersByDeck = renderUsersByDeck;
})();