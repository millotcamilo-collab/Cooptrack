(function () {
  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
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

  function getAllPlays() {
    const state = getCurrentState();
    return Array.isArray(state.plays) ? state.plays : [];
  }

  function getCurrentUserId() {
    const state = getCurrentState();
    return Number(state.userId || 0);
  }

  function getPlayById(playId, plays = []) {
    const id = Number(playId || 0);
    if (!id) return null;

    return plays.find((p) => Number(p?.id || 0) === id) || null;
  }

  function resolveAncestors(play, plays = []) {
    const ancestors = [];
    const seen = new Set();

    let current = play;

    while (current?.parent_play_id) {
      const parentId = Number(current.parent_play_id || 0);
      if (!parentId || seen.has(parentId)) break;

      const parent = getPlayById(parentId, plays);
      if (!parent) break;

      ancestors.push(parent);
      seen.add(parentId);
      current = parent;

      if (ancestors.length >= 2) break;
    }

    return ancestors.reverse();
  }

  function getCardImageSrc(rank, suit) {
    const r = normalizeRank(rank);
    const s = normalizeSuit(suit);

    const map = {
      A_HEART: "/assets/icons/Acorazon.gif",
      A_SPADE: "/assets/icons/Apike.gif",
      A_DIAMOND: "/assets/icons/Adiamante.gif",
      A_CLUB: "/assets/icons/Atrebol.gif",

      K_HEART: "/assets/icons/Kcorazon.gif",
      K_SPADE: "/assets/icons/Kpike.gif",
      K_DIAMOND: "/assets/icons/Kdiamante.gif",
      K_CLUB: "/assets/icons/Ktrebol.gif",

      Q_HEART: "/assets/icons/Qcorazon.gif",
      Q_SPADE: "/assets/icons/Qpike.gif",
      Q_DIAMOND: "/assets/icons/Qdiamante.gif",
      Q_CLUB: "/assets/icons/Qtrebol.gif",

      J_HEART: "/assets/icons/Jcorazon.gif",
      J_SPADE: "/assets/icons/Jpike.gif",
      J_DIAMOND: "/assets/icons/Jdiamante.gif",
      J_CLUB: "/assets/icons/Jtrebol.gif"
    };

    return map[`${r}_${s}`] || "/assets/icons/Dorso70.gif";
  }

  function getOrCreateLienzoContainer() {
    let container = document.getElementById("lienzo-container");

    if (container) return container;

    container = document.createElement("div");
    container.id = "lienzo-container";
    container.className = "lienzo-container";

    const host =
      document.getElementById("plays-view-container") ||
      document.getElementById("tablero-container") ||
      document.body;

    host.appendChild(container);

    return container;
  }

  function clearLienzo() {
    const container = document.getElementById("lienzo-container");
    if (container) {
      container.innerHTML = "";
      container.style.display = "none";
    }

    window.__lienzoOpen = null;
  }

  function renderAncestorRow(play) {
    if (!play) return "";

    const rank = normalizeRank(play?.card_rank || play?.rank);
    const suit = normalizeSuit(play?.card_suit || play?.suit);
    const text = escapeHtml(play?.play_text || "");
    const title = `${rank}${getSuitSymbol(suit)}`;

    return `
      <div class="lienzo__ancestor-row">
        <div class="lienzo__ancestor-card">${escapeHtml(title)}</div>
        <div class="lienzo__ancestor-text">${text || "Sin texto"}</div>
      </div>
    `;
  }

  function getSuitSymbol(suit) {
    const s = normalizeSuit(suit);

    if (s === "HEART") return "♥";
    if (s === "SPADE") return "♠";
    if (s === "DIAMOND") return "♦";
    if (s === "CLUB") return "♣";

    return "";
  }

  function resolveClubAceHolderUserId(plays) {
    const aceClubPlays = plays
      .filter((p) => {
        const rank = normalizeRank(p?.rank || p?.card_rank);
        const suit = normalizeSuit(p?.suit || p?.card_suit);
        const status = String(p?.play_status || "").toUpperCase();

        return rank === "A" && suit === "CLUB" && status !== "CANCELLED";
      })
      .sort((a, b) => Number(b?.id || 0) - Number(a?.id || 0));

    if (!aceClubPlays.length) return null;

    const latest = aceClubPlays[0];

    if (latest?.target_user_id) return Number(latest.target_user_id);
    if (latest?.created_by_user_id) return Number(latest.created_by_user_id);

    return null;
  }

  function renderQSpadeBody(play, context = {}) {
    const plays = context.plays || [];
    const currentUserId = Number(context.currentUserId || 0);

    const clubAceHolderUserId = resolveClubAceHolderUserId(plays);

    const userCanSend =
      clubAceHolderUserId !== null &&
      currentUserId !== 0 &&
      clubAceHolderUserId === currentUserId;

    const parentPlayId = Number(play?.parent_play_id || 0);

    return `
      <div class="lienzo__body-content">
        <div class="lienzo__picker-title">Seleccionar invitado</div>
        <div id="lienzo-users-picker"></div>

        <div class="lienzo__selected" id="lienzo-selected-user">
          Nadie seleccionado
        </div>

        <div class="lienzo__actions">
          <button
            type="button"
            id="lienzo-save"
            title="Guardar"
            style="display:none;"
          >
            Save
          </button>

          <button
            type="button"
            id="lienzo-send"
            title="Enviar"
            style="display:none;"
            data-can-send="${userCanSend ? "1" : "0"}"
            data-parent-play-id="${escapeHtml(parentPlayId)}"
          >
            Send
          </button>

          <button
            type="button"
            id="lienzo-cancel"
            title="Cancelar"
          >
            Cancelar
          </button>
        </div>
      </div>
    `;
  }

  function renderDefaultBody(play) {
    const text = escapeHtml(play?.play_text || "");

    return `
      <div class="lienzo__body-content">
        <div class="lienzo__placeholder-title">Vista ampliada</div>
        <div class="lienzo__placeholder-text">${text || "Sin contenido adicional"}</div>

        <div class="lienzo__actions">
          <button type="button" id="lienzo-cancel" title="Cerrar">
            Cerrar
          </button>
        </div>
      </div>
    `;
  }

  function renderLienzoBody(play, context = {}) {
    const rank = normalizeRank(play?.card_rank || play?.rank);
    const suit = normalizeSuit(play?.card_suit || play?.suit);

    if (rank === "Q" && suit === "SPADE") {
      return renderQSpadeBody(play, context);
    }

    return renderDefaultBody(play, context);
  }

  function renderLienzo(play) {
    if (!play) return;

    const plays = getAllPlays();
    const currentUserId = getCurrentUserId();
    const ancestors = resolveAncestors(play, plays);
    const cardImageSrc = getCardImageSrc(
      play?.card_rank || play?.rank,
      play?.card_suit || play?.suit
    );

    const container = getOrCreateLienzoContainer();

    container.style.display = "";
    container.innerHTML = `
      <section class="lienzo" data-play-id="${escapeHtml(play?.id)}">
        <div class="lienzo__topbar">
          <div class="lienzo__title">
            ${escapeHtml(normalizeRank(play?.card_rank || play?.rank))}${escapeHtml(getSuitSymbol(play?.card_suit || play?.suit))}
          </div>

          <button type="button" id="lienzo-close-top" class="lienzo__close-btn">
            Cerrar
          </button>
        </div>

        ${
          ancestors.length
            ? `
              <div class="lienzo__ancestors">
                ${ancestors.map(renderAncestorRow).join("")}
              </div>
            `
            : ""
        }

        <div class="lienzo__main">
          <div class="lienzo__left">
            <img
              class="lienzo__card-image"
              src="${escapeHtml(cardImageSrc)}"
              alt="Carta ampliada"
            />
          </div>

          <div class="lienzo__right">
            ${renderLienzoBody(play, { plays, currentUserId })}
          </div>
        </div>
      </section>
    `;

    bindLienzo(play, { plays, currentUserId });
    window.__lienzoOpen = {
      playId: Number(play?.id || 0)
    };
  }

  function bindLienzo(play, context = {}) {
    const plays = context.plays || [];
    const currentUserId = Number(context.currentUserId || 0);

    const btnCloseTop = document.getElementById("lienzo-close-top");
    const btnCancel = document.getElementById("lienzo-cancel");
    const btnSave = document.getElementById("lienzo-save");
    const btnSend = document.getElementById("lienzo-send");

    btnCloseTop?.addEventListener("click", () => {
      clearLienzo();
    });

    btnCancel?.addEventListener("click", () => {
      clearLienzo();
    });

    const rank = normalizeRank(play?.card_rank || play?.rank);
    const suit = normalizeSuit(play?.card_suit || play?.suit);

    if (rank === "Q" && suit === "SPADE") {
      bindQSpadeBody(play, { plays, currentUserId, btnSave, btnSend });
    }
  }

  function bindQSpadeBody(play, context = {}) {
    const plays = context.plays || [];
    const currentUserId = Number(context.currentUserId || 0);
    const btnSave = context.btnSave;
    const btnSend = context.btnSend;

    const selectedBox = document.getElementById("lienzo-selected-user");
    const pickerId = "lienzo-users-picker";

    const clubAceHolderUserId = resolveClubAceHolderUserId(plays);
    const userCanSend =
      clubAceHolderUserId !== null &&
      currentUserId !== 0 &&
      clubAceHolderUserId === currentUserId;

    let selectedUser = null;

    if (typeof window.renderUsersPicker === "function") {
      window.renderUsersPicker(pickerId, {
        onSelect(user) {
          selectedUser = user || null;

          window.__lienzoDraft = {
            playId: Number(play?.id || 0),
            parentPlayId: Number(play?.parent_play_id || 0),
            selectedUser
          };

          if (selectedBox) {
            selectedBox.textContent = selectedUser
              ? `Seleccionado: ${selectedUser.nickname || selectedUser.full_name || selectedUser.name || `Usuario ${selectedUser.id}`}`
              : "Nadie seleccionado";
          }

          if (selectedUser) {
            if (btnSave) btnSave.style.display = "inline-flex";
            if (btnSend) btnSend.style.display = userCanSend ? "inline-flex" : "none";
          }
        }
      });
    } else {
      const picker = document.getElementById(pickerId);
      if (picker) {
        picker.innerHTML = `
          <div class="lienzo__error">
            No se pudo cargar users.js
          </div>
        `;
      }
    }

    btnSave?.addEventListener("click", () => {
      if (!selectedUser) {
        alert("Primero seleccioná un usuario.");
        return;
      }

      window.__lienzoDraft = {
        playId: Number(play?.id || 0),
        parentPlayId: Number(play?.parent_play_id || 0),
        selectedUser
      };

      console.log("Lienzo Q♠ draft salvado:", window.__lienzoDraft);
      alert("Selección salvada.");
    });

    btnSend?.addEventListener("click", () => {
      if (!selectedUser) {
        alert("Primero seleccioná un usuario.");
        return;
      }

      document.dispatchEvent(
        new CustomEvent("plays:add-qspade-requested", {
          detail: {
            parentPlayId: Number(play?.parent_play_id || 0),
            targetUserId: selectedUser.id
          }
        })
      );
    });
  }

  function openLienzoByPlayId(playId) {
    const plays = getAllPlays();
    const play = getPlayById(playId, plays);

    if (!play) {
      console.warn("No se encontró la jugada para abrir lienzo:", playId);
      return;
    }

    renderLienzo(play);
  }

  document.addEventListener("lienzo:open", (event) => {
    const playId = Number(event.detail?.playId || 0);
    if (!playId) return;

    openLienzoByPlayId(playId);
  });

  document.addEventListener("lienzo:close", () => {
    clearLienzo();
  });

  window.openLienzoByPlayId = openLienzoByPlayId;
  window.clearLienzo = clearLienzo;
})();
