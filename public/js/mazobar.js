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

function saveStoredDecks(decks) {
  localStorage.setItem("cooptrackDecks", JSON.stringify(decks));
}

function closeMazobar() {
  const container = document.getElementById("mazobar-container");
  if (!container) return;
  container.innerHTML = "";
}

function goHome() {
  window.location.href = "/index.html";
}

function getDefaultAcesForJoker(joker) {
  if (joker === "red") {
    return ["A_HEART", "A_SPADE", "A_DIAMOND", "A_CLUB"];
  }

  return [];
}

function getCardImage(cardType) {
  const map = {
    A_HEART: "/assets/icons/Acorazon.gif",
    A_SPADE: "/assets/icons/Apike.gif",
    A_DIAMOND: "/assets/icons/Adiamante.gif",
    A_CLUB: "/assets/icons/Atrebol.gif",
    JOKER_RED: "/assets/icons/Joker120.gif",
    JOKER_BLUE: "/assets/icons/joker_blue.gif",
    SPADE: "/assets/icons/pik40.gif",
    DIAMOND: "/assets/icons/dia40.gif",
    CLUB: "/assets/icons/tre40.gif",
    HEART: "/assets/icons/cor40.gif"
  };

  return map[cardType] || "/assets/icons/Joker120.gif";
}

function getCardLabel(cardType) {
  const map = {
    A_HEART: "A♥",
    A_SPADE: "A♠",
    A_DIAMOND: "A♦",
    A_CLUB: "A♣"
  };

  return map[cardType] || cardType;
}

function normalizeDeck(deck) {
  if (!deck) return null;

  const joker = deck.joker || "red";
  const aces =
    Array.isArray(deck.aces) && deck.aces.length > 0
      ? deck.aces
      : getDefaultAcesForJoker(joker);

  return {
    ...deck,
    joker,
    aces
  };
}

function buildUserCardsHTML(deck) {
  const normalizedDeck = normalizeDeck(deck);
  const joker = normalizedDeck?.joker || "red";
  const aces = normalizedDeck?.aces || [];

  const jokerHTML =
    joker === "blue"
      ? `
        <img
          src="${getCardImage("JOKER_BLUE")}"
          alt="Joker azul"
          class="mazobar__mini-card"
          title="Joker azul"
        />
      `
      : `
        <img
          src="${getCardImage("JOKER_RED")}"
          alt="Joker rojo"
          class="mazobar__mini-card"
          title="Joker rojo"
        />
      `;

  const acesHTML = aces
    .map(
      (aceType) => `
        <button
          class="mazobar__ace-btn"
          type="button"
          data-ace-type="${aceType}"
          title="${getCardLabel(aceType)}"
        >
          <img
            src="${getCardImage(aceType)}"
            alt="${getCardLabel(aceType)}"
            class="mazobar__mini-card"
          />
        </button>
      `
    )
    .join("");

  return `
    <div class="mazobar__user-cards">
      ${jokerHTML}
      ${acesHTML}
    </div>
  `;
}

function buildAcePlayPanelHTML(aceType) {
  return `
    <div class="mazobar__ace-panel" id="mazobarAcePanel">
      <div class="mazobar__ace-panel-header">
        <strong>${getCardLabel(aceType)}</strong>
      </div>

      <div class="mazobar__ace-panel-actions">
        <button
          type="button"
          class="mazobar__action-btn mazobar__ace-action"
          id="transferAceBtn"
          data-ace-type="${aceType}"
        >
          Transferir
        </button>

        <button
          type="button"
          class="mazobar__action-btn mazobar__ace-action"
          id="renounceAceBtn"
          data-ace-type="${aceType}"
        >
          Renunciar
        </button>

        <button
          type="button"
          class="mazobar__action-btn mazobar__ace-action"
          id="closeAcePanelBtn"
        >
          Cancelar
        </button>
      </div>
    </div>
  `;
}

function removeAcePlayPanel() {
  const panel = document.getElementById("mazobarAcePanel");
  if (panel) panel.remove();
}

