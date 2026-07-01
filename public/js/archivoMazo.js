(function () {
  function normalizeStatus(value) {
    return String(value || "").trim().toUpperCase();
  }

  function normalizeRank(value) {
    return String(value || "").trim().toUpperCase();
  }

  function normalizeSuit(value) {
    return String(value || "").trim().toUpperCase();
  }

  function isArchivedPlay(play) {
    const rank = normalizeRank(play?.card_rank || play?.rank);
    const status = normalizeStatus(play?.play_status || play?.status);

    if (rank === "J") return ["CANCELLED", "REJECTED", "DELETED"].includes(status);
    if (rank === "Q") return ["REJECTED", "CANCELLED"].includes(status);
    if (rank === "K") return ["QUIT", "FIRED", "REJECTED", "CANCELLED"].includes(status);
    if (rank === "A") return ["REJECTED", "CANCELLED", "TRANSFERRED"].includes(status);

    return false;
  }

  function renderArchivoMazo(deck, plays, state = {}) {
    const container = document.getElementById("archivo-container");
    if (!container) return;

    const archived = (Array.isArray(plays) ? plays : [])
      .filter(isArchivedPlay);

    if (!archived.length) {
      container.innerHTML = `
        <section class="tablero">
          <p class="tablero-empty">No hay jugadas archivadas para este mazo.</p>
        </section>
      `;
      return;
    }

    container.innerHTML = `
      <section class="tablero">
        ${archived.map((play) => renderArchivedRow(play, deck, state)).join("")}
      </section>
    `;
  }

function renderArchivedRow(play, deck, state) {
  const rank = normalizeRank(play?.card_rank || play?.rank);
  const suit = normalizeSuit(play?.card_suit || play?.suit);

  const context = {
    deck,
    state,
    helpers: {
      escapeHtml
    }
  };

  // Use same J renderers as tablero.js
  if (rank === "J") {
    let rendererName = null;
    if (suit === "HEART") rendererName = "Jcorazon";
    else if (suit === "SPADE") rendererName = "Jpika";
    else if (suit === "CLUB") rendererName = "Jtrebol";
    else if (suit === "DIAMOND") rendererName = "Jdiamante";

    if (rendererName) {
      const renderer = window[`render${rendererName}`];
      if (typeof renderer === "function") {
        try {
          return renderer(play, context);
        } catch (error) {
          console.error(`Error renderizando ${rendererName}:`, error);
        }
      }
    }
  }

  if (rank === "Q" && typeof renderQpike === "function") {
    return renderQpike(play, context);
  }

  if (rank === "K" && typeof renderKrow === "function") {
    return renderKrow(play, context);
  }

  if (rank === "A" && typeof renderArow === "function") {
    return renderArow(play, context);
  }

  return renderArchivoMazoRow(play);
}

function renderArchivoMazoRow(play) {
  const rank = normalizeRank(play?.card_rank || play?.rank);
  const suit = normalizeSuit(play?.card_suit || play?.suit);
  const symbol = suitToSymbol(suit);
  const text = escapeHtml(play?.play_text || "Sin texto");
  const status = normalizeStatus(play?.play_status || play?.status || "");

  return `
    <article class="tablero-row tablero-row--fallback">
      <div class="tablero-row__left">
        <div class="tablero-row__card">${escapeHtml(rank)}${escapeHtml(symbol)}</div>
      </div>

      <div class="tablero-row__center">
        <div class="tablero-row__title">${text}</div>
        <div class="tablero-row__meta">Estado: ${escapeHtml(status)}</div>
      </div>

      <div class="tablero-row__right"></div>
    </article>
  `;
}

  function suitToSymbol(suit) {
    if (suit === "HEART") return "♥";
    if (suit === "SPADE") return "♠";
    if (suit === "DIAMOND") return "♦";
    if (suit === "CLUB") return "♣";
    return "";
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  window.renderArchivoMazo = renderArchivoMazo;
})();