(function () {
  const API_BASE_URL = "https://cooptrack-backend.onrender.com";
  const pageConfig = window.transversalBarConfig || {};
  const filterEventName = pageConfig.filterEventName || "bitacora:filterSuit";
  const searchEventName = pageConfig.searchEventName || "bitacora:search";
  const isContabilidadMode = String(pageConfig.filterPrefix || "").toLowerCase() === "contabilidad";

  let allJotas = [];
  let activeSuitFilter = "";
  let activeSearchQuery = "";

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function normalizeRank(value) {
    return String(value || "").trim().toUpperCase();
  }

  function normalizeSuit(value) {
    return String(value || "").trim().toUpperCase();
  }

  function formatShortDateTime(value) {
    if (!value) return "—";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value ?? "");

    try {
      const parts = new Intl.DateTimeFormat("es-UY", {
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit"
      }).formatToParts(date);

      const map = {};
      parts.forEach((part) => {
        map[part.type] = part.value;
      });

      const weekday = String(map.weekday || "").replace(".", "");
      const day = map.day || "";
      const month = String(map.month || "").replace(".", "");
      const hour = map.hour || "";
      const minute = map.minute || "";

      const cap = (txt) =>
        txt ? txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase() : "";

      return `${cap(weekday)} ${day} ${cap(month)} ${hour}:${minute}`;
    } catch (error) {
      return String(value ?? "");
    }
  }

  function getHoursBetween(startValue, endValue) {
    if (!startValue || !endValue) return null;

    const start = new Date(startValue);
    const end = new Date(endValue);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;

    const diffMs = end.getTime() - start.getTime();
    if (diffMs <= 0) return null;

    const hours = diffMs / (1000 * 60 * 60);

    if (hours < 1) {
      const minutes = Math.round(diffMs / (1000 * 60));
      return `${minutes} min`;
    }

    const rounded = Math.round(hours * 10) / 10;
    return `${rounded} hr`;
  }

  function getHoursFromNow(targetValue) {
    if (!targetValue) return null;

    const now = new Date();
    const target = new Date(targetValue);

    if (Number.isNaN(target.getTime())) return null;

    const diffMs = target.getTime() - now.getTime();
    const absMs = Math.abs(diffMs);

    if (absMs < 60 * 1000) {
      return diffMs >= 0 ? "ahora" : "recién pasó";
    }

    if (absMs < 1000 * 60 * 60) {
      const minutes = Math.round(absMs / (1000 * 60));
      return diffMs >= 0 ? `faltan ${minutes} min` : `hace ${minutes} min`;
    }

    const hours = Math.round((absMs / (1000 * 60 * 60)) * 10) / 10;
    return diffMs >= 0 ? `faltan ${hours} hr` : `hace ${hours} hr`;
  }

  function getJpicaReadSummary(play) {
    const title = String(play?.play_text || play?.text || "").trim();
    const spadeMode = String(play?.spade_mode || "").trim().toUpperCase();
    const startDate = play?.start_date;
    const endDate = play?.end_date;
    const location = String(play?.location || "").trim();

    if (spadeMode === "DEADLINE") {
      const endLabel = formatShortDateTime(endDate);
      const distanceLabel = getHoursFromNow(endDate);
      const deadlineLabel = distanceLabel ? `${endLabel} - ${distanceLabel}` : endLabel;
      return [title, deadlineLabel].filter(Boolean).join(" · ");
    }

    const startLabel = formatShortDateTime(startDate);
    const durationLabel = getHoursBetween(startDate, endDate);
    const appointmentLabel = durationLabel
      ? `${startLabel} - ${durationLabel}`
      : startLabel;

    return [title, appointmentLabel, location].filter(Boolean).join(" · ");
  }

  function getAppointmentReadLabel(startValue, endValue, recurrenceType, weekdays, months) {
    const startLabel = formatShortDateTime(startValue);
    const durationLabel = getHoursBetween(startValue, endValue);

    const baseLabel = durationLabel
      ? `${startLabel} - ${durationLabel}`
      : startLabel;

    const recurrenceLabel = getRecurrenceSummary(recurrenceType, weekdays, months);
    return recurrenceLabel && recurrenceLabel !== "Sin rutina"
      ? `${baseLabel} · ${recurrenceLabel}`
      : baseLabel;
  }

  function getJpicaReadModeIconography(play) {
    const title = String(play?.play_text || play?.text || "").trim();
    const spadeMode = String(play?.spade_mode || "").trim().toUpperCase();
    const startDate = play?.start_date;
    const endDate = play?.end_date;
    const location = String(play?.location || "").trim();
    const hasRecurrence = Boolean(play?.has_recurrence);
    const recurrenceType = String(play?.recurrence_type || "").trim().toUpperCase();
    const recurrenceWeekdays = Array.isArray(play?.recurrence_weekdays)
      ? play.recurrence_weekdays
      : [];
    const recurrenceMonths = Array.isArray(play?.recurrence_months)
      ? play.recurrence_months
      : [];
    const recurrenceLabel = hasRecurrence
      ? getRecurrenceSummary(recurrenceType, recurrenceWeekdays, recurrenceMonths)
      : "";

    const ICONS = window.ICONS || {};
    const ACTIONS = ICONS.actions || {};
    const startIcon = ACTIONS.start || "/assets/icons/reloj60.gif";
    const endIcon = ACTIONS.end || "/assets/icons/reloj60.gif";
    const locationIcon = ACTIONS.location || "/assets/icons/LocGlobito80.gif";
    const deadlineIcon = ACTIONS.deadline || ACTIONS.approve || ACTIONS.bomb || "/assets/icons/META60.gif";

    if (spadeMode === "DEADLINE") {
      const deadlineLabel = getDeadlineLabel(endDate);

      return `
        <div class="tablero-row__mode-read" data-role="mode-read">
          <div class="tablero-row__fields tablero-row__fields--jpike-read tablero-row__fields--deadline" data-role="deadline-read">
            <div class="tablero-row__field-inline tablero-row__field-inline--title">
              <span>${escapeHtml(title || "Sin texto")}</span>
            </div>

            <div class="tablero-row__field-inline">
              <img src="${escapeHtml(deadlineIcon)}" alt="Fin" class="tablero-row__field-icon" />
              <span>${escapeHtml(deadlineLabel)}</span>
            </div>
          </div>

          ${recurrenceLabel
            ? `<div class="tablero-row__fields tablero-row__fields--recurrence" data-role="recurrence-read">${escapeHtml(recurrenceLabel)}</div>`
            : ""}
        </div>
      `;
    }

    return `
      <div class="tablero-row__mode-read" data-role="mode-read">
        <div class="tablero-row__fields tablero-row__fields--jpike-read tablero-row__fields--appointment" data-role="appointment-read">
          <div class="tablero-row__field-inline tablero-row__field-inline--title">
            <span>${escapeHtml(title || "Sin texto")}</span>
          </div>

          <div class="tablero-row__field-inline">
            <img src="${escapeHtml(startIcon)}" alt="Inicio" class="tablero-row__field-icon" />
            <span>${escapeHtml(getAppointmentReadLabel(startDate, endDate, recurrenceType, recurrenceWeekdays, recurrenceMonths))}</span>
          </div>

          <div class="tablero-row__field-inline">
            <img src="${escapeHtml(locationIcon)}" alt="Locación" class="tablero-row__field-icon" />
            <span>${escapeHtml(location || "—")}</span>
          </div>
        </div>

        ${recurrenceLabel
          ? `<div class="tablero-row__fields tablero-row__fields--recurrence" data-role="recurrence-read">${escapeHtml(recurrenceLabel)}</div>`
          : ""}
      </div>
    `;
  }

  function getDeadlineLabel(endDate) {
    const endLabel = formatShortDateTime(endDate);
    const distanceLabel = getHoursFromNow(endDate);

    return distanceLabel ? `${endLabel} · ${distanceLabel}` : endLabel;
  }

  function getRecurrenceSummary(type, weekdays, months) {
    const normalizedType = String(type || "").trim().toUpperCase();

    if (!normalizedType) return "Sin rutina";

    if (normalizedType === "WEEKLY") {
      return `Rutina semanal: ${Array.isArray(weekdays) && weekdays.length ? weekdays.join(", ") : "—"}`;
    }

    if (normalizedType === "MONTHLY") {
      return `Rutina mensual: ${Array.isArray(months) && months.length ? months.join(", ") : "—"}`;
    }

    return "Sin rutina";
  }

  function normalizeAmount(value) {
    const raw = String(value ?? "").trim();
    if (!raw) return null;

    const normalizedMinus = raw
      .replace(/−/g, "-")
      .replace(/—/g, "-")
      .replace(/–/g, "-")
      .trim();

    const isBracketNegative = /^\(.*\)$/.test(normalizedMinus);

    const base = isBracketNegative
      ? normalizedMinus.replace(/^\(/, "").replace(/\)$/, "")
      : normalizedMinus;

    const normalized = base.replace(/,/g, ".").replace(/[^0-9+\-.]/g, "");
    const parsed = Number(normalized);

    if (Number.isNaN(parsed)) return null;

    return isBracketNegative ? -Math.abs(parsed) : parsed;
  }

  function parsePaymentFromPlayCode(playCode) {
    const parts = String(playCode || "").split("§");
    const flow = String(parts[7] || "");

    const chunks = flow
      .split(";")
      .map((item) => item.trim())
      .filter(Boolean);

    for (const chunk of chunks) {
      if (!chunk.toLowerCase().startsWith("pay:qheart")) continue;

      const payment = {};
      chunk.split("|").forEach((part, index) => {
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

  function parseRecipients(playCode) {
    const recipientsRaw = String(playCode || "").split("§")[8] || "";

    return recipientsRaw
      .split(/[;,|\s]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function isCurrentUserMentionedInQQPica(play, currentUserId) {
    const id = Number(currentUserId || 0);
    if (!id) return false;

    const creatorId = Number(play.created_by_user_id || 0);
    const targetId = Number(play.target_user_id || 0);

    if (creatorId === id || targetId === id) return true;

    const recipients = parseRecipients(play.play_code || "");
    return recipients.includes(String(id)) || recipients.includes(`U:${id}`);
  }

  function getCurrentUserIdFromToken() {
    try {
      const token = localStorage.getItem("cooptrackToken");
      if (!token) return null;

      const payload = JSON.parse(atob(token.split(".")[1]));
      return Number(payload.userId || 0) || null;
    } catch (error) {
      console.error("No se pudo leer userId del token:", error);
      return null;
    }
  }

  function getAllowedJotaSuits() {
    const config = window.transversalBarConfig || {};
    if (Array.isArray(config.allowedSuits) && config.allowedSuits.length) {
      return config.allowedSuits.map((suit) => String(suit || "").toUpperCase());
    }

    return ["HEART", "SPADE", "CLUB"];
  }

  function getContabilidadEntryKey(play) {
    if (play.__entryType === "QQPICA") {
      const payment = play.__payment || {};
      const deckId = Number(play.deck_id || 0);
      const parentId = Number(play.parent_play_id || 0);
      const createdBy = Number(play.created_by_user_id || 0);
      const target = Number(play.target_user_id || 0);
      const concept = String(payment.concept || "").trim();
      const amount = String(payment.amount || "").trim();
      const payDate = String(payment.payDate || payment.payAt || "").trim();

      return [
        "QQPICA",
        deckId,
        parentId,
        createdBy,
        target,
        concept,
        amount,
        payDate
      ].join("|");
    }

    return `PLAY:${Number(play.id || 0)}`;
  }

  function dedupeContabilidadEntries(entries) {
    const seen = new Set();
    const output = [];

    entries.forEach((entry) => {
      const key = getContabilidadEntryKey(entry);
      if (seen.has(key)) return;
      seen.add(key);
      output.push(entry);
    });

    return output;
  }

  async function fetchJotas() {
    try {
      const token = localStorage.getItem("cooptrackToken");
      if (!token) return [];

      const currentUserId = getCurrentUserIdFromToken();
      if (!currentUserId) return [];

      const response = await fetch(`${API_BASE_URL}/plays/bitacora`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error(`Error HTTP ${response.status}`);
      }

      const data = await response.json();
      const plays = Array.isArray(data?.plays) ? data.plays : [];
      const allowedSuits = getAllowedJotaSuits();

      const filtered = plays.filter((play) => {
        const rank = normalizeRank(play.card_rank || play.rank);
        const suit = normalizeSuit(play.card_suit || play.suit);
        const creatorId = Number(play.created_by_user_id || 0);
        const parentPlayId = Number(play.parent_play_id || 0);

        if (isContabilidadMode) {
          const isOwnedJClub = rank === "J" && suit === "CLUB" && creatorId === currentUserId;

          const payment = parsePaymentFromPlayCode(play.play_code || "");
          const isQQPica = rank === "Q" && suit === "SPADE" && Boolean(payment);
          const isMentioned = isCurrentUserMentionedInQQPica(play, currentUserId);

          if (isQQPica && isMentioned) {
            play.__entryType = "QQPICA";
            play.__payment = payment;
            return true;
          }

          if (isOwnedJClub) {
            play.__entryType = "JCLUB";
            return true;
          }

          return false;
        }

        // En bitácora no mostramos J♥ hijas (solo J♥ raíz y J♠).
        if (rank === "J" && suit === "HEART" && parentPlayId > 0) {
          return false;
        }

        return (
          rank === "J" &&
          allowedSuits.includes(suit) &&
          creatorId === currentUserId
        );
      });

      return isContabilidadMode
        ? dedupeContabilidadEntries(filtered)
        : filtered;
    } catch (error) {
      console.error("Error cargando jotas:", error);
      return [];
    }
  }

  function getCardLabel(play) {
    if (play.__entryType === "QQPICA") return "Q♠";

    const suit = normalizeSuit(play.card_suit || play.suit);

    if (suit === "HEART") return "J♥";
    if (suit === "SPADE") return "J♠";
    if (suit === "CLUB") return "J♣";
    if (suit === "DIAMOND") return "J♦";

    return "J";
  }

  function getDescription(play) {
    if (play.__entryType === "QQPICA") {
      const payment = play.__payment || {};
      const concept = String(payment.concept || "").trim();
      if (concept) return concept;
    }

    return String(play.play_text || play.text || "").trim() || "Sin descripción";
  }

  function getDeckId(play) {
    return play.deck_id || play.deckId || null;
  }

  function getJotaCssClass(play) {
    if (play.__entryType === "QQPICA") return "tablero-row--jpike";

    const suit = normalizeSuit(play.card_suit || play.suit);

    if (suit === "HEART") return "tablero-row--jcorazon";
    if (suit === "SPADE") return "tablero-row--jpike";
    if (suit === "CLUB") return "tablero-row--jtrebol";

    return "";
  }

  function getPlayHref(play) {
    const deckId = Number(play.deck_id || 0);
    const playId = Number(play.id || 0);

    if (!deckId || !playId) return "";

    if (play.__entryType === "QQPICA") {
      return `/lienzoQQpica.html?deckId=${deckId}&playId=${playId}`;
    }

    const rank = normalizeRank(play.card_rank || play.rank);
    const suit = normalizeSuit(play.card_suit || play.suit);

    if (rank === "J" && suit === "HEART") {
      return `/lienzoJcorazon.html?deckId=${deckId}&playId=${playId}`;
    }

    if (rank === "J" && suit === "SPADE") {
      return `/lienzoJpica.html?deckId=${deckId}&playId=${playId}`;
    }

    return `/mazo.html?id=${deckId}`;
  }

  function getQQPicaEconomicTone(play) {
    const payment = play.__payment || {};
    const numericAmount = normalizeAmount(payment.amount);

    if (numericAmount === null) return "credit";
    if (numericAmount < 0) return "debit";
    if (numericAmount > 0) return "credit";
    return "credit";
  }

  function buildJotaRowHTML(play) {
    const playId = Number(play.id || 0);
    const cardLabel = getCardLabel(play);
    const description = getDescription(play);
    const deckId = getDeckId(play);
    const deckName = String(
      play.deck_name || play.deckName || ""
    ).trim();
    const payment = play.__payment || null;
    const paymentCurrency = String(payment?.currency || "").trim();
    const currencySymbol = String(
      paymentCurrency || play.currency_symbol || play.deck_currency_symbol || play.currencySymbol || ""
    ).trim();
    const amountValue = String(payment?.amount ?? play.amount ?? "").trim();
    const isClub = normalizeSuit(play.card_suit || play.suit) === "CLUB";
    const isJSpade =
      normalizeRank(play.card_rank || play.rank) === "J" &&
      normalizeSuit(play.card_suit || play.suit) === "SPADE";
    const isQQPica = play.__entryType === "QQPICA";
    const spadeReadSummary = isJSpade ? getJpicaReadSummary(play) : "";
    const jpicaReadIconography = isJSpade ? getJpicaReadModeIconography(play) : "";
    const qqEconomicTone = getQQPicaEconomicTone(play);
    const economicToneClass = isClub
      ? "tablero-row__economic--debit"
      : isQQPica && qqEconomicTone === "debit"
        ? "tablero-row__economic--debit"
        : "tablero-row__economic--credit";

    return `
      <button
        type="button"
        class="tablero-row tablero-row--bitacora ${getJotaCssClass(play)}"
        data-play-id="${playId}"
        data-deck-id="${deckId || ""}"
      >
        <div class="tablero-row__left">
          <div class="tablero-row__card">${escapeHtml(cardLabel)}</div>
        </div>

        <div class="tablero-row__center">
          ${deckName
            ? `
              <div class="tablero-row__deck"><strong>${escapeHtml(deckName)}</strong></div>
            `
            : ""}

          ${isJSpade
            ? `
              <div class="tablero-row__jpike-readwrap">
                ${jpicaReadIconography || `
                  <div class="tablero-row__title" style="font-weight: 400;">
                    ${escapeHtml(spadeReadSummary || description)}
                  </div>
                `}
              </div>
            `
            : `
              <div class="tablero-row__title" style="font-weight: 400;">
                ${escapeHtml(description)}
              </div>
            `}
        </div>

        <div class="tablero-row__right">
          ${(isClub || isQQPica)
            ? `
                <span class="tablero-row__amount-card ${economicToneClass}">${isQQPica ? "Q♦" : "J♦"}</span>
                ${currencySymbol
                  ? `
                      <span class="tablero-row__currency-symbol ${economicToneClass}">
                        ${escapeHtml(currencySymbol)}
                      </span>
                    `
                  : ""}
                <span class="tablero-row__amount-view ${economicToneClass}">
                  ${escapeHtml(amountValue || "—")}
                </span>
              `
            : ""}
        </div>
      </button>
    `;
  }

  function applyFilters(plays) {
    return plays.filter((play) => {
      const suit = normalizeSuit(play.card_suit || play.suit);
      const description = getDescription(play).toLowerCase();
      const deckName = String(play.deck_name || play.deckName || "").trim().toLowerCase();

      const suitOk = !activeSuitFilter || suit === activeSuitFilter;
      const searchOk =
        !activeSearchQuery ||
        description.includes(activeSearchQuery.toLowerCase()) ||
        deckName.includes(activeSearchQuery.toLowerCase());

      return suitOk && searchOk;
    });
  }

  function bindRowEvents() {
    document.querySelectorAll(".tablero-row--bitacora").forEach((row) => {
      row.addEventListener("click", () => {
        const playId = Number(row.dataset.playId || 0);
        const play = allJotas.find((item) => Number(item.id || 0) === playId);
        if (!play) return;

        const href = getPlayHref(play);
        if (!href) return;

        window.location.href = href;
      });
    });
  }

  function renderJotas() {
    const container = document.getElementById("jotas-container");
    if (!container) return;

    const visibleJotas = applyFilters(allJotas);

    if (!visibleJotas.length) {
      container.innerHTML = `
        <div class="tablero-empty-state">
          No hay jugadas para mostrar.
        </div>
      `;
      return;
    }

    container.innerHTML = visibleJotas
      .map(buildJotaRowHTML)
      .join("");

    bindRowEvents();
  }

  async function initJotas() {
    allJotas = await fetchJotas();
    renderJotas();
  }

  document.addEventListener(filterEventName, (event) => {
    activeSuitFilter = String(event.detail?.suit || "").toUpperCase();
    renderJotas();
  });

  document.addEventListener(searchEventName, (event) => {
    activeSearchQuery = String(event.detail?.query || "").trim();
    renderJotas();
  });

  document.addEventListener("DOMContentLoaded", initJotas);
})();