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

    function getOwnerUserIdFromPlayCode(play) {
        const parts = String(play?.play_code || "").split("§");
        return Number(parts[1] || 0);
    }

    function getPlayOwnerUserId(play) {
        return Number(
            play?.created_by_user_id ||
            play?.target_user_id ||
            getOwnerUserIdFromPlayCode(play) ||
            0
        );
    }

    function getUserNameForPlay(play, userId, usersMap) {
        const normalizedUserId = Number(userId || 0);
        if (!normalizedUserId) return `U${normalizedUserId}`;

        const fromMap = usersMap?.[normalizedUserId]?.nickname || usersMap?.[normalizedUserId]?.name;
        if (fromMap) return fromMap;

        if (Number(play?.target_user_id || 0) === normalizedUserId) {
            return (
                play?.target_user_nickname ||
                play?.target_nickname ||
                play?.target_name ||
                `U${normalizedUserId}`
            );
        }

        if (Number(play?.created_by_user_id || 0) === normalizedUserId) {
            return (
                play?.created_by_nickname ||
                play?.created_by_user_nickname ||
                play?.created_by_name ||
                `U${normalizedUserId}`
            );
        }

        return `U${normalizedUserId}`;
    }

    function getUserPhotoForPlay(play, userId, usersMap) {
        const normalizedUserId = Number(userId || 0);
        if (!normalizedUserId) return "/assets/icons/singeta120.gif";

        const fromMap = usersMap?.[normalizedUserId]?.profile_photo_url;
        if (fromMap) return fromMap;

        if (Number(play?.target_user_id || 0) === normalizedUserId) {
            return (
                play?.target_user_profile_photo_url ||
                play?.target_profile_photo_url ||
                "/assets/icons/singeta120.gif"
            );
        }

        if (Number(play?.created_by_user_id || 0) === normalizedUserId) {
            return (
                play?.created_by_profile_photo_url ||
                "/assets/icons/singeta120.gif"
            );
        }

        return "/assets/icons/singeta120.gif";
    }

    function buildUsersByDeckModel(plays, usersMap = {}, state = {}) {
        const rows = {};
        const safePlays = Array.isArray(plays) ? plays : [];

        safePlays.forEach((p) => {
            const rank = getRank(p);
            const suit = getSuit(p);
            const status = getStatus(p);

            if (!["A", "K", "Q"].includes(rank)) return;
            if (isAclLine(p)) return;

            const isFoundationA =
                rank === "A" && String(p?.play_code || "").includes("§foundation§");

            if (!["ACTIVE", "APPROVED", "SENT"].includes(status) && !isFoundationA) {
                return;
            }

            const userId = getPlayOwnerUserId(p);
            if (!userId) return;

            if (!rows[userId]) {
                rows[userId] = {
                    userId,
                    name: getUserNameForPlay(p, userId, usersMap),
                    photo: getUserPhotoForPlay(p, userId, usersMap),
                    cards: []
                };
            }

            rows[userId].cards.push(`${rank}${getSuitSymbol(suit)}`);
        });

        return Object.values(rows);
    }

    function isAclLine(play) {
        const parts = String(play?.play_code || "").split("§");
        const action = String(play?.action || parts[5] || "").trim().toLowerCase();
        const flow = String(play?.flow || parts[7] || "").trim().toLowerCase();

        return action === "puedejugar" && flow === "acl";
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