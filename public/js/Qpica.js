(function () {
  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function renderQpike(play, context = {}) {
    const helpers = context.helpers || {};
    const escape = helpers.escapeHtml || escapeHtml;

    const targetPhoto =
      play.target_user_profile_photo_url ||
      play.target_user_photo_url ||
      "/assets/icons/singeta120.gif";

    const targetName =
      play.target_user_nickname ||
      play.target_nickname ||
      `Usuario ${play.target_user_id || "—"}`;

    const status = String(play.play_status || "").toUpperCase();

    let statusLabel = "Pendiente";
    if (status === "SENT") statusLabel = "Enviada";
    if (status === "APPROVED") statusLabel = "Aceptada";
    if (status === "REJECTED") statusLabel = "Rechazada";
    if (status === "CANCELLED") statusLabel = "Cancelada";

    return `
      <article class="tablero-row tablero-row--qpike" id="tablero-row-${play.id}">
        <div class="tablero-row__left">
          <div class="tablero-row__card">Q♠</div>
        </div>

        <div class="tablero-row__center qpike-row__center">
          <img
            class="qpike-row__photo"
            src="${escape(targetPhoto)}"
            alt="${escape(targetName)}"
          />
          <div class="qpike-row__content">
            <div class="qpike-row__nickname">${escape(targetName)}</div>
            <div class="qpike-row__meta">${escape(statusLabel)}</div>
          </div>
        </div>

        <div class="tablero-row__right qpike-row__right">
          <img
            class="qpike-row__status-icon"
            src="/assets/icons/Qpike.gif"
            alt="Q de picas"
            title="Q de picas"
          />
        </div>
      </article>
    `;
  }

  window.renderQpike = renderQpike;
})();