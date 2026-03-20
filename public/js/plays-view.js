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

function clearPlaysView() {
  const container = document.getElementById("plays-view-container");
  if (!container) return;
  container.innerHTML = "";
}

function normalizeDeckPlays(deck) {
  if (!deck || !Array.isArray(deck.plays)) return [];
  return deck.plays;
}

function formatPlayDate(value) {
  if (!value) return "";

  try {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "";

    return date.toLocaleString("es-UY", {
      day: "numeric",
      month: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit"
    });
  } catch (error) {
    console.error("Error formateando fecha:", error);
    return "";
  }
}

function getSuitSymbolFromCardType(cardType) {
  switch (cardType) {
    case "J_HEART":
      return "♥";
    case "J_SPADE":
      return "♠";
    case "J_CLUB":
      return "♣";
    case "J_DIAMOND":
      return "♦";
    default:
      return "";
  }
}

function getSuitClassFromCardType(cardType) {
  switch (cardType) {
    case "J_HEART":
      return "heart";
    case "J_SPADE":
      return "spade";
    case "J_CLUB":
      return "club";
    case "J_DIAMOND":
      return "diamond";
    default:
      return "";
  }
}

function getPlayMainText(play) {
  if (!play) return "";
  return play.title || play.description || play.text || "(sin texto)";
}

function isPlayApproved(play) {
  return play?.isApproved === true || play?.approvalStatus === "APPROVED";
}

function isPlayRejected(play) {
  return play?.isRejected === true || play?.approvalStatus === "REJECTED";
}

function getApprovalStatusLabel(play) {
  if (isPlayApproved(play)) return "Aprobada";
  if (isPlayRejected(play)) return "Rechazada";
  return "Pendiente de aprobación";
}

function getAceTypeForPlay(play) {
  switch (play?.cardType) {
    case "J_HEART":
      return "A_HEART";
    case "J_SPADE":
      return "A_SPADE";
    case "J_CLUB":
      return "A_CLUB";
    case "J_DIAMOND":
      return "A_DIAMOND";
    default:
      return null;
  }
}

function getCurrentUserAuthorityCards(deck, currentUser) {
  if (!deck || !currentUser) return [];

  if (Array.isArray(deck.currentUserCards)) {
    return deck.currentUserCards.filter((card) => typeof card === "string");
  }

  const cards = [];

  if (Array.isArray(deck.aces)) {
    cards.push(...deck.aces.filter((card) => typeof card === "string"));
  }

  if (Array.isArray(deck.kings)) {
    cards.push(...deck.kings.filter((card) => typeof card === "string"));
  }

  return cards;
}

function currentUserHasRequiredAce(deck, currentUser, play) {
  const aceType = getAceTypeForPlay(play);
  if (!aceType) return false;

  const currentUserCards = getCurrentUserAuthorityCards(deck, currentUser);
  return currentUserCards.includes(aceType);
}

function isPlayAuthor(play, currentUser) {
  if (!play || !currentUser) return false;
  return String(play.createdByUserId) === String(currentUser.id);
}

function canCurrentUserManagePendingPlay(deck, play, currentUser) {
  if (!play || !currentUser) return false;
  if (isPlayApproved(play)) return false;

  return (
    isPlayAuthor(play, currentUser) ||
    currentUserHasRequiredAce(deck, currentUser, play)
  );
}

function canCurrentUserApprovePlay(deck, play, currentUser) {
  if (!play || !currentUser) return false;
  if (isPlayApproved(play)) return false;
  return currentUserHasRequiredAce(deck, currentUser, play);
}

function canCurrentUserRejectPlay(deck, play, currentUser) {
  if (!play || !currentUser) return false;
  if (isPlayApproved(play)) return false;
  if (isPlayAuthor(play, currentUser)) return false;

  return currentUserHasRequiredAce(deck, currentUser, play);
}

function getDeckIndexById(decks, deckId) {
  return decks.findIndex((item) => String(item.id) === String(deckId));
}

function getPlayIndexById(plays, playId) {
  return plays.findIndex((item) => String(item.id) === String(playId));
}

