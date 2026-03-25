const ICONS = window.ICONS || {
  suits: {
    HEART: "/assets/icons/cor40.gif",
    SPADE: "/assets/icons/pik40.gif",
    DIAMOND: "/assets/icons/dia40.gif",
    CLUB: "/assets/icons/tre40.gif"
  },
  actions: {
    edit: "/assets/icons/desarrollo40.gif",
    save: "/assets/icons/salvar40.gif",
    delete: "/assets/icons/papelera30.gif",
    start: "/assets/icons/reloj60.gif",
    end: "/assets/icons/Campana80.gif",
    location: "/assets/icons/LocGlobito.gif",
    deadline: "/assets/icons/META60.gif",
    bomb: "/assets/icons/bombaRedonda60.gif",
    stop: "/assets/icons/stop60.gif",
    boom: "/assets/icons/Boom80.gif",
    approve: "/assets/icons/Sello40.gif",
    exit: "/assets/icons/exit40.gif",
    cancel: "/assets/icons/stop60.gif",
    routine: "/assets/icons/ActividadIterativa80.gif",
    fired: "/assets/icons/pistola60.gif",
    send: "/assets/icons/buzon60.gif",
    register: "/assets/icons/lacre80.gif",
    reject: "/assets/icons/stepback40.gif",
    quit: "/assets/icons/step60.gif"
  }
};

const {
  escapeHTML,
  formatDate,
  getPlaySuit,
  getPlayText,
  getPlayAmount,
  getPlayStartDate,
  getPlayEndDate,
  getSpadeMode,
  getPlayLocation,
  isApproved,
  isChildPlay,
  buildRecurrencePanel,
  buildRecurrenceMarker,
  buildIconButton,
  buildSuitBadge,
  buildApproveButton,
  buildApprovedMeta
} = window.PlayUIHelpers;

function buildHeartBody(play) {
  const text = getPlayText(play);

  if (isApproved(play)) {
    return `
      <div class="plays-view__text">${escapeHTML(text || "Sin descripción")}</div>
    `;
  }

  if (play.__editing) {
    return `
      <textarea
        class="plays-view__textarea"
        data-field="text"
        data-play-id="${escapeHTML(play.id)}"
      >${escapeHTML(text)}</textarea>
    `;
  }

  return `
    <div class="plays-view__text">${escapeHTML(text || "Sin descripción")}</div>
  `;
}

function buildHeartActions(play) {
  if (isApproved(play)) {
    return buildApprovedMeta(play);
  }

  if (play.__editing) {
    return `
      <div class="plays-view__actions">
        ${buildIconButton({
          src: ICONS.actions.save,
          alt: "Guardar",
          title: "Guardar",
          action: "save-edit",
          playId: play.id
        })}
        ${buildIconButton({
          src: ICONS.actions.exit,
          alt: "Salir edición",
          title: "Salir edición",
          action: "cancel-edit",
          playId: play.id
        })}
        ${buildIconButton({
          src: ICONS.actions.delete,
          alt: "Borrar",
          title: "Borrar",
          action: "delete",
          playId: play.id
        })}
      </div>
      <div class="plays-view__approve-wrap">
        ${buildApproveButton(play)}
      </div>
    `;
  }

  return `
    <div class="plays-view__actions">
      ${buildIconButton({
        src: ICONS.actions.edit,
        alt: "Editar",
        title: "Editar texto",
        action: "edit-heart",
        playId: play.id
      })}
      ${buildIconButton({
        src: ICONS.suits.CLUB,
        alt: "Pasar a trébol",
        title: "Transformar en J trébol",
        action: "to-club",
        playId: play.id
      })}
      ${buildIconButton({
        src: ICONS.suits.SPADE,
        alt: "Pasar a picas",
        title: "Transformar en J picas",
        action: "to-spade",
        playId: play.id
      })}
      ${buildIconButton({
        src: ICONS.actions.delete,
        alt: "Borrar",
        title: "Borrar",
        action: "delete",
        playId: play.id
      })}
    </div>
    <div class="plays-view__approve-wrap">
      ${buildApproveButton(play)}
    </div>
  `;
}

