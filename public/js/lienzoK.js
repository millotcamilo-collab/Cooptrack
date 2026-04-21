(function () {
    function normalizeRank(value) {
        return String(value || "").trim().toUpperCase();
    }

    function normalizeSuit(value) {
        return String(value || "").trim().toUpperCase();
    }

    function normalizeRank(value) {
        return String(value || "").trim().toUpperCase();
    }

    function normalizeSuit(value) {
        return String(value || "").trim().toUpperCase();
    }

    function getCurrentState() {
        return window.__currentState || {};
    }

    function getAllPlays() {
        const state = getCurrentState();
        return Array.isArray(state.plays) ? state.plays : [];
    }

    function getCurrentUser() {
        return window.__currentUser || window.__currentState?.currentUser || null;
    }

    function parsePlayCode(code) {
        const parts = String(code || "").split("§");

        return {
            deckId: parts[0] || null,
            userId: parts[1] || null,
            date: parts[2] || null,
            rank: parts[3] || null,
            suit: parts[4] || null,
            action: parts[5] || null,
            autorizados: parts[6] || null,
            flow: parts[7] || null,
            recipients: parts[8] || null
        };
    }

    function deriveOwnedCorporateCards(plays, currentUserId) {
        if (!Array.isArray(plays) || !currentUserId) return [];

        return plays
            .filter((p) => {
                const parsed = parsePlayCode(p?.play_code);
                const rank = normalizeRank(parsed.rank || p?.card_rank || p?.rank);
                const suit = normalizeSuit(parsed.suit || p?.card_suit || p?.suit);
                const action = String(parsed.action || "").trim();
                const status = String(p?.play_status || p?.status || "").trim().toUpperCase();

                if (!["A", "K"].includes(rank)) return false;
                if (!["HEART", "SPADE", "DIAMOND", "CLUB"].includes(suit)) return false;
                if (status !== "ACTIVE") return false;

                // excluye líneas de habilitación tipo "puedeJugar"
                if (action === "puedeJugar") return false;

                const ownerId =
                    Number(p?.target_user_id || 0) ||
                    Number(p?.created_by_user_id || 0);

                return ownerId === Number(currentUserId);
            })
            .map((p) => {
                const parsed = parsePlayCode(p?.play_code);

                return {
                    id: p?.id,
                    card_rank: parsed.rank || p?.card_rank || p?.rank,
                    card_suit: parsed.suit || p?.card_suit || p?.suit
                };
            });
    }

    function compareCorporateCards(a, b) {
        const order = {
            A_HEART: 1,
            A_SPADE: 2,
            A_DIAMOND: 3,
            A_CLUB: 4,
            K_HEART: 5,
            K_SPADE: 6,
            K_DIAMOND: 7,
            K_CLUB: 8
        };

        const aKey = `${normalizeRank(a?.card_rank)}_${normalizeSuit(a?.card_suit)}`;
        const bKey = `${normalizeRank(b?.card_rank)}_${normalizeSuit(b?.card_suit)}`;

        return (order[aKey] || 999) - (order[bKey] || 999);
    }

    function getOwnedCorporateCardsForCurrentUser() {
        const plays = getAllPlays();
        const currentUser = getCurrentUser();
        const userId = Number(currentUser?.id || 0);

        if (!userId) return [];

        return deriveOwnedCorporateCards(plays, userId).sort(compareCorporateCards);
    }

    function buildSourceCardsScene(play) {
        const ownedCards = getOwnedCorporateCardsForCurrentUser();

        const activeRank = normalizeRank(play?.card_rank || play?.rank);
        const activeSuit = normalizeSuit(play?.card_suit || play?.suit);

        const backgroundCards = ownedCards.filter((card) => {
            const rank = normalizeRank(card?.card_rank);
            const suit = normalizeSuit(card?.card_suit);

            return !(rank === activeRank && suit === activeSuit);
        });

        return {
            backgroundCards,
            activeCard: {
                card_rank: activeRank,
                card_suit: activeSuit
            }
        };
    }

    function getCardImageSrc(rank, suit) {
        const r = normalizeRank(rank);
        const s = normalizeSuit(suit);

        const map = {
            A_HEART: "/assets/icons/Acorazon.gif",
            A_SPADE: "/assets/icons/Apike.gif",
            A_DIAMOND: "/assets/icons/Adiamante.gif",
            A_CLUB: "/assets/icons/Atrebol.gif",

            K_HEART: "/assets/icons/Kcorazon.gif",
            K_SPADE: "/assets/icons/Kpike.gif",
            K_DIAMOND: "/assets/icons/Kdiamante.gif",
            K_CLUB: "/assets/icons/Ktrebol.gif"
        };

        return map[`${r}_${s}`] || "/assets/icons/Dorso70.gif";
    }

    function renderBackgroundCard(card, index) {
        const src = getCardImageSrc(card?.card_rank, card?.card_suit);

        return `
    <img
      class="lienzo-source-stack__card"
      src="${src}"
      alt=""
      style="left:${index * 18}px;"
    />
  `;
    }

    function escapeHtml(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function getCurrentState() {
        return window.__currentState || {};
    }

    function getAllPlays() {
        const state = getCurrentState();
        return Array.isArray(state.plays) ? state.plays : [];
    }

    function getCurrentDeck() {
        const state = getCurrentState();
        return state?.deck || state?.mazo || window.__currentDeck || {};
    }

    function getLienzoContainer() {
        return document.getElementById("lienzo-container");
    }

    function getPlayById(playId) {
        const id = Number(playId || 0);
        if (!id) return null;
        return getAllPlays().find((play) => Number(play?.id || 0) === id) || null;
    }

    function getCurrentUser() {
        return window.__currentUser || window.__currentState?.currentUser || null;
    }

    function getSuitSymbol(suit) {
        const s = normalizeSuit(suit);
        if (s === "HEART") return "♥";
        if (s === "SPADE") return "♠";
        if (s === "DIAMOND") return "♦";
        if (s === "CLUB") return "♣";
        return "";
    }

    function getCardImageSrc(rank, suit) {
        const r = normalizeRank(rank);
        const s = normalizeSuit(suit);

        const map = {
            K_HEART: "/assets/icons/Kcorazon.gif",
            K_SPADE: "/assets/icons/Kpike.gif",
            K_DIAMOND: "/assets/icons/Kdiamante.gif",
            K_CLUB: "/assets/icons/Ktrebol.gif"
        };

        return map[`${r}_${s}`] || "/assets/icons/Dorso70.gif";
    }

    function getDeckAvatarSrc(deck) {
        const raw =
            deck?.deck_image_url ||
            deck?.image_url ||
            deck?.photo_url ||
            deck?.avatar ||
            "";

        return String(raw).trim() || "/assets/icons/sinPicture.gif";
    }

    function getCurrencyCode(deck) {
        return String(deck?.currency_symbol || "").trim().toUpperCase();
    }

    function renderDeckHeader(deck) {
        const avatarSrc = getDeckAvatarSrc(deck);
        const deckName = deck?.name || "Mazo";
        const currencyCode = getCurrencyCode(deck);
        const currencyName =
            String(deck?.currency_name || "").trim() ||
            String(deck?.currency_label || "").trim() ||
            "";

        return `
      <div
        id="lienzo-placard"
        data-photo-url="${escapeHtml(avatarSrc)}"
        data-rank="A"
        data-suit="HEART"
        data-title="${escapeHtml(deckName)}"
        data-currency-code="${escapeHtml(currencyCode)}"
        data-currency-name="${escapeHtml(currencyName)}"
      ></div>
    `;
    }

    function mountPlacardFromDataset() {
        const placardHost = document.getElementById("lienzo-placard");
        if (!placardHost) return;
        if (typeof window.renderPlacard !== "function") return;

        window.renderPlacard(placardHost, {
            photoUrl: placardHost.dataset.photoUrl || "",
            rank: placardHost.dataset.rank || "A",
            suit: placardHost.dataset.suit || "HEART",
            title: placardHost.dataset.title || "Mazo",
            currencyCode: placardHost.dataset.currencyCode || "",
            currencyName: placardHost.dataset.currencyName || "",
            showCurrency: false
        });
    }

    function resolveSourceUser(play) {
        return {
            id: Number(play?.created_by_user_id || 0),
            nickname: play?.created_by_nickname || "Anfitrión",
            profile_photo_url:
                play?.created_by_profile_photo_url || "/assets/icons/singeta120.gif"
        };
    }

    function resolveTargetUser(play) {
        return {
            id: Number(play?.target_user_id || 0),
            nickname: play?.target_user_nickname || "Destinatario",
            profile_photo_url:
                play?.target_user_profile_photo_url || "/assets/icons/singeta120.gif"
        };
    }

    function renderExitButton() {
        const exitIcon = window.ICONS?.actions?.exit || "/assets/icons/exit40.gif";

        return `
      <div class="nuevo-mazo-target-actions nuevo-mazo-target-actions--top">
        <button id="lienzo-exit-btn" class="icon-btn" title="Salir">
          <img src="${exitIcon}" alt="Salir" />
        </button>
      </div>
    `;
    }

    function renderSourcePlayerPanel(play) {
        const sourceUser = resolveSourceUser(play);
        const scene = buildSourceCardsScene(play);
        const backgroundCards = Array.isArray(scene?.backgroundCards)
            ? scene.backgroundCards
            : [];

        return `
    <section class="lienzo-panel lienzo-panel--source panel--split-top">
      <div class="panel-topbar">
        <div class="panel-topbar__col panel-topbar__col--identity">
          <div class="lienzo-target-header lienzo-target-header--top">
            <div class="lienzo-target-header__name">${escapeHtml(sourceUser.nickname)}</div>
            <img
              class="lienzo-target-header__photo"
              src="${escapeHtml(sourceUser.profile_photo_url)}"
              alt="${escapeHtml(sourceUser.nickname)}"
            />
          </div>
        </div>
        <div class="panel-topbar__col panel-topbar__col--actions">
          ${renderExitButton()}
        </div>
      </div>

      <div class="lienzo-source-cards">
        <div class="lienzo-source-stack">
          ${backgroundCards.map(renderBackgroundCard).join("")}
        </div>
      </div>
    </section>
  `;
    }

    function renderTargetPlayerPanel(play) {
        console.count("renderTargetPlayerPanel");

        const targetUser = resolveTargetUser(play);

        return `
    <section class="lienzo-panel lienzo-panel--target panel--split-top">
      <div class="panel-topbar panel-topbar--single">
        <div class="panel-topbar__col panel-topbar__col--identity">
          <div class="lienzo-target-header lienzo-target-header--top">
            <div class="lienzo-target-header__name">${escapeHtml(targetUser.nickname)}</div>
            <img
              class="lienzo-target-header__photo"
              src="${escapeHtml(targetUser.profile_photo_url)}"
              alt="${escapeHtml(targetUser.nickname)}"
            />
          </div>
        </div>
      </div>

      <div id="lienzo-target-dropzone" class="lienzo-target-dropzone">
        <img
          class="lienzo-card-image"
          src="${escapeHtml(getCardImageSrc(play?.card_rank, play?.card_suit))}"
          alt="${escapeHtml(`K${getSuitSymbol(play?.card_suit)}`)}"
        />
      </div>
    </section>
  `;
    }

    function bindLienzoActions(play) {
        const exitBtn = document.getElementById("lienzo-exit-btn");

        if (exitBtn) {
            exitBtn.addEventListener("click", () => {
                const deckId =
                    Number(play?.deck_id || 0) ||
                    Number(getCurrentDeck()?.id || 0);

                if (deckId) {
                    window.location.href = `/mazo.html?id=${deckId}`;
                    return;
                }

                window.history.back();
            });
        }
    }

    function renderLienzo(play) {
        console.count("renderLienzo");

        const container = getLienzoContainer();
        const deck = getCurrentDeck();

        if (!container || !play) return;

        container.innerHTML = `
      ${renderDeckHeader(deck)}

      <div class="lienzo-grid">
        <div id="colombes" class="lienzo-grid__left">
          ${renderSourcePlayerPanel(play)}
        </div>

        <div id="amsterdam" class="lienzo-grid__right">
          ${renderTargetPlayerPanel(play)}
        </div>
      </div>
    `;

        mountPlacardFromDataset();
        bindLienzoActions(play);
    }

    function openLienzoByPlayId(playId) {
        const play = getPlayById(playId);

        if (!play) {
            const container = getLienzoContainer();
            if (container) {
                container.innerHTML = `
          <div class="lienzo-error">
            No se encontró la jugada ${escapeHtml(playId)}.
          </div>
        `;
            }
            return;
        }

        const rank = normalizeRank(play?.card_rank || play?.rank);
        if (rank !== "K") {
            const container = getLienzoContainer();
            if (container) {
                container.innerHTML = `
          <div class="lienzo-error">
            La jugada ${escapeHtml(playId)} no es una K.
          </div>
        `;
            }
            return;
        }

        renderLienzo(play);
    }

    window.openLienzoByPlayId = openLienzoByPlayId;
})();