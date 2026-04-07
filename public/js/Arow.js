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
      play?.target_user_profile_photo_url ||
      play?.target_profile_photo_url ||
      play?.created_by_profile_photo_url ||
      play?.createdByProfilePhotoUrl ||
      "/assets/icons/singeta120.gif"
    );
  }

  function renderArow(play, context = {}) {
    const helpers = context.helpers || {};
    const escapeHtml = helpers.escapeHtml || ((v) => String(v ?? ""));

    const playId = play?.id || 0;
    const rowId = `tablero-row-${playId}`;

    const rank = getRank(play) || "A";
    const suit = String(play?.suit || play?.card_suit || "").toUpperCase();
    const label = `${rank}${getSuitSymbol(suit)}`;

    const ownerNickname = escapeHtml(getOwnerNickname(play));
    const ownerPhoto = escapeHtml(getOwnerPhoto(play));

    return `
      <article class="tablero-row tablero-row--arow" id="${rowId}">
        <div
          class="tablero-row__meta"
          style="display:flex; align-items:center; gap:10px;"
        >
          <span class="tablero-row__title">${escapeHtml(label)}</span>

          <img
            src="${ownerPhoto}"
            alt="${ownerNickname}"
            style="width:32px; height:32px; border-radius:50%; object-fit:cover;"
            onerror="this.onerror=null;this.src='/assets/icons/singeta120.gif';"
          />

          <span class="tablero-row__owner">${ownerNickname}</span>
        </div>
      </article>
    `;
  }

  window.renderArow = renderArow;
})();