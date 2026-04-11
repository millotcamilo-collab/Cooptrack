(function () {
  function getSuitSymbol(suit) {
    switch (String(suit || "").toUpperCase()) {
      case "HEART":
        return "♥";
      case "SPADE":
        return "♠";
      case "DIAMOND":
        return "♦";
      case "CLUB":
        return "♣";
      default:
        return "";
    }
  }

  function getSuitFilePart(suit) {
    switch (String(suit || "").toUpperCase()) {
      case "HEART":
        return "corazon";
      case "SPADE":
        return "pike";
      case "DIAMOND":
        return "diamante";
      case "CLUB":
        return "trebol";
      default:
        return null;
    }
  }

  function getSuitButtonImageSrc(suit) {
    const suitPart = getSuitFilePart(suit);
    if (!suitPart) return null;

    const map = {
      corazon: "/assets/icons/cor40.gif",
      pike: "/assets/icons/pik40.gif",
      diamante: "/assets/icons/dia40.gif",
      trebol: "/assets/icons/tre40.gif"
    };

    return map[suitPart] || null;
  }

  function buildSuitButtonsHTML() {
    const suits = ["HEART", "SPADE", "DIAMOND", "CLUB"];

    return suits.map((suit) => {
      const imgSrc = getSuitButtonImageSrc(suit);
      const symbol = getSuitSymbol(suit);

      if (imgSrc) {
        return `
          <button
            type="button"
            class="mazobar__cmd-btn mazobar__cmd-btn--suit bitacorabar__filter-btn"
            data-bitacora-suit="${suit}"
            title="${symbol}"
            aria-label="${symbol}"
          >
            <img src="${imgSrc}" alt="${symbol}" class="mazobar__cmd-icon" />
          </button>
        `;
      }

      return `
        <button
          type="button"
          class="mazobar__cmd-btn mazobar__cmd-btn--suit bitacorabar__filter-btn"
          data-bitacora-suit="${suit}"
          title="${symbol}"
          aria-label="${symbol}"
        >
          ${symbol}
        </button>
      `;
    }).join("");
  }

  function buildBitacorabarHTML() {
    return `
      <section class="bitacorabar">
        <div class="page-container">
          <div class="bitacorabar__shell">
            <div class="bitacorabar__row">

              <div class="bitacorabar__brand">
                <div class="bitacorabar__machine" aria-label="Bitácora">
                  <img
                    src="/assets/icons/maquina80.gif"
                    alt="Bitácora"
                    class="bitacorabar__machine-icon"
                  />
                </div>

                <div class="bitacorabar__title">
                  Bitácora
                </div>
              </div>

              <div class="mazobar__commands bitacorabar__filters">
                ${buildSuitButtonsHTML()}
              </div>

              <div class="bitacorabar__search">
                <input
                  id="bitacoraSearchInput"
                  type="text"
                  class="bitacorabar__search-input"
                  placeholder="Buscar en bitácora"
                  autocomplete="off"
                />

                <button
                  id="bitacoraSearchBtn"
                  type="button"
                  class="mazobar__cmd-btn bitacorabar__search-btn"
                  title="Buscar"
                  aria-label="Buscar"
                >
                  <img
                    src="/assets/icons/lupa60.gif"
                    alt="Buscar"
                    class="bitacorabar__search-icon"
                  />
                </button>
              </div>

            </div>
          </div>
        </div>
      </section>
    `;
  }

  function bindBitacorabarEvents() {
    document.querySelectorAll("[data-bitacora-suit]").forEach((button) => {
      button.addEventListener("click", () => {
        const suit = String(button.dataset.bitacoraSuit || "").toUpperCase();

        document.dispatchEvent(
          new CustomEvent("bitacora:filterSuit", {
            detail: { suit }
          })
        );
      });
    });

    const searchInput = document.getElementById("bitacoraSearchInput");
    const searchBtn = document.getElementById("bitacoraSearchBtn");

    function runSearch() {
      const query = String(searchInput?.value || "").trim();

      document.dispatchEvent(
        new CustomEvent("bitacora:search", {
          detail: { query }
        })
      );
    }

    searchBtn?.addEventListener("click", runSearch);

    searchInput?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        runSearch();
      }
    });
  }

  function renderBitacorabar() {
    const container = document.getElementById("bitacorabar-container");
    if (!container) return;

    container.innerHTML = buildBitacorabarHTML();
    bindBitacorabarEvents();
  }

  window.renderBitacorabar = renderBitacorabar;

  document.addEventListener("DOMContentLoaded", renderBitacorabar);
})();