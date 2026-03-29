function renderDeckRow(deck) {
  if (!deck) return "";

  const photoUrl = deck.photo_url && deck.photo_url.trim() !== ""
    ? deck.photo_url
    : "/assets/icons/sinPicture.gif";

  return `
    <article class="deck-row" data-deck-id="${deck.id}">
      
      <div class="deck-row__left">
        <div class="deck-row__cards">
          <img src="/assets/icons/Acorazon.gif" class="deck-row__card" />
        </div>
      </div>

      <div class="deck-row__photo">
        <img
          src="${photoUrl}"
          class="deck-row__photo-img"
        />
      </div>

      <div class="deck-row__right">
        <div class="deck-row__name">
          ${deck.name || "Mazo sin nombre"}
        </div>

        <div class="deck-row__summary">
          <span class="deck-row__summary-item">
            ID: ${deck.id}
          </span>
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