function buildRootClubBody(play) {
  const text = getPlayText(play);
  const amount = getPlayAmount(play);

  if (isApproved(play)) {
    return `
      <div class="plays-view__club-row">
        <div class="plays-view__text">
          ${escapeHTML(text || "Sin descripción")}
          ${buildRecurrenceMarker(play)}
        </div>
        <div class="plays-view__amount">${escapeHTML(amount || "$ 0")}</div>
      </div>
    `;
  }

  return `
    <div class="plays-view__club-row">
      <div class="plays-view__text">
        ${escapeHTML(text || "Sin descripción")}
        ${buildRecurrenceMarker(play)}
      </div>
      <input
        type="number"
        step="0.01"
        min="0"
        class="plays-view__amount-input"
        placeholder="Monto"
        value="${escapeHTML(amount)}"
        data-field="amount"
        data-play-id="${escapeHTML(play.id)}"
      />
    </div>
  `;
}

function buildChildClubBody(play) {
  const text = getPlayText(play);
  const amount = getPlayAmount(play);

  if (isApproved(play)) {
    return `
      <div class="plays-view__child-club">
        <div class="plays-view__child-club-concept">
          ${escapeHTML(text || "Sin concepto")}
          ${buildRecurrenceMarker(play)}
        </div>

        <div class="plays-view__child-club-money">
          <div class="plays-view__child-club-money-label">
            <span class="plays-view__badge-rank">J</span>
            <img
              src="${escapeHTML(ICONS.suits.DIAMOND)}"
              alt="DIAMOND"
              class="plays-view__badge-suit"
            />
          </div>
          <div class="plays-view__child-club-amount">
            ${escapeHTML(amount || "$ 0")}
          </div>
        </div>
      </div>
    `;
  }

  return `
    <div class="plays-view__child-club">
      <input
        type="text"
        class="plays-view__child-text-input"
        placeholder="Concepto / descripción de factura"
        value="${escapeHTML(text)}"
        data-field="text"
        data-play-id="${escapeHTML(play.id)}"
      />

      <div class="plays-view__child-club-money">
        <div class="plays-view__child-club-money-label">
          <span class="plays-view__badge-rank">J</span>
          <img
            src="${escapeHTML(ICONS.suits.DIAMOND)}"
            alt="DIAMOND"
            class="plays-view__badge-suit"
          />
        </div>

        <input
          type="number"
          step="0.01"
          min="0"
          class="plays-view__amount-input"
          placeholder="Monto"
          value="${escapeHTML(amount)}"
          data-field="amount"
          data-play-id="${escapeHTML(play.id)}"
        />
      </div>
    </div>
  `;
}

function buildClubBody(play) {
  if (isChildPlay(play)) {
    return `
      ${buildChildClubBody(play)}
      ${buildRecurrencePanel(play)}
    `;
  }

  return `
    ${buildRootClubBody(play)}
    ${buildRecurrencePanel(play)}
  `;
}

function buildClubActions(play) {
  if (isApproved(play)) {
    return buildApprovedMeta(play);
  }

  return `
    <div class="plays-view__actions">
      ${buildIconButton({
        src: ICONS.actions.routine,
        alt: "Recurrencia",
        title: "Definir recurrencia",
        action: "set-recurrence",
        playId: play.id
      })}
      ${buildIconButton({
        src: ICONS.actions.delete,
        alt: "Borrar",
        title: "Borrar",
        action: "delete",
        playId: play.id
      })}
    </div>
    <div class="plays-view__approve-wrap">
      ${buildApproveButton(play)}
    </div>
  `;
}