function updatePlayInLocalDeck(deckId, playId, updater) {
  const decks = getStoredDecksSync();
  const deckIndex = getDeckIndexById(decks, deckId);

  if (deckIndex === -1) {
    console.warn("No se encontró el mazo:", deckId);
    return null;
  }

  if (!Array.isArray(decks[deckIndex].plays)) {
    decks[deckIndex].plays = [];
  }

  const playIndex = getPlayIndexById(decks[deckIndex].plays, playId);

  if (playIndex === -1) {
    console.warn("No se encontró la jugada:", playId);
    return null;
  }

  const currentPlay = decks[deckIndex].plays[playIndex];
  const updatedPlay = updater({ ...currentPlay });

  decks[deckIndex].plays[playIndex] = updatedPlay;
  saveStoredDecksSync(decks);

  return {
    updatedPlay,
    updatedDeck: decks[deckIndex]
  };
}

function removePlayFromLocalDeck(deckId, playId) {
  const decks = getStoredDecksSync();
  const deckIndex = getDeckIndexById(decks, deckId);

  if (deckIndex === -1) {
    console.warn("No se encontró el mazo:", deckId);
    return null;
  }

  if (!Array.isArray(decks[deckIndex].plays)) {
    decks[deckIndex].plays = [];
  }

  decks[deckIndex].plays = decks[deckIndex].plays.filter(
    (item) => String(item.id) !== String(playId)
  );

  saveStoredDecksSync(decks);

  return decks[deckIndex];
}

function rerenderDeckAfterPlayChange(deckId) {
  const decks = getStoredDecksSync();
  const updatedDeck = decks.find((item) => String(item.id) === String(deckId));

  if (!updatedDeck) {
    console.warn("No se encontró el mazo actualizado:", deckId);
    return;
  }

  if (typeof renderPlaysView === "function") {
    renderPlaysView(updatedDeck);
  }

  if (typeof renderPlayform === "function") {
    renderPlayform(updatedDeck);
  }

  if (typeof renderDeckView === "function") {
    renderDeckView(updatedDeck);
  }
}

function handleEditPlay(deck, play) {
  const currentUser = getLoggedUser();

  if (!canCurrentUserManagePendingPlay(deck, play, currentUser)) return;

  const nextText = window.prompt("Editar jugada", getPlayMainText(play));

  if (nextText === null) return;

  const trimmed = nextText.trim();

  if (!trimmed) {
    window.alert("La jugada no puede quedar vacía.");
    return;
  }

  updatePlayInLocalDeck(deck.id, play.id, (currentPlay) => ({
    ...currentPlay,
    title: trimmed,
    description: trimmed,
    text: trimmed,
    updatedAt: new Date().toISOString()
  }));

  rerenderDeckAfterPlayChange(deck.id);
}

function handleConvertHeartToClub(deck, play) {
  const currentUser = getLoggedUser();

  if (!canCurrentUserManagePendingPlay(deck, play, currentUser)) return;
  if (play.cardType !== "J_HEART") return;

  updatePlayInLocalDeck(deck.id, play.id, (currentPlay) => ({
    ...currentPlay,
    cardType: "J_CLUB",
    suit: "CLUB",
    recordKind: "ASSET",
    updatedAt: new Date().toISOString()
  }));

  rerenderDeckAfterPlayChange(deck.id);
}

function handleConvertHeartToSpade(deck, play) {
  const currentUser = getLoggedUser();

  if (!canCurrentUserManagePendingPlay(deck, play, currentUser)) return;
  if (play.cardType !== "J_HEART") return;

  updatePlayInLocalDeck(deck.id, play.id, (currentPlay) => ({
    ...currentPlay,
    cardType: "J_SPADE",
    suit: "SPADE",
    recordKind: "ACTIVITY",
    updatedAt: new Date().toISOString()
  }));

  rerenderDeckAfterPlayChange(deck.id);
}

function handleApprovePlay(deck, play) {
  const currentUser = getLoggedUser();

  if (!canCurrentUserApprovePlay(deck, play, currentUser)) return;

  updatePlayInLocalDeck(deck.id, play.id, (currentPlay) => ({
    ...currentPlay,
    isApproved: true,
    isRejected: false,
    approvalStatus: "APPROVED",
    lifecycleStatus: "APPROVED",
    visibleToDeck: true,
    approvedAt: new Date().toISOString(),
    approvedByUserId: currentUser?.id || null,
    updatedAt: new Date().toISOString()
  }));

  rerenderDeckAfterPlayChange(deck.id);
}

