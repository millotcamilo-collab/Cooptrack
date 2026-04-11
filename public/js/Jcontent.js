(function () {
  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatShortDateTime(value) {
    if (!value) return "—";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value ?? "");

    try {
      const parts = new Intl.DateTimeFormat("es-UY", {
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }).formatToParts(date);

      const map = {};
      parts.forEach((part) => {
        map[part.type] = part.value;
      });

      const weekday = String(map.weekday || "").replace(".", "");
      const day = map.day || "";
      const month = String(map.month || "").replace(".", "");
      const hour = map.hour || "";
      const minute = map.minute || "";

      const cap = (txt) =>
        txt ? txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase() : "";

      return `${cap(weekday)} ${day} ${cap(month)} ${hour}:${minute}`;
    } catch (error) {
      return String(value ?? "");
    }
  }

  function renderJcontent(play) {
    if (!play) return "";

    const text = play.play_text || play.text || "";
    const startDate = play.start_date || play.startDate || "";
    const location = play.location || play.place || "";

    return `
      <section class="jcontent-card">
        <div class="jcontent-card__row">
          <span class="jcontent-card__label">Contenido</span>
          <span class="jcontent-card__value">${escapeHtml(text || "—")}</span>
        </div>

        <div class="jcontent-card__row">
          <span class="jcontent-card__label">Fecha</span>
          <span class="jcontent-card__value">${formatShortDateTime(startDate)}</span>
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