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
    let currentDate = new Date(today.getFullYear(), today.getMonth(), 12);

    function isSameDay(a, b) {
        return (
            a.getFullYear() === b.getFullYear() &&
            a.getMonth() === b.getMonth() &&
            a.getDate() === b.getDate()
        );
    }

    function getMondayOfWeek(date) {
        const copy = new Date(date);
        const jsDay = copy.getDay(); // domingo=0
        const normalizedDay = jsDay === 0 ? 6 : jsDay - 1; // lunes=0
        copy.setDate(copy.getDate() - normalizedDay);
        copy.setHours(0, 0, 0, 0);
        return copy;
    }

    function addDays(date, amount) {
        const copy = new Date(date);
        copy.setDate(copy.getDate() + amount);
        return copy;
    }

    function renderWeeks() {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();

        const firstDayOfMonth = new Date(year, month, 1);
        const firstMonday = getMondayOfWeek(firstDayOfMonth);

        const weeksHtml = [];
        const totalWeeks = 6;

        for (let i = 0; i < totalWeeks; i += 1) {
            const mondayDate = addDays(firstMonday, i * 7);

            weeksHtml.push(
                window.renderSemana({
                    mondayDate,
                    currentDate,
                    today,
                    visibleMonth: month
                })
            );
        }

        return `
    <div class="almanaque__weeks">
      ${weeksHtml.join("")}
    </div>
  `;
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

    function bindMonthButtons() {
        const buttons = container.querySelectorAll(".almanaque__month-btn");

        buttons.forEach((button) => {
            button.addEventListener("click", () => {
                const monthIndex = Number(button.dataset.month);
                if (Number.isNaN(monthIndex)) return;

                const year = currentDate.getFullYear();
                const currentDay = currentDate.getDate();
                const maxDay = new Date(year, monthIndex + 1, 0).getDate();
                const safeDay = Math.min(currentDay, maxDay);

                currentDate = new Date(year, monthIndex, safeDay);
                render();
            });
        });
    }

    function render() {
        const monthsHtml = MONTHS.map((monthName, index) => {
            return `
      <button
        type="button"
        class="${getMonthCellClass(index)} almanaque__month-btn"
        data-month="${index}"
      >
        ${monthName}
      </button>
    `;
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

      ${renderWeeks()}
    </section>
  `;

        bindMonthButtons();
    }

    render();
})();