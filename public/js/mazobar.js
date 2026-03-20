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

function clearMazobar() {
  const container = document.getElementById("mazobar-container");
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

function buildMazobarHTML(mode = "create") {
  const title = mode === "create" ? "Nuevo mazo" : "Editar mazo";
  const actionLabel = mode === "create" ? "Crear mazo" : "Guardar cambios";

  return `
    <section class="mazobar">
      <div class="page-container">
        <div class="mazobar__card">

          <div class="mazobar__header">
            <h2 class="mazobar__title">${title}</h2>
          </div>

          <div class="mazobar__form">
            <div class="mazobar__field">
              <label for="deckNameInput" class="mazobar__label">Nombre del mazo</label>
              <input
                id="deckNameInput"
                type="text"
                class="mazobar__input"
                placeholder="Escribí el nombre del mazo..."
                maxlength="150"
                autocomplete="off"
              />
            </div>

            <div class="mazobar__field">
              <span class="mazobar__label">Tipo de Joker</span>

              <div class="mazobar__radio-group">
                <label class="mazobar__radio-option">
                  <input
                    type="radio"
                    name="jokerType"
                    value="RED"
                    checked
                  />
                  <span>Joker rojo</span>
                </label>

                <label class="mazobar__radio-option">
                  <input
                    type="radio"
                    name="jokerType"
                    value="BLUE"
                  />
                  <span>Joker azul</span>
                </label>
              </div>
            </div>

            <div class="mazobar__field">
              <label for="deckCurrencySelect" class="mazobar__label">Moneda base</label>
              <select id="deckCurrencySelect" class="mazobar__select">
                <option value="ARS" selected>ARS</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="BRL">BRL</option>
                <option value="UYU">UYU</option>
                <option value="CLP">CLP</option>
              </select>
            </div>
          </div>

          <div class="mazobar__actions">
            <button
              type="button"
              class="mazobar__btn mazobar__btn--secondary"
              id="mazobarCancelBtn"
            >
              Cancelar
            </button>

            <button
              type="button"
              class="mazobar__btn mazobar__btn--primary"
              id="mazobarSaveBtn"
            >
              ${actionLabel}
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

function handleMazobarSave() {
  const newDeck = buildNewDeckObject();
  if (!newDeck) return;

  saveNewDeckLocally(newDeck);
  clearMazobar();
  openDeckPage(newDeck);
}

function handleMazobarCancel() {
  clearMazobar();

  const url = new URL(window.location.href);
  url.searchParams.delete("view");
  window.history.replaceState({}, "", url.pathname + url.search);
}

function attachMazobarEvents() {
  document.getElementById("mazobarSaveBtn")?.addEventListener("click", handleMazobarSave);
  document.getElementById("mazobarCancelBtn")?.addEventListener("click", handleMazobarCancel);

  document.getElementById("deckNameInput")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleMazobarSave();
    }
  });
}

function renderMazobar(mode = "create") {
  const container = document.getElementById("mazobar-container");
  if (!container) {
    console.warn("mazobar-container no encontrado");
    return;
  }

  container.innerHTML = buildMazobarHTML(mode);
  attachMazobarEvents();
}
