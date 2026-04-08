(function () {
  function renderJokerazul(play, context = {}) {
    const helpers = context.helpers || {};
    const escapeHtml = helpers.escapeHtml || ((v) => String(v ?? ""));

    const playId = Number(play?.id || 0);
    const deckId = Number(play?.deck_id || 0);
    const rowId = `tablero-row-${playId}`;

    const creator = escapeHtml(
      play?.created_by_nickname ||
      play?.createdByNickname ||
      "—"
    );

    const status = String(play?.play_status || "").toUpperCase();
    const action = String(
      play?.action || play?.parsed?.action || ""
    ).toLowerCase();

    const isBlueCurrent =
      status === "ACTIVE" || action === "init_joker_blue";

    const jokerSrc = isBlueCurrent
      ? "/assets/icons/joker_blue.gif"
      : "/assets/icons/Joker.gif";

    const jokerAlt = isBlueCurrent
      ? "Joker azul"
      : "Joker rojo";

    const title = isBlueCurrent
      ? "Joker azul"
      : "Joker";

    const subtitle = "Registro";

    setTimeout(() => {
      const row = document.getElementById(rowId);
      if (!row || row.dataset.bound === "true") return;

      row.dataset.bound = "true";

      row.style.cursor = "pointer";
      row.setAttribute("role", "button");
      row.setAttribute("tabindex", "0");
      row.setAttribute("aria-label", "Abrir solicitud de Joker azul");

      function openJokerBluePage() {
        if (!deckId) {
          console.warn("renderJokerazul: falta deckId");
          return;
        }

        window.location.href = `/nuevo-mazo.html?mode=jokerblue&deckId=${deckId}`;
      }

      row.addEventListener("click", openJokerBluePage);

      row.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openJokerBluePage();
        }
      });
    }, 0);

    return `
      <article class="tablero-row tablero-row--joker" id="${rowId}">
        <div class="tablero-row__left">
          <img
            src="${jokerSrc}"
            alt="${jokerAlt}"
            class="admin-row__joker-card"
          />
        </div>

        <div class="tablero-row__center">
          <div class="tablero-row__title">${escapeHtml(title)}</div>
          <div class="tablero-row__text">${escapeHtml(subtitle)}</div>

          <div class="tablero-row__meta">
            <span>${creator}</span>
            <span>${escapeHtml(status || "—")}</span>
          </div>
        </div>

        <div class="tablero-row__right">
          <span class="admin-row__joker-link">Abrir</span>
        </div>
      </article>
    `;
  }

  window.renderJokerazul = renderJokerazul;
})();