function goToMazoPage(deck, suit = "HEART") {
  if (!deck || !deck.id) {
    console.warn("No se puede navegar a mazo: deck inválido", deck);
    return;
  }

  sessionStorage.setItem("activeDeckId", String(deck.id));
  sessionStorage.setItem("activeDeckName", deck.name || "");
  sessionStorage.setItem("activeSuit", suit);

  // al entrar a un mazo, la vista portfolio deja de estar desplegada
  sessionStorage.setItem("cooptrackDecksViewOpen", "false");

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

function clearDecksView() {
  const container = document.getElementById("decks-view-container");
  if (!container) return;
  container.innerHTML = "";
}

/**
 * TEMPORAL:
 * mientras todavía no venga todo del backend, armamos
 * un view model amigable para deck-row.js
 */
function buildDeckRowViewModel(deck, currentUser = null) {
  const normalizedJoker = String(deck?.joker || deck?.joker_type || "red").toLowerCase();

  return {
    id: deck.id,
    name: deck.name || "Mazo sin nombre",

    // joker
    joker: normalizedJoker,

    // imagen institucional del mazo
    // azul => imagen cargada en el joker azul
    // rojo => por ahora fallback a singeta si no tenés todavía A_CLUB real
    jokerImageUrl:
      deck.jokerImageUrl ||
      deck.joker_image_url ||
      deck.jokerImage ||
      null,

    clubOwnerPhotoUrl:
      deck.clubOwnerPhotoUrl ||
      deck.club_owner_photo_url ||
      null,

    // cartas del usuario actual a la izquierda
    // si todavía no las tenés reales, tratamos de usar lo que exista
    currentUserCards: buildCurrentUserCards(deck, currentUser),

    // fila inferior con J / Q jugadas
    summaryCards: buildSummaryCards(deck),

    // por si más adelante querés usar el deck original al click
    originalDeck: deck
  };
}

function buildCurrentUserCards(deck, currentUser = null) {
  // 1) si ya vienen preparadas, usamos eso
  if (Array.isArray(deck.currentUserCards)) {
    return deck.currentUserCards.filter(Boolean);
  }

  // 2) si ya viene algo como userCards, usamos eso
  if (Array.isArray(deck.userCards)) {
    return deck.userCards.filter(Boolean);
  }

  // 3) fallback temporal:
  // si el deck guarda aces, los usamos
  // esto NO es la regla final, pero ayuda a que se vea algo mientras tanto
  const aces = Array.isArray(deck.aces) ? deck.aces : [];

  // si después sumás kings en localStorage, podés agregarlos acá
  const kings = Array.isArray(deck.kings) ? deck.kings : [];

  const authorityCards = [...aces, ...kings].filter(
    (card) => typeof card === "string" && (card.startsWith("A_") || card.startsWith("K_"))
  );

  return authorityCards;
}

function buildSummaryCards(deck) {
  // 1) si ya vienen preparadas, usamos eso
  if (Array.isArray(deck.summaryCards)) {
    return deck.summaryCards.filter(Boolean);
  }

  // 2) si ya viene algo como playedCards, usamos eso
  if (Array.isArray(deck.playedCards)) {
    return deck.playedCards.filter(Boolean);
  }

  // 3) fallback temporal vacío
  // más adelante esto debería venir de records + participations
  return [];
}

function renderDecksView() {
  const container = document.getElementById("decks-view-container");
  if (!container) return;

  const decks = getStoredDecks();
  const currentUser = getLoggedUser();

  if (!decks.length) {
    container.innerHTML = "";
    return;
  }

  if (typeof renderDeckRow !== "function") {
    console.warn("renderDeckRow no está disponible. Verificá que deck-row.js esté cargado.");
    return;
  }

  const deckRowsHTML = decks
    .map((deck) => buildDeckRowViewModel(deck, currentUser))
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
