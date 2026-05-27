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

  function normalizeRank(value) {
    return String(value || "").trim().toUpperCase();
  }

  function normalizeSuit(value) {
    return String(value || "").trim().toUpperCase();
  }

  function parsePlayCode(code) {
    const parts = String(code || "").split("§");

    return {
      rank: parts[3] || "",
      suit: parts[4] || "",
      action: parts[5] || "",
      flow: parts[7] || "",
      userId: parts[1] || ""
    };
  }

  function getCurrentUserId(state = null) {
    return Number(
      state?.userId ||
      state?.currentUser?.id ||
      window.__currentUser?.id ||
      window.__currentState?.currentUser?.id ||
      0
    );
  }

  function userOwnsPlayableAOrK(state = null) {
    const plays = Array.isArray(state?.plays)
      ? state.plays
      : Array.isArray(window.__currentState?.plays)
        ? window.__currentState.plays
        : [];

    const currentUserId = getCurrentUserId(state);

    if (!currentUserId) return false;

    return plays.some((p) => {
      const rank = normalizeRank(p?.card_rank || p?.rank);
      const suit = normalizeSuit(p?.card_suit || p?.suit);
      const status = normalizeRank(p?.play_status || p?.status);

      if (!["A", "K"].includes(rank)) return false;

      if (!["HEART", "SPADE", "DIAMOND", "CLUB"].includes(suit)) {
        return false;
      }

      if (["QUIT", "FIRED", "REJECTED", "CANCELLED"].includes(status)) {
        return false;
      }

      const ownerId = Number(
        p?.target_user_id ||
        p?.final_target_user_id ||
        p?.created_by_user_id ||
        0
      );

      return ownerId === currentUserId;
    });
  }
  function userCanPlayInDeck(deck, state = null) {
    if (!getToken()) return false;

    return !!window.__canPlay || userOwnsPlayableAOrK(state);
  }

  function buildPlayformHTML() {
    return `
    <section id="playform-j" class="playform ct-block ct-surface">

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

    openJPlayform();
  }

  window.renderPlayform = renderPlayform;
  window.clearPlayform = clearPlayform;
})();
