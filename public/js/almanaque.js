(function () {
  const container = document.getElementById("almanaque-container");
  if (!container) return;

  const MONTHS = [
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Setiembre",
    "Octubre",
    "Noviembre",
    "Diciembre"
  ];

  const DAYS = [
    "LUNES",
    "MARTES",
    "MIÉRCOLES",
    "JUEVES",
    "VIERNES",
    "SÁBADO",
    "DOMINGO"
  ];

  const today = new Date();

  // después esto lo conectamos con navegación real del usuario
  const currentDate = new Date(today.getFullYear(), today.getMonth(), 12);

  function isSameDay(a, b) {
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  }

  function getMonthCellClass(monthIndex) {
    const todayMonth = today.getMonth();
    const currentMonth = currentDate.getMonth();

    if (todayMonth === monthIndex) {
      return "almanaque__cell almanaque__cell--today";
    }

    if (currentMonth === monthIndex) {
      return "almanaque__cell almanaque__cell--current";
    }

    return "almanaque__cell";
  }

  function getDayHeaderClass(dayIndex) {
    const jsDay = currentDate.getDay(); // domingo=0
    const normalizedDay = jsDay === 0 ? 6 : jsDay - 1; // lunes=0

    if (isSameDay(today, currentDate) && normalizedDay === dayIndex) {
      return "almanaque__cell almanaque__cell--today";
    }

    if (normalizedDay === dayIndex) {
      return "almanaque__cell almanaque__cell--current";
    }

    return "almanaque__cell";
  }

  function render() {
    const monthsHtml = MONTHS.map((monthName, index) => {
      return `<div class="${getMonthCellClass(index)}">${monthName}</div>`;
    }).join("");

    const daysHtml = DAYS.map((dayName, index) => {
      return `<div class="${getDayHeaderClass(index)}">${dayName}</div>`;
    }).join("");

    container.innerHTML = `
      <section class="almanaque">
        <div class="almanaque__months">
          ${monthsHtml}
        </div>

        <div class="almanaque__days">
          ${daysHtml}
        </div>
      </section>
    `;
  }

  render();
})();