const API_BASE_URL = "https://cooptrack-backend.onrender.com";

function goToMazoPage(deck) {
  if (!deck || !deck.id) {
    console.warn("Deck inválido", deck);
    return;
  }

  window.location.href = `/mazo.html?id=${deck.id}`;
}

async function fetchDecks() {
  try {
    const response = await fetch(`${API_BASE_URL}/decks`);
    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.message || "Error cargando mazos");
    }

    return data.decks || [];
  } catch (error) {
    console.error("Error trayendo mazos:", error);
    return [];
  }
}

function clearDecksView() {
  const container = document.getElementById("decks-view-container");
  if (!container) return;
  container.innerHTML = "";
}

function buildDeckRowViewModel(deck) {
  return {
    id: deck.id,
    name: deck.name || "Mazo sin nombre",
    joker: String(deck.joker_type || "RED").toLowerCase(),
    jokerImageUrl: deck.joker_image_url || null,
    currentUserCards: [],
    summaryCards: [],
    originalDeck: deck
  };
}

async function renderDecksView() {
  const container = document.getElementById("decks-view-container");
  if (!container) return;

  if (typeof renderDeckRow !== "function") {
    console.warn("renderDeckRow no está disponible");
    return;
  }

  const decks = await fetchDecks();

  if (!decks.length) {
    container.innerHTML = `
      <section class="decks-view">
        <div class="page-container">
          <p>No hay mazos todavía.</p>
        </div>
      </section>
    `;
    return;
  }

  const deckRowsHTML = decks
    .map((deck) => buildDeckRowViewModel(deck))
    .map((deckView) => renderDeckRow(deckView))
    .join("");

  container.innerHTML = `
    <section class="decks-view">
      <div class="page-container">
        <div class="decks-view__list">
          ${deckRowsHTML}
        </div>
      </div>
    </section>
  `;

  if (typeof attachDeckRowEvents === "function") {
    attachDeckRowEvents();
  }
}
