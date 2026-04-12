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

  function renderSemana({
    mondayDate,
    currentDate,
    today,
    visibleMonth
  } = {}) {
    if (!(mondayDate instanceof Date) || Number.isNaN(mondayDate.getTime())) {
      return "";
    }

    const daysHtml = [];

    for (let i = 0; i < 7; i += 1) {
      const date = addDays(mondayDate, i);
      const isToday = today ? isSameDay(date, today) : false;
      const isCurrent = currentDate ? isSameDay(date, currentDate) : false;
      const isOutsideMonth =
        typeof visibleMonth === "number"
          ? date.getMonth() !== visibleMonth
          : false;

      daysHtml.push(
        window.renderDia({
          headerText: String(date.getDate()),
          bodyHtml: "",
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