// ===============================
// UTILIDADES (copiadas de mazobar)
// ===============================

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

// ===============================
// REGLAS DE NEGOCIO
// ===============================

// imagen del mazo
function getDeckRowImage(deck) {
  if (deck.joker === "blue" && deck.jokerImageUrl) {
    return deck.jokerImageUrl;
  }

  // fallback (acá después podés poner A_CLUB real desde backend)
  return deck.clubOwnerPhotoUrl || "/assets/icons/singeta120.gif";
}

// cartas visibles del usuario (A y K)
function getUserCards(deck) {
  if (!Array.isArray(deck.currentUserCards)) return [];

  return deck.currentUserCards.filter(
    (card) => card.startsWith("A_") || card.startsWith("K_")
  );
}

// resumen J/Q
function getSummaryCards(deck) {
  return deck.summaryCards || [];
}

// ===============================
// RENDER PRINCIPAL
// ===============================

function renderDeckRow(deck) {
  const imageUrl = getDeckRowImage(deck);
  const userCards = getUserCards(deck);
  const summaryCards = getSummaryCards(deck);

  // izquierda (A / K)
  const userCardsHTML = userCards
    .map(
      (card) => `
        <img 
          src="${getCardImage(card)}" 
          class="deck-row__card" 
          alt="${card}" 
        />
      `
    )
    .join("");

  // resumen (J / Q)
  const summaryHTML = summaryCards
    .map(
      (card) => `
        <img 
          src="${getCardImage(card)}" 
          class="deck-row__summary-card" 
          alt="${card}" 
        />
      `
    )
    .join("");

  return `
    <article class="deck-row" data-deck-id="${deck.id}">
      
      <!-- IZQUIERDA -->
      <div class="deck-row__left">
        ${userCardsHTML}
      </div>

      <!-- FOTO -->
      <div class="deck-row__photo">
        <img src="${imageUrl}" alt="${deck.name}" />
      </div>

      <!-- DERECHA -->
      <div class="deck-row__right">
        <div class="deck-row__name">
          ${deck.name}
        </div>

        <div class="deck-row__summary">
          ${summaryHTML}
        </div>
      </div>

    </article>
  `;
}

// ===============================
// EVENTOS
// ===============================

function attachDeckRowEvents() {
  document.querySelectorAll(".deck-row").forEach((row) => {
    row.addEventListener("click", () => {
      const deckId = row.dataset.deckId;

      if (!deckId) return;

      // reutilizamos tu navegación
      const decks = JSON.parse(localStorage.getItem("cooptrackDecks") || "[]");
      const deck = decks.find((d) => String(d.id) === String(deckId));

      if (!deck) return;

      if (typeof goToMazoPage === "function") {
        goToMazoPage(deck);
      } else {
        // fallback
        sessionStorage.setItem("activeDeckId", deck.id);
        window.location.href = "/mazo.html";
      }
    });
  });
}
