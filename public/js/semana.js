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

  function isBombDisabled(item) {
  const code = String(item?.play_code || "").toUpperCase();
  return code.includes("BOMB:DISABLED");
}

function isBombCancelled(item) {
  const status = String(item?.play_status || "").trim().toUpperCase();
  return status === "CANCELLED";
}

function isBombApproved(item) {
  const status = String(item?.play_status || "").trim().toUpperCase();
  return status === "APPROVED";
}

function isBombExploded(item) {
  const status = String(item?.play_status || "").trim().toUpperCase();
  if (status === "EXPLODED") return true;

  const endValue = item?.end_date;
  if (!endValue) return false;

  const date = new Date(endValue);
  if (Number.isNaN(date.getTime())) return false;

  return Date.now() >= date.getTime() && !isBombDisabled(item);
}

function getSpadeIconSrc(item) {
  const mode = String(item?.spade_mode || "").trim().toUpperCase();

  if (mode === "APPOINTMENT") {
    return "/assets/icons/reloj60.gif";
  }

  if (mode === "DEADLINE") {
    if (isBombCancelled(item)) {
      return "/assets/icons/stop60.gif";
    }

    if (isBombApproved(item) || isBombDisabled(item)) {
      return "/assets/icons/META60.gif";
    }

    if (isBombExploded(item)) {
      return "/assets/icons/Boom80.gif";
    }

    return "/assets/icons/bombaRedonda60.gif";
  }

  return null;
}

function getPlayLeadingVisual(item) {
  const suit = String(item?.card_suit || "").toUpperCase();

  if (suit === "SPADE") {
    const iconSrc = getSpadeIconSrc(item);
    if (iconSrc) {
      return {
        type: "icon",
        value: iconSrc
      };
    }
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