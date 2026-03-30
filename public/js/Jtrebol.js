(function () {
  function renderJtrebol(play, context = {}) {
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
    const ACTIONS = ICONS.actions || {};

    const state = context.state || {};
    const allPlays = Array.isArray(state.plays) ? state.plays : [];
    const currentUserId = Number(state.userId || 0);

    const playId = play?.id;
    const creatorUserId = Number(play?.created_by_user_id || 0);

    const originalText = String(play?.play_text || "");
    let amountValue =
      play?.amount !== null && play?.amount !== undefined
        ? String(play.amount)
        : "";

    const safeText = escapeHtml(originalText);
    const author = escapeHtml(play?.createdByNickname || play?.created_by_nickname || "—");
    const date = formatDate(play?.displayDate || play?.created_at || "");
    const statusRaw = String(play?.play_status || play?.status || "ACTIVE").toUpperCase();
    const statusLabel = escapeHtml(statusRaw);

    const isApproved = statusRaw === "APPROVED";
    const isCancelled = statusRaw === "CANCELLED";
    const isDeleted = statusRaw === "DELETED";
    const isRejected = statusRaw === "REJECTED";
    const isClosed = isCancelled || isDeleted || isRejected;

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

    function resolveDiamondAceHolderUserId(plays) {
      const aceDiamondPlays = plays
        .filter((p) => {
          const rank = normalizeRank(p?.rank || p?.card_rank);
          const suit = normalizeSuit(p?.suit || p?.card_suit);
          return rank === "A" && suit === "DIAMOND" && isAliveStatus(p?.play_status);
        })
        .sort((a, b) => Number(b?.id || 0) - Number(a?.id || 0));

      if (!aceDiamondPlays.length) return null;

      const latest = aceDiamondPlays[0];

      if (latest?.target_user_id) return Number(latest.target_user_id);
      if (latest?.created_by_user_id) return Number(latest.created_by_user_id);

      return null;
    }

    const diamondAceHolderUserId = resolveDiamondAceHolderUserId(allPlays);

    const userIsDiamondAceHolder =
      diamondAceHolderUserId !== null &&
      currentUserId !== 0 &&
      diamondAceHolderUserId === currentUserId;

    const userIsCreator =
      creatorUserId !== 0 &&
      currentUserId !== 0 &&
      creatorUserId === currentUserId;

    const userCanEdit = userIsCreator || userIsDiamondAceHolder;

    const saveIcon = escapeHtml(ACTIONS.save || "");
    const approveIcon = escapeHtml(ACTIONS.approve || "");
    const deleteIcon = escapeHtml(ACTIONS.delete || "");
    const helpIcon = escapeHtml(ACTIONS.help || "");
    const amountIcon = escapeHtml(ACTIONS.diamond || "");

    setTimeout(() => {
      const row = document.getElementById(rowId);
      if (!row || row.dataset.bound === "true") return;

      row.dataset.bound = "true";
      row.dataset.mode = "read";

      const modeRead = row.querySelector('[data-role="mode-read"]');
      const modeEdit = row.querySelector('[data-role="mode-edit"]');

      const amountView = row.querySelector('[data-role="amount-view"]');
      const amountInput = row.querySelector('[data-role="amount-input"]');

      const btnHelp = row.querySelector('[data-action="help-play"]');
      const btnSave = row.querySelector('[data-action="save-play"]');
      const btnApprove = row.querySelector('[data-action="approve-play"]');
      const btnDelete = row.querySelector('[data-action="delete-play"]');

      function getCurrentAmount() {
        return String(amountInput?.value || "").trim();
      }

      function setVisualMode(mode) {
        row.dataset.mode = mode;
      }

      function renderMode() {
        const visualMode = row.dataset.mode || "read";
        const isEdit = visualMode === "edit";
        const isRead = visualMode === "read";

        if (modeRead) modeRead.style.display = isRead ? "flex" : "none";
        if (modeEdit) modeEdit.style.display = isEdit ? "flex" : "none";

        if (isClosed) {
          if (btnHelp) btnHelp.style.display = "inline-flex";
          if (btnSave) btnSave.style.display = "none";
          if (btnApprove) btnApprove.style.display = "none";
          if (btnDelete) btnDelete.style.display = "none";
          return;
        }

        if (btnHelp) {
          btnHelp.style.display = "inline-flex";
        }

        if (btnSave) {
          btnSave.style.display = userCanEdit ? "inline-flex" : "none";
        }

        if (btnApprove) {
          btnApprove.style.display =
            !isApproved && userIsDiamondAceHolder ? "inline-flex" : "none";
        }

        if (btnDelete) {
          btnDelete.style.display = !isApproved ? "inline-flex" : "none";
        }

        if (isEdit && amountInput) {
          amountInput.focus();
          amountInput.select();
        }
      }

      btnSave?.addEventListener("click", () => {
        const nextAmount = getCurrentAmount();

        dispatch("tablero:save-play", {
          playId,
          amount: nextAmount
        });

        amountValue = nextAmount;

        if (amountView) {
          amountView.textContent = amountValue || "—";
        }

        setVisualMode("read");
        renderMode();
      });

      btnApprove?.addEventListener("click", () => {
        dispatch("tablero:approve-play", {
          playId
        });
      });

      btnDelete?.addEventListener("click", () => {
        dispatch("tablero:delete-play", {
          playId
        });
      });

      btnHelp?.addEventListener("click", () => {
        dispatch("tablero:help-play", {
          playId,
          cardRank: "J",
          cardSuit: "CLUB"
        });
      });

      amountView?.addEventListener("click", () => {
        if (!userCanEdit || isApproved || isClosed) return;
        setVisualMode("edit");
        renderMode();
      });

      amountInput?.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          btnSave?.click();
        }
      });

      renderMode();
    }, 0);

    return `
      <article class="tablero-row tablero-row--jtrebol" id="${rowId}">
        <div class="tablero-row__left">
          <div class="tablero-row__card">J♣</div>
        </div>

        <div class="tablero-row__center">
          <div class="tablero-row__title">${safeText || "Sin concepto"}</div>

          <div class="tablero-row__amount-line">
            <span class="tablero-row__amount-card">J♦</span>

            <div class="tablero-row__mode-read" data-role="mode-read">
              <span class="tablero-row__amount-view" data-role="amount-view">
                ${escapeHtml(amountValue || "—")}
              </span>
            </div>

            <div class="tablero-row__mode-edit" data-role="mode-edit" style="display:none;">
              <span class="tablero-row__amount-icon-wrap">
                ${amountIcon ? `<img src="${amountIcon}" alt="Monto" class="tablero-row__field-icon" />` : ""}
              </span>
              <input
                type="number"
                step="0.01"
                min="0"
                value="${escapeHtml(amountValue)}"
                data-role="amount-input"
                class="tablero-row__amount-input"
                placeholder="Monto"
              />
            </div>
          </div>

          <div class="tablero-row__meta">
            <span>Autor: ${author}</span>
            <span>Fecha: ${date}</span>
            <span>Estado: ${statusLabel}</span>
          </div>
        </div>

        <div class="tablero-row__right">
          <button type="button" data-action="help-play" title="Help">
            ${helpIcon ? `<img src="${helpIcon}" alt="Help" />` : `<span>?</span>`}
          </button>

          <button type="button" data-action="save-play" title="Salvar">
            ${saveIcon ? `<img src="${saveIcon}" alt="Salvar" />` : `<span>S</span>`}
          </button>

          <button type="button" data-action="approve-play" title="Aprobar">
            ${approveIcon ? `<img src="${approveIcon}" alt="Aprobar" />` : `<span>✓</span>`}
          </button>

          <button type="button" data-action="delete-play" title="Borrar">
            ${deleteIcon ? `<img src="${deleteIcon}" alt="Borrar" />` : `<span>X</span>`}
          </button>
        </div>
      </article>
    `;
  }

  window.renderJtrebol = renderJtrebol;
})();
