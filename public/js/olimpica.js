(function () {
  const TRIBUNA_NAME = "OLIMPICA";
  const ROLE_DESCRIPTION = "acciones del validador A♦";

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
      mode: "olimpica",
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

    // Placeholder para carga. Posteriormente usar tribuna-core.js.
    return {
      id: playId,
      type: "olimpica-play",
      title: `Tribuna Olimpica - jugada ${playId}`
    };
  }

  function renderTribuna(play) {
    if (!play) {
      return "";
    }

    return `
      <section class="tribuna tribuna--olimpica">
        <header class="tribuna__header">
          <h2>${escapeHtml(String(play.title || "Tribuna Olimpica"))}</h2>
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
    // Vincular eventos del validador A♦.
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

  window.OlimpicaTribuna = {
    init,
    loadPlay,
    renderTribuna,
    bindActions
  };
})();