(function () {
  function addDays(date, amount) {
    const copy = new Date(date);
    copy.setDate(copy.getDate() + amount);
    return copy;
  }

  function isSameDay(a, b) {
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  }

  function toYmd(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function getSuitSymbol(suit) {
    switch (String(suit || "").toUpperCase()) {
      case "HEART":
        return "♥";
      case "SPADE":
        return "♠";
      case "DIAMOND":
        return "♦";
      case "CLUB":
        return "♣";
      default:
        return "J";
    }
  }

  function normalizeText(value) {
    return String(value || "").trim().toUpperCase();
  }

  function getActionIconPath(actionName) {
    const icons = window.ICONS?.actions || {};

    const fallback = {
      start: "/assets/icons/reloj60.gif",
      bomb: "/assets/icons/bombaRedonda60.gif",
      boom: "/assets/icons/Boom80.gif",
      deadline: "/assets/icons/META60.gif",
      stop: "/assets/icons/stop60.gif"
    };

    return icons[actionName] || fallback[actionName] || "";
  }

  function playCodeContains(play, token) {
    const code = String(play?.play_code || "").toUpperCase();
    return code.includes(String(token || "").toUpperCase());
  }

  function isCancelledActivity(play) {
    const status = normalizeText(play?.play_status);

    if (["CANCELED", "CANCELLED", "REJECTED", "VOID", "ABORTED", "DISABLED"].includes(status)) {
      return true;
    }

    return playCodeContains(play, "bomb:DISABLED");
  }

  function isConcludedActivity(play) {
    const status = normalizeText(play?.play_status);

    if (["DONE", "COMPLETED", "CLOSED", "PAID", "SETTLED", "FINISHED"].includes(status)) {
      return true;
    }

    return playCodeContains(play, "bomb:DONE");
  }

  function isDetonatedActivity(play) {
    if (
      playCodeContains(play, "bomb:EXPLODED") ||
      playCodeContains(play, "bomb:DETONATED") ||
      playCodeContains(play, "bomb:BOOM")
    ) {
      return true;
    }

    const status = normalizeText(play?.play_status);
    if (["DONE", "COMPLETED", "CLOSED", "PAID", "SETTLED", "FINISHED", "CANCELED", "CANCELLED", "REJECTED", "VOID", "ABORTED", "DISABLED"].includes(status)) {
      return false;
    }

    const deadlineDate = play?.end_date ? new Date(play.end_date) : null;
    if (!deadlineDate || Number.isNaN(deadlineDate.getTime())) {
      return false;
    }

    return Date.now() > deadlineDate.getTime();
  }

function getPlayLeadingVisual(item) {
  const suit = normalizeText(item?.card_suit);
  const spadeMode = normalizeText(item?.spade_mode);

  if (suit === "SPADE") {
    if (isCancelledActivity(item)) {
      return {
        type: "icon",
        value: getActionIconPath("stop")
      };
    }

    if (isConcludedActivity(item)) {
      return {
        type: "icon",
        value: getActionIconPath("deadline")
      };
    }

    if (spadeMode === "DEADLINE") {
      if (isDetonatedActivity(item)) {
        return {
          type: "icon",
          value: getActionIconPath("boom")
        };
      }

      return {
        type: "icon",
        value: getActionIconPath("bomb")
      };
    }

    return {
      type: "icon",
      value: getActionIconPath("start")
    };
  }

  return {
    type: "text",
    value: getSuitSymbol(suit)
  };
}

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

function getPlayHref(item) {
  const deckId = item.deck_id;
  const playId = item.id;

  if (!deckId || !playId) return "#";

  const rank = String(item.card_rank || "").toUpperCase();
  const suit = String(item.card_suit || "").toUpperCase();
  const code = String(item.play_code || "");

  if (rank === "A" && suit === "HEART") {
    return `/mazo.html?id=${encodeURIComponent(deckId)}`;
  }

  if (rank === "J" && suit === "HEART") {
    return `/lienzoJcorazon.html?deckId=${encodeURIComponent(deckId)}&playId=${encodeURIComponent(playId)}`;
  }

  if (rank === "J" && suit === "SPADE") {
    return `/lienzoJpica.html?deckId=${encodeURIComponent(deckId)}&playId=${encodeURIComponent(playId)}`;
  }

  if (rank === "J" && suit === "CLUB") {
    return `/lienzoJtrebol.html?deckId=${encodeURIComponent(deckId)}&playId=${encodeURIComponent(playId)}`;
  }

  if (rank === "Q" && suit === "SPADE") {
    const hasPayment = code.includes("pay:QHEART");
    const page = hasPayment ? "lienzoQQpica.html" : "lienzoQpica.html";

    return `/${page}?deckId=${encodeURIComponent(deckId)}&playId=${encodeURIComponent(playId)}`;
  }

  return `/mazo.html?id=${encodeURIComponent(deckId)}`;
}



function renderJotasBody(items = []) {
  if (!items.length) {
    return "";
  }

  const compactMode = items.length > 4;

  return items.map((item) => {
    const entryType = String(item?.calendar_entry_type || "").toUpperCase();
    const isPaymentEntry = entryType === "PAYMENT";

    if (isPaymentEntry) {
      const concept = String(item?.payment_concept || "").trim();
      const amount = String(item?.payment_amount || "").trim();
      const text = String(item?.text || item?.play_text || "").trim();

      const tooltipParts = [concept, amount].filter(Boolean);
      const fallbackTooltip = text || "Pago";
      const tooltipLabel = tooltipParts.length
        ? tooltipParts.join(" - ")
        : fallbackTooltip;

      const href = getPlayHref(item);

      return `
      <a
        class="dia__item-link dia__item-link--compact"
        href="${href}"
        title="${escapeHtml(tooltipLabel)}"
      >
        <span class="dia__item-symbol">♦</span>
      </a>
    `;
    }

    const leadingVisual = getPlayLeadingVisual(item);
    const text =
      item.text ||
      item.play_text ||
      item.description ||
      "";
    const deckName = item.deck_name || "";
    const href = getPlayHref(item);

    const leadingHtml =
      leadingVisual.type === "icon"
        ? `
          <img
            class="dia__item-icon"
            src="${leadingVisual.value}"
            alt=""
          />
        `
        : `
          <span class="dia__item-symbol">
            ${escapeHtml(leadingVisual.value)}
          </span>
        `;

    const visibleLabel = compactMode
      ? leadingHtml
      : `${leadingHtml}<span class="dia__item-text">${escapeHtml(text)}</span>`;

    const tooltipLabel = deckName
      ? `${deckName} — ${text}`
      : text;

    return `
      <a
        class="dia__item-link ${compactMode ? "dia__item-link--compact" : ""}"
        href="${href}"
        title="${escapeHtml(tooltipLabel)}"
      >
        ${visibleLabel}
      </a>
    `;
  }).join("");
}

  function renderSemana({
    mondayDate,
    currentDate,
    today,
    visibleMonth,
    jotasByDate = {}
  } = {}) {
    if (!(mondayDate instanceof Date) || Number.isNaN(mondayDate.getTime())) {
      return "";
    }

    const daysHtml = [];

    for (let i = 0; i < 7; i += 1) {
      const date = addDays(mondayDate, i);
      const ymd = toYmd(date);
      const items = jotasByDate[ymd] || [];

      const isToday = today ? isSameDay(date, today) : false;
      const isCurrent = currentDate ? isSameDay(date, currentDate) : false;
      const isOutsideMonth =
        typeof visibleMonth === "number"
          ? date.getMonth() !== visibleMonth
          : false;

      daysHtml.push(
        window.renderDia({
          headerText: String(date.getDate()),
          bodyHtml: renderJotasBody(items),
          isToday,
          isCurrent,
          isOutsideMonth
        })
      );
    }

    return `
      <div class="semana">
        ${daysHtml.join("")}
      </div>
    `;
  }

  window.renderSemana = renderSemana;
})();