function goToMazoPage(deck) {
  if (!deck || !deck.id) {
    console.warn("Deck inválido", deck);
    return;
  }

  window.location.href = `/mazo.html?id=${deck.id}`;
}

/**
 * Trae mazos del backend
 */
async function fetchDecks() {
  try {
    const response = await fetch("/decks");
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

/**
 * View model mínimo (sin inventar datos)
 */
function buildDeckRowViewModel(deck) {
  return {
    id: deck.id,
    name: deck.name || "Mazo sin nombre",

    // joker real del backend
    joker: String(deck.joker_type || "RED").toLowerCase(),

    // imagen institucional (cuando la uses)
    jokerImageUrl: deck.profile_photo_url || null,

    // ⚠️ por ahora vacío (después lo conectamos a governance)
    currentUserCards: [],

    // ⚠️ por ahora vacío (después viene de records)
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
    container.innerHTML = "";
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
