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

  function renderKrow(play, context = {}) {
    const helpers = context.helpers || {};
    const escapeHtml = helpers.escapeHtml || ((v) => String(v ?? ""));

    const playId = play?.id;
    const rowId = `tablero-row-${playId}`;

    const rank = "K";
    const suit = String(play?.suit || play?.card_suit || "").toUpperCase();
    const label = `${rank}${getSuitSymbol(suit)}`;

    const ownerNickname = escapeHtml(getOwnerNickname(play));
    const ownerPhoto = escapeHtml(getOwnerPhoto(play));

    return `
      <article class="tablero-row tablero-row--krow" id="${rowId}">
        
        <div class="tablero-row__left">
          <div class="tablero-row__card">
            ${escapeHtml(label)}
          </div>
        </div>

        <div class="tablero-row__center">
          <div class="tablero-row__title">
            ${escapeHtml(label)}
          </div>

          <div class="tablero-row__meta" style="display:flex; align-items:center; gap:8px;">
            <img
              src="${ownerPhoto}"
              alt="${ownerNickname}"
              style="width:32px; height:32px; border-radius:50%; object-fit:cover;"
              onerror="this.onerror=null;this.src='/assets/icons/singeta120.gif';"
            />
            <span>${ownerNickname}</span>
          </div>
        </div>

        <div class="tablero-row__right">
          <!-- vacío por ahora -->
        </div>

      </article>
    `;
  }

  window.renderKrow = renderKrow;
})();