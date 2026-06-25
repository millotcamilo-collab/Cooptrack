(function () {
  function normalizeText(value) {
    return String(value || "").trim().toUpperCase();
  }

  function parseLocalDate(value) {
    if (!value) return null;

    if (typeof value === "string") {
      const trimmed = value.trim();

      const onlyDateMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (onlyDateMatch) {
        const year = Number(onlyDateMatch[1]);
        const month = Number(onlyDateMatch[2]) - 1;
        const day = Number(onlyDateMatch[3]);
        const localDate = new Date(year, month, day);
        localDate.setHours(0, 0, 0, 0);
        return localDate;
      }

      const localDateTimeMatch = trimmed.match(
        /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/
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
    const fromCalendar = parseLocalDate(play?.calendar_date);
    if (fromCalendar) return fromCalendar;

    const suit = normalizeText(play?.card_suit || play?.suit);
    const spadeMode = normalizeText(play?.spade_mode);

    let selectedValue = null;

    if (suit === "SPADE") {
      if (spadeMode === "APPOINTMENT") {
        selectedValue = play?.start_date;
      } else if (spadeMode === "DEADLINE") {
        selectedValue = play?.end_date;
      } else {
        selectedValue = play?.start_date || play?.end_date;
      }
    } else {
      selectedValue = play?.created_at;
    }

    return parseLocalDate(selectedValue);
  }

  function isVisibleCalendarPlay(play) {
    const rank = normalizeText(play?.card_rank || play?.rank);
    const text = String(play?.play_text || play?.text || "").trim();

    if (!["J", "Q"].includes(rank)) return false;
    if (!text) return false;

    return true;
  }

  window.CalendarPlays = {
    parseLocalDate,
    getPlayCalendarDate,
    isVisibleCalendarPlay
  };
})();
