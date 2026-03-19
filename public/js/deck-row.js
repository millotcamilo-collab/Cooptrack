function getCardImage(cardType) {
  const map = {
    A_HEART: "/assets/icons/Acorazon.gif",
    A_SPADE: "/assets/icons/Apike.gif",
    A_DIAMOND: "/assets/icons/Adiamante.gif",
    A_CLUB: "/assets/icons/Atrebol.gif",

    K_HEART: "/assets/icons/Kcorazon.gif",
    K_SPADE: "/assets/icons/Kpike.gif",
    K_DIAMOND: "/assets/icons/Kdiamante.gif",
    K_CLUB: "/assets/icons/Ktrebol.gif",

    J_HEART: "/assets/icons/Jcorazon.gif",
    J_SPADE: "/assets/icons/Jpike.gif",
    J_DIAMOND: "/assets/icons/Jdiamante.gif",
    J_CLUB: "/assets/icons/Jtrebol.gif",

    Q_HEART: "/assets/icons/Qcorazon.gif",
    Q_SPADE: "/assets/icons/Qpike.gif",
    Q_DIAMOND: "/assets/icons/Qdiamante.gif",
    Q_CLUB: "/assets/icons/Qtrebol.gif"
  };

  return map[cardType] || "/assets/icons/Joker120.gif";
}

function getCardShortLabel(cardType) {
  const map = {
    A_HEART: "A♥",
    A_SPADE: "A♠",
    A_DIAMOND: "A♦",
    A_CLUB: "A♣",

    K_HEART: "K♥",
    K_SPADE: "K♠",
    K_DIAMOND: "K♦",
    K_CLUB: "K♣",

    J_HEART: "J♥",
    J_SPADE: "J♠",
    J_DIAMOND: "J♦",
    J_CLUB: "J♣",

    Q_HEART: "Q♥",
    Q_SPADE: "Q♠",
    Q_DIAMOND: "Q♦",
    Q_CLUB: "Q♣"
  };

  return map[cardType] || cardType;
}

function getDeckRowImage(deck) {
  const joker = String(deck?.joker || "").toLowerCase();

  if (joker === "blue" && deck.jokerImageUrl) {
    return deck.jokerImageUrl;
  }

  if (deck.clubOwnerPhotoUrl) {
    return deck.clubOwnerPhotoUrl;
  }

  return "/assets/icons/singeta120.gif";
}

function getUserCards(deck) {
  if (!Array.isArray(deck.currentUserCards)) return [];

  return deck.currentUserCards.filter(
    (card) =>
      typeof card === "string" &&
      (card.startsWith("A_") || card.startsWith("K_"))
  );
}

function getSummaryCards(deck) {
  if (!Array.isArray(deck.summaryCards)) return [];

  return deck.summaryCards.filter(
    (card) =>
      typeof card === "string" &&
      (card.startsWith("J_") || card.startsWith("Q_"))
  );
}

function buildUserCardsHTML(deck) {
  const userCards = getUserCards(deck);

  if (!userCards.length) {
    return `<div class="deck-row__cards deck-row__cards--empty"></div>`;
  }

  return `
    <div class="deck-row__cards">
      ${userCards
        .map(
          (card) => `
            <img
              src="${getCardImage(card)}"
              alt="${getCardShortLabel(card)}"
              title="${getCardShortLabel(card)}"
              class="deck-row__card"
            />
          `
        )
        .join("")}
    </div>
  `;
}

function buildSummaryCardsHTML(deck) {
  const summaryCards = getSummaryCards(deck);

  if (!summaryCards.length) {
    return `
      <div class="deck-row__summary deck-row__summary--empty">
        <span class="deck-row__summary-placeholder">Sin J / Q todavía</span>
      </div>
    `;
  }

  return `
    <div class="deck-row__summary">
      ${summaryCards
        .map(
          (card) => `
            <span
              class="deck-row__summary-item"
              title="${getCardShortLabel(card)}"
            >
              ${getCardShortLabel(card)}
            </span>
          `
        )
        .join("")}
    </div>
  `;
}

function renderDeckRow(deck) {
  const imageUrl = getDeckRowImage(deck);

  return `
    <article class="deck-row" data-deck-id="${deck.id}">
      <div class="deck-row__left">
        ${buildUserCardsHTML(deck)}
      </div>

      <div class="deck-row__photo">
        <img src="${imageUrl}" alt="${deck.name}" class="deck-row__photo-img" />
      </div>

      <div class="deck-row__right">
        <div class="deck-row__name" title="${deck.name}">
          ${deck.name}
        </div>

        ${buildSummaryCardsHTML(deck)}
      </div>
    </article>
  `;
}

function attachDeckRowEvents() {
  const rows = document.querySelectorAll(".deck-row");

  rows.forEach((row) => {
    row.addEventListener("click", () => {
      const deckId = row.dataset.deckId;
      if (!deckId) return;

      const decks = JSON.parse(localStorage.getItem("cooptrackDecks") || "[]");
      const deck = decks.find((item) => String(item.id) === String(deckId));

      if (!deck) {
        console.warn("No se encontró el deck para navegar:", deckId);
        return;
      }

      if (typeof goToMazoPage === "function") {
        goToMazoPage(deck, "HEART");
        return;
      }

      sessionStorage.setItem("activeDeckId", String(deck.id));
      sessionStorage.setItem("activeDeckName", deck.name || "");
      sessionStorage.setItem("activeSuit", "HEART");
      window.location.href = "/mazo.html";
    });
  });
}
