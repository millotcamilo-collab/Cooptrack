(function () {
  function normalizeRank(value) {
    return String(value || "").trim().toUpperCase();
  }
  
function bindDeckHeaderExit() {
  const btn = document.getElementById("lienzo-exit-btn");
  if (!btn) return;

  const deck = getCurrentDeck();
  const deckId = Number(deck?.id || getCurrentState()?.deckId || 0);

  btn.addEventListener("click", () => {
    if (deckId) {
      window.location.href = `/mazo.html?id=${deckId}`;
      return;
    }

    window.history.back();
  });
}
  function normalizeSuit(value) {
    return String(value || "").trim().toUpperCase();
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function getCurrentState() {
    return window.__currentState || {};
  }

  function getAllPlays() {
    const state = getCurrentState();
    return Array.isArray(state.plays) ? state.plays : [];
  }

  function getCurrentDeck() {
    const state = getCurrentState();
    return state.deck || window.__currentDeck || {};
  }

  function getPlayById(playId) {
    const id = Number(playId || 0);
    if (!id) return null;

    return getAllPlays().find((play) => Number(play?.id || 0) === id) || null;
  }

  function getSuitSymbol(suit) {
    const s = normalizeSuit(suit);

    if (s === "HEART") return "♥";
    if (s === "SPADE") return "♠";
    if (s === "DIAMOND") return "♦";
    if (s === "CLUB") return "♣";

    return "";
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

  function getDeckAvatarSrc(deck) {
    const raw = String(deck?.deck_image_url || "").trim();
    return raw || "/assets/icons/sinPicture.gif";
  }

  function getCurrencyCode(deck) {
    return String(deck?.currency_symbol || "").trim().toUpperCase();
  }

  function getBalanceValue(deck) {
    const value = deck?.viewer_balance;

    if (value === null || value === undefined || value === "") {
      return "0";
    }

    return String(value);
  }

  function getLienzoContainer() {
    return document.getElementById("lienzo-container");
  }

 function renderDeckHeader(deck) {
  const avatarSrc = getDeckAvatarSrc(deck);
  const deckName = deck?.name || "Mazo";
  const currencyCode = getCurrencyCode(deck);
  const balance = getBalanceValue(deck);

  return `
    <section class="lienzo-deckbar">
      <div class="lienzo-deckbar__left">
        <div class="lienzo-deckbar__avatar-wrap">
          <img
            src="${escapeHtml(avatarSrc)}"
            alt="Foto del mazo"
            class="lienzo-deckbar__avatar"
            onerror="this.onerror=null;this.src='/assets/icons/sinPicture.gif';"
          />
        </div>

        <div class="lienzo-deckbar__titleline">
          <span class="lienzo-deckbar__rank">A</span>

          <img
            src="/assets/icons/cor40.gif"
            alt="♥"
            class="lienzo-deckbar__suit"
          />

          <span class="lienzo-deckbar__name">
            ${escapeHtml(deckName)}
          </span>

          <img
            src="/assets/icons/dia40.gif"
            alt="♦"
            class="lienzo-deckbar__balance-icon"
          />

          <span class="lienzo-deckbar__currency">
            ${escapeHtml(currencyCode)}
          </span>

          <span class="lienzo-deckbar__balance">
            ${escapeHtml(balance)}
          </span>
        </div>
      </div>

      <div class="lienzo-deckbar__right">
        <button
          type="button"
          id="lienzo-exit-btn"
          class="lienzo-deckbar__exit-btn"
          title="Volver al mazo"
          aria-label="Volver al mazo"
        >
          <img
            src="/assets/icons/exit80.gif"
            alt="Salir"
            class="lienzo-deckbar__exit-icon"
          />
        </button>
      </div>
    </section>
  `;
}
  function renderUsersPanel() {
    return `
      <section class="lienzo-panel lienzo-panel--users">
        <div class="lienzo-panel__header">
          <div class="lienzo-panel__title">Usuarios</div>
          <div class="lienzo-panel__subtitle">Seleccioná un destinatario</div>
        </div>

        <div id="lienzo-users-picker" class="lienzo-users-picker"></div>

        <div id="lienzo-user-selected" class="lienzo-user-selected">
          Nadie seleccionado
        </div>
      </section>
    `;
  }

  function renderCardPanel(play) {
    const rank = normalizeRank(play?.card_rank || play?.rank);
    const suit = normalizeSuit(play?.card_suit || play?.suit);
    const symbol = getSuitSymbol(suit);
    const text = play?.play_text || "";
    const imageSrc = getCardImageSrc(rank, suit);

    return `
      <section class="lienzo-panel lienzo-panel--card">
        <div class="lienzo-panel__header">
          <div class="lienzo-panel__title">${escapeHtml(rank)}${escapeHtml(symbol)}</div>
          <div class="lienzo-panel__subtitle">Jugada ${escapeHtml(play?.id || "")}</div>
        </div>

        <div class="lienzo-card-wrap">
          <img
            class="lienzo-card-image"
            src="${escapeHtml(imageSrc)}"
            alt="Carta ${escapeHtml(rank)}${escapeHtml(symbol)}"
          />
        </div>

        <div class="lienzo-card-text">
          ${escapeHtml(text) || "Sin texto"}
        </div>
      </section>
    `;
  }

  function bindUsersPicker(play) {
    const selectedBox = document.getElementById("lienzo-user-selected");

    if (typeof window.renderUsersPicker !== "function") {
      const picker = document.getElementById("lienzo-users-picker");
      if (picker) {
        picker.innerHTML = `
          <div class="lienzo-error">
            No se pudo cargar users.js
          </div>
        `;
      }
      return;
    }

    window.renderUsersPicker("lienzo-users-picker", {
      onSelect(user) {
        window.__lienzoSelection = {
          playId: Number(play?.id || 0),
          user: user || null
        };

        if (!selectedBox) return;

        if (!user) {
          selectedBox.textContent = "Nadie seleccionado";
          return;
        }

        selectedBox.textContent =
          "Seleccionado: " +
          (user.nickname ||
            user.full_name ||
            user.name ||
            `Usuario ${user.id}`);
      }
    });
  }

  function renderLienzo(play) {
    const container = getLienzoContainer();
    const deck = getCurrentDeck();

    if (!container || !play) return;

    container.innerHTML = `
      ${renderDeckHeader(deck)}

      <div class="lienzo-grid">
        <div class="lienzo-grid__left">
          ${renderCardPanel(play)}
        </div>

        <div class="lienzo-grid__right">
          ${renderUsersPanel()}
        </div>
      </div>
    `;

    bindUsersPicker(play);
    bindDeckHeaderExit();
  }

  function openLienzoByPlayId(playId) {
    const play = getPlayById(playId);

    if (!play) {
      const container = getLienzoContainer();
      if (container) {
        container.innerHTML = `
          <div class="lienzo-error">
            No se encontró la jugada ${escapeHtml(playId)}.
          </div>
        `;
      }
      return;
    }

    renderLienzo(play);
  }
  function getLienzoParams() {
    const params = new URLSearchParams(window.location.search);

    return {
      deckId: Number(params.get("deckId") || 0),
      parentPlayId: Number(params.get("parentPlayId") || 0),
      childRank: normalizeRank(params.get("childRank")),
      childSuit: normalizeSuit(params.get("childSuit"))
    };
  }

  function bootLienzoFromUrl() {
    const { parentPlayId } = getLienzoParams();

    if (!parentPlayId) return;

    openLienzoByPlayId(parentPlayId);
  }

  window.bootLienzoFromUrl = bootLienzoFromUrl;
  window.openLienzoByPlayId = openLienzoByPlayId;
  bootLienzoFromUrl();
})();