function buildSpadeBody(play) {
  const text = getPlayText(play);
  const startDate = getPlayStartDate(play);
  const endDate = getPlayEndDate(play);
  const location = getPlayLocation(play);
  const spadeMode = getSpadeMode(play);

  if (isApproved(play)) {
    if (spadeMode === "DEADLINE") {
      return `
        <div class="plays-view__spade-main">
          <div class="plays-view__text">
            ${escapeHTML(text || "Sin descripción")}
            ${buildRecurrenceMarker(play)}
          </div>
          <div class="plays-view__spade-data">
            <span class="plays-view__spade-mode">Deadline</span>
            ${endDate ? `<span>Fin: ${escapeHTML(formatDate(endDate))}</span>` : ""}
          </div>
        </div>
        ${buildRecurrencePanel(play)}
      `;
    }

    return `
      <div class="plays-view__spade-main">
        <div class="plays-view__text">
          ${escapeHTML(text || "Sin descripción")}
          ${buildRecurrenceMarker(play)}
        </div>
        <div class="plays-view__spade-data">
          ${spadeMode ? `<span class="plays-view__spade-mode">Cita</span>` : ""}
          ${startDate ? `<span>Inicio: ${escapeHTML(formatDate(startDate))}</span>` : ""}
          ${endDate ? `<span>Fin: ${escapeHTML(formatDate(endDate))}</span>` : ""}
          ${location ? `<span>${escapeHTML(location)}</span>` : ""}
        </div>
      </div>
      ${buildRecurrencePanel(play)}
    `;
  }

  if (play.__editingSchedule) {
    if (spadeMode === "DEADLINE") {
      return `
        <div class="plays-view__spade-edit">
          <div class="plays-view__text">
            ${escapeHTML(text || "Sin descripción")}
            ${buildRecurrenceMarker(play)}
          </div>
          <div class="plays-view__schedule-fields">
            <div class="plays-view__schedule-field">
              <img src="${escapeHTML(ICONS.actions.end)}" alt="Fin" class="plays-view__mini-icon" />
              <input
                type="datetime-local"
                class="plays-view__datetime-input"
                data-field="end_date"
                data-play-id="${escapeHTML(play.id)}"
                value="${escapeHTML(endDate)}"
              />
            </div>
          </div>
        </div>
        ${buildRecurrencePanel(play)}
      `;
    }

    return `
      <div class="plays-view__spade-edit">
        <div class="plays-view__text">
          ${escapeHTML(text || "Sin descripción")}
          ${buildRecurrenceMarker(play)}
        </div>
        <div class="plays-view__schedule-fields">
          <div class="plays-view__schedule-field">
            <img src="${escapeHTML(ICONS.actions.start)}" alt="Inicio" class="plays-view__mini-icon" />
            <input
              type="datetime-local"
              class="plays-view__datetime-input"
              data-field="start_date"
              data-play-id="${escapeHTML(play.id)}"
              value="${escapeHTML(startDate)}"
            />
          </div>

          <div class="plays-view__schedule-field">
            <img src="${escapeHTML(ICONS.actions.end)}" alt="Fin" class="plays-view__mini-icon" />
            <input
              type="datetime-local"
              class="plays-view__datetime-input"
              data-field="end_date"
              data-play-id="${escapeHTML(play.id)}"
              value="${escapeHTML(endDate)}"
            />
          </div>

          <div class="plays-view__schedule-field">
            <img src="${escapeHTML(ICONS.actions.location)}" alt="Lugar" class="plays-view__mini-icon" />
            <input
              type="text"
              class="plays-view__location-input"
              data-field="location"
              data-play-id="${escapeHTML(play.id)}"
              value="${escapeHTML(location)}"
              placeholder="Ubicación"
            />
          </div>
        </div>
      </div>
      ${buildRecurrencePanel(play)}
    `;
  }

  if (spadeMode === "DEADLINE") {
    return `
      <div class="plays-view__spade-main">
        <div class="plays-view__text">
          ${escapeHTML(text || "Sin descripción")}
          ${buildRecurrenceMarker(play)}
        </div>
        <div class="plays-view__spade-data">
          <span class="plays-view__spade-mode">Deadline</span>
          ${endDate ? `<span>Fin: ${escapeHTML(formatDate(endDate))}</span>` : ""}
        </div>
      </div>
      ${buildRecurrencePanel(play)}
    `;
  }

  if (spadeMode === "CITA" || spadeMode === "APPOINTMENT") {
    return `
      <div class="plays-view__spade-main">
        <div class="plays-view__text">
          ${escapeHTML(text || "Sin descripción")}
          ${buildRecurrenceMarker(play)}
        </div>
        <div class="plays-view__spade-data">
          <span class="plays-view__spade-mode">Cita</span>
          ${startDate ? `<span>Inicio: ${escapeHTML(formatDate(startDate))}</span>` : ""}
          ${endDate ? `<span>Fin: ${escapeHTML(formatDate(endDate))}</span>` : ""}
          ${location ? `<span>${escapeHTML(location)}</span>` : ""}
        </div>
      </div>
      ${buildRecurrencePanel(play)}
    `;
  }

  return `
    <div class="plays-view__spade-main">
      <div class="plays-view__text">
        ${escapeHTML(text || "Sin descripción")}
        ${buildRecurrenceMarker(play)}
      </div>
    </div>
    ${buildRecurrencePanel(play)}
  `;
}

