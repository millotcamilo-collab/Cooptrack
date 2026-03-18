function goToMazoPage(deck, suit = "HEART") {
  if (!deck || !deck.id) {
    console.warn("No se puede navegar a mazo: deck inválido", deck);
    return;
  }

  sessionStorage.setItem("activeDeckId", String(deck.id));
  sessionStorage.setItem("activeDeckName", deck.name || "");
  sessionStorage.setItem("activeSuit", suit);

  console.log("Navegando a /mazo.html con:", {
    deckId: deck.id,
    deckName: deck.name,
    suit
  });

  window.location.href = "/mazo.html";
}

function getStoredDecks() {
  try {
    const raw = localStorage.getItem("cooptrackDecks");
    if (!raw) return [];
    const decks = JSON.parse(raw);
    return Array.isArray(decks) ? decks : [];
  } catch (error) {
    console.error("Error leyendo cooptrackDecks:", error);
    return [];
  }
}

function clearDecksView() {
  const container = document.getElementById("decks-view-container");
  if (!container) return;
  container.innerHTML = "";
}

function buildDeckUserCardsHTML(deck) {
  const joker = deck?.joker || "red";

  if (joker === "red") {
    return `
      <div class="decks-view__user-cards">
        <img src="/assets/icons/Joker120.gif" alt="Joker rojo" class="decks-view__mini-card" />
      </div>
    `;
  }

  if (joker === "blue") {
    return `
      <div class="decks-view__user-cards">
        <img src="/assets/icons/joker_blue.gif" alt="Joker azul" class="decks-view__mini-card" />
      </div>
    `;
  }

  return `
    <div class="decks-view__user-cards">
      <img src="/assets/icons/Joker120.gif" alt="Carta" class="decks-view__mini-card" />
    </div>
  `;
}

function buildDeckRowHTML(deck) {
  return `
    <article class="decks-view__item" data-deck-id="${deck.id}">
      
      <div class="decks-view__left-group">
        ${buildDeckUserCardsHTML(deck)}
      </div>

      <div class="decks-view__photo">
        <img src="/assets/icons/singeta120.gif" alt="Mazo" />
      </div>

      <div class="decks-view__right-group">
        <div class="decks-view__title">
          <span class="decks-view__ace">A ♥</span>
          <span class="decks-view__deck-name">${deck.name}</span>
        </div>

        <div class="decks-view__suits">
          <button class="decks-view__suit-btn" data-deck-id="${deck.id}" data-suit="SPADE" title="Vista picas" aria-label="Vista picas">
            <img src="/assets/icons/pik40.gif" alt="Picas" />
          </button>

          <button class="decks-view__suit-btn" data-deck-id="${deck.id}" data-suit="DIAMOND" title="Vista diamantes" aria-label="Vista diamantes">
            <img src="/assets/icons/dia40.gif" alt="Diamantes" />
          </button>

          <button class="decks-view__suit-btn" data-deck-id="${deck.id}" data-suit="CLUB" title="Vista tréboles" aria-label="Vista tréboles">
            <img src="/assets/icons/tre40.gif" alt="Tréboles" />
          </button>

          <button class="decks-view__suit-btn" data-deck-id="${deck.id}" data-suit="HEART" title="Vista corazones" aria-label="Vista corazones">
            <img src="/assets/icons/cor40.gif" alt="Corazones" />
          </button>
        </div>
      </div>

    </article>
  `;
}

function attachDeckSuitEvents() {
  const suitButtons = document.querySelectorAll(".decks-view__suit-btn");

  suitButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const deckId = button.dataset.deckId;
      const suit = button.dataset.suit;

      const decks = getStoredDecks();
      const deck = decks.find((item) => String(item.id) === String(deckId));

      goToMazoPage(deck, suit);
    });
  });
}

function renderDecksView() {
  const container = document.getElementById("decks-view-container");
  if (!container) return;

  const decks = getStoredDecks();

  if (!decks.length) {
    container.innerHTML = "";
    return;
  }

  container.innerHTML = `
    <section class="decks-view">
      <div class="page-container">
        <div class="decks-view__list">
          ${decks.map((deck) => buildDeckRowHTML(deck)).join("")}
        </div>
      </div>
    </section>
  `;

  attachDeckSuitEvents();
  attachDeckRowEvents();
}

function attachDeckRowEvents() {
  const deckRows = document.querySelectorAll(".decks-view__item");

  deckRows.forEach((row) => {
    row.addEventListener("click", (event) => {
      if (event.target.closest(".decks-view__suit-btn")) return;

      const deckId = row.dataset.deckId;
      const decks = getStoredDecks();
      const deck = decks.find((item) => String(item.id) === String(deckId));

      goToMazoPage(deck, "HEART");
    });
  });
}
