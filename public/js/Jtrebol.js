(function () {
  function renderJtrebol(play, context = {}) {
    const helpers = context.helpers || {};
    const escapeHtml = helpers.escapeHtml || ((v) => String(v ?? ""));
    const dispatch =
      typeof context.dispatch === "function"
        ? context.dispatch
        : function (eventName, detail) {
            document.dispatchEvent(new CustomEvent(eventName, { detail }));
          };

    const ICONS = window.ICONS || {};
    const ACTIONS = ICONS.actions || {};

    const state = context.state || {};
    const deck = context.deck || state.deck || window.__currentDeck || {};
    const allPlays = Array.isArray(state.plays) ? state.plays : [];
    const currentUserId = Number(state.userId || 0);

    const playId = play?.id;
    const creatorUserId = Number(play?.created_by_user_id || 0);
    const parentPlayId = play?.parent_play_id ? Number(play.parent_play_id) : null;

    let savedTextValue = String(play?.play_text || "");
    let savedAmountValue =
      play?.amount !== null && play?.amount !== undefined
        ? String(play.amount)
        : "";

    const statusRaw = String(play?.play_status || play?.status || "ACTIVE").toUpperCase();

    const isApproved = statusRaw === "APPROVED";
    const isCancelled = statusRaw === "CANCELLED";
    const isDeleted = statusRaw === "DELETED";
    const isRejected = statusRaw === "REJECTED";
    const isClosed = isCancelled || isDeleted || isRejected;

    const currencySymbol = String(
      play?.currency_symbol ||
      deck?.currency_symbol ||
      deck?.currencySymbol ||
      ""
    ).trim();

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
    const editIcon = escapeHtml(ACTIONS.edit || "");
    const exitIcon = escapeHtml(ACTIONS.exit || ACTIONS.cancel || "");

    setTimeout(() => {
      const row = document.getElementById(rowId);
      if (!row || row.dataset.bound === "true") return;

      row.dataset.bound = "true";

      const startsEmpty = !savedTextValue.trim() || !savedAmountValue.trim();
      row.dataset.mode = startsEmpty ? "edit" : "read";

      const textView = row.querySelector('[data-role="text-view"]');
      const textInput = row.querySelector('[data-role="text-input"]');
      const modeRead = row.querySelector('[data-role="mode-read"]');
      const modeEdit = row.querySelector('[data-role="mode-edit"]');

      const amountView = row.querySelector('[data-role="amount-view"]');
      const amountInput = row.querySelector('[data-role="amount-input"]');

      const btnHelp = row.querySelector('[data-action="help-play"]');
      const btnSave = row.querySelector('[data-action="save-play"]');
      const btnEdit = row.querySelector('[data-action="edit-play"]');
      const btnExit = row.querySelector('[data-action="exit-edit"]');
      const btnApprove = row.querySelector('[data-action="approve-play"]');
      const btnDelete = row.querySelector('[data-action="delete-play"]');

      function getCurrentText() {
        return String(textInput?.value || "").trim();
      }

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
        const hasSavedText = String(savedTextValue || "").trim() !== "";
        const hasSavedAmount = String(savedAmountValue || "").trim() !== "";
        const isComplete = hasSavedText && hasSavedAmount;

        if (textView) textView.style.display = isRead ? "inline-flex" : "none";
        if (textInput) textInput.style.display = isEdit ? "inline-flex" : "none";

        if (modeRead) modeRead.style.display = isRead ? "inline-flex" : "none";
        if (modeEdit) modeEdit.style.display = isEdit ? "inline-flex" : "none";

        if (isClosed) {
          if (btnHelp) btnHelp.style.display = "inline-flex";
          if (btnSave) btnSave.style.display = "none";
          if (btnEdit) btnEdit.style.display = "none";
          if (btnExit) btnExit.style.display = "none";
          if (btnApprove) btnApprove.style.display = "none";
          if (btnDelete) btnDelete.style.display = "none";
          return;
        }

        if (btnHelp) btnHelp.style.display = "inline-flex";

        if (btnSave) {
          btnSave.style.display = userCanEdit && isEdit ? "inline-flex" : "none";
        }

        if (btnEdit) {
          btnEdit.style.display =
            userCanEdit && !isApproved && isRead && isComplete
              ? "inline-flex"
              : "none";
        }

        if (btnExit) {
          btnExit.style.display =
            userCanEdit && isEdit && isComplete
              ? "inline-flex"
              : "none";
        }

        if (btnApprove) {
          btnApprove.style.display =
            !isApproved &&
            userIsDiamondAceHolder &&
            isRead &&
            isComplete
              ? "inline-flex"
              : "none";
        }

        if (btnDelete) {
          btnDelete.style.display = !isApproved ? "inline-flex" : "none";
        }

        if (isEdit) {
          if (textInput && !getCurrentText()) {
            textInput.focus();
          } else if (amountInput) {
            amountInput.focus();
            amountInput.select();
          }
        }
      }

      btnSave?.addEventListener("click", () => {
        const nextText = getCurrentText();
        const nextAmount = getCurrentAmount();

        dispatch("tablero:save-play", {
          playId,
          text: nextText,
          amount: nextAmount
        });

        savedTextValue = nextText;
        savedAmountValue = nextAmount;

        if (textView) {
          textView.textContent = savedTextValue || "Sin concepto";
        }

        if (amountView) {
          amountView.textContent = savedAmountValue || "—";
        }

        setVisualMode("read");
        renderMode();
      });

      btnEdit?.addEventListener("click", () => {
        if (!userCanEdit || isApproved || isClosed) return;
        if (textInput) textInput.value = savedTextValue || "";
        if (amountInput) amountInput.value = savedAmountValue || "";
        setVisualMode("edit");
        renderMode();
      });

      btnExit?.addEventListener("click", () => {
        if (textInput) textInput.value = savedTextValue || "";
        if (amountInput) amountInput.value = savedAmountValue || "";
        setVisualMode("read");
        renderMode();
      });

      btnApprove?.addEventListener("click", () => {
        dispatch("tablero:approve-play", {
          playId
        });
      });

      btnDelete?.addEventListener("click", () => {
        const confirmed = window.confirm("¿Seguro que querés borrar esta jugada?");
        if (!confirmed) return;

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

      textInput?.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          btnSave?.click();
        }

        if (event.key === "Escape") {
          event.preventDefault();
          btnExit?.click();
        }
      });

      amountInput?.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          btnSave?.click();
        }

        if (event.key === "Escape") {
          event.preventDefault();
          btnExit?.click();
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
          <div class="tablero-row__main-line">
            <span
              class="tablero-row__title-inline"
              data-role="text-view"
            >${escapeHtml(savedTextValue || "Sin concepto")}</span>

            <input
              type="text"
              value="${escapeHtml(savedTextValue)}"
              data-role="text-input"
              class="tablero-row__inline-input tablero-row__inline-input--jtrebol"
              placeholder="Concepto de factura"
              style="display:none;"
            />

            <span class="tablero-row__amount-card">J♦</span>

            ${currencySymbol ? `
              <span class="tablero-row__currency-symbol">
                ${escapeHtml(currencySymbol)}
              </span>
            ` : ""}

            <span class="tablero-row__mode-read" data-role="mode-read">
              <span class="tablero-row__amount-view" data-role="amount-view">
                ${escapeHtml(savedAmountValue || "—")}
              </span>
            </span>

            <span class="tablero-row__mode-edit" data-role="mode-edit" style="display:none;">
              <input
                type="number"
                step="0.01"
                min="0"
                value="${escapeHtml(savedAmountValue)}"
                data-role="amount-input"
                class="tablero-row__amount-input"
                placeholder="Monto"
              />
            </span>
          </div>
        </div>

        <div class="tablero-row__right">
          <button type="button" data-action="help-play" title="Help">
            ${helpIcon ? `<img src="${helpIcon}" alt="Help" />` : `<span>?</span>`}
          </button>

          <button type="button" data-action="save-play" title="Salvar" style="display:none;">
            ${saveIcon ? `<img src="${saveIcon}" alt="Salvar" />` : `<span>S</span>`}
          </button>

          <button type="button" data-action="edit-play" title="Editar" style="display:none;">
            ${editIcon ? `<img src="${editIcon}" alt="Editar" />` : `<span>E</span>`}
          </button>

          <button type="button" data-action="exit-edit" title="Salir edición" style="display:none;">
            ${exitIcon ? `<img src="${exitIcon}" alt="Salir edición" />` : `<span>↩</span>`}
          </button>

          <button type="button" data-action="approve-play" title="Aprobar" style="display:none;">
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
