(function () {
  function getToken() {
    return localStorage.getItem("cooptrackToken");
  }

  function clearPlayform() {
    const container = document.getElementById("playform-container");
    if (!container) return;
    container.innerHTML = "";
  }

  function userCanPlayInDeck(deck, state = null) {
    if (!getToken()) return false;

    if (!state || !Array.isArray(state.plays)) {
      return true;
    }

    // Por ahora simple:
    // si existe el mazo y hay sesión, puede usar +J
    return true;
  }

  function buildPlayformHTML() {
    return `
      <section id="playform-j" class="playform is-hidden">
        <div class="page-container">
          <div class="playform__inner">

            <div class="playform__left">
              <div class="playform__prefix">J</div>

              <input
                id="playformTextInput"
                type="text"
                class="playform__input"
                placeholder="Escribí una jugada..."
                autocomplete="off"
              />
            </div>

            <div class="playform__center">
              <button
                type="button"
                class="playform__action-btn playform__action-btn--heart"
                data-play-suit="HEART"
                title="J♥"
              >
                ♥
              </button>

              <button
                type="button"
                class="playform__action-btn playform__action-btn--spade"
                data-play-suit="SPADE"
                title="J♠"
              >
                ♠
              </button>

              <button
                type="button"
                class="playform__action-btn playform__action-btn--club"
                data-play-suit="CLUB"
                title="J♣"
              >
                ♣
              </button>
            </div>

            <div class="playform__right">
              <button
                type="button"
                class="playform__exit-btn"
                id="playformClearBtn"
                title="Limpiar"
              >
                <img src="/assets/icons/exit40.gif" alt="Limpiar" />
              </button>
            </div>

          </div>
        </div>
      </section>
    `;
  }

  function dispatchCreatePlay(deck, state, suit, text) {
    document.dispatchEvent(
      new CustomEvent("playform:createPlay", {
        detail: {
          deck,
          state,
          suit,
          text
        }
      })
    );
  }

  function handlePlayformSave(deck, state, suit) {
    const input = document.getElementById("playformTextInput");
    if (!input) return;

    const text = input.value.trim();

    if (!text) {
      window.alert("Escribí algo antes de guardar la jugada.");
      input.focus();
      return;
    }

    dispatchCreatePlay(deck, state, suit, text);
    input.value = "";
  }

  function attachPlayformEvents(deck, state) {
    document.querySelectorAll("[data-play-suit]").forEach((button) => {
      button.addEventListener("click", () => {
        const suit = button.dataset.playSuit;
        if (!suit) return;
        handlePlayformSave(deck, state, suit);
      });
    });

    document.getElementById("playformClearBtn")?.addEventListener("click", () => {
      const input = document.getElementById("playformTextInput");
      if (input) input.value = "";
    });

    document.getElementById("playformTextInput")?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        handlePlayformSave(deck, state, "HEART");
      }
    });
  }

  document.addEventListener("mazobar:addJ", () => {
    const form = document.getElementById("playform-j");
    if (!form) return;

    form.classList.toggle("is-hidden");

    if (!form.classList.contains("is-hidden")) {
      const input = document.getElementById("playformTextInput");
      if (input) input.focus();
    }
  });

  function renderPlayform(deck, state = null) {
    const container = document.getElementById("playform-container");

    if (!container) {
      console.warn("playform-container no encontrado");
      return;
    }

    if (!userCanPlayInDeck(deck, state)) {
      container.innerHTML = "";
      return;
    }

    container.innerHTML = buildPlayformHTML();
    attachPlayformEvents(deck, state);
  }

  window.renderPlayform = renderPlayform;
  window.clearPlayform = clearPlayform;
})();
