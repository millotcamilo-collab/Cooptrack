function getCardImageSrc(cardCode) {
  const map = {
    A_HEART: "/assets/icons/Acorazon.gif",
    A_SPADE: "/assets/icons/Apike.gif",
    A_DIAMOND: "/assets/icons/Adiamante.gif",
    A_CLUB: "/assets/icons/Atrebol.gif",

    K_HEART: "/assets/icons/Kcorazon.gif",
    K_SPADE: "/assets/icons/Kpike.gif",
    K_DIAMOND: "/assets/icons/Kdiamante.gif",
    K_CLUB: "/assets/icons/Ktrebol.gif"
  };

  return map[String(cardCode || "").toUpperCase()] || null;
}

function getCardAlt(cardCode) {
  const map = {
    A_HEART: "A corazón",
    A_SPADE: "A pica",
    A_DIAMOND: "A diamante",
    A_CLUB: "A trébol",

    K_HEART: "K corazón",
    K_SPADE: "K pica",
    K_DIAMOND: "K diamante",
    K_CLUB: "K trébol"
  };

  return map[String(cardCode || "").toUpperCase()] || String(cardCode || "");
}

function getJokerImageSrc(jokerType) {
  return String(jokerType || "").toUpperCase() === "BLUE"
    ? "/assets/icons/joker_blue.gif"
    : "/assets/icons/Joker120.gif";
}

function getJokerAlt(jokerType) {
  return String(jokerType || "").toUpperCase() === "BLUE"
    ? "Joker azul"
    : "Joker rojo";
}

function renderCardsStack(cards) {
  const safeCards = Array.isArray(cards) ? cards.slice(0, 4) : [];

  if (!safeCards.length) {
    return `
      <div class="deck-row__cards deck-row__cards--empty"></div>
    `;
  }

  const cardsHtml = safeCards
    .map((cardCode, index) => {
      const src = getCardImageSrc(cardCode);
      const alt = getCardAlt(cardCode);

      if (!src) {
        return "";
      }

      return `
        <img
          src="${src}"
          class="deck-row__card deck-row__card--${index + 1}"
          alt="${alt}"
          title="${alt}"
        />
      `;
    })
    .join("");

  return `
    <div class="deck-row__cards">
      ${cardsHtml}
    </div>
  `;
}

function renderDeckRow(deck) {
  if (!deck) return "";

  const deckId = deck.id;
  const deckName = deck.name || "Mazo sin nombre";
  const photoUrl =
    (typeof deck.photoUrl === "string" && deck.photoUrl.trim()) ||
    (typeof deck.deck_image_url === "string" && deck.deck_image_url.trim()) ||
    (typeof deck.photo_url === "string" && deck.photo_url.trim()) ||
    (typeof deck.image_url === "string" && deck.image_url.trim()) ||
    "/assets/icons/sinPicture.gif";

  const jokerType = String(deck.joker || deck.joker_type || "RED").toUpperCase();
  const currentUserCards = Array.isArray(deck.currentUserCards)
    ? deck.currentUserCards
    : Array.isArray(deck.current_user_cards)
      ? deck.current_user_cards
      : [];

  const jokerSrc = getJokerImageSrc(jokerType);
  const jokerAlt = getJokerAlt(jokerType);

  return `
    <article class="deck-row" data-deck-id="${deckId}">
      <div class="deck-row__left">
        <div class="deck-row__joker-wrap">
          <img
            src="${jokerSrc}"
            class="deck-row__joker"
            alt="${jokerAlt}"
            title="${jokerAlt}"
          />
        </div>

        ${renderCardsStack(currentUserCards)}
      </div>

      <div class="deck-row__photo">
        <img
          src="${photoUrl}"
          class="deck-row__photo-img"
          alt="${deckName}"
          onerror="this.onerror=null; this.src='/assets/icons/sinPicture.gif';"
        />
      </div>

      <div class="deck-row__right">
        <div class="deck-row__name">
          ${deckName}
        </div>
      </div>
    </article>
  `;
}

function attachDeckRowEvents() {
  document.querySelectorAll(".deck-row").forEach((row) => {
    const deckId = row.dataset.deckId;

    row.addEventListener("click", () => {
      if (!deckId) return;
      window.location.href = `/mazo.html?id=${deckId}`;
    });
  });
}