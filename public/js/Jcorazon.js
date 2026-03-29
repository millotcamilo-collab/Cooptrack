(function () {
  function renderJcorazon(play, context = {}) {
    const helpers = context.helpers || {};
    const escapeHtml = helpers.escapeHtml || ((v) => String(v ?? ""));
    const formatDate = helpers.formatDate || ((v) => String(v ?? ""));
    const dispatch =
      typeof context.dispatch === "function"
        ? context.dispatch
        : function (eventName, detail) {
            document.dispatchEvent(new CustomEvent(eventName, { detail }));
          };

    const ICONS = window.ICONS || {};
    const SUITS = ICONS.suits || {};
    const ACTIONS = ICONS.actions || {};

    const state = context.state || {};
    const allPlays = Array.isArray(state.plays) ? state.plays : [];
    const currentUserId = Number(state.userId || 0);

    const playId = play?.id;
    const text = escapeHtml(play?.play_text || "");
    const statusRaw = String(play?.play_status || play?.status || "ACTIVE").toUpperCase();

    const rowId = `tablero-row-${playId}`;

    function normalizeRank(value) {
      return String(value || "").trim().toUpperCase();
    }

    function normalizeSuit(value) {
      return String(value || "").trim().toUpperCase();
    }

    function isAliveStatus(value) {
      const status = String(value || "").trim().toUpperCase();
      return !["CANCELLED", "DELETED", "REJECTED"].includes(status);
    }

    function resolveHeartAceHolderUserId(plays) {
      const aceHeartPlays = plays
        .filter((p) => {
          const rank = normalizeRank(p?.rank || p?.card_rank);
          const suit = normalizeSuit(p?.suit || p?.card_suit);
          return rank === "A" && suit === "HEART" && isAliveStatus(p?.play_status);
        })
        .sort((a, b) => {
          const aId = Number(a?.id || 0);
          const bId = Number(b?.id || 0);
          return bId - aId;
        });

      if (!aceHeartPlays.length) return null;

      const latest = aceHeartPlays[0];

      if (latest?.target_user_id) {
        return Number(latest.target_user_id);
      }

      if (latest?.created_by_user_id) {
        return Number(latest.created_by_user_id);
      }

      return null;
    }

    const heartAceHolderUserId = resolveHeartAceHolderUserId(allPlays);
    const userIsHeartAceHolder =
      heartAceHolderUserId !== null &&
      currentUserId !== 0 &&
      heartAceHolderUserId === currentUserId;

    const isApproved = statusRaw === "APPROVED";
    const isSaved = statusRaw === "SAVED";
    const canTransformSuit = !isSaved && !isApproved;
    const canSave = !isApproved;
    const canApprove = !isApproved && userIsHeartAceHolder;
    const canCancel = isApproved && userIsHeartAceHolder;
    const canDelete = !isApproved;

    const spadeIcon = escapeHtml(SUITS.SPADE || "");
    const clubIcon = escapeHtml(SUITS.CLUB || "");
    const saveIcon = escapeHtml(ACTIONS.save || "");
    const approveIcon = escapeHtml(ACTIONS.approve || "");
    const deleteIcon = escapeHtml(ACTIONS.delete || "");
    const cancelIcon = escapeHtml(ACTIONS.cancel || ACTIONS.exit || "");

    setTimeout(() => {
      const row = document.getElementById(rowId);
      if (!row || row.dataset.bound === "true") return;

      row.dataset.bound = "true";

      row.querySelector('[data-action="change-to-spade"]')?.addEventListener("click", () => {
        dispatch("tablero:change-suit", {
          playId,
          nextSuit: "SPADE",
          currentSuit: "HEART"
        });
      });

      row.querySelector('[data-action="change-to-club"]')?.addEventListener("click", () => {
        dispatch("tablero:change-suit", {
          playId,
          nextSuit: "CLUB",
          currentSuit: "HEART"
        });
      });

      row.querySelector('[data-action="save-play"]')?.addEventListener("click", () => {
        dispatch("tablero:save-play", {
          playId
        });
      });

      row.querySelector('[data-action="approve-play"]')?.addEventListener("click", () => {
        dispatch("tablero:approve-play", {
          playId
        });
      });

      row.querySelector('[data-action="delete-play"]')?.addEventListener("click", () => {
        dispatch("tablero:delete-play", {
          playId
        });
      });

      row.querySelector('[data-action="cancel-play"]')?.addEventListener("click", () => {
        dispatch("tablero:cancel-play", {
          playId
        });
      });
    }, 0);

    return `
      <article class="tablero-row tablero-row--jcorazon" id="${rowId}">
        <div class="tablero-row__left">
          <div class="tablero-row__card">J♥</div>
        </div>

        <div class="tablero-row__center">
          <div class="tablero-row__title">${text || "Sin texto"}</div>
          <div class="tablero-row__meta">
            <span>Estado: ${escapeHtml(statusRaw)}</span>
          </div>
        </div>

        <div class="tablero-row__right">
          ${
            canTransformSuit
              ? `
                <button type="button" data-action="change-to-spade" title="Cambiar a J♠">
                  <img src="${spadeIcon}" alt="J♠" />
                </button>
                <button type="button" data-action="change-to-club" title="Cambiar a J♣">
                  <img src="${clubIcon}" alt="J♣" />
                </button>
              `
              : ""
          }

          ${
            canSave
              ? `
                <button type="button" data-action="save-play" title="Salvar">
                  <img src="${saveIcon}" alt="Salvar" />
                </button>
              `
              : ""
          }

          ${
            canApprove
              ? `
                <button type="button" data-action="approve-play" title="Aprobar">
                  <img src="${approveIcon}" alt="Aprobar" />
                </button>
              `
              : ""
          }

          ${
            canDelete
              ? `
                <button type="button" data-action="delete-play" title="Borrar">
                  <img src="${deleteIcon}" alt="Borrar" />
                </button>
              `
              : ""
          }

          ${
            canCancel
              ? `
                <button type="button" data-action="cancel-play" title="Cancelar">
                  <img src="${cancelIcon}" alt="Cancelar" />
                </button>
              `
              : ""
          }
        </div>
      </article>
    `;
  }

  window.renderJcorazon = renderJcorazon;
})();
