(function () {
  const DEFAULT_DECK_IMAGE = "/assets/icons/singeta120.gif";

  const CARD_LABELS = {
    A_HEART: "A♥",
    A_SPADE: "A♠",
    A_DIAMOND: "A♦",
    A_CLUB: "A♣",
    K_HEART: "K♥",
    K_SPADE: "K♠",
    K_DIAMOND: "K♦",
    K_CLUB: "K♣",
    JOKER_RED: "🃏R",
    JOKER_BLUE: "🃏B"
  };

  function clearMazobar() {
    const container = document.getElementById("mazobar-container");
    if (container) container.innerHTML = "";
  }

  function normalizeArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function getDeckImage(deck) {
    return (
      deck?.profile_photo_url ||
      deck?.profilePhotoUrl ||
      deck?.image_url ||
      DEFAULT_DECK_IMAGE
    );
  }

  function getDeckTitle(deck) {
    return String(deck?.name || "Mazo sin nombre").trim();
  }

  function getCurrencyCode(deck) {
    return deck?.currency_code || deck?.currencyCode || "ARS";
  }

  function getViewerBalance(deck) {
    if (deck?.viewer_economic_status && typeof deck.viewer_economic_status.amount === "number") {
      return deck.viewer_economic_status.amount;
    }

    if (typeof deck?.viewer_balance === "number") {
      return deck.viewer_balance;
    }

    if (typeof deck?.personal_balance === "number") {
      return deck.personal_balance;
    }

    if (typeof deck?.balance === "number") {
      return deck.balance;
    }

    return 0;
  }

  function formatMoney(amount, currencyCode) {
    try {
      return new Intl.NumberFormat("es-AR", {
        style: "currency",
        currency: currencyCode,
        maximumFractionDigits: 0
      }).format(amount);
    } catch (error) {
      const sign = amount > 0 ? "+" : "";
      return `${currencyCode} ${sign}${amount}`;
    }
  }

  function getBalanceClass(amount) {
    if (amount > 0) return "mazobar__balance mazobar__balance--positive";
    if (amount < 0) return "mazobar__balance mazobar__balance--negative";
    return "mazobar__balance mazobar__balance--neutral";
  }

  function getViewerCorporateCards(deck) {
    const directCards = normalizeArray(
      deck?.viewer_corporate_cards ||
      deck?.currentUserCards ||
      deck?.viewerCards ||
      deck?.corporateCards
    );

    if (directCards.length > 0) {
      return directCards.filter((cardCode) => /^A_|^K_/.test(cardCode));
    }

    const governance = deck?.governance || {};
    const aces = normalizeArray(governance.aces);
    const kings = normalizeArray(governance.kings);
    const viewerUserId =
      deck?.viewer_user_id ||
      deck?.current_user_id ||
      deck?.viewerId ||
      null;

    if (!viewerUserId) return [];

    const aceCards = aces
      .filter((ace) => Number(ace.user_id) === Number(viewerUserId))
      .map((ace) => ace.ace_type);

    const kingCards = kings
      .filter((king) => Number(king.user_id) === Number(viewerUserId))
      .map((king) => king.king_type);

    return [...aceCards, ...kingCards];
  }

  function hasCorporateCard(deck) {
    return getViewerCorporateCards(deck).length > 0;
  }

  function getVisibleJokers(deck) {
    const jokers = [];

    const jokerType = String(deck?.joker_type || deck?.jokerType || "").toUpperCase();
    const hasBlue =
      jokerType === "BLUE" ||
      deck?.has_blue_joker === true ||
      deck?.joker_blue === true;

    const hasRed =
      jokerType === "RED" ||
      deck?.has_red_joker === true ||
      deck?.joker_red === true;

    if (hasRed) jokers.push("JOKER_RED");
    if (hasBlue) jokers.push("JOKER_BLUE");

    return jokers;
  }

  function canEditBlueJoker(deck) {
    if (typeof deck?.current_user_can_edit_blue_joker === "boolean") {
      return deck.current_user_can_edit_blue_joker;
    }

    const viewerId =
      deck?.viewer_user_id ||
      deck?.current_user_id ||
      deck?.viewerId ||
      null;

    const serviceOwnerId =
      deck?.service_owner_user_id ||
      deck?.serviceOwnerUserId ||
      deck?.owner_user_id ||
      deck?.ownerUserId ||
      null;

    if (!viewerId || !serviceOwnerId) return false;
    return Number(viewerId) === Number(serviceOwnerId);
  }

  function getInitialFilter(deck) {
    if (hasCorporateCard(deck)) return "HEART";
    return "HEART";
  }

  function buildCorporateCardsHTML(deck) {
    const cards = getViewerCorporateCards(deck);

    if (cards.length === 0) {
      return `<div class="mazobar__corporate-cards mazobar__corporate-cards--empty"></div>`;
    }

    return `
      <div class="mazobar__corporate-cards">
        ${cards.map((cardCode) => `
          <button
            type="button"
            class="mazobar__mini-card"
            data-card-code="${cardCode}"
            title="${cardCode}"
          >
            ${CARD_LABELS[cardCode] || cardCode}
          </button>
        `).join("")}
      </div>
    `;
  }

  function buildJokersHTML(deck) {
    const jokers = getVisibleJokers(deck);

    if (jokers.length === 0) {
      return `<div class="mazobar__jokers"></div>`;
    }

    return `
      <div class="mazobar__jokers">
        ${jokers.map((jokerCode) => {
          const isBlue = jokerCode === "JOKER_BLUE";
          const editable = isBlue && canEditBlueJoker(deck);

          return `
            <button
              type="button"
              class="mazobar__joker ${editable ? "mazobar__joker--editable" : "mazobar__joker--passive"}"
              data-joker-code="${jokerCode}"
              ${editable ? "" : 'disabled aria-disabled="true"'}
              title="${jokerCode}"
            >
              ${CARD_LABELS[jokerCode] || jokerCode}
            </button>
          `;
        }).join("")}
      </div>
    `;
  }

  function buildHeaderHTML(deck) {
    const amount = getViewerBalance(deck);
    const currencyCode = getCurrencyCode(deck);

    return `
      <div class="mazobar__title-row">
        <div class="mazobar__title-main">
          <button
            type="button"
            class="mazobar__ace-heart"
            id="mazobarAceHeartBtn"
            title="As de corazones"
          >
            A♥
          </button>

          <h1 class="mazobar__title" id="mazobarDeckTitle">
            ${escapeHtml(getDeckTitle(deck))}
          </h1>
        </div>

        <div class="${getBalanceClass(amount)}" id="mazobarBalance">
          <span class="mazobar__balance-diamond">♦</span>
          <span class="mazobar__balance-value">${escapeHtml(formatMoney(amount, currencyCode))}</span>
        </div>
      </div>
    `;
  }

  function buildActionBarHTML(deck) {
    const clubEnabled = hasCorporateCard(deck);

    return `
      <div class="mazobar__actions-row">
        <button
          type="button"
          class="mazobar__action-btn"
          id="mazobarAddJBtn"
          title="Nueva jugada J"
        >
          +J
        </button>

        <div class="mazobar__filters" id="mazobarFilters">
          <button
            type="button"
            class="mazobar__filter-btn"
            data-filter="HEART"
            title="Anotaciones"
          >
            ♥
          </button>

          <button
            type="button"
            class="mazobar__filter-btn"
            data-filter="SPADE"
            title="Jugadas de picas"
          >
            ♠
          </button>

          <button
            type="button"
            class="mazobar__filter-btn"
            data-filter="DIAMOND"
            title="Vista económica"
          >
            ♦
          </button>

          <button
            type="button"
            class="mazobar__filter-btn"
            data-filter="CLUB"
            title="Vista corporativa"
            ${clubEnabled ? "" : 'disabled aria-disabled="true"'}
          >
            ♣
          </button>
        </div>

        <button
          type="button"
          class="mazobar__action-btn mazobar__action-btn--exit"
          id="mazobarExitBtn"
          title="Salir"
        >
          EXIT
        </button>
      </div>
    `;
  }

  function buildMazobarHTML(deck) {
    return `
      <section class="mazobar mazobar--saved">
        <div class="page-container">
          <div class="mazobar__board">
            <div class="mazobar__left">
              ${buildCorporateCardsHTML(deck)}

              <div class="mazobar__deck-photo-wrap">
                <img
                  src="${escapeAttribute(getDeckImage(deck))}"
                  alt="Foto del mazo"
                  class="mazobar__deck-photo"
                />
              </div>

              ${buildJokersHTML(deck)}
            </div>

            <div class="mazobar__right">
              ${buildHeaderHTML(deck)}
              ${buildActionBarHTML(deck)}
            </div>
          </div>
        </div>
      </section>
    `;
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function escapeAttribute(value) {
    return escapeHtml(value);
  }

  function dispatchMazobarEvent(name, detail = {}) {
    document.dispatchEvent(new CustomEvent(name, { detail }));
  }

  function setActiveFilter(filter) {
    const buttons = document.querySelectorAll(".mazobar__filter-btn");
    buttons.forEach((button) => {
      const isActive = button.dataset.filter === filter;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-pressed", isActive ? "true" : "false");
    });
  }

  function bindMazobarEvents(deck) {
    document.getElementById("mazobarAddJBtn")?.addEventListener("click", () => {
      dispatchMazobarEvent("cooptrack:mazobar:add-j", { deck });
      dispatchMazobarEvent("cooptrack:playform:toggle", { deck, source: "mazobar" });
    });

    document.getElementById("mazobarAceHeartBtn")?.addEventListener("click", () => {
      dispatchMazobarEvent("cooptrack:mazobar:ace-heart", { deck });
    });

    document.getElementById("mazobarExitBtn")?.addEventListener("click", () => {
      window.location.href = "/mazos.html";
    });

    document.querySelectorAll(".mazobar__filter-btn").forEach((button) => {
      button.addEventListener("click", () => {
        if (button.disabled) return;

        const filter = button.dataset.filter;
        setActiveFilter(filter);

        dispatchMazobarEvent("cooptrack:mazobar:filter-change", {
          deck,
          filter
        });
      });
    });

    document.querySelectorAll(".mazobar__joker--editable").forEach((button) => {
      button.addEventListener("click", () => {
        dispatchMazobarEvent("cooptrack:mazobar:blue-joker-edit", {
          deck,
          jokerCode: button.dataset.jokerCode
        });
      });
    });
  }

  function renderMazobar(mode = "deck", deck = null) {
    const container = document.getElementById("mazobar-container");
    if (!container) {
      console.warn("mazobar-container no encontrado");
      return;
    }

    if (mode !== "deck") {
      container.innerHTML = "";
      return;
    }

    if (!deck) {
      container.innerHTML = "";
      console.warn("renderMazobar requiere un deck");
      return;
    }

    container.innerHTML = buildMazobarHTML(deck);

    const initialFilter = getInitialFilter(deck);
    setActiveFilter(initialFilter);
    bindMazobarEvents(deck);

    dispatchMazobarEvent("cooptrack:mazobar:ready", {
      deck,
      filter: initialFilter,
      hasCorporateAccess: hasCorporateCard(deck)
    });

    dispatchMazobarEvent("cooptrack:mazobar:filter-change", {
      deck,
      filter: initialFilter
    });
  }

  window.clearMazobar = clearMazobar;
  window.renderMazobar = renderMazobar;
})();
