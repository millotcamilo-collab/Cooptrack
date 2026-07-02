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
    const isQQPica = play.__entryType === "QQPICA";
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
          ${
            deckName
              ? `
                <div class="tablero-row__deck"><strong>${escapeHtml(deckName)}</strong></div>
              `
              : ""
          }

          <div class="tablero-row__title" style="font-weight: 400;">
            ${escapeHtml(description)}
          </div>
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