function handleRejectPlay(deck, play) {
  const currentUser = getLoggedUser();

  if (!canCurrentUserRejectPlay(deck, play, currentUser)) return;

  updatePlayInLocalDeck(deck.id, play.id, (currentPlay) => ({
    ...currentPlay,
    isApproved: false,
    isRejected: true,
    approvalStatus: "REJECTED",
    lifecycleStatus: "REJECTED",
    visibleToDeck: false,
    rejectedAt: new Date().toISOString(),
    rejectedByUserId: currentUser?.id || null,
    updatedAt: new Date().toISOString()
  }));

  rerenderDeckAfterPlayChange(deck.id);
}

function handleDeletePlay(deck, play) {
  const currentUser = getLoggedUser();

  if (!canCurrentUserManagePendingPlay(deck, play, currentUser)) return;

  const confirmed = window.confirm("¿Querés borrar esta jugada?");
  if (!confirmed) return;

  removePlayFromLocalDeck(deck.id, play.id);
  rerenderDeckAfterPlayChange(deck.id);
}

function buildPlayActionsHTML(deck, play, currentUser) {
  if (isPlayApproved(play)) {
    return "";
  }

  const canManage = canCurrentUserManagePendingPlay(deck, play, currentUser);
  const canApprove = canCurrentUserApprovePlay(deck, play, currentUser);
  const canReject = canCurrentUserRejectPlay(deck, play, currentUser);

  if (!canManage && !canApprove && !canReject) {
    return "";
  }

  if (play.cardType === "J_HEART") {
    return `
      <div class="play-row__actions">
        ${
          canManage
            ? `
              <button type="button" class="play-row__action-btn" data-play-action="edit" data-play-id="${play.id}" title="Editar">
                <img src="/assets/icons/desarrollo40.gif" alt="Editar" />
              </button>

              <button type="button" class="play-row__action-btn" data-play-action="to-club" data-play-id="${play.id}" title="Convertir en bien">
                <img src="/assets/icons/tre40.gif" alt="Convertir en bien" />
              </button>

              <button type="button" class="play-row__action-btn" data-play-action="to-spade" data-play-id="${play.id}" title="Convertir en actividad">
                <img src="/assets/icons/pik40.gif" alt="Convertir en actividad" />
              </button>
            `
            : ""
        }

        ${
          canApprove
            ? `
              <button type="button" class="play-row__action-btn" data-play-action="approve" data-play-id="${play.id}" title="Aprobar">
                <img src="/assets/icons/Sello40.gif" alt="Aprobar" />
              </button>
            `
            : ""
        }

        ${
          canReject
            ? `
              <button type="button" class="play-row__action-btn" data-play-action="reject" data-play-id="${play.id}" title="Rechazar">
                <img src="/assets/icons/stepback40.gif" alt="Rechazar" />
              </button>
            `
            : ""
        }

        ${
          canManage
            ? `
              <button type="button" class="play-row__action-btn" data-play-action="delete" data-play-id="${play.id}" title="Borrar">
                <img src="/assets/icons/papelera80.gif" alt="Borrar" />
              </button>
            `
            : ""
        }
      </div>
    `;
  }

  if (play.cardType === "J_CLUB") {
    return `
      <div class="play-row__actions">
        ${
          canManage
            ? `
              <button type="button" class="play-row__action-btn" data-play-action="delete" data-play-id="${play.id}" title="Borrar">
                <img src="/assets/icons/papelera80.gif" alt="Borrar" />
              </button>
            `
            : ""
        }

        ${
          canApprove
            ? `
              <button type="button" class="play-row__action-btn" data-play-action="approve" data-play-id="${play.id}" title="Aprobar">
                <img src="/assets/icons/Sello40.gif" alt="Aprobar" />
              </button>
            `
            : ""
        }

        ${
          canReject
            ? `
              <button type="button" class="play-row__action-btn" data-play-action="reject" data-play-id="${play.id}" title="Rechazar">
                <img src="/assets/icons/stepback40.gif" alt="Rechazar" />
              </button>
            `
            : ""
        }
      </div>
    `;
  }

  if (play.cardType === "J_SPADE") {
    return `
      <div class="play-row__actions">
        ${
          canManage
            ? `
              <button type="button" class="play-row__action-btn" data-play-action="delete" data-play-id="${play.id}" title="Borrar">
                <img src="/assets/icons/papelera80.gif" alt="Borrar" />
              </button>
            `
            : ""
        }

        ${
          canApprove
            ? `
              <button type="button" class="play-row__action-btn" data-play-action="approve" data-play-id="${play.id}" title="Aprobar">
                <img src="/assets/icons/Sello40.gif" alt="Aprobar" />
              </button>
            `
            : ""
        }

        ${
          canReject
            ? `
              <button type="button" class="play-row__action-btn" data-play-action="reject" data-play-id="${play.id}" title="Rechazar">
                <img src="/assets/icons/stepback40.gif" alt="Rechazar" />
              </button>
            `
            : ""
        }
      </div>
    `;
  }

  return "";
}

