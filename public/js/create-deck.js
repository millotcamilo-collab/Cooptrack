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

function getStoredDecksSync() {
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

function saveStoredDecksSync(decks) {
  localStorage.setItem("cooptrackDecks", JSON.stringify(decks));
}

function clearCreateDeckForm() {
  const container = document.getElementById("create-deck-container");
  if (!container) return;
  container.innerHTML = "";
}

function generateLocalDeckId() {
  return Date.now();
}

function getDefaultDeckImage() {
  return "/assets/icons/singeta120.gif";
}

function normalizeDeckName(value) {
  return String(value || "").trim();
}

function buildCreateDeckHTML() {
  return `
    <section class="create-deck">
      <div class="page-container">
        <div class="create-deck__card">

          <div class="create-deck__header">
            <h2 class="create-deck__title">Nuevo mazo</h2>
          </div>

          <div class="create-deck__form">

            <div class="create-deck__field">
              <label for="deckNameInput" class="create-deck__label">Nombre del mazo</label>
              <input
                id="deckNameInput"
                type="text"
                class="create-deck__input"
                placeholder="Escribí el nombre del mazo..."
                maxlength="150"
                autocomplete="off"
              />
            </div>

            <div class="create-deck__field">
              <span class="create-deck__label">Tipo de Joker</span>

              <div class="create-deck__radio-group">
                <label class="create-deck__radio-option">
                  <input
                    type="radio"
                    name="jokerType"
                    value="RED"
                    checked
                  />
                  <span>Joker rojo</span>
                </label>

                <label class="create-deck__radio-option">
                  <input
                    type="radio"
                    name="jokerType"
                    value="BLUE"
                  />
                  <span>Joker azul</span>
                </label>
              </div>
            </div>

            <div class="create-deck__field">
              <label for="deckCurrencySelect" class="create-deck__label">Moneda base</label>
              <select id="deckCurrencySelect" class="create-deck__select">
                <option value="ARS" selected>ARS</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="BRL">BRL</option>
                <option value="UYU">UYU</option>
                <option value="CLP">CLP</option>
              </select>
            </div>

          </div>

          <div class="create-deck__actions">
            <button
              type="button"
              class="create-deck__btn create-deck__btn--secondary"
              id="createDeckCancelBtn"
            >
              Cancelar
            </button>

            <button
              type="button"
              class="create-deck__btn create-deck__btn--primary"
              id="createDeckSaveBtn"
            >
              Crear mazo
            </button>
          </div>

        </div>
      </div>
    </section>
  `;
}

function getSelectedJokerType() {
  const checked = document.querySelector('input[name="jokerType"]:checked');
  return checked?.value || "RED";
}

function buildNewDeckObject() {
  const currentUser = getLoggedUser();
  const nameInput = document.getElementById("deckNameInput");
  const currencySelect = document.getElementById("deckCurrencySelect");

  const name = normalizeDeckName(nameInput?.value);
  const jokerType = getSelectedJokerType();
  const currencyCode = currencySelect?.value || "ARS";

  if (!name) {
    window.alert("Escribí un nombre para el mazo.");
    nameInput?.focus();
    return null;
  }

  const nowIso = new Date().toISOString();
  const userId = currentUser?.id || null;
  const nickname = currentUser?.nickname || "Usuario";

  return {
    id: generateLocalDeckId(),
    name,
    description: "",
    createdByUserId: userId,
    ownerUserId: userId,
    createdByNickname: nickname,
    ownerNickname: nickname,
    profilePhotoUrl: getDefaultDeckImage(),
    profile_photo_url: getDefaultDeckImage(),
    isPrivate: false,
    jokerType,
    currencyCode,
    createdAt: nowIso,
    updatedAt: nowIso,
    plays: [],
    members: userId ? [userId] : [],
    currentUserCards: ["A_HEART", "A_SPADE", "A_DIAMOND", "A_CLUB"],
    aces: ["A_HEART", "A_SPADE", "A_DIAMOND", "A_CLUB"],
    kings: [],
    jokerRed: {
      visibleToCreatorOnly: true,
      staysWithCreatorUntilAceTransfer: true
    },
    jokerBlue: {
      visibleToEveryone: true,
      editableByOwnerOnly: true
    }
  };
}

function saveNewDeckLocally(deck) {
  const decks = getStoredDecksSync();
  decks.unshift(deck);
  saveStoredDecksSync(decks);
  return deck;
}

function openDeckPage(deck) {
  if (!deck?.id) return;
  window.location.href = `/mazo.html?id=${deck.id}`;
}

function handleCreateDeckSave() {
  const newDeck = buildNewDeckObject();
  if (!newDeck) return;

  saveNewDeckLocally(newDeck);
  clearCreateDeckForm();
  openDeckPage(newDeck);
}

function handleCreateDeckCancel() {
  clearCreateDeckForm();

  const url = new URL(window.location.href);
  url.searchParams.delete("view");
  window.history.replaceState({}, "", url.pathname + url.search);
}

function attachCreateDeckEvents() {
  document.getElementById("createDeckSaveBtn")?.addEventListener("click", handleCreateDeckSave);
  document.getElementById("createDeckCancelBtn")?.addEventListener("click", handleCreateDeckCancel);

  document.getElementById("deckNameInput")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleCreateDeckSave();
    }
  });
}

function renderCreateDeckForm() {
  const container = document.getElementById("create-deck-container");
  if (!container) {
    console.warn("create-deck-container no encontrado");
    return;
  }

  container.innerHTML = buildCreateDeckHTML();
  attachCreateDeckEvents();
}
