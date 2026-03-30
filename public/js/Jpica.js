(function () {
  function isFutureDate(value) {
    if (!value) return false;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return false;
    return date.getTime() > Date.now();
  }

function formatRecurrenceSuffix(type, weekdays, months) {
  const normalizedType = String(type || "").toUpperCase();

  const weekdayMap = {
    MON: "Lun",
    TUE: "Mar",
    WED: "Mié",
    THU: "Jue",
    FRI: "Vie",
    SAT: "Sáb",
    SUN: "Dom"
  };

  const monthMap = {
    1: "Ene",
    2: "Feb",
    3: "Mar",
    4: "Abr",
    5: "May",
    6: "Jun",
    7: "Jul",
    8: "Ago",
    9: "Sep",
    10: "Oct",
    11: "Nov",
    12: "Dic"
  };

  if (normalizedType === "WEEKLY" && Array.isArray(weekdays) && weekdays.length) {
    const labels = weekdays
      .map((day) => weekdayMap[String(day).toUpperCase()] || String(day))
      .filter(Boolean);

    return labels.length ? labels.join(", ") : "";
  }

  if (normalizedType === "MONTHLY" && Array.isArray(months) && months.length) {
    const labels = months
      .map((month) => monthMap[Number(month)] || String(month))
      .filter(Boolean);

    return labels.length ? labels.join(", ") : "";
  }

  return "";
}

function appendRecurrenceLabel(baseLabel, recurrenceType, weekdays, months) {
  const suffix = formatRecurrenceSuffix(recurrenceType, weekdays, months);

  if (!suffix) return baseLabel;

  return `${baseLabel} · ${suffix}`;
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

function getHoursBetween(startValue, endValue) {
  if (!startValue || !endValue) return null;

  const start = new Date(startValue);
  const end = new Date(endValue);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;

  const diffMs = end.getTime() - start.getTime();
  if (diffMs <= 0) return null;

  const hours = diffMs / (1000 * 60 * 60);

  if (hours < 1) {
    const minutes = Math.round(diffMs / (1000 * 60));
    return `${minutes} min`;
  }

  const rounded = Math.round(hours * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded} hr` : `${rounded} hr`;
}

function getHoursFromNow(targetValue) {
  if (!targetValue) return null;

  const now = new Date();
  const target = new Date(targetValue);

  if (Number.isNaN(target.getTime())) return null;

  const diffMs = target.getTime() - now.getTime();
  const absMs = Math.abs(diffMs);

  if (absMs < 60 * 1000) {
    return diffMs >= 0 ? "ahora" : "recién pasó";
  }

  if (absMs < 1000 * 60 * 60) {
    const minutes = Math.round(absMs / (1000 * 60));
    return diffMs >= 0 ? `faltan ${minutes} min` : `hace ${minutes} min`;
  }

  const hours = Math.round((absMs / (1000 * 60 * 60)) * 10) / 10;
  const label = Number.isInteger(hours) ? `${hours} hr` : `${hours} hr`;

  return diffMs >= 0 ? `faltan ${label}` : `hace ${label}`;
}

  function getAppointmentReadLabel(startValue, endValue, recurrenceType, weekdays, months) {
  const startLabel = formatShortDateTime(startValue);
  const durationLabel = getHoursBetween(startValue, endValue);

  const baseLabel = durationLabel
    ? `${startLabel} – ${durationLabel}`
    : startLabel;

  return appendRecurrenceLabel(baseLabel, recurrenceType, weekdays, months);
}

function getDeadlineReadLabel(endValue, recurrenceType, weekdays, months) {
  const endLabel = formatShortDateTime(endValue);
  const distanceLabel = getHoursFromNow(endValue);

  const baseLabel = distanceLabel
    ? `${endLabel} – ${distanceLabel}`
    : endLabel;

  return appendRecurrenceLabel(baseLabel, recurrenceType, weekdays, months);
}
  
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
    let originalText = String(play?.play_text || "");
    const safeText = escapeHtml(originalText);
    const statusRaw = String(play?.play_status || play?.status || "ACTIVE").toUpperCase();
    const creatorUserId = Number(play?.created_by_user_id || 0);

    const spadeMode = String(play?.spade_mode || "").toUpperCase(); // APPOINTMENT | DEADLINE | ""
    let startDateValue = play?.start_date ? toInputDateTimeValue(play.start_date) : "";
    let endDateValue = play?.end_date ? toInputDateTimeValue(play.end_date) : "";
    let locationValue = String(play?.location || "");

    const hasRecurrence = !!play?.has_recurrence;

    let recurrenceTypeValue = "";
    let recurrenceWeekdaysValue = [];
    let recurrenceMonthsValue = [];
    let recurrenceUntilDateValue = "";
    let recurrenceLoaded = false;
    
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

    function canHaveRoutine(mode, startDate, endDate) {
      const normalizedMode = String(mode || "").toUpperCase();

      if (normalizedMode === "APPOINTMENT") {
        return !!startDate;
      }

      if (normalizedMode === "DEADLINE") {
        return !!endDate;
      }

      return false;
    }

    function isValidRecurrenceConfig(type, weekdays, months) {
      const normalizedType = String(type || "").toUpperCase();

      if (!normalizedType) return true; // rutina opcional

      if (normalizedType === "WEEKLY") {
        return Array.isArray(weekdays) && weekdays.length > 0;
      }

      if (normalizedType === "MONTHLY") {
        return Array.isArray(months) && months.length > 0;
      }

      return false;
    }

    function getRecurrenceSummary() {
      if (!recurrenceTypeValue) return "Sin rutina";

      if (recurrenceTypeValue === "WEEKLY") {
        return `Rutina semanal: ${recurrenceWeekdaysValue.join(", ") || "—"}`;
      }

      if (recurrenceTypeValue === "MONTHLY") {
        return `Rutina mensual: ${recurrenceMonthsValue.join(", ") || "—"}`;
      }

      return "Sin rutina";
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

    function canCancelApprovedPlay() {
      if (!isApproved) return false;

      if (spadeMode === "APPOINTMENT") {
        return isFutureDate(play?.end_date);
      }

      if (spadeMode === "DEADLINE") {
        return isFutureDate(play?.end_date);
      }

      return false;
    }

    const bombIcon = escapeHtml(ACTIONS.bomb || "");
    const startIcon = escapeHtml(ACTIONS.start || "");
    const endIcon = escapeHtml(ACTIONS.end || "");
    const locationIcon = escapeHtml(ACTIONS.location || "");
    const saveIcon = escapeHtml(ACTIONS.save || "");
    const approveIcon = escapeHtml(ACTIONS.approve || "");
    const deleteIcon = escapeHtml(ACTIONS.delete || "");
    const editIcon = escapeHtml(ACTIONS.edit || "");
    const exitIcon = escapeHtml(ACTIONS.exit || ACTIONS.cancel || "");
    const helpIcon = escapeHtml(ACTIONS.help || "");
    const cancelIcon = escapeHtml(ACTIONS.cancel || ACTIONS.exit || "");
    const clubIcon = escapeHtml(ACTIONS.club || "");
    const qspadeIcon = escapeHtml(ACTIONS.qspade || ACTIONS.spade || "");
    const routineIcon = escapeHtml(ACTIONS.routine || "");

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

      const btnHelp = row.querySelector('[data-action="help-play"]');
      const btnCancel = row.querySelector('[data-action="cancel-play"]');
      const btnAddJclub = row.querySelector('[data-action="add-jclub-child"]');
      const btnAddQspade = row.querySelector('[data-action="add-qspade-child"]');

      const appointmentRead = row.querySelector('[data-role="appointment-read"]');
      const deadlineRead = row.querySelector('[data-role="deadline-read"]');

      const appointmentEdit = row.querySelector('[data-role="appointment-edit"]');
      const deadlineEdit = row.querySelector('[data-role="deadline-edit"]');

      const startDateInput = row.querySelector('[data-role="start-date"]');
      const appointmentEndDateInput = row.querySelector('[data-role="appointment-end-date"]');
      const deadlineEndDateInput = row.querySelector('[data-role="deadline-end-date"]');
      const locationInput = row.querySelector('[data-role="location"]');

      const btnRoutine = row.querySelector('[data-action="toggle-routine"]');

      const recurrenceRead = row.querySelector('[data-role="recurrence-read"]');
      const recurrenceEdit = row.querySelector('[data-role="recurrence-edit"]');

      const recurrenceTypeSelect = row.querySelector('[data-role="recurrence-type"]');
      const recurrenceWeeklyBox = row.querySelector('[data-role="recurrence-weekly"]');
      const recurrenceMonthlyBox = row.querySelector('[data-role="recurrence-monthly"]');
      const recurrenceUntilDateInput = row.querySelector('[data-role="recurrence-until-date"]');

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

            function getCheckedValues(selector) {
        return Array.from(row.querySelectorAll(selector))
          .filter((input) => input.checked)
          .map((input) => String(input.value || "").trim())
          .filter(Boolean);
      }

      function getRecurrenceValues() {
        return {
          recurrence_type: String(recurrenceTypeSelect?.value || "").trim().toUpperCase(),
          weekdays: getCheckedValues('[data-role="recurrence-weekday"]'),
          months: getCheckedValues('[data-role="recurrence-month"]'),
          until_date: String(recurrenceUntilDateInput?.value || "").trim() || null,
          timezone: "America/Montevideo"
        };
      }

      function paintRecurrenceControls() {
        const recurrenceType = String(recurrenceTypeSelect?.value || "").trim().toUpperCase();

        if (recurrenceWeeklyBox) {
          recurrenceWeeklyBox.style.display = recurrenceType === "WEEKLY" ? "flex" : "none";
        }

        if (recurrenceMonthlyBox) {
          recurrenceMonthlyBox.style.display = recurrenceType === "MONTHLY" ? "flex" : "none";
        }

        if (recurrenceRead) {
          recurrenceRead.textContent = getRecurrenceSummary();
        }
      }

      async function loadRecurrenceIfNeeded() {
        if (recurrenceLoaded || !playId) return;

        try {
          const response = await fetch(`${window.API_BASE_URL}/plays/${playId}/recurrence`, {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("cooptrackToken") || ""}`
            }
          });

          const data = await response.json();

          if (!response.ok || !data.ok || !data.recurrence) {
            recurrenceLoaded = true;
            paintRecurrenceControls();
            return;
          }

          const recurrence = data.recurrence;

          recurrenceTypeValue = String(recurrence.recurrence_type || "").toUpperCase();
          recurrenceWeekdaysValue = Array.isArray(recurrence.weekdays) ? recurrence.weekdays : [];
          recurrenceMonthsValue = Array.isArray(recurrence.months) ? recurrence.months : [];
          recurrenceUntilDateValue = recurrence.until_date
            ? String(recurrence.until_date).slice(0, 10)
            : "";

          if (recurrenceTypeSelect) recurrenceTypeSelect.value = recurrenceTypeValue;
          if (recurrenceUntilDateInput) recurrenceUntilDateInput.value = recurrenceUntilDateValue;

          row.querySelectorAll('[data-role="recurrence-weekday"]').forEach((input) => {
            input.checked = recurrenceWeekdaysValue.includes(input.value);
          });

          row.querySelectorAll('[data-role="recurrence-month"]').forEach((input) => {
            input.checked = recurrenceMonthsValue.includes(input.value);
          });

          recurrenceLoaded = true;
          paintRecurrenceControls();
        } catch (error) {
          console.error("No se pudo cargar recurrencia", error);
          recurrenceLoaded = true;
        }
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

        const showApprovedExtras = isApproved && !isCancelled;
        const showCancelApproved = canCancelApprovedPlay();

        const { startDate, endDate } = getFieldValues();
        const routineAvailable = !isApproved && !!currentMode && canHaveRoutine(currentMode, startDate, endDate);

        if (modeChoose) modeChoose.style.display = isChoose ? "flex" : "none";
        if (modeRead) modeRead.style.display = isRead ? "flex" : "none";
        if (modeEdit) modeEdit.style.display = isEdit ? "flex" : "none";

        if (textView) textView.style.display = isEdit ? "none" : "";
        if (textInput) textInput.style.display = isEdit ? "block" : "none";

        if (appointmentRead) {
          appointmentRead.style.display = isRead && currentMode === "APPOINTMENT" ? "flex" : "none";
        }

        if (deadlineRead) {
          deadlineRead.style.display = isRead && currentMode === "DEADLINE" ? "flex" : "none";
        }

        if (appointmentEdit) {
          appointmentEdit.style.display = isEdit && currentMode === "APPOINTMENT" ? "flex" : "none";
        }

        if (deadlineEdit) {
          deadlineEdit.style.display = isEdit && currentMode === "DEADLINE" ? "flex" : "none";
        }
        if (recurrenceEdit) {
          const recurrenceOpen = recurrenceEdit.dataset.open === "true";
          recurrenceEdit.style.display = isEdit && recurrenceOpen ? "flex" : "none";
        }

        if (btnRoutine) {
          btnRoutine.style.display = routineAvailable ? "inline-flex" : "none";
        }
        if (isCancelled) {
          if (btnChooseAppointment) btnChooseAppointment.style.display = "none";
          if (btnChooseDeadline) btnChooseDeadline.style.display = "none";
          if (btnEdit) btnEdit.style.display = "none";
          if (btnSave) btnSave.style.display = "none";
          if (btnApprove) btnApprove.style.display = "none";
          if (btnDelete) btnDelete.style.display = "none";
          if (btnExit) btnExit.style.display = "none";
          if (btnCancel) btnCancel.style.display = "none";
          if (btnAddJclub) btnAddJclub.style.display = "none";
          if (btnAddQspade) btnAddQspade.style.display = "none";
          if (btnHelp) btnHelp.style.display = "inline-flex";
          if (btnRoutine) btnRoutine.style.display = "none";
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

        if (btnHelp) {
          btnHelp.style.display = "inline-flex";
        }

        if (btnCancel) {
          btnCancel.style.display = showCancelApproved ? "inline-flex" : "none";
        }

        if (btnAddJclub) {
          btnAddJclub.style.display = showApprovedExtras ? "inline-flex" : "none";
        }

        if (btnAddQspade) {
          btnAddQspade.style.display = showApprovedExtras ? "inline-flex" : "none";
        }

        if (isEdit && textInput) {
          textInput.focus();
          textInput.select();
        }
        paintRecurrenceControls();
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

      function buildRecurrencePayload() {
        return {
          playId,
          ...getRecurrenceValues()
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

  const recurrencePayload = buildRecurrencePayload();

  if (
    recurrencePayload.recurrence_type &&
    !isValidRecurrenceConfig(
      recurrencePayload.recurrence_type,
      recurrencePayload.weekdays,
      recurrencePayload.months
    )
  ) {
    alert("La rutina está incompleta.");
    return;
  }

  dispatch("tablero:save-play", payload);

  if (recurrencePayload.recurrence_type) {
    dispatch("tablero:save-recurrence", recurrencePayload);
  }

  originalText = payload.text || "";
  if (textView) textView.textContent = originalText || "Sin texto";

  startDateValue = payload.startDate || "";
  endDateValue = payload.endDate || "";
  locationValue = payload.location || "";

  recurrenceTypeValue = recurrencePayload.recurrence_type || "";
  recurrenceWeekdaysValue = recurrencePayload.weekdays || [];
  recurrenceMonthsValue = recurrencePayload.months || [];
  recurrenceUntilDateValue = recurrencePayload.until_date || "";

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

        const recurrencePayload = buildRecurrencePayload();

        if (
          recurrencePayload.recurrence_type &&
          !isValidRecurrenceConfig(
            recurrencePayload.recurrence_type,
            recurrencePayload.weekdays,
            recurrencePayload.months
          )
        ) {
          alert("La rutina está incompleta.");
          return;
        }

        dispatch("tablero:approve-play", {
          ...payload,
          recurrence: recurrencePayload.recurrence_type ? recurrencePayload : null
        });
      });
    
btnDelete?.addEventListener("click", () => {
  const confirmed = window.confirm("¿Seguro que querés borrar esta jugada?");
  if (!confirmed) return;

  dispatch("tablero:delete-play", {
    playId
  });
});

     btnExit?.addEventListener("click", () => {
  if (textInput) textInput.value = originalText;
  if (startDateInput) startDateInput.value = startDateValue;
  if (appointmentEndDateInput) appointmentEndDateInput.value = endDateValue;
  if (deadlineEndDateInput) deadlineEndDateInput.value = endDateValue;
  if (locationInput) locationInput.value = locationValue;

  if (recurrenceTypeSelect) recurrenceTypeSelect.value = recurrenceTypeValue || "";
  if (recurrenceUntilDateInput) recurrenceUntilDateInput.value = recurrenceUntilDateValue || "";

  row.querySelectorAll('[data-role="recurrence-weekday"]').forEach((input) => {
    input.checked = recurrenceWeekdaysValue.includes(input.value);
  });

  row.querySelectorAll('[data-role="recurrence-month"]').forEach((input) => {
    input.checked = recurrenceMonthsValue.includes(input.value);
  });

  if (recurrenceEdit) {
    recurrenceEdit.dataset.open = "false";
  }

  setSpadeMode(spadeMode || "");
  setVisualMode(spadeMode ? "read" : "choose");

  renderMode();
});
    
      btnRoutine?.addEventListener("click", async () => {
        await loadRecurrenceIfNeeded();

        if (!recurrenceEdit) return;

        const currentlyOpen = recurrenceEdit.dataset.open === "true";
        recurrenceEdit.dataset.open = currentlyOpen ? "false" : "true";
        renderMode();
      });

      recurrenceTypeSelect?.addEventListener("change", () => {
        paintRecurrenceControls();
      });
    
      btnHelp?.addEventListener("click", () => {
        dispatch("tablero:help-play", {
          playId,
          cardRank: "J",
          cardSuit: "SPADE",
          spadeMode: getCurrentMode(),
        });
      });

      btnCancel?.addEventListener("click", () => {
        dispatch("tablero:cancel-play", {
          playId,
        });
      });

      btnAddJclub?.addEventListener("click", () => {
        dispatch("tablero:add-child-play", {
          parentPlayId: playId,
          childRank: "J",
          childSuit: "CLUB",
        });
      });

      btnAddQspade?.addEventListener("click", () => {
        dispatch("tablero:add-child-play", {
          parentPlayId: playId,
          childRank: "Q",
          childSuit: "SPADE",
        });
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

      <div class="tablero-row__mode-read" data-role="mode-read">
  <div
    class="tablero-row__fields tablero-row__fields--appointment"
    data-role="appointment-read"
    style="display:none;"
  >
    <div class="tablero-row__field-inline">
      <img src="${startIcon}" alt="Inicio" class="tablero-row__field-icon" />
      <span>${escapeHtml(
  getAppointmentReadLabel(
    play?.start_date,
    play?.end_date,
    recurrenceTypeValue,
    recurrenceWeekdaysValue,
    recurrenceMonthsValue
  )
)}</span>
    </div>

    <div class="tablero-row__field-inline">
      <img src="${locationIcon}" alt="Locación" class="tablero-row__field-icon" />
      <span>${escapeHtml(locationValue || "—")}</span>
    </div>
  </div>

  <div
    class="tablero-row__fields tablero-row__fields--deadline"
    data-role="deadline-read"
    style="display:none;"
  >
    <div class="tablero-row__field-inline">
      <img src="${bombIcon}" alt="Deadline" class="tablero-row__field-icon" />
      <span>${escapeHtml(
  getDeadlineReadLabel(
    play?.end_date,
    recurrenceTypeValue,
    recurrenceWeekdaysValue,
    recurrenceMonthsValue
  )
)}</span>
    </div>
  </div>

  <div
    class="tablero-row__fields tablero-row__fields--recurrence"
    data-role="recurrence-read"
  >
    ${escapeHtml(hasRecurrence ? "Rutina configurada" : "Sin rutina")}
  </div>
</div>

      <div class="tablero-row__mode-choose" data-role="mode-choose"></div>

      <div class="tablero-row__mode-edit" data-role="mode-edit">
        <div
          class="tablero-row__fields tablero-row__fields--appointment"
          data-role="appointment-edit"
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
          data-role="deadline-edit"
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

        <div
          class="tablero-row__fields tablero-row__fields--recurrence-edit"
          data-role="recurrence-edit"
          style="display:none;"
          data-open="false"
        >
          <div class="tablero-row__field-block">
            <label>Rutina</label>
            <select data-role="recurrence-type">
              <option value="">Sin rutina</option>
              <option value="WEEKLY">Semanal</option>
              <option value="MONTHLY">Mensual</option>
            </select>
          </div>

          <div
            class="tablero-row__field-block"
            data-role="recurrence-weekly"
            style="display:none;"
          >
            <label>Días</label>
            <div class="tablero-row__checks">
              <label><input type="checkbox" value="MON" data-role="recurrence-weekday" />Lun</label>
              <label><input type="checkbox" value="TUE" data-role="recurrence-weekday" />Mar</label>
              <label><input type="checkbox" value="WED" data-role="recurrence-weekday" />Mié</label>
              <label><input type="checkbox" value="THU" data-role="recurrence-weekday" />Jue</label>
              <label><input type="checkbox" value="FRI" data-role="recurrence-weekday" />Vie</label>
              <label><input type="checkbox" value="SAT" data-role="recurrence-weekday" />Sáb</label>
              <label><input type="checkbox" value="SUN" data-role="recurrence-weekday" />Dom</label>
            </div>
          </div>

          <div
            class="tablero-row__field-block"
            data-role="recurrence-monthly"
            style="display:none;"
          >
            <label>Meses</label>
            <div class="tablero-row__checks">
              <label><input type="checkbox" value="1" data-role="recurrence-month" />Ene</label>
              <label><input type="checkbox" value="2" data-role="recurrence-month" />Feb</label>
              <label><input type="checkbox" value="3" data-role="recurrence-month" />Mar</label>
              <label><input type="checkbox" value="4" data-role="recurrence-month" />Abr</label>
              <label><input type="checkbox" value="5" data-role="recurrence-month" />May</label>
              <label><input type="checkbox" value="6" data-role="recurrence-month" />Jun</label>
              <label><input type="checkbox" value="7" data-role="recurrence-month" />Jul</label>
              <label><input type="checkbox" value="8" data-role="recurrence-month" />Ago</label>
              <label><input type="checkbox" value="9" data-role="recurrence-month" />Sep</label>
              <label><input type="checkbox" value="10" data-role="recurrence-month" />Oct</label>
              <label><input type="checkbox" value="11" data-role="recurrence-month" />Nov</label>
              <label><input type="checkbox" value="12" data-role="recurrence-month" />Dic</label>
            </div>
          </div>

          <div class="tablero-row__field-block">
            <label>Hasta</label>
            <input type="date" data-role="recurrence-until-date" />
          </div>
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

      <button type="button" data-action="toggle-routine" title="Rutina" style="display:none;">
        ${routineIcon ? `<img src="${routineIcon}" alt="Rutina" />` : `<span>R</span>`}
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

      <button type="button" data-action="help-play" title="Help">
        ${helpIcon ? `<img src="${helpIcon}" alt="Help" />` : `<span>?</span>`}
      </button>

      <button type="button" data-action="cancel-play" title="Cancelar" style="display:none;">
        ${cancelIcon ? `<img src="${cancelIcon}" alt="Cancelar" />` : `<span>X</span>`}
      </button>

      <button type="button" data-action="add-jclub-child" title="Agregar J♣ hija" style="display:none;">
        ${clubIcon ? `<img src="${clubIcon}" alt="J♣" />` : `<span>J♣</span>`}
      </button>

      <button type="button" data-action="add-qspade-child" title="Agregar Q♠" style="display:none;">
        ${qspadeIcon ? `<img src="${qspadeIcon}" alt="Q♠" />` : `<span>Q♠</span>`}
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
