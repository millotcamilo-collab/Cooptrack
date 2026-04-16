const API_BASE_URL = "https://cooptrack-backend.onrender.com";

function getToken() {
  return localStorage.getItem("cooptrackToken");
}

function getDecksMode() {
  const mode = document.body?.dataset?.decksMode || "active";
  return mode === "archived" ? "archived" : "active";
}

function goToMazoPage(deck) {
  if (!deck || !deck.id) {
    console.warn("Deck inválido", deck);
    return;
  }

  window.location.href = `/mazo.html?id=${deck.id}`;
}

async function fetchDecks(mode = "active") {
  try {
    const token = getToken();

    if (!token) {
      throw new Error("Token no encontrado");
    }

    const url =
      mode === "archived"
        ? `${API_BASE_URL}/decks?archived=true`
        : `${API_BASE_URL}/decks`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.message || data.error || "Error cargando mazos");
    }

    return Array.isArray(data.mazos)
      ? data.mazos
      : Array.isArray(data.decks)
        ? data.decks
        : [];
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
  const photoUrl =
    (typeof deck.deck_image_url === "string" && deck.deck_image_url.trim()) ||
    (typeof deck.photo_url === "string" && deck.photo_url.trim()) ||
    (typeof deck.image_url === "string" && deck.image_url.trim()) ||
    "/assets/icons/sinPicture.gif";

  return {
    id: deck.id,
    name: deck.name || "Mazo sin nombre",
    photoUrl,
    joker: String(deck.joker_type || "RED").toUpperCase(),
    currentUserCards: Array.isArray(deck.current_user_cards)
      ? deck.current_user_cards
      : [],
    membershipStatus: String(deck.membership_status || "ACTIVE").toUpperCase(),
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

  const mode = getDecksMode();
  const decks = await fetchDecks(mode);

  if (!decks.length) {
    container.innerHTML = `
      <section class="decks-view">
        <div class="page-container">
          <p>${mode === "archived" ? "No hay mazos archivados." : "No hay mazos todavía."}</p>
        </div>
      </section>
    `;
    return;
  }

  const deckRowsHTML = decks
    .map((deck) => {
      const viewModel = buildDeckRowViewModel(deck);
      return renderDeckRow(viewModel);
    })
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