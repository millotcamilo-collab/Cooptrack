(function () {
  function renderJcorazon(play, context = {}) {
    const helpers = context.helpers || {};
    const escapeHtml = helpers.escapeHtml || ((v) => String(v ?? ""));
    const formatDate = helpers.formatDate || ((v) => String(v ?? ""));
    const dispatch =
      typeof context.dispatch === "function"
        ? context.dispatch
        : function (eventName, detail) {
            document.dispatchEvent(new CustomEvent(eventName, { detail }));
          };

    const playId = play?.id;
    const text = escapeHtml(play?.play_text || "");
    const author = escapeHtml(play?.createdByNickname || play?.created_by_nickname || "—");
    const date = formatDate(play?.displayDate || play?.created_at || "");
    const status = escapeHtml(play?.play_status || play?.status || "ACTIVE");

    const rowId = `tablero-row-${playId}`;

    setTimeout(() => {
      const row = document.getElementById(rowId);
      if (!row || row.dataset.bound === "true") return;

      row.dataset.bound = "true";

      row.querySelector('[data-action="change-to-spade"]')?.addEventListener("click", () => {
        dispatch("tablero:change-suit", {
          playId,
          nextSuit: "SPADE",
          currentSuit: "HEART",
        });
      });

      row.querySelector('[data-action="change-to-club"]')?.addEventListener("click", () => {
        dispatch("tablero:change-suit", {
          playId,
          nextSuit: "CLUB",
          currentSuit: "HEART",
        });
      });

      row.querySelector('[data-action="save-play"]')?.addEventListener("click", () => {
        dispatch("tablero:save-play", {
          playId,
        });
      });

      row.querySelector('[data-action="approve-play"]')?.addEventListener("click", () => {
        dispatch("tablero:approve-play", {
          playId,
        });
      });

      row.querySelector('[data-action="delete-play"]')?.addEventListener("click", () => {
        dispatch("tablero:delete-play", {
          playId,
        });
      });

      row.querySelector('[data-action="cancel-play"]')?.addEventListener("click", () => {
        dispatch("tablero:cancel-play", {
          playId,
        });
      });
    }, 0);

    return `
      <article class="tablero-row tablero-row--jcorazon" id="${rowId}">
        <div class="tablero-row__left">
          <div class="tablero-row__card">J♥</div>
        </div>

        <div class="tablero-row__center">
          <div class="tablero-row__title">${text || "Sin texto"}</div>

          <div class="tablero-row__meta">
            <span>Autor: ${author}</span>
            <span>Fecha: ${date}</span>
            <span>Estado: ${status}</span>
          </div>
        </div>

        <div class="tablero-row__right">
          <button type="button" data-action="change-to-spade">♠</button>
          <button type="button" data-action="change-to-club">♣</button>
          <button type="button" data-action="save-play">Salvar</button>
          <button type="button" data-action="approve-play">Aprobar</button>
          <button type="button" data-action="delete-play">Borrar</button>
          <button type="button" data-action="cancel-play">Cancel</button>
        </div>
      </article>
    `;
  }

  window.renderJcorazon = renderJcorazon;
})();
