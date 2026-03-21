const newMazobarState = {
  step: "name", // name | joker | blue-image
  draft: {
    name: "",
    jokerType: null, // RED | BLUE
    currencyCode: "ARS",
    profilePhotoUrl: ""
  },
  isSaving: false
};

window.sessionScope = window.sessionScope || {
  jugadas: []
};

function getAuthToken() {
  try {
    return localStorage.getItem("cooptrackToken");
  } catch (error) {
    console.error("Error leyendo cooptrackToken:", error);
    return null;
  }
}

function getCurrentIsoDate() {
  return new Date().toISOString();
}

function clearNewMazobar() {
  const container = document.getElementById("new-mazobar-container");
  if (!container) return;
  container.innerHTML = "";
}

function getCardImage(cardType) {
  const map = {
    A_HEART: "/assets/icons/Acorazon.gif",
    A_SPADE: "/assets/icons/Apike.gif",
    A_DIAMOND: "/assets/icons/Adiamante.gif",
    A_CLUB: "/assets/icons/Atrebol.gif",
    JOKER_RED: "/assets/icons/Joker120.gif",
    JOKER_BLUE: "/assets/icons/joker_blue.gif"
  };

  return map[cardType] || "/assets/icons/singeta120.gif";
}

function getDefaultDeckImage() {
  return "/assets/icons/singeta120.gif";
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function buildNameStepHTML() {
  return `
    <section class="new-mazobar">
      <div class="page-container">
        <div class="new-mazobar__row">

          <div class="new-mazobar__left">
            <div class="new-mazobar__preview-slot"></div>
          </div>

          <div class="new-mazobar__photo-wrap">
            <img
              src="${getDefaultDeckImage()}"
              alt="Imagen del mazo"
              class="new-mazobar__photo"
            />
          </div>

          <div class="new-mazobar__main">
            <div class="new-mazobar__name-line">
              <span class="new-mazobar__label">Nombre del mazo</span>
              <input
                id="newMazobarNameInput"
                type="text"
                class="new-mazobar__name-input"
                placeholder="Escribí el nombre del mazo..."
                maxlength="150"
                autocomplete="off"
              />
            </div>

            <div class="new-mazobar__actions">
              <button
                type="button"
                class="new-mazobar__text-btn"
                id="newMazobarNameSaveBtn"
                title="Salvar A♥"
              >
                <img src="/assets/icons/cor40.gif" alt="Salvar A♥" />
              </button>

              <button
                type="button"
                class="new-mazobar__exit-btn"
                id="newMazobarCancelBtn"
                title="Cancelar"
              >
                <img src="/assets/icons/exit40.gif" alt="Cancelar" />
              </button>
            </div>
          </div>

        </div>
      </div>
    </section>
  `;
}

function buildJokerStepHTML(draft) {
  const safeName = escapeHtml(draft.name);

  return `
    <section class="new-mazobar">
      <div class="page-container">
        <div class="new-mazobar__helper">
          Si aprueba as de corazones, ya se fija el nombre del mazo y se entregan los 3 ases restantes.
        </div>

        <div class="new-mazobar__row">

          <div class="new-mazobar__left">
            <div class="new-mazobar__cards">
              <img src="${getCardImage("A_SPADE")}" alt="A♠" class="new-mazobar__card-img" />
              <img src="${getCardImage("A_DIAMOND")}" alt="A♦" class="new-mazobar__card-img" />
              <img src="${getCardImage("A_CLUB")}" alt="A♣" class="new-mazobar__card-img" />
            </div>
          </div>

          <div class="new-mazobar__photo-wrap">
            <img
              src="${getDefaultDeckImage()}"
              alt="Imagen del mazo"
              class="new-mazobar__photo"
            />
          </div>

          <div class="new-mazobar__main">
            <div class="new-mazobar__title-line">
              <span class="new-mazobar__ace-title">A ♥</span>
              <span class="new-mazobar__deck-name">${safeName}</span>
            </div>

            <div class="new-mazobar__joker-choice">
              <button
                type="button"
                class="new-mazobar__choice-btn"
                id="newMazobarChooseRedBtn"
                title="Solo joker rojo"
              >
                <img src="${getCardImage("JOKER_RED")}" alt="Joker rojo" class="new-mazobar__choice-card" />
              </button>

              <button
                type="button"
                class="new-mazobar__choice-btn"
                id="newMazobarChooseBlueBtn"
                title="Agregar joker azul"
              >
                <img src="${getCardImage("JOKER_BLUE")}" alt="Joker azul" class="new-mazobar__choice-card" />
              </button>

              <button
                type="button"
                class="new-mazobar__exit-btn"
                id="newMazobarBackToNameBtn"
                title="Volver"
              >
                <img src="/assets/icons/exit40.gif" alt="Volver" />
              </button>
            </div>
          </div>

        </div>
      </div>
    </section>
  `;
}

function buildBlueImageStepHTML(draft) {
  const safeName = escapeHtml(draft.name);
  const photoUrl = draft.profilePhotoUrl || getDefaultDeckImage();

  return `
    <section class="new-mazobar">
      <div class="page-container">
        <div class="new-mazobar__helper">
          Si elige joker azul, la imagen del mazo es opcional y podrá editarse más tarde.
        </div>

        <div class="new-mazobar__row">

          <div class="new-mazobar__left">
            <div class="new-mazobar__cards">
              <img src="${getCardImage("JOKER_BLUE")}" alt="Joker azul" class="new-mazobar__card-img" />
              <img src="${getCardImage("JOKER_RED")}" alt="Joker rojo" class="new-mazobar__card-img" />
              <img src="${getCardImage("A_SPADE")}" alt="A♠" class="new-mazobar__card-img" />
              <img src="${getCardImage("A_DIAMOND")}" alt="A♦" class="new-mazobar__card-img" />
              <img src="${getCardImage("A_CLUB")}" alt="A♣" class="new-mazobar__card-img" />
            </div>
          </div>

          <div class="new-mazobar__photo-wrap">
            <img
              src="${photoUrl}"
              alt="Imagen del mazo"
              class="new-mazobar__photo"
              id="newMazobarBluePreview"
            />
          </div>

          <div class="new-mazobar__main">
            <div class="new-mazobar__title-line">
              <span class="new-mazobar__ace-title">A ♥</span>
              <span class="new-mazobar__deck-name">${safeName}</span>
            </div>

            <div class="new-mazobar__image-line">
              <label for="newMazobarBlueImageInput" class="new-mazobar__label">
                Imagen del mazo
              </label>

              <input
                id="newMazobarBlueImageInput"
                type="text"
                class="new-mazobar__name-input"
                placeholder="URL de la imagen (opcional)"
                value="${escapeHtml(draft.profilePhotoUrl)}"
                autocomplete="off"
              />
            </div>

            <div class="new-mazobar__actions">
              <button
                type="button"
                class="new-mazobar__text-btn"
                id="newMazobarBlueSaveBtn"
                title="Salvar mazo"
              >
                <img src="/assets/icons/Disquete40.gif" alt="Salvar mazo" />
              </button>

              <button
                type="button"
                class="new-mazobar__exit-btn"
                id="newMazobarBackToJokerBtn"
                title="Volver"
              >
                <img src="/assets/icons/exit40.gif" alt="Volver" />
              </button>
            </div>
          </div>

        </div>
      </div>
    </section>
  `;
}

function buildSavingHTML() {
  return `
    <section class="new-mazobar">
      <div class="page-container">
        <div class="new-mazobar__saving">
          Salvando mazo...
        </div>
      </div>
    </section>
  `;
}

function buildNewMazobarHTML() {
  if (newMazobarState.isSaving) {
    return buildSavingHTML();
  }

  if (newMazobarState.step === "name") {
    return buildNameStepHTML();
  }

  if (newMazobarState.step === "joker") {
    return buildJokerStepHTML(newMazobarState.draft);
  }

  if (newMazobarState.step === "blue-image") {
    return buildBlueImageStepHTML(newMazobarState.draft);
  }

  return buildNameStepHTML();
}

function renderNewMazobar() {
  const container = document.getElementById("new-mazobar-container");
  if (!container) {
    console.warn("new-mazobar-container no encontrado");
    return;
  }

  container.innerHTML = buildNewMazobarHTML();
  attachNewMazobarEvents();
}

function resetNewMazobarState() {
  newMazobarState.step = "name";
  newMazobarState.isSaving = false;
  newMazobarState.draft = {
    name: "",
    jokerType: null,
    currencyCode: "ARS",
    profilePhotoUrl: ""
  };
}

function handleCancelNewMazobar() {
  clearNewMazobar();

  const url = new URL(window.location.href);
  url.searchParams.delete("view");
  window.history.replaceState({}, "", url.pathname + url.search);
}

function handleSaveNameStep() {
  const input = document.getElementById("newMazobarNameInput");
  if (!input) return;

  const name = String(input.value || "").trim();

  if (!name) {
    window.alert("Escribí un nombre para el mazo.");
    input.focus();
    return;
  }

  newMazobarState.draft.name = name;
  newMazobarState.step = "joker";
  renderNewMazobar();
}

function handleChooseRedJoker() {
  newMazobarState.draft.jokerType = "RED";
  finalizeNewDeck();
}

function handleChooseBlueJoker() {
  newMazobarState.draft.jokerType = "BLUE";
  newMazobarState.step = "blue-image";
  renderNewMazobar();
}

function handleBlueImagePreview() {
  const input = document.getElementById("newMazobarBlueImageInput");
  const preview = document.getElementById("newMazobarBluePreview");
  if (!input || !preview) return;

  const value = String(input.value || "").trim();
  preview.src = value || getDefaultDeckImage();
}

function buildPlayString(parts) {
  return parts.map((part) => String(part ?? "").trim()).join("§");
}

function buildInitialDeckPlays({ deckId, userId, description, jokerType }) {
  const createdAt = getCurrentIsoDate();
  const normalizedDescription = String(description || "").trim();
  const plays = [];

  // A♥ fundador
  plays.push(
    buildPlayString([deckId, userId, createdAt, "A", "HEART", normalizedDescription, "SAVE"])
  );

  // Ases restantes
  if (jokerType === "RED") {
    plays.push(
      buildPlayString([deckId, userId, createdAt, "A", "SPADE", "", "SAVE"])
    );
    plays.push(
      buildPlayString([deckId, userId, createdAt, "A", "DIAMOND", "", "SAVE"])
    );
    plays.push(
      buildPlayString([deckId, userId, createdAt, "A", "CLUB", "", "SAVE"])
    );

    // Joker rojo: habilita K♥ y K♣ al creador
    plays.push(
      buildPlayString([deckId, userId, createdAt, "K", "HEART", "puedejugar", `U:${userId}`])
    );
    plays.push(
      buildPlayString([deckId, userId, createdAt, "K", "CLUB", "puedejugar", `U:${userId}`])
    );

    plays.push(
      buildPlayString([deckId, userId, createdAt, "JOKER", "RED", "SAVE"])
    );
  }

  if (jokerType === "BLUE") {
    // Con azul, los ases no corazón nacen habilitados
    plays.push(
      buildPlayString([deckId, userId, createdAt, "A", "SPADE", "puedejugar", `U:${userId}`])
    );
    plays.push(
      buildPlayString([deckId, userId, createdAt, "A", "DIAMOND", "puedejugar", `U:${userId}`])
    );
    plays.push(
      buildPlayString([deckId, userId, createdAt, "A", "CLUB", "puedejugar", `U:${userId}`])
    );

    // Y completa todos los reyes con puedejugar
    plays.push(
      buildPlayString([deckId, userId, createdAt, "K", "HEART", "puedejugar", `U:${userId}`])
    );
    plays.push(
      buildPlayString([deckId, userId, createdAt, "K", "SPADE", "puedejugar", `U:${userId}`])
    );
    plays.push(
      buildPlayString([deckId, userId, createdAt, "K", "DIAMOND", "puedejugar", `U:${userId}`])
    );
    plays.push(
      buildPlayString([deckId, userId, createdAt, "K", "CLUB", "puedejugar", `U:${userId}`])
    );

    plays.push(
      buildPlayString([deckId, userId, createdAt, "JOKER", "BLUE", "SAVE"])
    );
    plays.push(
      buildPlayString([deckId, userId, createdAt, "JOKER", "RED", "SAVE"])
    );
  }

  return plays;
}

function setSessionJugadas(plays) {
  window.sessionScope = window.sessionScope || {};
  window.sessionScope.jugadas = Array.isArray(plays) ? [...plays] : [];

  try {
    sessionStorage.setItem(
      "cooptrackSessionJugadas",
      JSON.stringify(window.sessionScope.jugadas)
    );
  } catch (error) {
    console.warn("No se pudieron guardar jugadas en sessionStorage:", error);
  }
}

function dispatchInitialPlaysReady({ deckId, plays }) {
  document.dispatchEvent(
    new CustomEvent("cooptrack:new-deck:plays-ready", {
      detail: {
        deckId,
        plays
      }
    })
  );
}

async function fetchLoggedUser(token) {
  try {
    const response = await fetch("https://cooptrack-backend.onrender.com/me", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data?.ok || !data?.user?.id) {
      throw new Error(data?.error || `Error HTTP ${response.status}`);
    }

    return data.user;
  } catch (error) {
    console.error("No se pudo obtener usuario autenticado:", error);
    return null;
  }
}

async function finalizeNewDeck() {
  const token = getAuthToken();

  if (!token) {
    window.alert("Necesitás iniciar sesión para crear un mazo.");
    window.location.href = "/login.html";
    return;
  }

  newMazobarState.isSaving = true;
  renderNewMazobar();

  try {
    const payload = {
      name: newMazobarState.draft.name,
      description: null,
      joker_type: newMazobarState.draft.jokerType || "RED",
      currency_code: newMazobarState.draft.currencyCode || "ARS",
      profile_photo_url: newMazobarState.draft.profilePhotoUrl || null
    };

    const response = await fetch("https://cooptrack-backend.onrender.com/decks", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data?.ok || !data?.deck?.id) {
      throw new Error(data?.message || data?.error || `Error HTTP ${response.status}`);
    }

    const user = await fetchLoggedUser(token);
    const userId = user?.id;

    if (!userId) {
      throw new Error("No se pudo identificar el usuario autenticado");
    }

    const initialPlays = buildInitialDeckPlays({
      deckId: data.deck.id,
      userId,
      description: newMazobarState.draft.name,
      jokerType: newMazobarState.draft.jokerType || "RED"
    });

    setSessionJugadas(initialPlays);
    dispatchInitialPlaysReady({
      deckId: data.deck.id,
      plays: initialPlays
    });

    console.log("Jugadas iniciales del mazo:", initialPlays);

    resetNewMazobarState();
    window.location.href = `/mazo.html?id=${data.deck.id}`;
  } catch (error) {
    console.error("Error creando mazo:", error);
    newMazobarState.isSaving = false;
    renderNewMazobar();
    window.alert("No se pudo crear el mazo.");
  }
}

function attachNewMazobarEvents() {
  document.getElementById("newMazobarCancelBtn")?.addEventListener("click", handleCancelNewMazobar);
  document.getElementById("newMazobarNameSaveBtn")?.addEventListener("click", handleSaveNameStep);

  document.getElementById("newMazobarNameInput")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleSaveNameStep();
    }
  });

  document.getElementById("newMazobarBackToNameBtn")?.addEventListener("click", () => {
    newMazobarState.step = "name";
    renderNewMazobar();
  });

  document.getElementById("newMazobarChooseRedBtn")?.addEventListener("click", handleChooseRedJoker);
  document.getElementById("newMazobarChooseBlueBtn")?.addEventListener("click", handleChooseBlueJoker);

  document.getElementById("newMazobarBackToJokerBtn")?.addEventListener("click", () => {
    newMazobarState.step = "joker";
    renderNewMazobar();
  });

  document.getElementById("newMazobarBlueSaveBtn")?.addEventListener("click", () => {
    const imageInput = document.getElementById("newMazobarBlueImageInput");
    newMazobarState.draft.profilePhotoUrl = String(imageInput?.value || "").trim();
    finalizeNewDeck();
  });

  document.getElementById("newMazobarBlueImageInput")?.addEventListener("input", () => {
    const imageInput = document.getElementById("newMazobarBlueImageInput");
    newMazobarState.draft.profilePhotoUrl = String(imageInput?.value || "").trim();
    handleBlueImagePreview();
  });

  document.getElementById("newMazobarBlueImageInput")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      const imageInput = document.getElementById("newMazobarBlueImageInput");
      newMazobarState.draft.profilePhotoUrl = String(imageInput?.value || "").trim();
      finalizeNewDeck();
    }
  });
}
