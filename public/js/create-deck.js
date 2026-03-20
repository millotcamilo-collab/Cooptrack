function renderCreateDeckForm() {
  const container = document.getElementById("create-deck-container");
  if (!container) return;

  container.innerHTML = `
    <section class="create-deck">
      <div class="create-deck__page-container">

        <div class="create-deck__card">

          <div class="create-deck__header">
            <h2 class="create-deck__title">Nuevo mazo</h2>
          </div>

          <form id="createDeckForm" class="create-deck__form">

            <div class="create-deck__field">
              <label>Nombre del mazo</label>
              <input
                type="text"
                id="deckName"
                placeholder="Escribí el nombre del mazo..."
                required
              />
            </div>

            <div class="create-deck__field">
              <label>Tipo de Joker</label>
              <div class="create-deck__radio-group">
                <label>
                  <input type="radio" name="jokerType" value="RED" checked />
                  Joker rojo
                </label>
                <label>
                  <input type="radio" name="jokerType" value="BLUE" />
                  Joker azul
                </label>
              </div>
            </div>

            <div class="create-deck__field">
              <label>Moneda base</label>
              <select id="currency">
                <option value="ARS">ARS</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </div>

            <div class="create-deck__actions">
              <button type="button" id="cancelCreateDeck">Cancelar</button>
              <button type="submit">Crear mazo</button>
            </div>

          </form>

        </div>
      </div>
    </section>
  `;

  attachCreateDeckEvents();
}

function attachCreateDeckEvents() {
  document
    .getElementById("createDeckForm")
    ?.addEventListener("submit", (e) => {
      e.preventDefault();

      const name = document.getElementById("deckName").value.trim();
      const jokerType = document.querySelector(
        "input[name='jokerType']:checked"
      )?.value;
      const currency = document.getElementById("currency").value;

      if (!name) {
        alert("El nombre del mazo es obligatorio");
        return;
      }

      const newDeck = {
        id: Date.now(),
        name,
        jokerType,
        currency,
        plays: [],
        aces: [],
        kings: []
      };

      const decks = getStoredDecks();
      decks.unshift(newDeck);
      saveStoredDecks(decks);

      window.location.href = "/mazo.html?id=" + newDeck.id;
    });

  document
    .getElementById("cancelCreateDeck")
    ?.addEventListener("click", () => {
      window.location.href = "/mazos.html";
    });
}
