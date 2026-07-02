(function () {
  function normalizeStatus(value) {
    return String(value || "").trim().toUpperCase();
  }

  function normalizeRank(value) {
    return String(value || "").trim().toUpperCase();
  }

  function normalizeSuit(value) {
    return String(value || "").trim().toUpperCase();
  }

  function isArchivedPlay(play) {
    const rank = normalizeRank(play?.card_rank || play?.rank);
    const status = normalizeStatus(play?.play_status || play?.status);

    if (rank === "J") return ["CANCELLED", "REJECTED", "DELETED"].includes(status);
    if (rank === "Q") return ["REJECTED", "CANCELLED"].includes(status);
    if (rank === "K") return ["QUIT", "FIRED", "REJECTED", "CANCELLED"].includes(status);
    if (rank === "A") return ["REJECTED", "CANCELLED", "TRANSFERRED"].includes(status);

    return false;
  }

  function renderArchivoMazo(deck, plays, state = {}) {
    const container = document.getElementById("archivo-container");
    if (!container) return;

    const archived = (Array.isArray(plays) ? plays : [])
      .filter(isArchivedPlay);

    if (!archived.length) {
      container.innerHTML = `
        <section class="tablero">
          <p class="tablero-empty">No hay jugadas archivadas para este mazo.</p>
        </section>
      `;
      return;
    }

    container.innerHTML = `
      <section class="tablero">
        ${archived.map((play) => renderArchivedRow(play, deck, state)).join("")}
      </section>
    `;

    bindLienzoOpenEvents(container);
  }

  function parsePlayCode(code) {
    const parts = String(code || "").split("§");

    return {
      flow: parts[7] || ""
    };
  }

  function parseFlowMetadata(flowValue) {
    const raw = String(flowValue || "").trim();
    if (!raw) return { baseFlow: "", payment: null };

    const chunks = raw
      .split(";")
      .map((item) => item.trim())
      .filter(Boolean);

    let baseFlow = "";
    let payment = null;

    chunks.forEach((chunk) => {
      if (chunk.startsWith("pay:QHEART")) {
        const parts = chunk.split("|");
        const paymentData = {
          attachedRank: "Q",
          attachedSuit: "HEART"
        };

        parts.forEach((part, index) => {
          if (index === 0) return;

          const separatorIndex = part.indexOf(":");
          if (separatorIndex === -1) return;

          const key = part.slice(0, separatorIndex).trim();
          const value = part.slice(separatorIndex + 1).trim();

          if (!key) return;
          paymentData[key] = value;
        });

        payment = paymentData;
      } else if (!baseFlow) {
        baseFlow = chunk;
      }
    });

    return { baseFlow, payment };
  }

  function getQSpadeSituation(play) {
    const parsed = parsePlayCode(play?.play_code || "");
    const meta = parseFlowMetadata(parsed?.flow);

    const amount = String(meta?.payment?.amount || "").trim();
    const payDate = String(meta?.payment?.payDate || "").trim();
    const concept = String(meta?.payment?.concept || "").trim();

    return amount && payDate && concept ? "QQPICA_ENTRA" : "QPICA_ENTRA";
  }

  function buildPlayUrl(page, deckId, playId) {
    const separator = String(page || "").includes("?") ? "&" : "?";
    return `${page}${separator}deckId=${deckId}&playId=${playId}`;
  }

  function resolveLienzoPageForPlay(play) {
    if (!play) return "/lienzo.html";

    const rank = normalizeRank(play?.card_rank || play?.rank);
    const suit = normalizeSuit(play?.card_suit || play?.suit);
    const status = normalizeRank(play?.play_status || play?.status);

    if (rank === "J" && suit === "HEART") {
      return "/lienzoJcorazon.html";
    }

    if (rank === "J" && suit === "SPADE") {
      return "/lienzoJpica.html";
    }

    if (rank === "Q" && suit === "SPADE") {
      if (["SENT", "PENDING", "APPROVED", "REJECTED", "CANCELLED", "DONE", "QUIT", "FIRED"].includes(status)) {
        return `/amsterdam.html?situacion=${getQSpadeSituation(play)}`;
      }

      const parsed = parsePlayCode(play?.play_code || "");
      const meta = parseFlowMetadata(parsed?.flow);

      const amount = String(meta?.payment?.amount || "").trim();
      const payDate = String(meta?.payment?.payDate || "").trim();
      const concept = String(meta?.payment?.concept || "").trim();

      if (amount && payDate && concept) {
        return "/lienzoQQpica.html";
      }

      return "/lienzoQpica.html";
    }

    return "/lienzo.html";
  }

  function bindLienzoOpenEvents(container) {
    if (!container || container.dataset.lienzoBound === "1") return;

    container.addEventListener("click", (event) => {
      if (
        event.target.closest("button[data-action]") ||
        event.target.closest("input") ||
        event.target.closest("select") ||
        event.target.closest("textarea") ||
        event.target.closest("label")
      ) {
        return;
      }

      const row = event.target.closest('[data-open-lienzo="true"]');
      if (!row || !container.contains(row)) return;

      const playId = Number(row.dataset.playId || 0);
      const deckId =
        row.dataset.deckId ||
        window.__currentDeck?.id ||
        window.__currentState?.deck?.id ||
        new URLSearchParams(window.location.search).get("id");

      if (!playId || !deckId) {
        console.warn("No se pudo abrir lienzo desde archivo", { playId, deckId });
        return;
      }

      const currentPlays = Array.isArray(window.__currentState?.plays)
        ? window.__currentState.plays
        : [];

      const play = currentPlays.find((item) => Number(item?.id || 0) === playId) || null;
      const nextPage = resolveLienzoPageForPlay(play);

      window.location.href = buildPlayUrl(nextPage, deckId, playId);
    });

    container.dataset.lienzoBound = "1";
  }

function renderArchivedRow(play, deck, state) {
  const rank = normalizeRank(play?.card_rank || play?.rank);
  const suit = normalizeSuit(play?.card_suit || play?.suit);

  const context = {
    deck,
    state,
    helpers: {
      escapeHtml
    }
  };

  // Use same J renderers as tablero.js
  if (rank === "J") {
    let rendererName = null;
    if (suit === "HEART") rendererName = "Jcorazon";
    else if (suit === "SPADE") rendererName = "Jpike";
    else if (suit === "CLUB") rendererName = "Jtrebol";
    else if (suit === "DIAMOND") rendererName = "Jdiamante";

    if (rendererName) {
      const renderer = window[`render${rendererName}`];
      if (typeof renderer === "function") {
        try {
          return renderer(play, context);
        } catch (error) {
          console.error(`Error renderizando ${rendererName}:`, error);
        }
      }
    }
  }

  if (rank === "Q" && typeof renderQpike === "function") {
    return renderQpike(play, context);
  }

  if (rank === "K" && typeof renderKrow === "function") {
    return renderKrow(play, context);
  }

  if (rank === "A" && typeof renderArow === "function") {
    return renderArow(play, context);
  }

  return renderArchivoMazoRow(play);
}

function renderArchivoMazoRow(play) {
  const rank = normalizeRank(play?.card_rank || play?.rank);
  const suit = normalizeSuit(play?.card_suit || play?.suit);
  const symbol = suitToSymbol(suit);
  const text = escapeHtml(play?.play_text || "Sin texto");
  const status = normalizeStatus(play?.play_status || play?.status || "");

  return `
    <article class="tablero-row tablero-row--fallback">
      <div class="tablero-row__left">
        <div class="tablero-row__card">${escapeHtml(rank)}${escapeHtml(symbol)}</div>
      </div>

      <div class="tablero-row__center">
        <div class="tablero-row__title">${text}</div>
        <div class="tablero-row__meta">Estado: ${escapeHtml(status)}</div>
      </div>

      <div class="tablero-row__right"></div>
    </article>
  `;
}

  function suitToSymbol(suit) {
    if (suit === "HEART") return "♥";
    if (suit === "SPADE") return "♠";
    if (suit === "DIAMOND") return "♦";
    if (suit === "CLUB") return "♣";
    return "";
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  window.renderArchivoMazo = renderArchivoMazo;
})();