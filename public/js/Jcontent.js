(function () {
  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatShortDate(value) {
    if (!value) return "—";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return escapeHtml(value);

    try {
      return date.toLocaleString("es-UY", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch (error) {
      return escapeHtml(value);
    }
  }

  function renderJcontent(play) {
    if (!play) return "";

    const text = play.play_text || play.text || "";
    const startDate = play.start_date || play.startDate || "";
    const endDate = play.end_date || play.endDate || "";
    const location = play.location || play.place || "";

    return `
      <section class="jcontent-card">
        <div class="jcontent-card__row">
          <span class="jcontent-card__label">Contenido</span>
          <span class="jcontent-card__value">${escapeHtml(text || "—")}</span>
        </div>

        <div class="jcontent-card__row">
          <span class="jcontent-card__label">Inicio</span>
          <span class="jcontent-card__value">${formatShortDate(startDate)}</span>
        </div>

        <div class="jcontent-card__row">
          <span class="jcontent-card__label">Fin</span>
          <span class="jcontent-card__value">${formatShortDate(endDate)}</span>
        </div>

        <div class="jcontent-card__row">
          <span class="jcontent-card__label">Lugar</span>
          <span class="jcontent-card__value">${escapeHtml(location || "—")}</span>
        </div>
      </section>
    `;
  }

  window.renderJcontent = renderJcontent;
})();