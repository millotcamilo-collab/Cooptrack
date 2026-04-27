(function () {
  function getSuitSymbol(suit) {
    switch (String(suit || "").toUpperCase()) {
      case "HEART":
        return "♥";
      case "SPADE":
        return "♠";
      case "DIAMOND":
        return "♦";
      case "CLUB":
        return "♣";
      default:
        return "";
    }
  }

  function getRank(play) {
    return String(
      play?.rank || play?.card_rank || ""
    ).toUpperCase();
  }

  function getOwnerNickname(play) {
    return (
      play?.targetNickname ||
      play?.target_user_nickname ||
      play?.createdByNickname ||
      play?.created_by_nickname ||
      "—"
    );
  }

  function getOwnerPhoto(play) {
    return (
      play?.targetProfilePhotoUrl ||
      play?.target_user_profile_photo_url ||
      play?.target_profile_photo_url ||
      play?.createdByProfilePhotoUrl ||
      play?.created_by_profile_photo_url ||
      "/assets/icons/singeta120.gif"
    );
  }

  function getSuitName(suit) {
    switch (String(suit || "").toUpperCase()) {
      case "HEART":
        return "Corazón";
      case "SPADE":
        return "Pica";
      case "DIAMOND":
        return "Diamante";
      case "CLUB":
        return "Trébol";
      default:
        return "Sin palo";
    }
  }

  function getRankName(rank) {
    switch (String(rank || "").toUpperCase()) {
      case "A":
        return "As";
      case "K":
        return "Rey";
      default:
        return "";
    }
  }

  function resolveDeckId(play, context) {
    return Number(
      play?.deck_id ||
      context?.deck?.id ||
      context?.state?.deck?.id ||
      context?.state?.mazo?.id ||
      0
    );
  }

  function getCurrentViewerId(context) {
    return Number(
      context?.state?.userId ||
      context?.state?.currentUser?.id ||
      window.__currentUser?.id ||
      0
    );
  }

  function getAceOwnerUserId(play) {
    return Number(
      play?.target_user_id ||
      play?.targetUserId ||
      play?.created_by_user_id ||
      play?.createdByUserId ||
      0
    );
  }

  function getHeartAceOwnerUserId(context) {
    const plays = Array.isArray(context?.state?.plays) ? context.state.plays : [];

    const heartAce = plays.find((p) => {
      const rank = String(p?.card_rank || p?.rank || "").toUpperCase();
      const suit = String(p?.card_suit || p?.suit || "").toUpperCase();

      return rank === "A" && suit === "HEART";
    });

    if (!heartAce) return 0;

    return Number(
      heartAce?.target_user_id ||
      heartAce?.targetUserId ||
      heartAce?.created_by_user_id ||
      heartAce?.createdByUserId ||
      0
    );
  }

  function viewerOwnsHeartAce(context) {
    const viewerId = getCurrentViewerId(context);
    const heartAceOwnerId = getHeartAceOwnerUserId(context);

    return !!viewerId && !!heartAceOwnerId && viewerId === heartAceOwnerId;
  }

  function resolveAceAction(play, context) {
    const viewerId = getCurrentViewerId(context);
    const ownerId = getAceOwnerUserId(play);
    const suit = String(play?.suit || play?.card_suit || "").toUpperCase();
    const hasBlueJoker = deckHasActiveBlueJoker(context);

    if (!viewerId || !ownerId) return null;

    // A♥ es el derecho de autor del mazo:
    // no se transfiere, no se despide.
    if (suit === "HEART") {
      return viewerId === ownerId ? "view" : null;
    }

    // Si soy dueño actual de esta A, puedo transferir.
    // Más adelante lienzoA decide si además puede renunciar.
    if (viewerId === ownerId) {
      if (!hasBlueJoker) return "view";
      return "transfer";
    }

    // Si no soy dueño de esta A, solo A♥ puede despedir.
    if (viewerOwnsHeartAce(context)) {
      return "dismiss";
    }

    // K/Q u otros A no propietarios: no hacen nada.
    return null;
  }

  function deckHasActiveBlueJoker(context) {
    const plays = Array.isArray(context?.state?.plays) ? context.state.plays : [];

    return plays.some((p) => {
      const rank = String(p?.card_rank || p?.rank || "").toUpperCase();
      const suit = String(p?.card_suit || p?.suit || "").toUpperCase();
      const status = String(p?.play_status || "").toUpperCase();

      return rank === "JOKER" && suit === "BLUE" && status === "ACTIVE";
    });
  }

  function buildNavigationUrl(play, context) {
    const playId = Number(play?.id || 0);
    const deckId = resolveDeckId(play, context);

    if (!playId || !deckId) {
      return "";
    }

    const rank = getRank(play);
    const suit = String(play?.suit || play?.card_suit || "").toUpperCase();

    if (rank === "A") {
      const action = resolveAceAction(play, context);

      if (action === "transfer") {
        return (
          `/lienzo-new.html` +
          `?deckId=${deckId}` +
          `&parentPlayId=${playId}` +
          `&childRank=A` +
          `&childSuit=${encodeURIComponent(suit)}` +
          `&action=transfer`
        );
      }

      if (action === "dismiss") {
        return (
          `/lienzo.html` +
          `?deckId=${deckId}` +
          `&playId=${playId}` +
          `&action=dismiss`
        );
      }

      if (action === "view") {
        return (
          `/lienzo.html` +
          `?deckId=${deckId}` +
          `&playId=${playId}` +
          `&action=view`
        );
      }

      return "";
    }

    return `/lienzo.html?deckId=${deckId}&playId=${playId}`;
  }

  function renderArow(play, context = {}) {
    const helpers = context.helpers || {};
    const escapeHtml = helpers.escapeHtml || ((v) => String(v ?? ""));

    const playId = play?.id || 0;
    const rowId = `tablero-row-${playId}`;

    const rank = getRank(play);
    const suit = String(play?.suit || play?.card_suit || "").toUpperCase();
    const suitSymbol = getSuitSymbol(suit);
    const miniLabel = `${rank}${suitSymbol}`;

    const ownerNickname = escapeHtml(getOwnerNickname(play));
    const ownerPhoto = escapeHtml(getOwnerPhoto(play));
    const suitName = getSuitName(suit);
    const rankName = getRankName(rank);

    const centerTitle = escapeHtml(`${rankName} de ${suitName}`);

    setTimeout(() => {
      const row = document.getElementById(rowId);
      if (!row || row.dataset.bound === "true") return;

      row.dataset.bound = "true";

      row.style.cursor = "pointer";
      row.setAttribute("role", "button");
      row.setAttribute("tabindex", "0");
      row.setAttribute("aria-label", centerTitle);

      function openLienzo() {
        const url = buildNavigationUrl(play, context);

        if (!url) {
          console.warn("No se pudo construir la navegación de Arow", {
            play,
            context
          });
          return;
        }

        window.location.href = url;
      }

      row.addEventListener("click", openLienzo);

      row.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openLienzo();
        }
      });
    }, 0);

    return `
      <article class="tablero-row tablero-row--ak" id="${rowId}">
        <div class="tablero-row__left">
          <div class="admin-row__mini-card" title="${escapeHtml(miniLabel)}">
            <span class="admin-row__rank admin-row__rank--${suit.toLowerCase()}">
              ${escapeHtml(rank)}
            </span>
            <span class="admin-row__suit admin-row__suit--${suit.toLowerCase()}">
              ${escapeHtml(suitSymbol)}
            </span>
          </div>

          <div class="admin-row__owner">
            <img
              src="${ownerPhoto}"
              alt="${ownerNickname}"
              class="admin-row__owner-photo"
              onerror="this.onerror=null;this.src='/assets/icons/singeta120.gif';"
            />
            <span class="admin-row__owner-name">${ownerNickname}</span>
          </div>
        </div>
      </article>
    `;
  }

  window.renderArow = renderArow;
})();