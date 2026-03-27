(function () {
  function renderJpike(play, context = {}) {
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

    const spadeMode = String(play?.spade_mode || "").toUpperCase();
    const startDateValue = play?.start_date ? toInputDateTimeValue(play.start_date) : "";
    const endDateValue = play?.end_date ? toInputDateTimeValue(play.end_date) : "";
    const locationValue = play?.location || "";

    const rowId = `tablero-row-${playId}`;

    setTimeout(() => {
      const row = document.getElementById(rowId);
      if (!row || row.dataset.bound === "true") return;

      row.dataset.bound = "true";

      row.querySelector('[data-action="choose-appointment"]')?.addEventListener("click", () => {
        dispatch("tablero:spade-mode-selected", {
          playId,
          spadeMode: "APPOINTMENT"
        });
      });

      row.querySelector('[data-action="choose-deadline"]')?.addEventListener("click", () => {
        dispatch("tablero:spade-mode-selected", {
          playId,
          spadeMode: "DEADLINE"
        });
      });

      row.querySelector('[data-action="save-play"]')?.addEventListener("click", () => {
        const payload = collectSpadeFields(row, playId, spadeMode);
        dispatch("tablero:save-play", payload);
      });

      row.querySelector('[data-action="approve-play"]')?.addEventListener("click", () => {
        const payload = collectSpadeFields(row, playId, spadeMode);
        dispatch("tablero:approve-play", payload);
      });

      row.querySelector('[data-action="edit-play"]')?.addEventListener("click", () => {
        dispatch("tablero:edit-play", {
          playId,
          spadeMode
        });
      });

      row.querySelector('[data-action="delete-play"]')?.addEventListener("click", () => {
        dispatch("tablero:delete-play", {
          playId
        });
      });

      row.querySelector('[data-action="cancel-play"]')?.addEventListener("click", () => {
        dispatch("tablero:cancel-play", {
          playId
        });
      });
    }, 0);

    if (!spadeMode) {
      return `
        <article class="tablero-row tablero-row--jpike" id="${rowId}">
          <div class="tablero-row__left">
            <div class="tablero-row__card">J♠</div>
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
            <button type="button" data-action="choose-appointment">Cita</button>
            <button type="button" data-action="choose-deadline">Deadline</button>
            <button type="button" data-action="delete-play">Borrar</button>
          </div>
        </article>
      `;
    }

    if (spadeMode === "APPOINTMENT") {
      return `
        <article class="tablero-row tablero-row--jpike" id="${rowId}">
          <div class="tablero-row__left">
            <div class="tablero-row__card">J♠</div>
          </div>

          <div class="tablero-row__center">
            <div class="tablero-row__title">${text || "Sin texto"}</div>

            <div class="tablero-row__fields">
              <label class="tablero-row__field">
                <span>Fecha inicio</span>
                <input
                  type="datetime-local"
                  value="${escapeHtml(startDateValue)}"
                  data-role="start-date"
                />
              </label>

              <label class="tablero-row__field">
                <span>Fecha fin</span>
                <input
                  type="datetime-local"
                  value="${escapeHtml(endDateValue)}"
                  data-role="end-date"
                />
              </label>

              <label class="tablero-row__field">
                <span>Locación</span>
                <input
                  type="text"
                  value="${escapeHtml(locationValue)}"
                  data-role="location"
                />
              </label>
            </div>

            <div class="tablero-row__meta">
              <span>Modo: Cita</span>
              <span>Autor: ${author}</span>
              <span>Fecha: ${date}</span>
              <span>Estado: ${status}</span>
            </div>
          </div>

          <div class="tablero-row__right">
            <button type="button" data-action="save-play">Salvar</button>
            <button type="button" data-action="approve-play">Aprobar</button>
            <button type="button" data-action="edit-play">Editar</button>
            <button type="button" data-action="delete-play">Borrar</button>
            <button type="button" data-action="cancel-play">Cancelar</button>
          </div>
        </article>
      `;
    }

    return `
      <article class="tablero-row tablero-row--jpike" id="${rowId}">
        <div class="tablero-row__left">
          <div class="tablero-row__card">J♠</div>
        </div>

        <div class="tablero-row__center">
          <div class="tablero-row__title">${text || "Sin texto"}</div>

          <div class="tablero-row__fields">
            <label class="tablero-row__field">
              <span>Fecha fin</span>
              <input
                type="datetime-local"
                value="${escapeHtml(endDateValue)}"
                data-role="end-date"
              />
            </label>

            <label class="tablero-row__field">
              <span>Locación</span>
              <input
                type="text"
                value="${escapeHtml(locationValue)}"
                data-role="location"
              />
            </label>
          </div>

          <div class="tablero-row__meta">
            <span>Modo: Deadline</span>
            <span>Autor: ${author}</span>
            <span>Fecha: ${date}</span>
            <span>Estado: ${status}</span>
          </div>
        </div>

        <div class="tablero-row__right">
          <button type="button" data-action="save-play">Salvar</button>
          <button type="button" data-action="approve-play">Aprobar</button>
          <button type="button" data-action="edit-play">Editar</button>
          <button type="button" data-action="delete-play">Borrar</button>
          <button type="button" data-action="cancel-play">Cancelar</button>
        </div>
      </article>
    `;
  }

  function collectSpadeFields(row, playId, spadeMode) {
    const startDate = row.querySelector('[data-role="start-date"]')?.value || "";
    const endDate = row.querySelector('[data-role="end-date"]')?.value || "";
    const location = row.querySelector('[data-role="location"]')?.value || "";

    return {
      playId,
      spadeMode,
      startDate,
      endDate,
      location
    };
  }

  function toInputDateTimeValue(value) {
    if (!value) return "";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";

    const pad = (n) => String(n).padStart(2, "0");

    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());

    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  window.renderJpike = renderJpike;
})();