function buildSpadeActions(play) {
  const spadeMode = getSpadeMode(play);

  if (isApproved(play) && (spadeMode === "CITA" || spadeMode === "APPOINTMENT")) {
    return `
      <div class="plays-view__actions">
        ${buildIconButton({
          src: ICONS.suits.DIAMOND,
          alt: "Nuevo gasto hijo",
          title: "Agregar J♦ hija",
          action: "add-child-diamond",
          playId: play.id
        })}
        ${buildIconButton({
          src: ICONS.suits.SPADE,
          alt: "Nueva Q♠",
          title: "Agregar Q♠ hija",
          action: "add-child-qspade",
          playId: play.id
        })}
      </div>
      <div class="plays-view__approve-wrap">
        ${buildApprovedMeta(play)}
      </div>
    `;
  }

  if (isApproved(play)) {
    return buildApprovedMeta(play);
  }

  if (play.__editingSchedule) {
    return `
      <div class="plays-view__actions">
        ${buildIconButton({
          src: ICONS.actions.save,
          alt: "Guardar",
          title: "Guardar",
          action: "save-schedule",
          playId: play.id
        })}
        ${buildIconButton({
          src: ICONS.actions.exit,
          alt: "Salir edición",
          title: "Salir edición",
          action: "cancel-schedule-edit",
          playId: play.id
        })}
        ${buildIconButton({
          src: ICONS.actions.routine,
          alt: "Recurrencia",
          title: "Definir recurrencia",
          action: "set-recurrence",
          playId: play.id
        })}
        ${buildIconButton({
          src: ICONS.actions.delete,
          alt: "Borrar",
          title: "Borrar",
          action: "delete",
          playId: play.id
        })}
      </div>
      <div class="plays-view__approve-wrap">
        ${buildApproveButton(play)}
      </div>
    `;
  }

  if (!spadeMode) {
    return `
      <div class="plays-view__actions">
        ${buildIconButton({
          src: ICONS.actions.start,
          alt: "Cita",
          title: "Appointment / Cita",
          action: "set-appointment",
          playId: play.id
        })}
        ${buildIconButton({
          src: ICONS.actions.bomb,
          alt: "Deadline",
          title: "Deadline",
          action: "set-deadline",
          playId: play.id
        })}
        ${buildIconButton({
          src: ICONS.actions.routine,
          alt: "Recurrencia",
          title: "Definir recurrencia",
          action: "set-recurrence",
          playId: play.id
        })}
        ${buildIconButton({
          src: ICONS.actions.delete,
          alt: "Borrar",
          title: "Borrar",
          action: "delete",
          playId: play.id
        })}
      </div>
      <div class="plays-view__approve-wrap">
        ${buildApproveButton(play)}
      </div>
    `;
  }

  return `
    <div class="plays-view__actions">
      ${buildIconButton({
        src: ICONS.actions.edit,
        alt: "Editar",
        title: spadeMode === "DEADLINE" ? "Editar deadline" : "Editar cita",
        action: "edit-schedule",
        playId: play.id
      })}
      ${buildIconButton({
        src: ICONS.actions.routine,
        alt: "Recurrencia",
        title: "Definir recurrencia",
        action: "set-recurrence",
        playId: play.id
      })}
      ${buildIconButton({
        src: ICONS.actions.delete,
        alt: "Borrar",
        title: "Borrar",
        action: "delete",
        playId: play.id
      })}
    </div>
    <div class="plays-view__approve-wrap">
      ${buildApproveButton(play)}
    </div>
  `;
}
window.JRenderer = {
  buildHeartBody,
  buildHeartActions,
  buildRootClubBody,
  buildChildClubBody,
  buildClubBody,
  buildClubActions,
  buildSpadeBody,
  buildSpadeActions
};
