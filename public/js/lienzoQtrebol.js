(function () {
  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
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

  function getCurrentDeck() {
    const state = getCurrentState();
    return state.deck || state.mazo || window.__currentDeck || {};
  }

  function getAllPlays() {
    const state = getCurrentState();
    return Array.isArray(state.plays) ? state.plays : [];
  }

  function getPlayById(playId) {
    const id = Number(playId || 0);
    if (!id) return null;
    return getAllPlays().find((play) => Number(play?.id || 0) === id) || null;
  }

  function formatTime(value) {
    if (!value) return "";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";

    return date.toLocaleString("es-UY", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function getPlayOwnerUser(play) {
    const targetUserId = Number(play?.target_user_id || 0);

    if (targetUserId) {
      return {
        id: targetUserId,
        nickname: play?.target_user_nickname || `Usuario ${targetUserId}`,
        profile_photo_url:
          play?.target_user_profile_photo_url ||
          "/assets/icons/singeta120.gif"
      };
    }

    const sourceUserId = Number(play?.created_by_user_id || 0);

    return {
      id: sourceUserId || null,
      nickname: play?.created_by_nickname || (sourceUserId ? `Usuario ${sourceUserId}` : "Usuario"),
      profile_photo_url:
        play?.created_by_profile_photo_url ||
        "/assets/icons/singeta120.gif"
    };
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

  function getCardsOwnedByUser(userId) {
    const ownerId = Number(userId || 0);
    if (!ownerId) return [];

    const finalStatuses = ["QUIT", "FIRED", "REJECTED", "CANCELLED"];

    return getAllPlays()
      .filter((play) => {
        const rank = normalizeRank(play?.card_rank || play?.rank);
        const suit = normalizeSuit(play?.card_suit || play?.suit);
        const status = normalizeRank(play?.play_status || play?.status);

        if (!["A", "K"].includes(rank)) return false;
        if (!["HEART", "SPADE", "DIAMOND", "CLUB"].includes(suit)) return false;
        if (finalStatuses.includes(status)) return false;

        const cardOwnerId =
          Number(play?.target_user_id || 0) ||
          Number(play?.created_by_user_id || 0);

        return cardOwnerId === ownerId;
      })
      .map((play) => ({
        card_rank: normalizeRank(play?.card_rank || play?.rank),
        card_suit: normalizeSuit(play?.card_suit || play?.suit)
      }))
      .filter((card, index, self) => {
        const key = `${card.card_rank}_${card.card_suit}`;
        return index === self.findIndex((c) => `${c.card_rank}_${c.card_suit}` === key);
      })
      .sort(compareCorporateCards);
  }

  function getLienzoContainer() {
    return document.getElementById("lienzo-container");
  }

  function renderDeckHeader(deck) {
    return `
      <div
        id="lienzo-placard"
        data-photo-url="${escapeHtml(deck.deck_image_url || "/assets/icons/sinPicture.gif")}"
        data-title="${escapeHtml(deck.name || "Mazo")}" 
      ></div>
    `;
  }

  function mountPlacard(play) {
    const host = document.getElementById("lienzo-placard");
    if (!host || typeof window.renderPlacard !== "function") return;

    window.renderPlacard(host, {
      page: "lienzo-qtrebol",
      play,
      photoUrl: host.dataset.photoUrl,
      title: host.dataset.title,
      rank: "Q",
      suit: "CLUB",
      showCurrency: false,
      leftCards: [],
      plays: getAllPlays()
    });
  }

  function renderQtrebol(play) {
    const ownerUser = getPlayOwnerUser(play);

    const cardHtml = typeof window.CartaTipo?.renderPlayCardBox === "function"
      ? window.CartaTipo.renderPlayCardBox({
          rank: "Q",
          suit: "CLUB",
          title: play?.play_text || "Q♣",
          play_text: play?.play_text || "",
          status: play?.play_status || play?.status || "",
          start_date: play?.start_date,
          end_date: play?.end_date,
          location: play?.location,
          ownerUser,
          ownerCards: getCardsOwnedByUser(ownerUser?.id),
          metas: [
            play?.start_date
              ? {
                  icon: "/assets/icons/reloj60.gif",
                  text: formatTime(play.start_date)
                }
              : null,
            play?.location
              ? {
                  icon: "/assets/icons/LocGlobito80.gif",
                  text: play.location
                }
              : null
          ].filter(Boolean),
          actionsHtml: "",
          showActions: false
        })
      : `
        <article class="lv2-play-card">
          <div class="lv2-play-card__body">
            <div class="lv2-play-card__title">Q♣</div>
            <div class="lv2-play-card__text">${escapeHtml(play?.play_text || "Sin texto")}</div>
          </div>
        </article>
      `;

    return `
      <section class="lienzo-tribune lienzo-tribune--source">
        <div class="lienzo-tribune__corporates"></div>

        <div class="lienzo-tribune__stage lienzo-tribune__stage--column">
          <div class="amsterdam-card-stack">
            <div class="amsterdam-card-stack__primary">
              ${cardHtml}
            </div>
          </div>

          <div class="lienzo-jpica-panel" style="margin-top: 12px;">
            <div class="tablero-empty">Versión inicial de Q♣. Próximo paso: reglas y acciones específicas.</div>
          </div>
        </div>
      </section>
    `;
  }

  function openLienzoByPlayId(playId) {
    const play = getPlayById(playId);
    const container = getLienzoContainer();

    if (!container) return;

    if (!play) {
      container.innerHTML = '<div class="lienzo-error">No se encontró la jugada Q♣ solicitada.</div>';
      return;
    }

    container.innerHTML = `
      ${renderDeckHeader(getCurrentDeck())}
      ${renderQtrebol(play)}
    `;

    mountPlacard(play);
  }

  window.openLienzoByPlayId = openLienzoByPlayId;
})();