function updateStoredDeck(deckId, updater) {
  const decks = getStoredDecks();
  const index = decks.findIndex((item) => String(item.id) === String(deckId));

  if (index === -1) return null;

  decks[index] = updater({ ...decks[index] });
  saveStoredDecks(decks);

  return decks[index];
}

function transferAce(deck, aceType) {
  const targetNickname = window.prompt(
    `Transferir ${getCardLabel(aceType)} a:`,
    ""
  );

  if (!targetNickname || !targetNickname.trim()) return;

  window.alert(
    `${getCardLabel(aceType)} preparado para transferencia a ${targetNickname.trim()}.`
  );

  removeAcePlayPanel();
}

function renounceAce(deck, aceType) {
  const confirmed = window.confirm(
    `¿Seguro que querés renunciar a ${getCardLabel(aceType)}?`
  );

  if (!confirmed) return;

  const updatedDeck = updateStoredDeck(deck.id, (storedDeck) => {
    const currentAces = Array.isArray(storedDeck.aces) ? storedDeck.aces : [];
    return {
      ...storedDeck,
      aces: currentAces.filter((item) => item !== aceType)
    };
  });

  if (updatedDeck) {
    renderMazobar("deck", normalizeDeck(updatedDeck));
  }

  removeAcePlayPanel();
}

function attachAcePanelEvents(deck, aceType) {
  document.getElementById("transferAceBtn")?.addEventListener("click", () => {
    transferAce(deck, aceType);
  });

  document.getElementById("renounceAceBtn")?.addEventListener("click", () => {
    renounceAce(deck, aceType);
  });

  document.getElementById("closeAcePanelBtn")?.addEventListener("click", () => {
    removeAcePlayPanel();
  });
}

function openAcePlay(deck, aceType) {
  removeAcePlayPanel();

  const host = document.getElementById("mazobar-ace-play-host");
  if (!host) return;

  host.innerHTML = buildAcePlayPanelHTML(aceType);
  attachAcePanelEvents(deck, aceType);
}

function attachDeckAceEvents(deck) {
  const aceButtons = document.querySelectorAll(".mazobar__ace-btn");

  aceButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const aceType = button.dataset.aceType;
      if (!aceType) return;
      openAcePlay(deck, aceType);
    });
  });
}

function buildDeckFinalRow(deck) {
  const normalizedDeck = normalizeDeck(deck);

  return `
    <section class="mazobar">
      <div class="page-container mazobar__inner mazobar__inner--deck">

        <div class="mazobar__left-group">
          ${buildUserCardsHTML(normalizedDeck)}
        </div>

        <div class="mazobar__photo">
          <img src="/assets/icons/singeta120.gif" alt="Foto del mazo" />
        </div>

        <div class="mazobar__right-group">
          <div class="mazobar__title mazobar__title--deck">
            <span class="mazobar__deck-name">${normalizedDeck.name}</span>
          </div>

          <div class="mazobar__suits">
            <img src="${getCardImage("HEART")}" alt="Corazones" />
            <img src="${getCardImage("SPADE")}" alt="Picas" />
            <img src="${getCardImage("DIAMOND")}" alt="Diamantes" />
            <img src="${getCardImage("CLUB")}" alt="Tréboles" />
          </div>
        </div>

      </div>

      <div class="page-container" id="mazobar-ace-play-host"></div>
    </section>
  `;
}

