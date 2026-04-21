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

  function resolveDeckId(play, context) {
    return Number(
      play?.deck_id ||
      context?.deck?.id ||
      context?.state?.deck?.id ||
      context?.state?.mazo?.id ||
      0
    );
  }

  function buildNavigationUrl(play, context) {
    const playId = Number(play?.id || 0);
    const deckId = resolveDeckId(play, context);

    if (!playId || !deckId) {
      return "";
    }

    return `/lienzoK.html?deckId=${deckId}&playId=${playId}`;
  }

  function isUnsentK(play) {
    const rank = getRank(play);
    if (rank !== "K") return false;

    const action = String(
      play?.action ||
      play?.parsed?.action ||
      ""
    ).trim().toLowerCase();

    const status = String(play?.play_status || "")
      .trim()
      .toUpperCase();

    const targetUserId = Number(
      play?.target_user_id ||
      play?.targetUserId ||
      0
    );

    const recipientsRaw = String(
      play?.recipients ||
      play?.parsed?.recipients ||
      ""
    ).trim();

    const recipientList = Array.isArray(play?.recipientList)
      ? play.recipientList
      : [];

    // criterio conservador:
    // si ya fue enviada/aprobada/cancelada no mostrar borrar
    if (["SENT", "APPROVED", "ACCEPTED", "REJECTED", "CANCELLED"].includes(status)) {
      return false;
    }

    // si ya tiene destinatario o recipients, asumimos que ya salió del estado "no enviada"
    if (targetUserId) return false;
    if (recipientsRaw) return false;
    if (recipientList.length > 0) return false;

    // permitimos K creadas desde lienzo pero todavía no enviadas / no resueltas
    if (!action || action === "create_from_lienzo") {
      return true;
    }

    return true;
  }

  function getDeleteButtonHtml(play, escapeHtml) {
    if (!isUnsentK(play)) return "";

    return `
      <button
        type="button"
        class="tablero-row__icon-btn tablero-row__icon-btn--delete-k"
        data-action="delete-k-play"
        data-play-id="${escapeHtml(play?.id || "")}"
        title="Borrar K"
        aria-label="Borrar K"
      >
        <img src="/assets/icons/papelera30.gif" alt="Borrar" />
      </button>
    `;
  }

  function deleteKPlay(playId, row) {
    const token = localStorage.getItem("cooptrackToken");

    if (!token) {
      alert("No estás logueado");
      return;
    }

    fetch(`/plays/${playId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
      .then(async (response) => {
        let data = null;
        try {
          data = await response.json();
        } catch (_) {
          data = null;
        }

        if (!response.ok || data?.ok === false) {
          throw new Error(data?.error || "No se pudo borrar la K");
        }

        if (row) {
          row.remove();
        } else {
          window.location.reload();
        }
      })
      .catch((error) => {
        console.error("Error borrando K", error);
        alert(error?.message || "No se pudo borrar la K");
      });
  }

  function renderKrow(play, context = {}) {
    const helpers = context.helpers || {};
    const escapeHtml = helpers.escapeHtml || ((v) => String(v ?? ""));

    const playId = play?.id || 0;
    const rowId = `tablero-row-k-${playId}`;

    const rank = getRank(play);
    const suit = String(play?.suit || play?.card_suit || "").toUpperCase();
    const suitSymbol = getSuitSymbol(suit);
    const miniLabel = `${rank}${suitSymbol}`;

    const ownerNickname = escapeHtml(getOwnerNickname(play));
    const ownerPhoto = escapeHtml(getOwnerPhoto(play));
    const suitName = getSuitName(suit);
    const centerTitle = escapeHtml(`Rey de ${suitName}`);
    const deleteButtonHtml = getDeleteButtonHtml(play, escapeHtml);

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
          console.warn("No se pudo construir la navegación de Krow", {
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

      const deleteBtn = row.querySelector('[data-action="delete-k-play"]');
      if (deleteBtn) {
        deleteBtn.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();

          const confirmed = window.confirm("¿Borrar esta K no enviada?");
          if (!confirmed) return;

          deleteKPlay(playId, row);
        });
      }
    }, 0);

    return `
      <article class="tablero-row tablero-row--ak tablero-row--krow" id="${rowId}">
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

        <div class="tablero-row__right">
          ${deleteButtonHtml}
        </div>
      </article>
    `;
  }

  window.renderKrow = renderKrow;
})();