(function () {
  function renderJpike(play, context = {}) {
    const helpers = context.helpers || {};
    const escapeHtml = helpers.escapeHtml || ((v) => String(v ?? ""));
    const dispatch =
      typeof context.dispatch === "function"
        ? context.dispatch
        : function (eventName, detail) {
            document.dispatchEvent(new CustomEvent(eventName, { detail }));
          };

    const ICONS = window.ICONS || {};
    const ACTIONS = ICONS.actions || {};

    const state = context.state || {};
    const allPlays = Array.isArray(state.plays) ? state.plays : [];
    const currentUserId = Number(state.userId || 0);

    const playId = play?.id;
    const originalText = String(play?.play_text || "");
    const safeText = escapeHtml(originalText);
    const statusRaw = String(play?.play_status || play?.status || "ACTIVE").toUpperCase();
    const creatorUserId = Number(play?.created_by_user_id || 0);

    const spadeMode = String(play?.spade_mode || "").toUpperCase(); // APPOINTMENT | DEADLINE | ""
    const startDateValue = play?.start_date ? toInputDateTimeValue(play.start_date) : "";
    const endDateValue = play?.end_date ? toInputDateTimeValue(play.end_date) : "";
    const locationValue = String(play?.location || "");

    const rowId = `tablero-row-${playId}`;
    const textInputId = `jpike-text-${playId}`;

    function normalizeRank(value) {
      return String(value || "").trim().toUpperCase();
    }

    function normalizeSuit(value) {
      return String(value || "").trim().toUpperCase();
    }

    function isAliveStatus(value) {
      const status = String(value || "").trim().toUpperCase();
      return !["CANCELLED", "DELETED", "REJECTED"].includes(status);
    }

    function resolveSpadeAceHolderUserId(plays) {
      const aceSpadePlays = plays
        .filter((p) => {
          const rank = normalizeRank(p?.rank || p?.card_rank);
          const suit = normalizeSuit(p?.suit || p?.card_suit);
          return rank === "A" && suit === "SPADE" && isAliveStatus(p?.play_status);
        })
        .sort((a, b) => Number(b?.id || 0) - Number(a?.id || 0));

      if (!aceSpadePlays.length) return null;

      const latest = aceSpadePlays[0];

      if (latest?.target_user_id) return Number(latest.target_user_id);
      if (latest?.created_by_user_id) return Number(latest.created_by_user_id);

      return null;
    }

    function validateFields(mode, startDate, endDate, location) {
      const normalizedMode = String(mode || "").toUpperCase();

      if (normalizedMode === "APPOINTMENT") {
        return {
          ok: !!startDate && !!String(location || "").trim(),
          error: "Para aprobar o salvar una cita, fecha inicio y locación son obligatorias."
        };
      }

      if (normalizedMode === "DEADLINE") {
        return {
          ok: !!endDate,
          error: "Para aprobar o salvar una deadline, fecha fin es obligatoria."
        };
      }

      return {
        ok: false,
        error: "Primero elegí si la J♠ es cita o deadline."
      };
    }

    const spadeAceHolderUserId = resolveSpadeAceHolderUserId(allPlays);
    const userIsSpadeAceHolder =
      spadeAceHolderUserId !== null &&
      currentUserId !== 0 &&
      spadeAceHolderUserId === currentUserId;

    const userIsCreator =
      creatorUserId !== 0 &&
      currentUserId !== 0 &&
      creatorUserId === currentUserId;

    const userCanEdit = userIsCreator || userIsSpadeAceHolder;
    const isApproved = statusRaw === "APPROVED";
    const isCancelled = statusRaw === "CANCELLED";

    const bombIcon = escapeHtml(ACTIONS.bomb || "");
    const startIcon = escapeHtml(ACTIONS.start || "");
    const endIcon = escapeHtml(ACTIONS.end || "");
    const locationIcon = escapeHtml(ACTIONS.location || "");
    const saveIcon = escapeHtml(ACTIONS.save || "");
    const approveIcon = escapeHtml(ACTIONS.approve || "");
    const deleteIcon = escapeHtml(ACTIONS.delete || "");
    const editIcon = escapeHtml(ACTIONS.edit || "");
    const exitIcon = escapeHtml(ACTIONS.exit || ACTIONS.cancel || "");

    setTimeout(() => {
      const row = document.getElementById(rowId);
      if (!row || row.dataset.bound === "true") return;

      row.dataset.bound = "true";
      row.dataset.mode = spadeMode ? "read" : "choose";
      row.dataset.spadeMode = spadeMode || "";

      const textView = row.querySelector('[data-role="text-view"]');
      const textInput = row.querySelector('[data-role="text-input"]');

      const modeRead = row.querySelector('[data-role="mode-read"]');
      const modeChoose = row.querySelector('[data-role="mode-choose"]');
      const modeEdit = row.querySelector('[data-role="mode-edit"]');

      const btnChooseAppointment = row.querySelector('[data-action="choose-appointment"]');
      const btnChooseDeadline = row.querySelector('[data-action="choose-deadline"]');
      const btnEdit = row.querySelector('[data-action="edit-play"]');
      const btnSave = row.querySelector('[data-action="save-play"]');
      const btnApprove = row.querySelector('[data-action="approve-play"]');
      const btnDelete = row.querySelector('[data-action="delete-play"]');
      const btnExit = row.querySelector('[data-action="exit-edit"]');

      const appointmentFields = row.querySelector('[data-role="appointment-fields"]');
      const deadlineFields = row.querySelector('[data-role="deadline-fields"]');

      const startDateInput = row.querySelector('[data-role="start-date"]');
      const appointmentEndDateInput = row.querySelector('[data-role="appointment-end-date"]');
      const deadlineEndDateInput = row.querySelector('[data-role="deadline-end-date"]');
      const locationInput = row.querySelector('[data-role="location"]');

      function getCurrentText() {
        return String(textInput?.value || "").trim();
      }

      function getCurrentMode() {
        return String(row.dataset.spadeMode || "").toUpperCase();
      }

      function getFieldValues() {
        const currentMode = getCurrentMode();

        const startDate = String(startDateInput?.value || "").trim();
        const location = String(locationInput?.value || "").trim();

        let endDate = "";
        if (currentMode === "APPOINTMENT") {
          endDate = String(appointmentEndDateInput?.value || "").trim();
        } else if (currentMode === "DEADLINE") {
          endDate = String(deadlineEndDateInput?.value || "").trim();
        }

        return {
          startDate,
          endDate,
          location,
        };
      }

      function setVisualMode(mode) {
        row.dataset.mode = mode;
      }

      function setSpadeMode(mode) {
        row.dataset.spadeMode = String(mode || "").toUpperCase();
      }

      function renderMode() {
        const visualMode = row.dataset.mode || "choose";
        const currentMode = getCurrentMode();
        const isChoose = visualMode === "choose";
        const isEdit = visualMode === "edit";
        const isRead = visualMode === "read";

        if (modeChoose) modeChoose.style.display = isChoose ? "flex" : "none";
        if (modeRead) modeRead.style.display = isRead ? "flex" : "none";
        if (modeEdit) modeEdit.style.display = isEdit ? "flex" : "none";

        if (textView) textView.style.display = isEdit ? "none" : "";
        if (textInput) textInput.style.display = isEdit ? "block" : "none";

        if (appointmentFields) {
          appointmentFields.style.display =
            (isEdit || isRead) && currentMode === "APPOINTMENT" ? "flex" : "none";
        }

        if (deadlineFields) {
          deadlineFields.style.display =
            (isEdit || isRead) && currentMode === "DEADLINE" ? "flex" : "none";
        }

        if (isCancelled) {
          if (btnChooseAppointment) btnChooseAppointment.style.display = "none";
          if (btnChooseDeadline) btnChooseDeadline.style.display = "none";
          if (btnEdit) btnEdit.style.display = "none";
          if (btnSave) btnSave.style.display = "none";
          if (btnApprove) btnApprove.style.display = "none";
          if (btnDelete) btnDelete.style.display = "none";
          if (btnExit) btnExit.style.display = "none";

          if (textView) textView.style.display = "";
          if (textInput) textInput.style.display = "none";

          setInputsReadOnly(true);
          return;
        }

        if (btnChooseAppointment) {
          btnChooseAppointment.style.display = (!isApproved && isChoose) ? "inline-flex" : "none";
        }

        if (btnChooseDeadline) {
          btnChooseDeadline.style.display = (!isApproved && isChoose) ? "inline-flex" : "none";
        }

        if (btnEdit) {
          btnEdit.style.display =
            (!isApproved && isRead && userCanEdit && !!currentMode) ? "inline-flex" : "none";
        }

        if (btnSave) {
          btnSave.style.display = (!isApproved && isEdit && !!currentMode) ? "inline-flex" : "none";
        }

        if (btnExit) {
          btnExit.style.display = (!isApproved && isEdit) ? "inline-flex" : "none";
        }

        if (btnApprove) {
          btnApprove.style.display =
            (!isApproved && !!currentMode && userIsSpadeAceHolder && (isRead || isEdit))
              ? "inline-flex"
              : "none";
        }

        if (btnDelete) {
          btnDelete.style.display = !isApproved ? "inline-flex" : "none";
        }

        if (isEdit && textInput) {
          textInput.focus();
          textInput.select();
        }

        setInputsReadOnly(isRead);
      }

      function setInputsReadOnly(readOnly) {
        [
          textInput,
          startDateInput,
          appointmentEndDateInput,
          deadlineEndDateInput,
          locationInput
        ].forEach((input) => {
          if (!input) return;
          input.readOnly = !!readOnly;
          input.disabled = false;
        });
      }

      function buildPayload() {
        const currentMode = getCurrentMode();
        const { startDate, endDate, location } = getFieldValues();

        return {
          playId,
          text: getCurrentText(),
          spadeMode: currentMode,
          startDate,
          endDate,
          location,
        };
      }

      btnChooseAppointment?.addEventListener("click", () => {
        setSpadeMode("APPOINTMENT");
        setVisualMode("edit");
        renderMode();
      });

      btnChooseDeadline?.addEventListener("click", () => {
        setSpadeMode("DEADLINE");
        setVisualMode("edit");
        renderMode();
      });

      btnEdit?.addEventListener("click", () => {
        setVisualMode("edit");
        renderMode();
      });

      btnSave?.addEventListener("click", () => {
  const payload = buildPayload();
  const check = validateFields(
    payload.spadeMode,
    payload.startDate,
    payload.endDate,
    payload.location
  );

  if (!check.ok) {
    alert(check.error);
    return;
  }

  dispatch("tablero:save-play", payload);

  // 👇 CLAVE: volver a modo lectura inmediatamente
  setVisualMode("read");
  renderMode();
});

      btnApprove?.addEventListener("click", () => {
        const payload = buildPayload();
        const check = validateFields(
          payload.spadeMode,
          payload.startDate,
          payload.endDate,
          payload.location
        );

        if (!check.ok) {
          alert(check.error);
          return;
        }

        dispatch("tablero:approve-play", payload);
      });

      btnDelete?.addEventListener("click", () => {
        dispatch("tablero:delete-play", {
          playId,
        });
      });

      btnExit?.addEventListener("click", () => {
        if (textInput) textInput.value = originalText;
        if (startDateInput) startDateInput.value = startDateValue;
        if (appointmentEndDateInput) appointmentEndDateInput.value = endDateValue;
        if (deadlineEndDateInput) deadlineEndDateInput.value = endDateValue;
        if (locationInput) locationInput.value = locationValue;

        setSpadeMode(spadeMode || "");
        setVisualMode(spadeMode ? "read" : "choose");
        renderMode();
      });

      textInput?.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          btnSave?.click();
        }
        if (event.key === "Escape") {
          event.preventDefault();
          btnExit?.click();
        }
      });

      renderMode();
    }, 0);

    return `
      <article class="tablero-row tablero-row--jpike" id="${rowId}">
        <div class="tablero-row__left">
          <div class="tablero-row__card">J♠</div>
        </div>

        <div class="tablero-row__center">
          <div class="tablero-row__title" data-role="text-view">${safeText || "Sin texto"}</div>

          <input
            id="${textInputId}"
            type="text"
            class="tablero-row__inline-input"
            data-role="text-input"
            value="${safeText}"
            style="display:none;"
          />

          <div class="tablero-row__mode-read" data-role="mode-read"></div>
          <div class="tablero-row__mode-choose" data-role="mode-choose"></div>
          <div class="tablero-row__mode-edit" data-role="mode-edit"></div>

          <div
            class="tablero-row__fields tablero-row__fields--appointment"
            data-role="appointment-fields"
            style="display:none;"
          >
            <div class="tablero-row__field-inline">
              <img src="${startIcon}" alt="Inicio" class="tablero-row__field-icon" />
              <input
                type="datetime-local"
                value="${escapeHtml(startDateValue)}"
                data-role="start-date"
              />
            </div>

            <div class="tablero-row__field-inline">
              <img src="${endIcon}" alt="Fin" class="tablero-row__field-icon" />
              <input
                type="datetime-local"
                value="${escapeHtml(endDateValue)}"
                data-role="appointment-end-date"
              />
            </div>

            <div class="tablero-row__field-inline">
              <img src="${locationIcon}" alt="Locación" class="tablero-row__field-icon" />
              <input
                type="text"
                value="${escapeHtml(locationValue)}"
                data-role="location"
                placeholder="Locación"
              />
            </div>
          </div>

          <div
            class="tablero-row__fields tablero-row__fields--deadline"
            data-role="deadline-fields"
            style="display:none;"
          >
            <div class="tablero-row__field-inline">
              <img src="${bombIcon}" alt="Deadline" class="tablero-row__field-icon" />
              <input
                type="datetime-local"
                value="${escapeHtml(endDateValue)}"
                data-role="deadline-end-date"
              />
            </div>
          </div>
        </div>

        <div class="tablero-row__right">
          <button type="button" data-action="choose-appointment" title="Cita">
            <img src="${startIcon}" alt="Cita" />
          </button>

          <button type="button" data-action="choose-deadline" title="Deadline">
            <img src="${bombIcon}" alt="Deadline" />
          </button>

          <button type="button" data-action="edit-play" title="Editar" style="display:none;">
            <img src="${editIcon}" alt="Editar" />
          </button>

          <button type="button" data-action="save-play" title="Salvar" style="display:none;">
            <img src="${saveIcon}" alt="Salvar" />
          </button>

          <button type="button" data-action="exit-edit" title="Salir edición" style="display:none;">
            <img src="${exitIcon}" alt="Salir edición" />
          </button>

          <button type="button" data-action="approve-play" title="Aprobar" style="display:none;">
            <img src="${approveIcon}" alt="Aprobar" />
          </button>

          <button type="button" data-action="delete-play" title="Borrar">
            <img src="${deleteIcon}" alt="Borrar" />
          </button>
        </div>
      </article>
    `;
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