function renderMazobar(mode = "create", deck = null) {
  const container = document.getElementById("mazobar-container");

  if (!container) {
    console.warn("mazobar-container no encontrado");
    return;
  }

  let html = "";

  if (mode === "create") {
    html = `
      <section class="mazobar">
        <div class="page-container mazobar__inner">

          <div class="mazobar__card">
            <img src="/assets/icons/Acorazon.gif" alt="A corazón" />
          </div>

          <div class="mazobar__form">
            <input
              id="deckNameInput"
              type="text"
              placeholder="Nombre del mazo"
            />
          </div>

          <div class="mazobar__jokers">
            <img
              src="/assets/icons/Joker120.gif"
              class="joker-option"
              id="jokerRed"
              title="Joker rojo"
              alt="Joker rojo"
            />

            <img
              src="/assets/icons/joker_blue.gif"
              class="joker-option"
              id="jokerBlue"
              title="Joker azul"
              alt="Joker azul"
            />
          </div>

          <button class="mazobar__exit" id="mazoExitBtn" title="Salir">
            EXIT
          </button>

        </div>
      </section>
    `;

    container.innerHTML = html;

    document.getElementById("mazoExitBtn")?.addEventListener("click", () => {
      closeMazobar();
    });

    document.getElementById("jokerRed")?.addEventListener("click", () => {
      const deckName =
        document.getElementById("deckNameInput")?.value?.trim() || "Nuevo mazo";

      renderMazobar("confirm", {
        name: deckName,
        joker: "red",
        aces: ["A_HEART", "A_SPADE", "A_DIAMOND", "A_CLUB"]
      });
    });

    document.getElementById("jokerBlue")?.addEventListener("click", () => {
      const deckName =
        document.getElementById("deckNameInput")?.value?.trim() || "Nuevo mazo";

      renderMazobar("confirm", {
        name: deckName,
        joker: "blue",
        aces: []
      });
    });

    return;
  }

  if (mode === "confirm") {
    const normalizedDeck = normalizeDeck(deck);
    const jokerImage =
      normalizedDeck?.joker === "blue"
        ? "/assets/icons/joker_blue.gif"
        : "/assets/icons/Joker120.gif";

    const acesHTML = (normalizedDeck?.aces || [])
      .map(
        (aceType) => `
          <img src="${getCardImage(aceType)}" alt="${getCardLabel(aceType)}" />
        `
      )
      .join("");

    html = `
      <section class="mazobar">
        <div class="page-container mazobar__inner">

          <div class="mazobar__card">
            <img src="/assets/icons/Acorazon.gif" alt="A corazón" />
          </div>

          <div class="mazobar__title">
            ${normalizedDeck.name}
          </div>

          <div class="mazobar__cards">
            <img src="${jokerImage}" alt="Joker" />
            ${acesHTML}
          </div>

          <div class="mazobar__actions">

            <button class="mazobar__action-btn" id="confirmDeckBtn" title="Aprobar mazo">
              <img src="/assets/icons/Sello40.gif" alt="Aprobar mazo" />
            </button>

            <button class="mazobar__action-btn" id="editDeckBtn" title="Editar nombre">
              <img src="/assets/icons/desarrollo40.gif" alt="Editar mazo" />
            </button>

            <button class="mazobar__action-btn" id="exitDeckBtn" title="Salir al home">
              <img src="/assets/icons/exit120.gif" alt="Salir" />
            </button>

          </div>

        </div>
      </section>
    `;

    container.innerHTML = html;

    document.getElementById("confirmDeckBtn")?.addEventListener("click", () => {
      const storedDecks = getStoredDecks();

      const newDeck = {
        id: Date.now(),
        name: normalizedDeck.name,
        joker: normalizedDeck.joker || "red",
        aces: normalizedDeck.aces || []
      };

      storedDecks.push(newDeck);
      saveStoredDecks(storedDecks);

      if (typeof renderTopbar === "function") {
        renderTopbar();
      }

      goToMazoPage(newDeck, "HEART");
    });

    document.getElementById("editDeckBtn")?.addEventListener("click", () => {
      renderMazobar("create");
    });

    document.getElementById("exitDeckBtn")?.addEventListener("click", () => {
      goHome();
    });

    return;
  }

  if (mode === "deck") {
    const normalizedDeck = normalizeDeck(deck);
    html = buildDeckFinalRow(normalizedDeck);
    container.innerHTML = html;
    attachDeckAceEvents(normalizedDeck);
  }
}
