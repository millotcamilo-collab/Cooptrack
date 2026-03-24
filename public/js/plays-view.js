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
    exit: "/assets/icons/exit40.gif"
  }
};

let currentSuitFilter = null;
let lastDeck = null;
let lastPlays = [];
let lastState = null;

function normalizeText(value) {
  return String(value || "").trim();
}

function escapeHTML(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatDate(value) {
  if (!value) return "";
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString("es-UY", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch (error) {
    console.error("Error formateando fecha:", error);
    return String(value);
  }
}

function getPlaySuit(play) {
  return String(play?.card_suit || play?.suit || "").toUpperCase();
}

function getPlayRank(play) {
  return String(play?.card_rank || play?.rank || "").toUpperCase();
}

function getPlayStatus(play) {
  return String(play?.play_status || play?.status || "").toUpperCase();
}

function getPlayText(play) {
  return normalizeText(
    play?.play_text ||
    play?.text ||
    play?.description ||
    ""
  );
}

function getPlayAmount(play) {
  return normalizeText(
    play?.amount ||
    play?.play_amount ||
    play?.monto ||
    ""
  );
}

function getPlayStartDate(play) {
  return play?.start_date || play?.startDate || "";
}

function getPlayEndDate(play) {
  return play?.end_date || play?.endDate || "";
}

function getSpadeMode(play) {
  return String(
    play?.spade_mode ||
    play?.mode ||
    play?.spadeMode ||
    ""
  ).toUpperCase();
}

function getPlayLocation(play) {
  return normalizeText(play?.location || "");
}

function isApproved(play) {
  return getPlayStatus(play) === "APPROVED";
}

function isJPlay(play) {
  return getPlayRank(play) === "J";
}

function isVisibleJPlay(play, filter = null) {
  if (!isJPlay(play)) return false;
  if (!filter) return true;
  return getPlaySuit(play) === filter;
}

function getVisiblePlays(plays, filter = null) {
  return (Array.isArray(plays) ? plays : []).filter((play) => isVisibleJPlay(play, filter));
}

function getFilterTitle(filter) {
  switch (filter) {
    case "HEART":
      return "Notas";
    case "SPADE":
      return "Actividades";
    case "CLUB":
      return "Bienes";
    case "DIAMOND":
      return "Contabilidad";
    default:
      return "Jugadas";
  }
}

function buildIconButton({ src, alt, title, action, playId, extraData = "" }) {
  return `
    <button
      type="button"
      class="plays-view__icon-btn"
      data-action="${escapeHTML(action)}"
      data-play-id="${escapeHTML(playId)}"
      ${extraData}
      title="${escapeHTML(title || alt || "")}"
    >
      <img src="${escapeHTML(src)}" alt="${escapeHTML(alt || "")}" class="plays-view__icon-img" />
    </button>
  `;
}

function buildSuitBadge(play) {
  const suit = getPlaySuit(play);
  const suitIcon = ICONS?.suits?.[suit];

  if (!suitIcon) {
    return `<div class="plays-view__badge">J ${escapeHTML(suit)}</div>`;
  }

  return `
    <div class="plays-view__badge">
      <span class="plays-view__badge-rank">J</span>
      <img src="${escapeHTML(suitIcon)}" alt="${escapeHTML(suit)}" class="plays-view__badge-suit" />
    </div>
  `;
}

function buildApproveButton(play) {
  if (isApproved(play)) return "";

  const suit = getPlaySuit(play);

  let canApprove = true;
  let tooltip = "Aprobar";

  if (suit === "HEART") {
    const text = getPlayText(play);
    if (!text) {
      canApprove = false;
      tooltip = "Debe tener descripción";
    }
  }

  if (suit === "CLUB") {
    const amount = getPlayAmount(play);
    if (!amount || Number(amount) <= 0) {
      canApprove = false;
      tooltip = "Ingrese monto";
    }
  }

  if (suit === "SPADE") {
    const spadeMode = String(
      play?.spade_mode ||
      play?.mode ||
      play?.spadeMode ||
      ""
    ).toUpperCase();

    const startDate = getPlayStartDate(play);
    const endDate = getPlayEndDate(play);
    const location = getPlayLocation(play);

    if (!spadeMode) {
      canApprove = false;
      tooltip = "Defina cita o deadline";
    }

    if (spadeMode === "CITA" || spadeMode === "APPOINTMENT") {
      if (!startDate || !location) {
        canApprove = false;
        tooltip = "La cita requiere inicio y locación";
      }
    }

    if (spadeMode === "DEADLINE") {
      if (!endDate) {
        canApprove = false;
        tooltip = "El deadline requiere fecha fin";
      }
    }
  }

  if (!canApprove) {
    return `
      <button
        type="button"
        class="plays-view__icon-btn plays-view__icon-btn--disabled"
        title="${escapeHTML(tooltip)}"
        disabled
      >
        <img
          src="${escapeHTML(ICONS.actions.approve)}"
          alt="Aprobar"
          class="plays-view__icon-img"
        />
      </button>
    `;
  }

  return `
    <button
      type="button"
      class="plays-view__icon-btn"
      data-action="approve"
      data-play-id="${escapeHTML(play.id)}"
      title="${escapeHTML(tooltip)}"
    >
      <img
        src="${escapeHTML(ICONS.actions.approve)}"
        alt="Aprobar"
        class="plays-view__icon-img"
      />
    </button>
  `;
}

function buildApprovedMeta(play) {
  if (!isApproved(play)) return "";

  const approvedAt = formatDate(play.updated_at || play.approved_at || play.created_at);
  return `
    <div class="plays-view__approved-meta">
      ${approvedAt ? `Fecha de aprobado: ${escapeHTML(approvedAt)}` : "Aprobada"}
    </div>
  `;
}

function buildHeartBody(play) {
  const text = getPlayText(play);

  if (isApproved(play)) {
    return `
      <div class="plays-view__text">${escapeHTML(text || "Sin descripción")}</div>
    `;
  }

  const isEditing = !!play.__editing;

  if (isEditing) {
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

function buildClubBody(play) {
  const text = getPlayText(play);
  const amount = getPlayAmount(play);

  if (isApproved(play)) {
    return `
      <div class="plays-view__club-row">
        <div class="plays-view__text">${escapeHTML(text || "Sin descripción")}</div>
        <div class="plays-view__amount">${escapeHTML(amount || "$ 0")}</div>
      </div>
    `;
  }

  return `
    <div class="plays-view__club-row">
      <div class="plays-view__text">${escapeHTML(text || "Sin descripción")}</div>
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

function buildClubActions(play) {
  if (isApproved(play)) {
    return buildApprovedMeta(play);
  }

  return `
    <div class="plays-view__actions">
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

  const isEditingSchedule = !!play.__editingSchedule;

  if (isApproved(play)) {
    if (spadeMode === "DEADLINE") {
      return `
        <div class="plays-view__spade-main">
          <div class="plays-view__text">${escapeHTML(text || "Sin descripción")}</div>
          <div class="plays-view__spade-data">
            <span class="plays-view__spade-mode">Deadline</span>
            ${endDate ? `<span>Fin: ${escapeHTML(formatDate(endDate))}</span>` : ""}
          </div>
        </div>
      `;
    }

    return `
      <div class="plays-view__spade-main">
        <div class="plays-view__text">${escapeHTML(text || "Sin descripción")}</div>
        <div class="plays-view__spade-data">
          ${spadeMode ? `<span class="plays-view__spade-mode">Cita</span>` : ""}
          ${startDate ? `<span>Inicio: ${escapeHTML(formatDate(startDate))}</span>` : ""}
          ${endDate ? `<span>Fin: ${escapeHTML(formatDate(endDate))}</span>` : ""}
          ${location ? `<span>${escapeHTML(location)}</span>` : ""}
        </div>
      </div>
    `;
  }

  if (isEditingSchedule) {
    if (spadeMode === "DEADLINE") {
      return `
        <div class="plays-view__spade-edit">
          <div class="plays-view__text">${escapeHTML(text || "Sin descripción")}</div>

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
      `;
    }

    return `
      <div class="plays-view__spade-edit">
        <div class="plays-view__text">${escapeHTML(text || "Sin descripción")}</div>

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
    `;
  }

  if (spadeMode === "DEADLINE") {
    return `
      <div class="plays-view__spade-main">
        <div class="plays-view__text">${escapeHTML(text || "Sin descripción")}</div>
        <div class="plays-view__spade-data">
          <span class="plays-view__spade-mode">Deadline</span>
          ${endDate ? `<span>Fin: ${escapeHTML(formatDate(endDate))}</span>` : ""}
        </div>
      </div>
    `;
  }

  if (spadeMode === "CITA" || spadeMode === "APPOINTMENT") {
    return `
      <div class="plays-view__spade-main">
        <div class="plays-view__text">${escapeHTML(text || "Sin descripción")}</div>
        <div class="plays-view__spade-data">
          <span class="plays-view__spade-mode">Cita</span>
          ${startDate ? `<span>Inicio: ${escapeHTML(formatDate(startDate))}</span>` : ""}
          ${endDate ? `<span>Fin: ${escapeHTML(formatDate(endDate))}</span>` : ""}
          ${location ? `<span>${escapeHTML(location)}</span>` : ""}
        </div>
      </div>
    `;
  }

  return `
    <div class="plays-view__spade-main">
      <div class="plays-view__text">${escapeHTML(text || "Sin descripción")}</div>
    </div>
  `;
}

function buildSpadeActions(play) {
  if (isApproved(play)) {
    return buildApprovedMeta(play);
  }

  const spadeMode = getSpadeMode(play);

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

function buildPlayRow(play) {
  const suit = getPlaySuit(play);

  let bodyHTML = "";
  let actionsHTML = "";

  if (suit === "HEART") {
    bodyHTML = buildHeartBody(play);
    actionsHTML = buildHeartActions(play);
  } else if (suit === "CLUB") {
    bodyHTML = buildClubBody(play);
    actionsHTML = buildClubActions(play);
  } else if (suit === "SPADE") {
    bodyHTML = buildSpadeBody(play);
    actionsHTML = buildSpadeActions(play);
  } else {
    bodyHTML = `<div class="plays-view__text">${escapeHTML(getPlayText(play) || "Jugada")}</div>`;
    actionsHTML = isApproved(play) ? buildApprovedMeta(play) : buildApproveButton(play);
  }

  return `
    <article class="plays-view__row ${isApproved(play) ? "plays-view__row--approved" : ""}" data-play-id="${escapeHTML(play.id)}">
      <div class="plays-view__left">
        ${buildSuitBadge(play)}
      </div>

      <div class="plays-view__center">
        ${bodyHTML}
      </div>

      <div class="plays-view__right">
        ${actionsHTML}
      </div>
    </article>
  `;
}

function renderPlaysView(deck, plays = [], state = null) {
  const container = document.getElementById("plays-view-container");
  if (!container) return;

  lastDeck = deck;
  lastPlays = Array.isArray(plays) ? plays : [];
  lastState = state;

  const visiblePlays = getVisiblePlays(lastPlays, currentSuitFilter);

  if (!visiblePlays.length) {
    container.innerHTML = `
      <section class="plays-view">
        <div class="page-container">
          <div class="plays-view__empty">No hay jugadas visibles.</div>
        </div>
      </section>
    `;
    return;
  }

  const rowsHTML = visiblePlays.map(buildPlayRow).join("");

  container.innerHTML = `
    <section class="plays-view">
      <div class="page-container">
        <div class="plays-view__header">
          <h2 class="plays-view__title">${escapeHTML(getFilterTitle(currentSuitFilter))}</h2>
        </div>
        <div class="plays-view__list">
          ${rowsHTML}
        </div>
      </div>
    </section>
  `;

  bindPlaysViewEvents();
}

function updateLocalPlay(playId, patch = {}) {
  lastPlays = lastPlays.map((play) => {
    if (String(play.id) !== String(playId)) return play;
    return { ...play, ...patch };
  });
}

function removeLocalPlay(playId) {
  lastPlays = lastPlays.filter((play) => String(play.id) !== String(playId));
}

function getFieldValue(playId, fieldName) {
  const field = document.querySelector(`[data-field="${fieldName}"][data-play-id="${playId}"]`);
  return field ? field.value : "";
}

async function savePlayPatch(playId, patch) {
  document.dispatchEvent(
    new CustomEvent("plays:patch-requested", {
      detail: { playId, patch }
    })
  );
}

async function deletePlay(playId) {
  document.dispatchEvent(
    new CustomEvent("plays:delete-requested", {
      detail: { playId }
    })
  );
}

async function approvePlay(playId) {
  document.dispatchEvent(
    new CustomEvent("plays:approve-requested", {
      detail: { playId }
    })
  );
}

async function transformSuit(playId, suit) {
  document.dispatchEvent(
    new CustomEvent("plays:transform-suit-requested", {
      detail: { playId, suit }
    })
  );
}

function bindPlaysViewEvents() {
  containerSafeQueryAll('[data-action="edit-heart"]').forEach((button) => {
    button.addEventListener("click", () => {
      const playId = button.dataset.playId;
      updateLocalPlay(playId, { __editing: true });
      renderPlaysView(lastDeck, lastPlays, lastState);
    });
  });

  containerSafeQueryAll('[data-action="cancel-edit"]').forEach((button) => {
    button.addEventListener("click", () => {
      const playId = button.dataset.playId;
      updateLocalPlay(playId, { __editing: false });
      renderPlaysView(lastDeck, lastPlays, lastState);
    });
  });

  containerSafeQueryAll('[data-action="save-edit"]').forEach((button) => {
    button.addEventListener("click", async () => {
      const playId = button.dataset.playId;
      const playText = getFieldValue(playId, "text");

      updateLocalPlay(playId, {
        play_text: playText,
        __editing: false
      });

      renderPlaysView(lastDeck, lastPlays, lastState);
      await savePlayPatch(playId, { play_text: playText });
    });
  });

  containerSafeQueryAll('[data-action="to-club"]').forEach((button) => {
    button.addEventListener("click", async () => {
      const playId = button.dataset.playId;
      updateLocalPlay(playId, { card_suit: "CLUB" });
      renderPlaysView(lastDeck, lastPlays, lastState);
      await transformSuit(playId, "CLUB");
    });
  });

  containerSafeQueryAll('[data-action="to-spade"]').forEach((button) => {
    button.addEventListener("click", async () => {
      const playId = button.dataset.playId;
      updateLocalPlay(playId, { card_suit: "SPADE" });
      renderPlaysView(lastDeck, lastPlays, lastState);
      await transformSuit(playId, "SPADE");
    });
  });

  containerSafeQueryAll('[data-action="set-appointment"]').forEach((button) => {
    button.addEventListener("click", async () => {
      const playId = button.dataset.playId;

      updateLocalPlay(playId, {
        spade_mode: "APPOINTMENT",
        __editingSchedule: true
      });

      renderPlaysView(lastDeck, lastPlays, lastState);

      await savePlayPatch(playId, {
        spade_mode: "APPOINTMENT"
      });
    });
  });

  containerSafeQueryAll('[data-action="set-deadline"]').forEach((button) => {
    button.addEventListener("click", async () => {
      const playId = button.dataset.playId;

      updateLocalPlay(playId, {
        spade_mode: "DEADLINE",
        __editingSchedule: true,
        start_date: "",
        location: ""
      });

      renderPlaysView(lastDeck, lastPlays, lastState);

      await savePlayPatch(playId, {
        spade_mode: "DEADLINE"
      });
    });
  });

  containerSafeQueryAll('[data-action="edit-schedule"]').forEach((button) => {
    button.addEventListener("click", () => {
      const playId = button.dataset.playId;
      updateLocalPlay(playId, { __editingSchedule: true });
      renderPlaysView(lastDeck, lastPlays, lastState);
    });
  });

  containerSafeQueryAll('[data-action="cancel-schedule-edit"]').forEach((button) => {
    button.addEventListener("click", () => {
      const playId = button.dataset.playId;
      updateLocalPlay(playId, { __editingSchedule: false });
      renderPlaysView(lastDeck, lastPlays, lastState);
    });
  });

  containerSafeQueryAll('[data-action="save-schedule"]').forEach((button) => {
    button.addEventListener("click", async () => {
      const playId = button.dataset.playId;

      const play = lastPlays.find((item) => String(item.id) === String(playId)) || {};
      const spadeMode = getSpadeMode(play);

      const startDate = getFieldValue(playId, "start_date");
      const endDate = getFieldValue(playId, "end_date");
      const location = getFieldValue(playId, "location");

      if (spadeMode === "DEADLINE") {
        updateLocalPlay(playId, {
          end_date: endDate,
          __editingSchedule: false
        });

        renderPlaysView(lastDeck, lastPlays, lastState);

        await savePlayPatch(playId, {
          spade_mode: "DEADLINE",
          end_date: endDate
        });

        return;
      }

      updateLocalPlay(playId, {
        spade_mode: "APPOINTMENT",
        start_date: startDate,
        end_date: endDate,
        location,
        __editingSchedule: false
      });

      renderPlaysView(lastDeck, lastPlays, lastState);

      await savePlayPatch(playId, {
        spade_mode: "APPOINTMENT",
        start_date: startDate,
        end_date: endDate,
        location
      });
    });
  });

  containerSafeQueryAll('[data-field="amount"]').forEach((input) => {
    input.addEventListener("change", async () => {
      const playId = input.dataset.playId;
      const amount = input.value;

      updateLocalPlay(playId, {
        amount: amount,
        play_amount: amount
      });

      renderPlaysView(lastDeck, lastPlays, lastState);

      await savePlayPatch(playId, {
        amount: amount
      });
    });
  });

  containerSafeQueryAll('[data-action="delete"]').forEach((button) => {
    button.addEventListener("click", async () => {
      const playId = button.dataset.playId;
      const confirmed = window.confirm("¿Seguro que querés borrar esta jugada?");

      if (!confirmed) {
        return;
      }

      removeLocalPlay(playId);
      renderPlaysView(lastDeck, lastPlays, lastState);
      await deletePlay(playId);
    });
  });

  containerSafeQueryAll('[data-action="approve"]').forEach((button) => {
    button.addEventListener("click", async () => {
      const playId = button.dataset.playId;
      updateLocalPlay(playId, { play_status: "APPROVED", status: "APPROVED" });
      renderPlaysView(lastDeck, lastPlays, lastState);
      await approvePlay(playId);
    });
  });

  containerSafeQueryAll('[data-action="deadline"]').forEach((button) => {
    button.addEventListener("click", () => {
      const playId = button.dataset.playId;
      document.dispatchEvent(
        new CustomEvent("plays:deadline-requested", {
          detail: { playId }
        })
      );
    });
  });
}

function containerSafeQueryAll(selector) {
  return Array.from(document.querySelectorAll(selector));
}

document.addEventListener("mazobar:filter", (event) => {
  const incomingFilter = event.detail?.filter || null;
  currentSuitFilter = currentSuitFilter === incomingFilter ? null : incomingFilter;
  renderPlaysView(lastDeck, lastPlays, lastState);
});

window.renderPlaysView = renderPlaysView;
