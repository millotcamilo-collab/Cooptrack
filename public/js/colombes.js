(function () {
  const TRIBUNA_NAME = "COLOMBES";
  const ROLE_DESCRIPTION = "acciones del creador/anfitrión";

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
    // Inicialización ligera de la tribuna.
    // Más adelante puede delegarse a tribuna-core.js para compartir lógica.
    const config = {
      mode: "colombes",
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

    // Placeholder: en el futuro, usar tribuna-core.js para hacer la carga.
    // Ejemplo: return TribunaCore.loadPlay(playId);
    return {
      id: playId,
      type: "colombes-play",
      title: `Tribuna Colombes - jugada ${playId}`
    };
  }

  function renderTribuna(play) {
    if (!play) {
      return "";
    }

    // Esta parte puede usar funciones comunes de render en tribuna-core.js.
    return `
      <section class="tribuna tribuna--colombes">
        <header class="tribuna__header">
          <h2>${escapeHtml(String(play.title || "Tribuna Colombes"))}</h2>
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
    // Vincular botones y comportamientos para el creador/anfitrión.
    // Más adelante podría reutilizar bindCommonActions(play).
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

  window.ColombesTribuna = {
    init,
    loadPlay,
    renderTribuna,
    bindActions
  };
})();