function buildPlayRowHTML(deck, play, currentUser) {
  const suitSymbol = getSuitSymbolFromCardType(play.cardType);
  const suitClass = getSuitClassFromCardType(play.cardType);
  const text = getPlayMainText(play);
  const nickname = play.createdByNickname || "Usuario";
  const createdAt = formatPlayDate(play.createdAt);
  const statusLabel = getApprovalStatusLabel(play);

  return `
    <article class="play-row ${isPlayApproved(play) ? "play-row--approved" : "play-row--pending"}" data-play-id="${play.id}">
      <div class="play-row__main">
        <div class="play-row__card">
          <span class="play-row__rank">J</span>
          <span class="play-row__suit play-row__suit--${suitClass}">${suitSymbol}</span>
        </div>

        <div class="play-row__body">
          <div class="play-row__text">${text}</div>

          <div class="play-row__meta">
            <span class="play-row__author">${nickname}</span>
            <span class="play-row__date">${createdAt}</span>
            <span class="play-row__status">${statusLabel}</span>
          </div>
        </div>
      </div>

      ${buildPlayActionsHTML(deck, play, currentUser)}
    </article>
  `;
}

function attachPlayRowEvents(deck) {
  const container = document.getElementById("plays-view-container");
  if (!container) return;

  container.querySelectorAll("[data-play-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const playId = button.dataset.playId;
      const action = button.dataset.playAction;

      if (!playId || !action) return;

      const currentDecks = getStoredDecksSync();
      const currentDeck =
        currentDecks.find((item) => String(item.id) === String(deck.id)) || deck;

      const plays = normalizeDeckPlays(currentDeck);
      const play = plays.find((item) => String(item.id) === String(playId));

      if (!play) return;

      if (action === "edit") {
        handleEditPlay(currentDeck, play);
        return;
      }

      if (action === "to-club") {
        handleConvertHeartToClub(currentDeck, play);
        return;
      }

      if (action === "to-spade") {
        handleConvertHeartToSpade(currentDeck, play);
        return;
      }

      if (action === "approve") {
        handleApprovePlay(currentDeck, play);
        return;
      }

      if (action === "reject") {
        handleRejectPlay(currentDeck, play);
        return;
      }

      if (action === "delete") {
        handleDeletePlay(currentDeck, play);
      }
    });
  });
}

function buildEmptyPlaysHTML() {
  return `
    <section class="plays-view-empty">
      <div class="page-container">
        <div class="plays-view-empty__box">
          Todavía no hay jugadas en este mazo.
        </div>
      </div>
    </section>
  `;
}

function renderPlaysView(deck) {
  const container = document.getElementById("plays-view-container");
  if (!container) {
    console.warn("plays-view-container no encontrado");
    return;
  }

  const currentUser = getLoggedUser();
  const plays = normalizeDeckPlays(deck);

  if (!plays.length) {
    container.innerHTML = buildEmptyPlaysHTML();
    return;
  }

  const rowsHTML = plays
    .map((play) => buildPlayRowHTML(deck, play, currentUser))
    .join("");

  container.innerHTML = `
    <section class="plays-view">
      <div class="page-container">
        <div class="plays-view__list">
          ${rowsHTML}
        </div>
      </div>
    </section>
  `;

  attachPlayRowEvents(deck);
}
