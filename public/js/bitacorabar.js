(function () {
  function getSuitSymbol(suit) {
    switch (String(suit || "").toUpperCase()) {
      case "HEART": return "♥";
      case "SPADE": return "♠";
      case "DIAMOND": return "♦";
      case "CLUB": return "♣";
      default: return "";
    }
  }

  function getSuitFilePart(suit) {
    switch (String(suit || "").toUpperCase()) {
      case "HEART": return "corazon";
      case "SPADE": return "pike";
      case "DIAMOND": return "diamante";
      case "CLUB": return "trebol";
      default: return null;
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

  function getBarConfig() {
    const custom = window.transversalBarConfig || {};

    return {
      containerId: custom.containerId || "bitacorabar-container",
      title: custom.title || "Bitácora",
      iconSrc: custom.iconSrc || "/assets/icons/maquina80.gif",
      iconAlt: custom.iconAlt || "Bitácora",
      searchPlaceholder: custom.searchPlaceholder || "Buscar en bitácora",
      searchInputId: custom.searchInputId || "bitacoraSearchInput",
      searchBtnId: custom.searchBtnId || "bitacoraSearchBtn",
      filterEventName: custom.filterEventName || "bitacora:filterSuit",
      searchEventName: custom.searchEventName || "bitacora:search",
      filterPrefix: custom.filterPrefix || "bitacora",
      suits: Array.isArray(custom.suits) && custom.suits.length
        ? custom.suits
        : ["HEART", "SPADE", "DIAMOND", "CLUB"],
      showSuitFilters: custom.showSuitFilters !== false
    };
  }

  function buildSuitButtonsHTML(config) {
    return config.suits.map((suit) => {
      const imgSrc = getSuitButtonImageSrc(suit);
      const symbol = getSuitSymbol(suit);

      if (imgSrc) {
        return `
          <button
            type="button"
            class="mazobar__cmd-btn mazobar__cmd-btn--suit bitacorabar__filter-btn"
            data-${config.filterPrefix}-suit="${suit}"
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
          data-${config.filterPrefix}-suit="${suit}"
          title="${symbol}"
          aria-label="${symbol}"
        >
          ${symbol}
        </button>
      `;
    }).join("");
  }

  function buildBitacorabarHTML(config) {
    return `
      <section class="bitacorabar">
        <div class="page-container">
          <div class="bitacorabar__shell">
            <div class="bitacorabar__row">

              <div class="bitacorabar__brand">
                <div class="bitacorabar__machine" aria-label="${config.iconAlt}">
                  <img
                    src="${config.iconSrc}"
                    alt="${config.iconAlt}"
                    class="bitacorabar__machine-icon"
                  />
                </div>

                <div class="bitacorabar__title">
                  ${config.title}
                </div>
              </div>

              <div class="mazobar__commands bitacorabar__filters">
                ${config.showSuitFilters ? buildSuitButtonsHTML(config) : ""}
              </div>

              <div class="bitacorabar__search">
                <input
                  id="${config.searchInputId}"
                  type="text"
                  class="bitacorabar__search-input"
                  placeholder="${config.searchPlaceholder}"
                  autocomplete="off"
                />

                <button
                  id="${config.searchBtnId}"
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

  function bindBitacorabarEvents(config) {
    document.querySelectorAll(`[data-${config.filterPrefix}-suit]`).forEach((button) => {
      button.addEventListener("click", () => {
        const suit = String(button.dataset[`${config.filterPrefix}Suit`] || "").toUpperCase();

        document.dispatchEvent(
          new CustomEvent(config.filterEventName, {
            detail: { suit }
          })
        );
      });
    });

    const searchInput = document.getElementById(config.searchInputId);
    const searchBtn = document.getElementById(config.searchBtnId);

    function runSearch() {
      const query = String(searchInput?.value || "").trim();

      document.dispatchEvent(
        new CustomEvent(config.searchEventName, {
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
    const config = getBarConfig();
    const container = document.getElementById(config.containerId);
    if (!container) return;

    container.innerHTML = buildBitacorabarHTML(config);
    bindBitacorabarEvents(config);
  }

  window.renderBitacorabar = renderBitacorabar;

  document.addEventListener("DOMContentLoaded", renderBitacorabar);
})();