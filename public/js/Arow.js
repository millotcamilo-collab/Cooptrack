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

    return `
      <article class="tablero-row tablero-row--ak" id="${rowId}">
        <div class="tablero-row__left">
          <div class="admin-row__mini-card" title="${escapeHtml(centerTitle)}">
            <span class="admin-row__rank">${escapeHtml(rank)}</span>
            <span class="admin-row__suit">${escapeHtml(suitSymbol)}</span>
          </div>
        </div>

        <div class="tablero-row__center">
          <div class="tablero-row__title">${centerTitle}</div>
        </div>

        <div class="tablero-row__right">
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