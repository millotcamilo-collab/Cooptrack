(function () {
  function getToken() {
    return localStorage.getItem("cooptrackToken");
  }

  function setActivePlayform(value) {
    sessionStorage.setItem("activePlayform", value || "");
  }

  function getActivePlayform() {
    return sessionStorage.getItem("activePlayform") || "";
  }

  function isJPlayformOpen() {
    return getActivePlayform() === "J";
  }

  function openJPlayform() {
    const form = document.getElementById("playform-j");
    if (!form) return;

    form.classList.remove("is-hidden");
    setActivePlayform("J");

    const input = document.getElementById("playformTextInput");
    if (input) input.focus();
  }

  function closeJPlayform() {
    const form = document.getElementById("playform-j");
    if (!form) return;

    form.classList.add("is-hidden");
    setActivePlayform("");
  }

  function toggleJPlayform() {
    if (isJPlayformOpen()) {
      closeJPlayform();
    } else {
      openJPlayform();
    }
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

    return true;
  }

  function buildPlayformHTML() {
    return `
      <section id="playform-j" class="playform is-hidden">
        <div class="page-container">
          <div class="playform__inner">

<div class="playform__left">
  <img
    src="/assets/icons/maquina80.gif"
    alt="Nueva jugada"
    class="playform__icon"
  />

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
                title="Nota"
              >
                ♥
              </button>

              <button
                type="button"
                class="playform__action-btn playform__action-btn--spade"
                data-play-suit="SPADE"
                title="Actividad"
              >
                ♠
              </button>

              <button
                type="button"
                class="playform__action-btn playform__action-btn--club"
                data-play-suit="CLUB"
                title="Concepto factura"
              >
                ♣
              </button>
            </div>

            <div class="playform__right">
<button
  type="button"
  class="playform__exit-btn"
  id="playformCloseBtn"
  title="Cerrar"
>
  <img src="/assets/icons/exit40.gif" alt="Cerrar" />
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
    input.focus();
  }

  function attachPlayformEvents(deck, state) {
    document.querySelectorAll("[data-play-suit]").forEach((button) => {
      button.addEventListener("click", () => {
        const suit = button.dataset.playSuit;
        if (!suit) return;
        handlePlayformSave(deck, state, suit);
      });
    });

    document.getElementById("playformCloseBtn")?.addEventListener("click", () => {
      closeJPlayform();
    });

    document.getElementById("playformTextInput")?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        handlePlayformSave(deck, state, "HEART");
      }
    });
  }

  document.addEventListener("mazobar:addJ", () => {
    toggleJPlayform();
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

    if (isJPlayformOpen()) {
      openJPlayform();
    } else {
      closeJPlayform();
    }
  }

  window.renderPlayform = renderPlayform;
  window.clearPlayform = clearPlayform;
})();
