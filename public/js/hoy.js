(function () {
  const container = document.getElementById("hoy-container");
  if (!container) return;

  const calendarPlays = window.CalendarPlays;
  if (!calendarPlays) {
    console.error("CalendarPlays helper no disponible");
    return;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function pad2(value) {
    return String(value).padStart(2, "0");
  }

  function toYmd(date) {
    const year = date.getFullYear();
    const month = pad2(date.getMonth() + 1);
    const day = pad2(date.getDate());
    return `${year}-${month}-${day}`;
  }

  function normalizeText(value) {
    return String(value || "").trim().toUpperCase();
  }

  const getPlayCalendarDate = calendarPlays.getPlayCalendarDate;
  const isVisibleTodayPlay = calendarPlays.isVisibleCalendarPlay;

  function getSuitSymbol(suit) {
    switch (normalizeText(suit)) {
      case "HEART":
        return "♥";
      case "SPADE":
        return "♠";
      case "DIAMOND":
        return "♦";
      case "CLUB":
        return "♣";
      default:
        return "";
    }
  }

  function parseFlowPayment(playCode) {
    const flow = String(playCode || "").split("§")[7] || "";
    const chunks = flow
      .split(";")
      .map((item) => item.trim())
      .filter(Boolean);

    for (const chunk of chunks) {
      if (!chunk.toLowerCase().startsWith("pay:qheart")) continue;

      const parts = chunk.split("|");
      const payment = {};

      parts.forEach((part, index) => {
        if (index === 0) return;
        const separatorIndex = part.indexOf(":");
        if (separatorIndex === -1) return;

        const key = part.slice(0, separatorIndex).trim();
        const value = part.slice(separatorIndex + 1).trim();
        if (key) payment[key] = value;
      });

      return payment;
    }

    return null;
  }

  function isBombDisabled(item) {
    const code = String(item?.play_code || "").toUpperCase();
    return code.includes("BOMB:DISABLED");
  }

  function isBombCancelled(item) {
    const status = normalizeText(item?.play_status || item?.status);
    return status === "CANCELLED";
  }

  function isBombDone(item) {
    const code = String(item?.play_code || "").toUpperCase();
    if (code.includes("BOMB:DONE")) return true;

    const status = normalizeText(item?.play_status || item?.status);
    return status === "DONE";
  }

  function isBombExploded(item) {
    const status = normalizeText(item?.play_status || item?.status);
    if (status === "EXPLODED") return true;

    const endValue = item?.end_date;
    if (!endValue) return false;

    const date = new Date(endValue);
    if (Number.isNaN(date.getTime())) return false;

    return Date.now() >= date.getTime() && !isBombDisabled(item);
  }

  function getSpadeIconSrc(item) {
    const mode = normalizeText(item?.spade_mode);

    if (mode === "APPOINTMENT") {
      return "/assets/icons/reloj60.gif";
    }

    if (mode === "DEADLINE") {
      if (isBombCancelled(item)) return "/assets/icons/stop60.gif";
      if (isBombDone(item) || isBombDisabled(item)) return "/assets/icons/META60.gif";
      if (isBombExploded(item)) return "/assets/icons/Boom80.gif";
      return "/assets/icons/bombaRedonda60.gif";
    }

    return null;
  }

  function getLeadingVisual(item) {
    const entryType = normalizeText(item?.calendar_entry_type);
    const overrideSuit = normalizeText(item?.calendar_suit_override);

    if (entryType === "PAYMENT" || overrideSuit === "DIAMOND") {
      return { type: "text", value: "♦" };
    }

    const suit = normalizeText(item?.card_suit || item?.suit);

    if (suit === "SPADE") {
      const iconSrc = getSpadeIconSrc(item);
      if (iconSrc) {
        return { type: "icon", value: iconSrc };
      }
    }

    return {
      type: "text",
      value: getSuitSymbol(suit)
    };
  }

  function getPlayHref(item) {
    const deckId = item?.deck_id;
    const playId = item?.id;

    if (!deckId || !playId) return "#";

    const rank = normalizeText(item?.card_rank);
    const suit = normalizeText(item?.card_suit);
    const code = String(item?.play_code || "");

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
      const status = normalizeText(item?.play_status || item?.status);
      const hasPayment = code.includes("pay:QHEART");
      const sentOrLaterStatuses = ["SENT", "PENDING", "APPROVED", "REJECTED", "CANCELLED", "DONE", "QUIT", "FIRED"];
      if (sentOrLaterStatuses.includes(status)) {
        const situacion = hasPayment ? "QQPICA_ENTRA" : "QPICA_ENTRA";
        return `/amsterdam.html?situacion=${encodeURIComponent(situacion)}&deckId=${encodeURIComponent(deckId)}&playId=${encodeURIComponent(playId)}`;
      }

      const page = hasPayment ? "lienzoQQpica.html" : "lienzoQpica.html";
      return `/${page}?deckId=${encodeURIComponent(deckId)}&playId=${encodeURIComponent(playId)}`;
    }

    return `/mazo.html?id=${encodeURIComponent(deckId)}`;
  }

  function formatTodayHeader(date) {
    const formatter = new Intl.DateTimeFormat("es-AR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric"
    });

    return formatter
      .formatToParts(date)
      .map((part) => {
        if (part.type !== "weekday" && part.type !== "month") return part.value;
        if (!part.value) return part.value;
        return part.value.charAt(0).toUpperCase() + part.value.slice(1);
      })
      .join("");
  }

  function rowHourLabel(hour) {
    return `${pad2(hour)}:00`;
  }

  function getEntryTooltip(item) {
    const entryType = normalizeText(item?.calendar_entry_type);

    if (entryType === "PAYMENT") {
      const concept = String(item?.payment_concept || "").trim();
      const amount = String(item?.payment_amount || "").trim();
      const payment = parseFlowPayment(item?.play_code || "");
      const currency = String(payment?.currency || "").trim();

      const amountLabel = [currency, amount].filter(Boolean).join(" ").trim();
      const pieces = [concept, amountLabel].filter(Boolean);
      return pieces.length ? pieces.join(" - ") : "Pago";
    }

    const deckName = String(item?.deck_name || "").trim();
    const text = String(item?.play_text || item?.text || "").trim();

    if (deckName && text) return `${deckName} - ${text}`;
    return text || deckName || "Jugada";
  }

  function renderEntry(item, compact) {
    const leading = getLeadingVisual(item);
    const tooltip = getEntryTooltip(item);
    const href = getPlayHref(item);
    const text = String(item?.play_text || item?.text || "").trim();

    const leadingHtml =
      leading.type === "icon"
        ? `<img class="hoy-entry__icon" src="${leading.value}" alt="" />`
        : `<span class="hoy-entry__symbol">${escapeHtml(leading.value)}</span>`;

    return `
      <a class="hoy-entry" href="${href}" title="${escapeHtml(tooltip)}">
        ${leadingHtml}
        ${compact ? "" : `<span class="hoy-entry__text">${escapeHtml(text)}</span>`}
      </a>
    `;
  }

  function renderRowsByHour(itemsByHour, nowHour) {
    const rows = [];

    for (let hour = 0; hour < 24; hour += 1) {
      const items = itemsByHour[hour] || [];
      const compact = items.length > 3;

      const itemsHtml = items.length
        ? items.map((item) => renderEntry(item, compact)).join("")
        : `<span class="hoy-row__empty">-</span>`;

      rows.push(`
        <div class="hoy-row ${hour === nowHour ? "hoy-row--current" : ""}" data-hour="${hour}">
          <div class="hoy-row__hour">${rowHourLabel(hour)}</div>
          <div class="hoy-row__items">${itemsHtml}</div>
        </div>
      `);
    }

    return rows.join("");
  }

  async function fetchTodayPlays(date) {
    const token = localStorage.getItem("cooptrackToken");
    if (!token) return [];

    const ymd = toYmd(date);
    const response = await fetch(`/plays/almanaque?from=${ymd}&to=${ymd}`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!response.ok) {
      console.error("Error cargando hoy", response.status);
      return [];
    }

    const data = await response.json().catch(() => null);
    return Array.isArray(data?.plays) ? data.plays : [];
  }

  function buildItemsByHour(plays) {
    const byHour = {};

    plays.forEach((play) => {
      if (!isVisibleTodayPlay(play)) return;

      const calendarDate = getPlayCalendarDate(play);
      if (!calendarDate) return;

      const hour = Number(calendarDate.getHours());
      if (Number.isNaN(hour) || hour < 0 || hour > 23) return;

      if (!byHour[hour]) byHour[hour] = [];
      byHour[hour].push(play);
    });

    return byHour;
  }

  function scrollToCurrentHourRow(listEl, nowHour) {
    const rowHeight = 56;
    const targetHour = Math.max(0, nowHour - 1);
    listEl.scrollTop = targetHour * rowHeight;
  }

  async function renderHoy() {
    const now = new Date();
    const nowHour = now.getHours();

    const plays = await fetchTodayPlays(now);
    const itemsByHour = buildItemsByHour(plays);

    container.innerHTML = `
      <section class="hoy">
        <header class="hoy__header">${escapeHtml(formatTodayHeader(now))}</header>
        <div class="hoy__list" id="hoy-list">
          ${renderRowsByHour(itemsByHour, nowHour)}
        </div>
      </section>
    `;

    const listEl = document.getElementById("hoy-list");
    if (listEl) {
      requestAnimationFrame(() => {
        scrollToCurrentHourRow(listEl, nowHour);
      });
    }
  }

  renderHoy();
})();
