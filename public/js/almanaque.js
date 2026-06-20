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

    function parseLocalDate(value) {
        if (!value) return null;

        if (typeof value === "string") {
            const trimmed = value.trim();

            // YYYY-MM-DD => parse local
            const onlyDateMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
            if (onlyDateMatch) {
                const year = Number(onlyDateMatch[1]);
                const month = Number(onlyDateMatch[2]) - 1;
                const day = Number(onlyDateMatch[3]);
                const localDate = new Date(year, month, day);
                localDate.setHours(0, 0, 0, 0);
                return localDate;
            }

            // YYYY-MM-DDTHH:mm => parse local
            const localDateTimeMatch = trimmed.match(
                /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/
            );
            if (localDateTimeMatch) {
                const year = Number(localDateTimeMatch[1]);
                const month = Number(localDateTimeMatch[2]) - 1;
                const day = Number(localDateTimeMatch[3]);
                const hours = Number(localDateTimeMatch[4]);
                const minutes = Number(localDateTimeMatch[5]);
                return new Date(year, month, day, hours, minutes, 0, 0);
            }
        }

        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) return null;

        return parsed;
    }

    function getPlayCalendarDate(play) {
        const suit = String(play?.card_suit || play?.suit || "").toUpperCase();
        const spadeMode = String(play?.spade_mode || "").toUpperCase();

        let selectedValue = null;

        if (suit === "SPADE") {
            if (spadeMode === "APPOINTMENT") {
                selectedValue = play?.start_date;
            } else if (spadeMode === "DEADLINE") {
                selectedValue = play?.end_date;
            } else {
                selectedValue =
                    play?.start_date ||
                    play?.end_date;
            }
        } else {
            selectedValue = play?.created_at;
        }

        return parseLocalDate(selectedValue);
    }

    function getPlayCalendarTime(play) {
        const date = getPlayCalendarDate(play);
        return date ? date.getTime() : Number.POSITIVE_INFINITY;
    }

    function isVisibleCalendarPlay(play) {
        const rank = String(play.card_rank || "").toUpperCase();
        const suit = String(play.card_suit || "").toUpperCase();
        const text = String(play.play_text || "").trim();

        // Solo queremos J y Q reales
        if (!["J", "Q"].includes(rank)) return false;

        // Evitar basura sin contenido
        if (!text) return false;

        return true;
    }

    function groupByYmd(plays) {
        const map = {};

        plays.forEach((p) => {
            const date = getPlayCalendarDate(p);
            if (!date) return;

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

            const suitOk =
                !activeSuitFilters.length ||
                activeSuitFilters.includes(suit);

            const searchOk =
                !activeSearchQuery ||
                text.includes(activeSearchQuery.toLowerCase()) ||
                deckName.includes(activeSearchQuery.toLowerCase());

            return suitOk && searchOk;
        });
    }

    function getVisibleRange() {
        const firstMonday = getDisplayStartMonday();
        const lastDay = addDays(firstMonday, 6 * 7 - 1);

        return {
            from: toYmd(firstMonday),
            to: toYmd(lastDay)
        };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let currentDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    let allPlays = [];
    let activeSuitFilters = ["SPADE"];
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

        const firstMonday = getDisplayStartMonday();

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

    function getDisplayStartMonday() {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();

        const firstDayOfMonth = new Date(year, month, 1);
        const firstMondayOfMonth = getMondayOfWeek(firstDayOfMonth);

        const isCurrentMonth =
            currentDate.getFullYear() === today.getFullYear() &&
            currentDate.getMonth() === today.getMonth();

        if (!isCurrentMonth) {
            return firstMondayOfMonth;
        }

        const currentWeekMonday = getMondayOfWeek(today);

        return addDays(currentWeekMonday, -7);
    }

    function getFirstChronologicalMatch(plays) {
        if (!plays.length) return null;

        const sorted = [...plays].sort((a, b) => {
            return getPlayCalendarTime(a) - getPlayCalendarTime(b);
        });

        return sorted[0];
    }

    async function render() {
        const { from, to } = getVisibleRange();
        allPlays = await fetchAlmanaqueData(from, to);
        let filteredPlays = applyFilters(allPlays);

        if (activeSearchQuery && filteredPlays.length) {
            const firstMatchDate = getPlayCalendarDate(firstMatch);

            if (firstMatch?.created_at) {
                currentDate = new Date(firstMatchDate);
                currentDate.setHours(0, 0, 0, 0);

                const nextRange = getVisibleRange();
                allPlays = await fetchAlmanaqueData(nextRange.from, nextRange.to);
                filteredPlays = applyFilters(allPlays);
            }
        }

        const cleanPlays = filteredPlays.filter(isVisibleCalendarPlay);

        const jotasByDate = groupByYmd(cleanPlays);

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
        activeSuitFilters = Array.isArray(event.detail?.suits)
            ? event.detail.suits.map((suit) => String(suit).toUpperCase())
            : [];

        render();
    });

    document.addEventListener("almanaque:search", (event) => {
        activeSearchQuery = String(event.detail?.query || "").trim();
        render();
    });

    render();
})();