function getLoggedUser() {
  try {
    const raw = localStorage.getItem("cooptrackUser");
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (error) {
    console.error("Error leyendo cooptrackUser:", error);
    return null;
  }
}

function clearDeckRow() {
  const container = document.getElementById("deck-row-container");
  if (!container) return;
  container.innerHTML = "";
}

function getDeckDisplayImage(deck) {
  if (deck?.profilePhotoUrl && String(deck.profilePhotoUrl).trim() !== "") {
    return deck.profilePhotoUrl;
  }

  if (deck?.profile_photo_url && String(deck.profile_photo_url).trim() !== "") {
    return deck.profile_photo_url;
  }

  if (deck?.imageUrl && String(deck.imageUrl).trim() !== "") {
    return deck.imageUrl;
  }

  return "/assets/icons/singeta120.gif";
}

function getDeckDisplayName(deck) {
  if (!deck) return "Mazo";
  return deck.name || deck.title || "Mazo sin nombre";
}

function normalizeDeckCardList(cards) {
  if (!Array.isArray(cards)) return [];
  return cards.filter((item) => typeof item === "string" && item.trim() !== "");
}

function getDeckCorporateCardsForCurrentUser(deck, currentUser = null) {
  if (!deck) return [];

  if (Array.isArray(deck.currentUserCards)) {
    return normalizeDeckCardList(deck.currentUserCards);
  }

  const cards = [];

  if (Array.isArray(deck.aces)) {
    cards.push(...normalizeDeckCardList(deck.aces));
  }

  if (Array.isArray(deck.kings)) {
    cards.push(...normalizeDeckCardList(deck.kings));
  }

  return cards;
}

function getCardImageByType(cardType) {
  const map = {
    A_HEART: "/assets/cards/Acorazon.gif",
    A_SPADE: "/assets/cards/Apica.gif",
    A_DIAMOND: "/assets/cards/Adiamante.gif",
    A_CLUB: "/assets/cards/Atrebol.gif",

    K_HEART: "/assets/cards/Kcorazon.gif",
    K_SPADE: "/assets/cards/Kpica.gif",
    K_DIAMOND: "/assets/cards/Kdiamante.gif",
    K_CLUB: "/assets/cards/Ktrebol.gif",

    JOKER_RED: "/assets/cards/jokerRojo.gif",
    JOKER_BLUE: "/assets/cards/jokerAzul.gif"
  };

  return map[cardType] || "/assets/icons/card-placeholder.png";
}

function getCardAltByType(cardType) {
  const map = {
    A_HEART: "As de corazones",
    A_SPADE: "As de picas",
    A_DIAMOND: "As de diamantes",
    A_CLUB: "As de tréboles",

    K_HEART: "Rey de corazones",
    K_SPADE: "Rey de picas",
    K_DIAMOND: "Rey de diamantes",
    K_CLUB: "Rey de tréboles",

    JOKER_RED: "Joker rojo",
    JOKER_BLUE: "Joker azul"
  };

  return map[cardType] || "Carta";
}

function buildCorporateCardsHTML(deck, currentUser) {
  const cards = getDeckCorporateCardsForCurrentUser(deck, currentUser);

  if (!cards.length) {
    return `
      <div class="deck-row__cards deck-row__cards--empty"></div>
    `;
  }

  const cardsHTML = cards
    .map((cardType) => {
      return `
        <button
          type="button"
          class="deck-row__card-btn"
          data-corporate-card="${cardType}"
          title="${getCardAltByType(cardType)}"
          aria-label="${getCardAltByType(cardType)}"
        >
          <img
            src="${getCardImageByType(cardType)}"
            alt="${getCardAltByType(cardType)}"
            class="deck-row__card-img"
          />
        </button>
      `;
    })
    .join("");

  return `
    <div class="deck-row__cards">
      ${cardsHTML}
    </div>
  `;
}

function buildDeckSuitsHTML() {
  return `
    <div class="deck-row__suits" aria-label="Palos del mazo">
      <span class="deck-row__suit deck-row__suit--heart">♥</span>
      <span class="deck-row__suit deck-row__suit--spade">♠</span>
      <span class="deck-row__suit deck-row__suit--diamond">♦</span>
      <span class="deck-row__suit deck-row__suit--club">♣</span>
    </div>
  `;
}

function buildDeckHeaderHTML(deck, currentUser) {
  return `
    <section class="deck-row">
      <div class="page-container">
        <div class="deck-row__inner">

          <div class="deck-row__left">
            ${buildCorporateCardsHTML(deck, currentUser)}
          </div>

          <div class="deck-row__center">
            <img
              src="${getDeckDisplayImage(deck)}"
              alt="${getDeckDisplayName(deck)}"
              class="deck-row__photo"
            />
          </div>

          <div class="deck-row__right">
            <h1 class="deck-row__title">${getDeckDisplayName(deck)}</h1>
            ${buildDeckSuitsHTML()}
          </div>

        </div>
      </div>
    </section>
  `;
}

function attachCorporateCardEvents(deck) {
  document.querySelectorAll("[data-corporate-card]").forEach((button) => {
    button.addEventListener("click", () => {
      const cardType = button.dataset.corporateCard;
      if (!cardType) return;

      console.log("Carta corporativa clickeada:", cardType, "en mazo:", deck?.id);

      /*
        ETAPA POSTERIOR:
        acá vamos a abrir el subform institucional para:
        - transferir As
        - asignar Reyes
        - ocultar el playform J mientras esa jugada esté activa
      */
    });
  });
}

function ensureDeckLayoutContainers() {
  let deckContainer = document.getElementById("deck-row-container");
  let playformContainer = document.getElementById("playform-container");
  let playsViewContainer = document.getElementById("plays-view-container");

  if (!deckContainer || !playformContainer || !playsViewContainer) {
    const root =
      document.getElementById("deck-view-container") ||
      document.getElementById("decks-view-container");

    if (!root) {
      console.warn("No se encontró contenedor raíz del mazo");
      return null;
    }

    root.innerHTML = `
      <div id="deck-row-container"></div>
      <div id="playform-container"></div>
      <div id="plays-view-container"></div>
    `;

    deckContainer = document.getElementById("deck-row-container");
    playformContainer = document.getElementById("playform-container");
    playsViewContainer = document.getElementById("plays-view-container");
  }

  return {
    deckContainer,
    playformContainer,
    playsViewContainer
  };
}

function renderDeckRow(deck) {
  const layout = ensureDeckLayoutContainers();
  if (!layout) return;

  const currentUser = getLoggedUser();

  layout.deckContainer.innerHTML = buildDeckHeaderHTML(deck, currentUser);
  attachCorporateCardEvents(deck);
}

function renderDeckView(deck) {
  const layout = ensureDeckLayoutContainers();
  if (!layout) return;

  renderDeckRow(deck);

  if (typeof renderPlayform === "function") {
    renderPlayform(deck);
  }

  if (typeof renderPlaysView === "function") {
    renderPlaysView(deck);
  }
}
