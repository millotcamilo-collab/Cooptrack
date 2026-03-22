function renderDeckRow(deck) {
  if (!deck) return "";

  return `
    <article class="deck-row" data-deck-id="${deck.id}">
      <div class="deck-row__inner">

        <div class="deck-row__left">
          <div class="deck-row__card">
            A♥
          </div>
        </div>

        <div class="deck-row__center">
          <div class="deck-row__title">
            ${deck.name || "Mazo sin nombre"}
          </div>

          <div class="deck-row__meta">
            <span>ID: ${deck.id}</span>
          </div>
        </div>

        <div class="deck-row__right">
          <button class="deck-row__open-btn">
            Abrir →
          </button>
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

  document.querySelectorAll(".deck-row__open-btn").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.stopPropagation();

      const row = btn.closest(".deck-row");
      if (!row) return;

      const deckId = row.dataset.deckId;
      if (!deckId) return;

      window.location.href = `/mazo.html?id=${deckId}`;
    });
  });
}
