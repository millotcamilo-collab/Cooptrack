(function () {
  function renderJcorazon(play, context = {}) {
    const helpers = context.helpers || {};
    const escapeHtml = helpers.escapeHtml || ((v) => String(v ?? ""));
    const dispatch =
      typeof context.dispatch === "function"
        ? context.dispatch
        : function (eventName, detail) {
          document.dispatchEvent(new CustomEvent(eventName, { detail }));
        };

    const ICONS = window.ICONS || {};
    const SUITS = ICONS.suits || {};
    const ACTIONS = ICONS.actions || {};

    const sendIcon = escapeHtml(ACTIONS.send || "/assets/icons/buzon60.gif");

    const state = context.state || {};
    const allPlays = Array.isArray(state.plays) ? state.plays : [];
    const currentUserId = Number(state.userId || 0);

    const playId = play?.id;
    const originalText = String(play?.play_text || "");
    const safeText = escapeHtml(originalText);
    const statusRaw = String(play?.play_status || play?.status || "ACTIVE").toUpperCase();
    const creatorUserId = Number(play?.created_by_user_id || 0);

    const rowId = `tablero-row-${playId}`;
    const inputId = `jcorazon-input-${playId}`;

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

    function normalizeReaders(value) {
      if (!Array.isArray(value)) return [];
      return value
        .map((item) => String(item || "").trim())
        .filter(Boolean);
    }

    function isPrivateForCurrentUser(readers, userId) {
      if (!userId || readers.length !== 1) return false;
      return readers[0] === `U:${userId}`;
    }

    function hasMultipleReaders(readers) {
      return readers.length > 1 || readers.includes("TODOS");
    }

    function formatReadersLabel(readers) {
      if (!Array.isArray(readers) || readers.length === 0) {
        return "Sin lectores";
      }

      if (readers.includes("TODOS")) {
        return "TODOS";
      }

      return readers.join(", ");
    }

    function resolveHeartAceHolderUserId(plays) {
      const aceHeartPlays = plays
        .filter((p) => {
          const rank = normalizeRank(p?.rank || p?.card_rank);
          const suit = normalizeSuit(p?.suit || p?.card_suit);
          return rank === "A" && suit === "HEART" && isAliveStatus(p?.play_status);
        })
        .sort((a, b) => Number(b?.id || 0) - Number(a?.id || 0));

      if (!aceHeartPlays.length) return null;

      const latest = aceHeartPlays[0];

      if (latest?.target_user_id) return Number(latest.target_user_id);
      if (latest?.created_by_user_id) return Number(latest.created_by_user_id);

      return null;
    }

    const heartAceHolderUserId = resolveHeartAceHolderUserId(allPlays);
    const userIsHeartAceHolder =
      heartAceHolderUserId !== null &&
      currentUserId !== 0 &&
      heartAceHolderUserId === currentUserId;

    const userIsCreator =
      creatorUserId !== 0 &&
      currentUserId !== 0 &&
      creatorUserId === currentUserId;

    const userCanEdit = userIsCreator || userIsHeartAceHolder;
    const isApproved = statusRaw === "APPROVED";
    const isCancelled = statusRaw === "CANCELLED";

    const readers = normalizeReaders(play?.reader_user_ids);
    const showPrivedButton = isPrivateForCurrentUser(readers, currentUserId);
    const showReadersButton = hasMultipleReaders(readers);

    const spadeIcon = escapeHtml(SUITS.SPADE || "");
    const clubIcon = escapeHtml(SUITS.CLUB || "");
    const helpIcon = escapeHtml(ACTIONS.help || "");
    const editIcon = escapeHtml(ACTIONS.edit || "");
    const saveIcon = escapeHtml(ACTIONS.save || "");
    const approveIcon = escapeHtml(ACTIONS.approve || "");
    const deleteIcon = escapeHtml(ACTIONS.delete || "");
    const cancelIcon = escapeHtml(ACTIONS.cancel || "");
    const exitIcon = escapeHtml(ACTIONS.exit || ACTIONS.cancel || "");
    const privedIcon = escapeHtml(ACTIONS.prived || "");
    const readersIcon = escapeHtml(ACTIONS.readers || "");

    setTimeout(() => {
      const row = document.getElementById(rowId);
      if (!row || row.dataset.bound === "true") return;

      row.dataset.bound = "true";
      row.dataset.mode = "read";

      const textView = row.querySelector('[data-role="text-view"]');
      const textInput = row.querySelector('[data-role="text-input"]');
      const btnHelp = row.querySelector('[data-action="show-help"]');
      const btnEdit = row.querySelector('[data-action="edit-play"]');
      const btnSave = row.querySelector('[data-action="save-play"]');
      const btnApprove = row.querySelector('[data-action="approve-play"]');
      const btnDelete = row.querySelector('[data-action="delete-play"]');
      const btnCancel = row.querySelector('[data-action="cancel-play"]');
      const btnExit = row.querySelector('[data-action="exit-edit"]');
      const btnPrived = row.querySelector('[data-action="open-private-readers"]');
      const btnReaders = row.querySelector('[data-action="show-readers"]');
      const btnSend = row.querySelector('[data-action="send-play"]');

      function getCurrentText() {
        return String(textInput?.value || "").trim();
      }

      function setMode(mode) {
        row.dataset.mode = mode === "edit" ? "edit" : "read";
      }

      function showButton(button) {
        if (!button) return;
        button.style.display = "inline-flex";
      }

      function hideButton(button) {
        if (!button) return;
        button.style.display = "none";
      }

      function renderMode() {
        const isEditMode = row.dataset.mode === "edit";

        if (!isApproved && !isEditMode && userCanEdit && !userIsHeartAceHolder) {
          showButton(btnSend);
        } else {
          hideButton(btnSend);
        }

        if (textView) textView.style.display = isEditMode ? "none" : "";
        if (textInput) textInput.style.display = isEditMode ? "block" : "none";

        if (isCancelled) {
          hideButton(btnHelp);
          hideButton(btnEdit);
          hideButton(btnSave);
          hideButton(btnApprove);
          hideButton(btnDelete);
          hideButton(btnCancel);
          hideButton(btnExit);
          hideButton(btnPrived);
          hideButton(btnReaders);
          hideButton(btnSend);

          if (textView) textView.style.display = "";
          if (textInput) textInput.style.display = "none";
          return;
        }

        if (!userCanEdit) {
          hideButton(btnEdit);
          hideButton(btnSave);
          hideButton(btnApprove);
          hideButton(btnDelete);
          hideButton(btnCancel);
          hideButton(btnExit);
          hideButton(btnPrived);
          hideButton(btnReaders);

          showButton(btnHelp);

          if (textView) textView.style.display = "";
          if (textInput) textInput.style.display = "none";
          return;
        }


        showButton(btnHelp);

        if (!isApproved && !isEditMode && userCanEdit) {
          showButton(btnEdit);
        } else {
          hideButton(btnEdit);
        }

        if (isEditMode) {
          showButton(btnSave);
          showButton(btnExit);
        } else {
          hideButton(btnSave);
          hideButton(btnExit);
        }

        if (!isApproved && !isEditMode && userIsHeartAceHolder) {
          showButton(btnApprove);
        } else {
          hideButton(btnApprove);
        }

        if (!isApproved) {
          showButton(btnDelete);
        } else {
          hideButton(btnDelete);
        }

        if (isApproved && userIsHeartAceHolder) {
          showButton(btnCancel);
        } else {
          hideButton(btnCancel);
        }

        if (!isEditMode && showPrivedButton) {
          showButton(btnPrived);
        } else {
          hideButton(btnPrived);
        }

        if (!isEditMode && showReadersButton) {
          showButton(btnReaders);
        } else {
          hideButton(btnReaders);
        }

        if (isEditMode && textInput) {
          textInput.focus();
          textInput.select();
        }
      }

      btnHelp?.addEventListener("click", () => {
        if (typeof window.openPlayHelp === "function") {
          window.openPlayHelp("J_HEART");
        } else {
          console.warn("openPlayHelp no está disponible");
        }
      });

      btnEdit?.addEventListener("click", () => {
        setMode("edit");
        renderMode();
      });

      btnSave?.addEventListener("click", () => {
        dispatch("tablero:save-play", {
          playId,
          text: getCurrentText()
        });
      });

      btnSend?.addEventListener("click", () => {
        const deckId =
          context?.deck?.id ||
          context?.state?.deck?.id ||
          play?.deck_id ||
          window.__currentDeck?.id ||
          null;

        if (!deckId || !playId) {
          alert("No se pudo abrir el lienzo J♥");
          return;
        }

        window.location.href = `/lienzoJcorazon.html?deckId=${deckId}&playId=${playId}`;
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

      btnCancel?.addEventListener("click", () => {
        dispatch("tablero:cancel-play", {
          playId
        });
      });

      btnExit?.addEventListener("click", () => {
        if (textInput) {
          textInput.value = originalText;
        }
        setMode("read");
        renderMode();
      });

      btnPrived?.addEventListener("click", () => {
        dispatch("tablero:open-readers", {
          playId
        });
      });

      btnReaders?.addEventListener("click", () => {
        window.alert(`Pueden leer esta jugada:\n\n${formatReadersLabel(readers)}`);
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

      renderMode();
    }, 0);

    return `
      <article class="tablero-row tablero-row--jcorazon" id="${rowId}">
        <div class="tablero-row__left">
          <div class="tablero-row__card">J♥</div>
        </div>

        <div class="tablero-row__center">
          <div class="tablero-row__title" data-role="text-view">${safeText || "Sin texto"}</div>

          <input
            id="${inputId}"
            type="text"
            class="tablero-row__inline-input"
            data-role="text-input"
            value="${safeText}"
            style="display:none;"
          />

          <div class="tablero-row__meta">
            <span>Estado: ${escapeHtml(statusRaw)}</span>
          </div>
        </div>

        <div class="tablero-row__right">

          <button type="button" data-action="open-private-readers" title="Abrir lectura" style="display:none;">
            <img src="${privedIcon}" alt="Privado" />
          </button>

<button type="button" data-action="send-play" title="Enviar a A♥" style="display:none;">
  <img src="${sendIcon}" alt="Enviar" />
</button>

          <button type="button" data-action="show-readers" title="Lectores" style="display:none;">
            <img src="${readersIcon}" alt="Lectores" />
          </button>

          <button type="button" data-action="edit-play" title="Editar">
            <img src="${editIcon}" alt="Editar" />
          </button>

          <button type="button" data-action="save-play" title="Salvar" style="display:none;">
            <img src="${saveIcon}" alt="Salvar" />
          </button>

          <button type="button" data-action="exit-edit" title="Salir edición" style="display:none;">
            <img src="${exitIcon}" alt="Salir edición" />
          </button>

          <button type="button" data-action="approve-play" title="Aprobar">
            <img src="${approveIcon}" alt="Aprobar" />
          </button>

          <button type="button" data-action="cancel-play" title="Cancelar">
            <img src="${cancelIcon}" alt="Cancelar" />
          </button>

          <button type="button" data-action="delete-play" title="Borrar">
            <img src="${deleteIcon}" alt="Borrar" />
          </button>

          <button type="button" data-action="show-help" title="Ayuda">
            <img src="${helpIcon}" alt="Ayuda" />
          </button>
        </div>
      </article>
    `;
  }

  window.renderJcorazon = renderJcorazon;
})();
