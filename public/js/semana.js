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

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function renderJotasBody(items = []) {
    if (!items.length) {
      return "";
    }

    return items.map((item) => {
      const symbol = getSuitSymbol(item.card_suit);
      const text = item.text || "";
      const deckId = item.deck_id;
      const href = deckId ? `/mazo.html?id=${encodeURIComponent(deckId)}` : "#";
      const label = `${symbol} ${text}`;

      return `
      <a
        class="dia__item-link"
        href="${href}"
        title="${escapeHtml(label)}"
      >
        ${escapeHtml(label)}
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