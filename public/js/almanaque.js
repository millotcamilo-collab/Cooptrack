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
        "Lunes",
        "Martes",
        "Miércoles",
        "Jueves",
        "Viernes",
        "Sábado",
        "Domingo"
    ];

    async function fetchAlmanaqueData(from, to) {
        const token = localStorage.getItem("cooptrackToken");

        const res = await fetch(
            `/plays/almanaque?from=${from}&to=${to}`,
            {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );

        if (!res.ok) {
            console.error("Error fetching almanaque", res.status);
            return [];
        }

        const data = await res.json();
        return data.plays || [];
    }

    function groupByYmd(plays) {
        const map = {};

        plays.forEach((p) => {
            const date = new Date(p.created_at);
            const ymd = toYmd(date);

            if (!map[ymd]) {
                map[ymd] = [];
            }

            map[ymd].push(p);
        });

        return map;
    }

    function applyFilters(plays) {
        return plays.filter((play) => {
            const suit = String(play.card_suit || "").toUpperCase();
            const text = String(play.play_text || play.text || "").toLowerCase();
            const deckName = String(play.deck_name || "").toLowerCase();

            const suitOk = !activeSuitFilter || suit === activeSuitFilter;

            const searchOk =
                !activeSearchQuery ||
                text.includes(activeSearchQuery.toLowerCase()) ||
                deckName.includes(activeSearchQuery.toLowerCase());

            return suitOk && searchOk;
        });
    }

    function getVisibleRange() {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();

        const firstDay = new Date(year, month, 1);
        const firstMonday = getMondayOfWeek(firstDay);

        const lastDay = addDays(firstMonday, 6 * 7 - 1); // 6 semanas

        return {
            from: toYmd(firstMonday),
            to: toYmd(lastDay)
        };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let currentDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    let allPlays = [];
    let activeSuitFilter = "";
    let activeSearchQuery = "";


    function toYmd(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    }

    function isSameDay(a, b) {
        return (
            a.getFullYear() === b.getFullYear() &&
            a.getMonth() === b.getMonth() &&
            a.getDate() === b.getDate()
        );
    }

    function getMondayOfWeek(date) {
        const copy = new Date(date);
        const jsDay = copy.getDay();
        const normalizedDay = jsDay === 0 ? 6 : jsDay - 1;
        copy.setDate(copy.getDate() - normalizedDay);
        copy.setHours(0, 0, 0, 0);
        return copy;
    }

    function addDays(date, amount) {
        const copy = new Date(date);
        copy.setDate(copy.getDate() + amount);
        return copy;
    }

    function renderWeeks(jotasByDate) {
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
                    visibleMonth: month,
                    jotasByDate
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
        const jsDay = currentDate.getDay();
        const normalizedDay = jsDay === 0 ? 6 : jsDay - 1;

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
                currentDate.setHours(0, 0, 0, 0);

                render();
            });
        });
    }

    async function render() {
        const { from, to } = getVisibleRange();
        allPlays = await fetchAlmanaqueData(from, to);
        const filteredPlays = applyFilters(allPlays);
        const jotasByDate = groupByYmd(filteredPlays);

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

            ${renderWeeks(jotasByDate)}
        </section>
    `;

        bindMonthButtons();
    }

    document.addEventListener("almanaque:filterSuit", (event) => {
        const clickedSuit = String(event.detail?.suit || "").toUpperCase();

        activeSuitFilter = activeSuitFilter === clickedSuit ? "" : clickedSuit;
        render();
    });
    document.addEventListener("almanaque:search", (event) => {
        activeSearchQuery = String(event.detail?.query || "").trim();
        render();
    });

    render();
})();