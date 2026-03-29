function renderDeckRow(deck) {
  if (!deck) return "";

  const photoUrl =
    (typeof deck.deck_image_url === "string" && deck.deck_image_url.trim()) ||
    (typeof deck.photo_url === "string" && deck.photo_url.trim()) ||
    (typeof deck.image_url === "string" && deck.image_url.trim()) ||
    "/assets/icons/sinPicture.gif";

  const deckName = deck.name || "Mazo sin nombre";

  return `
    <article class="deck-row" data-deck-id="${deck.id}">
      <div class="deck-row__left">
        <div class="deck-row__cards">
          <img
            src="/assets/icons/Acorazon.gif"
            class="deck-row__card"
            alt="A corazón"
          />
        </div>
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

function attachDeckRowEvents() {
  document.querySelectorAll(".deck-row").forEach((row) => {
    const deckId = row.dataset.deckId;

    row.addEventListener("click", () => {
      if (!deckId) return;
      window.location.href = `/mazo.html?id=${deckId}`;
    });
  });
}
