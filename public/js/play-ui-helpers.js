

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

function isChildPlay(play) {
  return !!play?.parent_play_id;
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

function buildRecurrencePanel(play) {
  if (!play.__showRecurrence) return "";

  return `
    <div class="plays-view__recurrence">
      <div class="plays-view__recurrence-box">
        <select data-field="recurrence_type" data-play-id="${escapeHTML(play.id)}">
          <option value="WEEKLY">Semanal</option>
          <option value="MONTHLY">Mensual</option>
        </select>

        <div class="plays-view__recurrence-weekly">
          <label><input type="checkbox" value="MON">L</label>
          <label><input type="checkbox" value="TUE">M</label>
          <label><input type="checkbox" value="WED">X</label>
          <label><input type="checkbox" value="THU">J</label>
          <label><input type="checkbox" value="FRI">V</label>
          <label><input type="checkbox" value="SAT">S</label>
          <label><input type="checkbox" value="SUN">D</label>
        </div>

        <div class="plays-view__recurrence-monthly">
          <input
            type="number"
            min="1"
            max="31"
            placeholder="Día del mes"
            data-field="day_of_month"
            data-play-id="${escapeHTML(play.id)}"
          />
        </div>

        <div class="plays-view__recurrence-actions">
          <button type="button" data-action="save-recurrence" data-play-id="${escapeHTML(play.id)}">Guardar</button>
          <button type="button" data-action="cancel-recurrence" data-play-id="${escapeHTML(play.id)}">Cancelar</button>
        </div>
      </div>
    </div>
  `;
}

function buildRecurrenceMarker(play) {
  if (!play.__hasRecurrence) return "";

  return `
    <span class="plays-view__recurrence-marker" title="Tiene rutina">
      <img
        src="${escapeHTML(window.ICONS.actions.routine)}"
        alt="Rutina"
        class="plays-view__mini-icon"
      />
    </span>
  `;
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
  const suitIcon = window.ICONS?.suits?.[suit];

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
  const isChild = isChildPlay(play);

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
    const text = getPlayText(play);
    const amount = getPlayAmount(play);

    if (isChild) {
      if (!text || !amount || Number(amount) <= 0) {
        canApprove = false;
        tooltip = "La factura requiere concepto y monto";
      }
    } else {
      if (!amount || Number(amount) <= 0) {
        canApprove = false;
        tooltip = "Ingrese monto";
      }
    }
  }

  if (suit === "SPADE") {
    const spadeMode = getSpadeMode(play);
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
          src="${escapeHTML(window.ICONS.actions.approve)}"
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
        src="${escapeHTML(window.ICONS.actions.approve)}"
        alt="Aprobar"
        class="plays-view__icon-img"
      />
    </button>
  `;
}

function buildApprovedMeta(play) {
  if (!isApproved(play)) return "";

  if (getPlaySuit(play) === "SPADE") {
    return "";
  }

  const approvedAt = formatDate(play.updated_at || play.approved_at || play.created_at);

  return `
    <div class="plays-view__approved-meta">
      ${approvedAt ? `${escapeHTML(approvedAt)}` : ""}
    </div>
  `;
}
window.PlayUIHelpers = {
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
  getVisiblePlays,
  getFilterTitle,
  buildRecurrencePanel,
  buildRecurrenceMarker,
  buildIconButton,
  buildSuitBadge,
  buildApproveButton,
  buildApprovedMeta,
  normalizeText, getPlayRank, getPlayStatus, isJPlay, isVisibleJPlay
};


