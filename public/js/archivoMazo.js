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
    const container = document.getElementById("tablero-container");
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
        ${archived.map(renderArchivoMazoRow).join("")}
      </section>
    `;
  }

  function renderArchivoMazoRow(play) {
    const rank = normalizeRank(play?.card_rank || play?.rank);
    const suit = normalizeSuit(play?.card_suit || play?.suit);
    const status = normalizeStatus(play?.play_status || play?.status);
    const text = String(play?.play_text || "Sin texto");

    return `
      <article class="tablero-row tablero-row--archived">
        <div class="tablero-row__left">
          <div class="tablero-row__card">${rank}${suitToSymbol(suit)}</div>
        </div>

        <div class="tablero-row__center">
          <div class="tablero-row__title">${escapeHtml(text)}</div>
          <div class="tablero-row__meta">${escapeHtml(status)}</div>
        </div>
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