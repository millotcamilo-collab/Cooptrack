async function getStoredDecks() {
  try {
    const token = localStorage.getItem("cooptrackToken");

    const response = await fetch("/api/decks", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    });

    if (!response.ok) {
      throw new Error(`Error HTTP ${response.status}`);
    }

    const decks = await response.json();

    if (!Array.isArray(decks)) {
      console.warn("La API no devolvió un array de mazos");
      return [];
    }

    localStorage.setItem("cooptrackDecks", JSON.stringify(decks));
    return decks;
  } catch (error) {
    console.error("Error trayendo mazos desde API:", error);

    try {
      const raw = localStorage.getItem("cooptrackDecks");
      if (!raw) return [];
      const decks = JSON.parse(raw);
      return Array.isArray(decks) ? decks : [];
    } catch (localError) {
      console.error("Error leyendo cooptrackDecks desde localStorage:", localError);
      return [];
    }
  }
}

function saveStoredDecks(decks) {
  localStorage.setItem("cooptrackDecks", JSON.stringify(decks));
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

function clearPlayform() {
  const container = document.getElementById("playform-container");
  if (!container) return;
  container.innerHTML = "";
}

function getDeckAuthorityCardsForCurrentUser(deck, currentUser = null) {
  if (!deck) return [];

  if (Array.isArray(deck.currentUserCards)) {
    return deck.currentUserCards.filter(
      (card) =>
        typeof card === "string" &&
        (card.startsWith("A_") || card.startsWith("K_"))
    );
  }

  const aces = Array.isArray(deck.aces) ? deck.aces : [];
  const kings = Array.isArray(deck.kings) ? deck.kings : [];

  return [...aces, ...kings].filter(
    (card) =>
      typeof card === "string" &&
      (card.startsWith("A_") || card.startsWith("K_"))
  );
}

function userCanPlayInDeck(deck, currentUser = null) {
  const cards = getDeckAuthorityCardsForCurrentUser(deck, currentUser);
  return cards.length > 0;
}

function buildPlayformHTML(deck, currentUser = null) {
  return `
    <section class="playform">
      <div class="page-container">
        <div class="playform__inner">

          <div class="playform__left">
            <div class="playform__prefix">J</div>

            <input
              id="playformTextInput"
              type="text"
              class="playform__input"
              placeholder="Escribí una jugada..."
              autocomplete="off"
            />
          </div>

          <div class="playform__center">
            <button
              type="button"
              class="playform__action-btn playform__action-btn--heart"
              data-play-suit="HEART"
              title="Salvar como nota (J♥)"
            >
              ♥
            </button>

            <button
              type="button"
              class="playform__action-btn playform__action-btn--spade"
              data-play-suit="SPADE"
              title="Salvar como actividad (J♠)"
            >
              ♠
            </button>

            <button
              type="button"
              class="playform__action-btn playform__action-btn--club"
              data-play-suit="CLUB"
              title="Salvar como bien (J♣)"
            >
              ♣
            </button>
          </div>

          <div class="playform__right">
            <button
              type="button"
              class="playform__exit-btn"
              id="playformClearBtn"
              title="Limpiar"
            >
              <img src="/assets/icons/exit40.gif" alt="Limpiar" />
            </button>
          </div>

        </div>
      </div>
    </section>
  `;
}

function getRecordCardTypeFromSuit(suit) {
  const map = {
    HEART: "J_HEART",
    SPADE: "J_SPADE",
    CLUB: "J_CLUB"
  };

  return map[suit] || "J_HEART";
}

function getRecordKindFromSuit(suit) {
  const map = {
    HEART: "NOTE",
    SPADE: "ACTIVITY",
    CLUB: "ASSET"
  };

  return map[suit] || "NOTE";
}

function buildLocalPlayRecord(deck, currentUser, suit, text) {
  const nowIso = new Date().toISOString();

  return {
    id: Date.now(),
    deckId: deck?.id || null,
    cardType: getRecordCardTypeFromSuit(suit),
    suit,
    recordKind: getRecordKindFromSuit(suit),

    title: text,
    description: text,
    text,

    createdAt: nowIso,
    updatedAt: nowIso,

    createdByUserId: currentUser?.id || null,
    createdByNickname: currentUser?.nickname || "Usuario",

    lifecycleStatus: "SAVED",
    governanceStatus: "NORMAL",
    visibleToDeck: false,

    approvalStatus: "PENDING",
    isApproved: false,
    isRejected: false,

    parentRecordId: null,

    startDate: null,
    endDate: null,
    location: null,

    comments: [],
    validations: [],
    economicComponents: []
  };
}

async function saveLocalPlayRecord(deckId, record) {
  const decks = await getStoredDecks();
  const deckIndex = decks.findIndex((item) => String(item.id) === String(deckId));

  if (deckIndex === -1) {
    console.warn("No se encontró el mazo para guardar la jugada:", deckId);
    return null;
  }

  if (!Array.isArray(decks[deckIndex].plays)) {
    decks[deckIndex].plays = [];
  }

  decks[deckIndex].plays.unshift(record);
  saveStoredDecks(decks);
  return record;
}

async function handlePlayformSave(deck, suit) {
  const input = document.getElementById("playformTextInput");
  const currentUser = getLoggedUser();

  if (!input) return;

  const text = input.value.trim();

  if (!text) {
    window.alert("Escribí algo antes de guardar la jugada.");
    input.focus();
    return;
  }

  const record = buildLocalPlayRecord(deck, currentUser, suit, text);
  const savedRecord = await saveLocalPlayRecord(deck.id, record);

  if (!savedRecord) {
    window.alert("No se pudo guardar la jugada.");
    return;
  }

  input.value = "";

  if (typeof renderPlaysView === "function") {
    const updatedDecks = await getStoredDecks();
    const updatedDeck =
      updatedDecks.find((item) => String(item.id) === String(deck.id)) || deck;

    renderPlaysView(updatedDeck);
  }
}

function attachPlayformEvents(deck) {
  document.querySelectorAll("[data-play-suit]").forEach((button) => {
    button.addEventListener("click", async () => {
      const suit = button.dataset.playSuit;
      if (!suit) return;
      await handlePlayformSave(deck, suit);
    });
  });

  document.getElementById("playformClearBtn")?.addEventListener("click", () => {
    const input = document.getElementById("playformTextInput");
    if (input) input.value = "";
  });

  document.getElementById("playformTextInput")?.addEventListener("keydown", async (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      await handlePlayformSave(deck, "HEART");
    }
  });
}

function renderPlayform(deck) {
  const container = document.getElementById("playform-container");
  if (!container) {
    console.warn("playform-container no encontrado");
    return;
  }

  const currentUser = getLoggedUser();

  if (!userCanPlayInDeck(deck, currentUser)) {
    container.innerHTML = "";
    return;
  }

  container.innerHTML = buildPlayformHTML(deck, currentUser);
  attachPlayformEvents(deck);
}
