(function () {
  const TRIBUNA_NAME = "AMERICA";
  const ROLE_DESCRIPTION = "acciones del validador A♣";

  // Candidatas a tribuna-core.js:
  // - parseUrlParams()
  // - fetchPlayData(playId)
  // - fetchDeckData(deckId)
  // - renderPlayCardBox(play)
  // - renderPlacard(play)
  // - renderTalud(play)
  // - normalizePlay(play)
  // - bindCommonActions(container, play)

  function init(options = {}) {
    const config = {
      mode: "america",
      role: ROLE_DESCRIPTION,
      ...options
    };

    return {
      name: TRIBUNA_NAME,
      config
    };
  }

  async function loadPlay(playId) {
    if (!playId) {
      return null;
    }

    // Placeholder de carga. En el futuro, delegar a tribuna-core.js.
    return {
      id: playId,
      type: "america-play",
      title: `Tribuna America - jugada ${playId}`
    };
  }

  function renderTribuna(play) {
    if (!play) {
      return "";
    }

    return `
      <section class="tribuna tribuna--america">
        <header class="tribuna__header">
          <h2>${escapeHtml(String(play.title || "Tribuna America"))}</h2>
          <p>${escapeHtml(ROLE_DESCRIPTION)}</p>
        </header>

        <main class="tribuna__stage">
          <!-- renderPlayCardBox(play) -->
          <div class="tribuna__play-card">
            <span>Play #${escapeHtml(String(play.id))}</span>
          </div>
        </main>
      </section>
    `;
  }

  function bindActions(play) {
    // Vincular eventos específicos del validador A♣.
    return;
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  window.AmericaTribuna = {
    init,
    loadPlay,
    renderTribuna,
    bindActions
  };
})();