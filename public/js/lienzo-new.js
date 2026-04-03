(function () {
  function normalizeRank(value) {
    return String(value || "").trim().toUpperCase();
  }
function renderAssignedTargetPanel(user) {
  const container = document.getElementById("lienzo-users-picker");
  if (!container) return;

  const photo =
    user?.profile_photo_url || "/assets/icons/singeta120.gif";

  const name =
    user?.nickname ||
    user?.full_name ||
    user?.name ||
    `Usuario ${user?.id || ""}`;

  container.innerHTML = `
    <section class="lienzo-panel lienzo-panel--target">
      
      <div class="lienzo-target-header">
        <img
          class="lienzo-target-header__photo"
          src="${photo}"
          alt="${name}"
        />
        <div class="lienzo-target-header__name">
          ${name}
        </div>
      </div>

      <div id="lienzo-target-dropzone" class="lienzo-target-dropzone">
        <!-- acá aterriza la carta -->
      </div>

      <div class="lienzo-target-actions">
        <button id="lienzo-save-btn" class="lienzo-btn">
          Salvar
        </button>

        <button id="lienzo-exit-btn" class="lienzo-btn">
          Exit
        </button>
      </div>
    </section>
  `;

  bindTargetActions();
}

  function bindTargetActions() {
  const saveBtn = document.getElementById("lienzo-save-btn");
  const exitBtn = document.getElementById("lienzo-exit-btn");

  if (saveBtn) {
    saveBtn.addEventListener("click", () => {
      console.log("SALVAR jugada", window.__lienzoNewDraft);
      // después conectamos POST /plays
    });
  }

  if (exitBtn) {
    exitBtn.addEventListener("click", () => {
      const params = new URLSearchParams(window.location.search);
      const deckId = params.get("deckId") || params.get("id");

      if (deckId) {
        window.location.href = `/mazo.html?id=${deckId}`;
      } else {
        window.location.href = "/mazos.html";
      }
    });
  }
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

    return (
      state?.deck ||
      state?.mazo ||
      window.__currentDeck ||
      {}
    );
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
  console.log("deck completo =", deck);
  console.log("posibles campos imagen =", {
    deck_image_url: deck?.deck_image_url,
    image_url: deck?.image_url,
    photo_url: deck?.photo_url,
    avatar: deck?.avatar
  });

  const raw =
    deck?.deck_image_url ||
    deck?.image_url ||
    deck?.photo_url ||
    deck?.avatar ||
    "";

  return String(raw).trim() || "/assets/icons/sinPicture.gif";
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

  function getLienzoNewParams() {
    const params = new URLSearchParams(window.location.search);

    return {
      deckId: Number(params.get("deckId") || 0),
      parentPlayId: Number(params.get("parentPlayId") || 0),
      childRank: normalizeRank(params.get("childRank")),
      childSuit: normalizeSuit(params.get("childSuit"))
    };
  }

  function buildDraftFromParams() {
    const { deckId, parentPlayId, childRank, childSuit } = getLienzoNewParams();
    const parentPlay = getPlayById(parentPlayId);
    const deck = getCurrentDeck();

    return {
      mode: "new",
      deckId: deckId || Number(deck?.id || 0),
      parentPlayId,
      parentPlay,
      card_rank: childRank,
      card_suit: childSuit,
      target_user_id: null,
      play_text: "",
      status: "DRAFT"
    };
  }

  function renderDeckHeader(deck) {
    console.log("renderDeckHeader deck =", deck);
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

          </div>
        </div>

      </section>
    `;
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

  function renderUsersPanel() {
    return `
      <section class="lienzo-panel lienzo-panel--users">
        <div class="lienzo-panel__header">
          <div class="lienzo-panel__subtitle">Seleccioná un destinatario</div>
        </div>

        <div id="lienzo-users-picker" class="lienzo-users-picker"></div>


        <div class="lienzo-actions">
          <button
            type="button"
            id="lienzo-new-save-btn"
            class="lienzo-actions__btn"
          >
            Crear jugada
          </button>
        </div>
      </section>
    `;
  }

  function renderDraftCardPanel(draft) {
    const rank = normalizeRank(draft?.card_rank);
    const suit = normalizeSuit(draft?.card_suit);
    const symbol = getSuitSymbol(suit);
    const imageSrc = getCardImageSrc(rank, suit);

    return `
      <section class="lienzo-panel lienzo-panel--card">

        <div class="lienzo-card-wrap">
          <img
            class="lienzo-card-image"
            src="${escapeHtml(imageSrc)}"
            alt="Carta ${escapeHtml(rank)}${escapeHtml(symbol)}"
          />
        </div>
      </section>
    `;
  }

  function bindUsersPicker(draft) {
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
    // 🟢 Selección normal (click en fila)
    onSelect(user) {
      window.__lienzoNewDraft = {
        ...window.__lienzoNewDraft,
        target_user_id: Number(user?.id || 0) || null,
        target_user: user || null
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
    },

    // 🔥 NUEVO: click en la claqueta
    onAnimateSelect(user) {
      // 1. también selecciona (para mantener coherencia)
      window.__lienzoNewDraft = {
        ...window.__lienzoNewDraft,
        target_user_id: Number(user?.id || 0) || null,
        target_user: user || null
      };

      if (selectedBox && user) {
        selectedBox.textContent =
          "Seleccionado: " +
          (user.nickname ||
            user.full_name ||
            user.name ||
            `Usuario ${user.id}`);
      }

      // 2. dispara animación (la implementamos después)
      document.dispatchEvent(
        new CustomEvent("lienzo:animate-card-to-user", {
          detail: { user }
        })
      );
    }
  });
}

  function bindCreateButton() {
    const btn = document.getElementById("lienzo-new-save-btn");
    if (!btn) return;

    btn.addEventListener("click", () => {
      const draft = window.__lienzoNewDraft || null;

      if (!draft) {
        alert("No se pudo armar el borrador.");
        return;
      }

      if (!draft.parentPlayId) {
        alert("Falta la jugada madre.");
        return;
      }

      if (!draft.card_rank || !draft.card_suit) {
        alert("Falta la carta a crear.");
        return;
      }

      if (!draft.target_user_id) {
        alert("Seleccioná un destinatario.");
        return;
      }

      document.dispatchEvent(
        new CustomEvent("lienzo:new-play", {
          detail: {
            deckId: draft.deckId,
            parentPlayId: draft.parentPlayId,
            childRank: draft.card_rank,
            childSuit: draft.card_suit,
            targetUserId: draft.target_user_id
          }
        })
      );
    });
  }

  function renderNewLienzo() {
    const container = getLienzoContainer();
    const deck = getCurrentDeck();
    const draft = buildDraftFromParams();

    if (!container) return;

    if (!draft.parentPlayId) {
      container.innerHTML = `
        <div class="lienzo-error">
          Falta parentPlayId en la URL.
        </div>
      `;
      return;
    }

    if (!draft.card_rank || !draft.card_suit) {
      container.innerHTML = `
        <div class="lienzo-error">
          Faltan childRank o childSuit en la URL.
        </div>
      `;
      return;
    }

    if (!draft.parentPlay) {
      container.innerHTML = `
        <div class="lienzo-error">
          No se encontró la jugada madre ${escapeHtml(draft.parentPlayId)}.
        </div>
      `;
      return;
    }

    window.__lienzoNewDraft = draft;

    container.innerHTML = `
      ${renderDeckHeader(deck)}

      <div class="lienzo-grid">
        <div class="lienzo-grid__left">
          ${renderDraftCardPanel(draft)}
        </div>

        <div class="lienzo-grid__right">
          ${renderUsersPanel()}
        </div>
      </div>
    `;

    bindUsersPicker(draft);
    bindCreateButton();
  }

  window.openNewLienzo = renderNewLienzo;
})();
