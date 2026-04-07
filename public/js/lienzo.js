(function () {
  function normalizeRank(value) {
    return String(value || "").trim().toUpperCase();
  }

  function normalizeSuit(value) {
    return String(value || "").trim().toUpperCase();
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
    return (
      state?.deck ||
      state?.mazo ||
      window.__currentDeck ||
      {}
    );
  }

  function getCurrentUser() {
    return window.__currentUser || null;
  }

  function getPlayById(playId) {
    const id = Number(playId || 0);
    if (!id) return null;

    return getAllPlays().find((play) => Number(play?.id || 0) === id) || null;
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
      A_HEART: "/assets/icons/Acorazon.gif",
      A_SPADE: "/assets/icons/Apike.gif",
      A_DIAMOND: "/assets/icons/Adiamante.gif",
      A_CLUB: "/assets/icons/Atrebol.gif",

      K_HEART: "/assets/icons/Kcorazon.gif",
      K_SPADE: "/assets/icons/Kpike.gif",
      K_DIAMOND: "/assets/icons/Kdiamante.gif",
      K_CLUB: "/assets/icons/Ktrebol.gif",

      Q_HEART: "/assets/icons/Qcorazon.gif",
      Q_SPADE: "/assets/icons/Qpike.gif",
      Q_DIAMOND: "/assets/icons/Qdiamante.gif",
      Q_CLUB: "/assets/icons/Qtrebol.gif",

      J_HEART: "/assets/icons/Jcorazon.gif",
      J_SPADE: "/assets/icons/Jpike.gif",
      J_DIAMOND: "/assets/icons/Jdiamante.gif",
      J_CLUB: "/assets/icons/Jtrebol.gif"
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

  function getLienzoContainer() {
    return document.getElementById("lienzo-container");
  }

  function deriveOwnedCorporateCards(plays, currentUserId) {
    if (!Array.isArray(plays) || !currentUserId) return [];

    return plays
      .filter((p) => {
        const rank = normalizeRank(p.card_rank || p.rank);
        const suit = normalizeSuit(p.card_suit || p.suit);

        if (rank !== "A") return false;
        if (!["HEART", "SPADE", "DIAMOND", "CLUB"].includes(suit)) return false;

        const ownerId =
          Number(p.target_user_id || 0) ||
          Number(p.created_by_user_id || 0);

        return ownerId === Number(currentUserId);
      })
      .map((p) => ({
        id: p.id,
        card_rank: p.card_rank || p.rank,
        card_suit: p.card_suit || p.suit
      }));
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

  function renderBackgroundCard(card, index) {
    const src = getCardImageSrc(card?.card_rank, card?.card_suit);

    return `
      <img
        class="lienzo-source-stack__card"
        src="${escapeHtml(src)}"
        alt=""
        style="left:${index * 18}px;"
      />
    `;
  }

  function buildSourceCardsScene(play) {
    const ownedCards = getOwnedCorporateCardsForCurrentUser();

    const activeRank = normalizeRank(play?.card_rank || play?.rank);
    const activeSuit = normalizeSuit(play?.card_suit || play?.suit);

    const parentPlay = getPlayById(play?.parent_play_id);
    const parentRank = normalizeRank(parentPlay?.card_rank || parentPlay?.rank);
    const parentSuit = normalizeSuit(parentPlay?.card_suit || parentPlay?.suit);

    // Caso especial: Q♠
    if (activeRank === "Q" && activeSuit === "SPADE") {
      const stackCards = [];

      const clubAce = ownedCards.find((card) => {
        return (
          normalizeRank(card?.card_rank) === "A" &&
          normalizeSuit(card?.card_suit) === "CLUB"
        );
      });

      if (clubAce) {
        stackCards.push({
          id: clubAce.id,
          card_rank: clubAce.card_rank,
          card_suit: clubAce.card_suit
        });
      }

      if (parentPlay && parentRank === "J" && parentSuit === "SPADE") {
        stackCards.push({
          id: parentPlay.id,
          card_rank: parentPlay.card_rank || parentPlay.rank,
          card_suit: parentPlay.card_suit || parentPlay.suit
        });
      }

      return {
        backgroundCards: stackCards,
        activeCard: {
          card_rank: activeRank,
          card_suit: activeSuit
        }
      };
    }

    // Caso general: K, A, etc.
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

  function resolveSourceUser(play) {
    const plays = getAllPlays();
    const sourceUserId =
      Number(play?.created_by_user_id || 0) ||
      Number(play?.target_user_id || 0);

    if (!sourceUserId) return null;

    const relatedPlay = plays.find((p) => {
      const candidateId =
        Number(p?.created_by_user_id || 0) ||
        Number(p?.target_user_id || 0);
      return candidateId === sourceUserId;
    });

    return {
      id: sourceUserId,
      nickname:
        play?.created_by_nickname ||
        relatedPlay?.created_by_nickname ||
        `Usuario ${sourceUserId}`,
      profile_photo_url:
        play?.created_by_profile_photo_url ||
        relatedPlay?.created_by_profile_photo_url ||
        "/assets/icons/singeta120.gif"
    };
  }

  function resolveTargetUser(play) {
    const targetUserId = Number(play?.target_user_id || 0);

    if (!targetUserId) return null;

    return {
      id: targetUserId,
      nickname:
        play?.target_user_nickname ||
        `Usuario ${targetUserId}`,
      profile_photo_url:
        play?.target_user_profile_photo_url ||
        "/assets/icons/singeta120.gif"
    };
  }

  function renderSourcePlayerPanel(play) {
    const user = resolveSourceUser(play);
    const userPhoto = user?.profile_photo_url || "/assets/icons/singeta120.gif";
    const userName =
      user?.nickname ||
      user?.full_name ||
      user?.name ||
      "Anfitrión";

    const scene = buildSourceCardsScene(play);

    return `
      <section class="lienzo-panel lienzo-panel--source">
        <div class="lienzo-source-header">
          <img
            class="lienzo-source-header__photo"
            src="${escapeHtml(userPhoto)}"
            alt="${escapeHtml(userName)}"
          />
          <div class="lienzo-source-header__name">
            ${escapeHtml(userName)}
          </div>
        </div>

        <div class="lienzo-source-cards">
          <div class="lienzo-source-stack">
            ${scene.backgroundCards.map(renderBackgroundCard).join("")}
          </div>
        </div>
      </section>
    `;
  }

  function renderTargetPlayerPanel(play) {
    const user = resolveTargetUser(play);
    const userPhoto = user?.profile_photo_url || "/assets/icons/singeta120.gif";
    const userName =
      user?.nickname ||
      user?.full_name ||
      user?.name ||
      "Invitado";

    const rank = normalizeRank(play?.card_rank || play?.rank);
    const suit = normalizeSuit(play?.card_suit || play?.suit);
    const imageSrc = getCardImageSrc(rank, suit);

    return `
      <section class="lienzo-panel lienzo-panel--target">
        <div class="lienzo-target-header">
          <img
            class="lienzo-target-header__photo"
            src="${escapeHtml(userPhoto)}"
            alt="${escapeHtml(userName)}"
          />
          <div class="lienzo-target-header__name">
            ${escapeHtml(userName)}
          </div>
        </div>

        <div id="lienzo-target-dropzone" class="lienzo-target-dropzone">
          <img
            class="lienzo-card-image"
            src="${escapeHtml(imageSrc)}"
            alt=""
          />
        </div>
      </section>
    `;
  }

  function renderLienzo(play) {
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

    renderLienzo(play);
  }

  window.openLienzoByPlayId = openLienzoByPlayId;
})();