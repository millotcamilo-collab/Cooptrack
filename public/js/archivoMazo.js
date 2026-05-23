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

  const context = {
    deck,
    state,
    helpers: {
      escapeHtml
    }
  };

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