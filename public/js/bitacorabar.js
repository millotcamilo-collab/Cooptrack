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

  function buildSuitButtonsHTML(config) {
    const suits = Array.isArray(config?.suits) && config.suits.length
      ? config.suits
      : ["HEART", "SPADE", "DIAMOND", "CLUB"];

    const filterPrefix = String(config?.filterPrefix || "transversal");

    return suits.map((suit) => {
      const imgSrc = getSuitButtonImageSrc(suit);
      const symbol = getSuitSymbol(suit);

      if (imgSrc) {
        return `
          <button
            type="button"
            class="mazobar__cmd-btn mazobar__cmd-btn--suit bitacorabar__filter-btn"
            data-${filterPrefix}-suit="${suit}"
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
          data-${filterPrefix}-suit="${suit}"
          title="${symbol}"
          aria-label="${symbol}"
        >
          ${symbol}
        </button>
      `;
    }).join("");
  }

  function buildTransversalBarHTML(config) {
    const title = String(config?.title || "Vista transversal");
    const iconSrc = String(config?.iconSrc || "");
    const iconAlt = String(config?.iconAlt || title);
    const searchPlaceholder = String(config?.searchPlaceholder || "Buscar");
    const searchInputId = String(config?.searchInputId || "transversalSearchInput");
    const searchBtnId = String(config?.searchBtnId || "transversalSearchBtn");
    const showSuitFilters = config?.showSuitFilters !== false;

    return `
      <section class="bitacorabar">
        <div class="page-container">
          <div class="bitacorabar__shell">
            <div class="bitacorabar__row">

              <div class="bitacorabar__brand">
                <div class="bitacorabar__machine" aria-label="${iconAlt}">
                  <img
                    src="${iconSrc}"
                    alt="${iconAlt}"
                    class="bitacorabar__machine-icon"
                  />
                </div>

                <div class="bitacorabar__title">
                  ${title}
                </div>
              </div>

              <div class="mazobar__commands bitacorabar__filters">
                ${showSuitFilters ? buildSuitButtonsHTML(config) : ""}
              </div>

              <div class="bitacorabar__search">
                <input
                  id="${searchInputId}"
                  type="text"
                  class="bitacorabar__search-input"
                  placeholder="${searchPlaceholder}"
                  autocomplete="off"
                />

                <button
                  id="${searchBtnId}"
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

  function bindTransversalBarEvents(config) {
    const filterPrefix = String(config?.filterPrefix || "transversal");
    const filterEventName = String(config?.filterEventName || "transversal:filterSuit");
    const searchEventName = String(config?.searchEventName || "transversal:search");
    const searchInputId = String(config?.searchInputId || "transversalSearchInput");
    const searchBtnId = String(config?.searchBtnId || "transversalSearchBtn");

    document.querySelectorAll(`[data-${filterPrefix}-suit]`).forEach((button) => {
      button.addEventListener("click", () => {
        const suit = String(button.dataset[`${filterPrefix}Suit`] || "").toUpperCase();

        document.dispatchEvent(
          new CustomEvent(filterEventName, {
            detail: { suit }
          })
        );
      });
    });

    const searchInput = document.getElementById(searchInputId);
    const searchBtn = document.getElementById(searchBtnId);

    function runSearch() {
      const query = String(searchInput?.value || "").trim();

      document.dispatchEvent(
        new CustomEvent(searchEventName, {
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

  function renderTransversalBar(config = {}) {
    const containerId = String(config?.containerId || "bitacorabar-container");
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = buildTransversalBarHTML(config);
    bindTransversalBarEvents(config);
  }

  window.renderTransversalBar = renderTransversalBar;
})();