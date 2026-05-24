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
        const parts = String(play?.play_code || "").split("§");
        return Number(parts[1] || 0);
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

    function buildUsersByDeckModelFromPlays(plays, usersMap = {}, state = {}) {
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

        return Object.values(rows);
    }

    function buildUsersByDeckModelFromMembers(members = [], state = {}) {
        return Array.isArray(members)
            ? members.map((member) => {
                const userId = Number(member?.id || member?.user_id || 0);
                const name =
                    String(member?.nickname || member?.name || member?.user_name || "").trim() ||
                    `U${userId}`;
                const photo =
                    String(member?.profile_photo_url || member?.photo || "").trim() ||
                    "/assets/icons/singeta120.gif";
                const category =
                    String(member?.qCategory || member?.user_type || "").trim();

                return {
                    userId,
                    name,
                    photo,
                    cards: category ? [category] : []
                };
            })
            : [];
    }

    function buildUsersByDeckModel(playsOrMembers, usersMap = {}, state = {}) {
        const isMemberList = Array.isArray(playsOrMembers) && playsOrMembers.length > 0 &&
            typeof playsOrMembers[0].user_type !== "undefined";

        if (isMemberList) {
            return buildUsersByDeckModelFromMembers(playsOrMembers, state);
        }

        return buildUsersByDeckModelFromPlays(playsOrMembers, usersMap, state);
    }

    function isAclLine(play) {
        const parts = String(play?.play_code || "").split("§");
        const action = String(play?.action || parts[5] || "").trim().toLowerCase();
        const flow = String(play?.flow || parts[7] || "").trim().toLowerCase();

        return action === "puedejugar" && flow === "acl";
    }

    function getAuthHeaders(includeJson = false) {
        const token = localStorage.getItem("cooptrackToken");
        const headers = {};

        if (includeJson) {
            headers["Content-Type"] = "application/json";
        }

        if (token) {
            headers["Authorization"] = `Bearer ${token}`;
        }

        return headers;
    }

    async function fetchUsersByDeck(deckId) {
        if (!deckId) return [];

        try {
            const response = await fetch(
                `${window.API_BASE_URL}/decks/${encodeURIComponent(deckId)}/q-users`,
                {
                    method: "GET",
                    headers: getAuthHeaders()
                }
            );

            const data = await response.json();
            if (!response.ok || !data.ok) {
                console.warn("Error cargando usuarios del mazo:", data);
                return [];
            }

            return Array.isArray(data.users) ? data.users : [];
        } catch (error) {
            console.error("Error fetching users by deck", error);
            return [];
        }
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

    document.addEventListener("mazobar:showUsersByDeck", async () => {
        const container = document.getElementById("administradores-container");
        if (!container) return;

        const state = window.__currentState || {};
        const deck = window.__currentDeck || {};
        const deckId = deck?.id || state?.deck?.id;

        container.innerHTML = `
          <div class="users-deck__loading">Cargando usuarios del mazo...</div>
        `;

        const members = await fetchUsersByDeck(deckId);
        let model = [];

        if (members.length) {
            model = buildUsersByDeckModel(members, {}, state);
        } else {
            const plays = state.plays || [];
            const usersMap = state.usersMap || {};
            model = buildUsersByDeckModel(plays, usersMap, state);
        }

        if (!model.length) {
            container.innerHTML = `
              <div class="users-deck__empty">No se encontraron usuarios del mazo.</div>
            `;
            return;
        }

        renderUsersByDeck(container, model);
    });

    window.buildUsersByDeckModel = buildUsersByDeckModel;
    window.renderUsersByDeck = renderUsersByDeck;
})();