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

    function getOwnerUserId(play) {
        const rank = getRank(play);

        if (rank === "A") {
            return Number(play?.target_user_id || play?.created_by_user_id || 0);
        }

        if (rank === "K" || rank === "Q") {
            return Number(play?.target_user_id || 0);
        }

        return 0;
    }

    function getOwnerName(play, userId, usersMap) {
        return (
            usersMap?.[userId]?.nickname ||
            play?.target_user_nickname ||
            play?.created_by_nickname ||
            `U${userId}`
        );
    }

    function getOwnerPhoto(play, userId, usersMap) {
        return (
            usersMap?.[userId]?.profile_photo_url ||
            play?.target_user_profile_photo_url ||
            play?.created_by_profile_photo_url ||
            "/assets/icons/singeta120.gif"
        );
    }

    function buildUsersByDeckModel(plays, usersMap = {}, state = {}) {
        const rows = {};
        const deck = window.__currentDeck || state?.deck || state?.mazo || {};
        const authorId = Number(deck.created_by_user_id || deck.owner_user_id || 0);

        if (authorId) {
            rows[authorId] = {
                userId: authorId,
                name:
                    deck.created_by_nickname ||
                    deck.owner_nickname ||
                    usersMap?.[authorId]?.nickname ||
                    `U${authorId}`,
                photo:
                    deck.created_by_profile_photo_url ||
                    deck.owner_profile_photo_url ||
                    usersMap?.[authorId]?.profile_photo_url ||
                    "/assets/icons/singeta120.gif",
                cards: []
            };
        }
        (Array.isArray(plays) ? plays : []).forEach((p) => {
            const rank = getRank(p);
            const suit = getSuit(p);
            const status = getStatus(p);

            if (!["A", "K", "Q"].includes(rank)) return;
            if (!["ACTIVE", "APPROVED", "SENT"].includes(status)) return;

            const userId = getOwnerUserId(p);
            if (!userId) return;

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

        Object.values(rows).forEach((row) => {
            if (row.name !== `U${row.userId}`) return;

            const play = (Array.isArray(plays) ? plays : []).find((p) => {
                return Number(p.created_by_user_id || 0) === Number(row.userId) ||
                    Number(p.target_user_id || 0) === Number(row.userId);
            });

            if (play) {
                row.name = getOwnerName(play, row.userId, usersMap);
                row.photo = getOwnerPhoto(play, row.userId, usersMap);
            }
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
    class="users-deck__photo"
    src="${row.photo}"
    alt="${row.name}"
    onerror="this.onerror=null;this.src='/assets/icons/singeta120.gif';"
  />
  <span class="users-deck__name">${row.name}</span>
</div>
            <div class="users-deck__cards">${row.cards.join(" ")}</div>
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