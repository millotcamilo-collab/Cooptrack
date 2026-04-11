(function () {
  const API_BASE_URL = "https://cooptrack-backend.onrender.com";

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

  async function fetchJotas() {
    try {
      const token = localStorage.getItem("cooptrackToken");
      if (!token) return [];

      const currentUserId = getCurrentUserIdFromToken();
      if (!currentUserId) return [];

      const response = await fetch(`${API_BASE_URL}/plays`, {
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

      return plays.filter((play) => {
        const rank = normalizeRank(play.card_rank || play.rank);
        const suit = normalizeSuit(play.card_suit || play.suit);
        const creatorId = Number(play.created_by_user_id || 0);

        return (
          rank === "J" &&
          ["HEART", "SPADE", "CLUB"].includes(suit) &&
          creatorId === currentUserId
        );
      });
    } catch (error) {
      console.error("Error cargando jotas:", error);
      return [];
    }
  }

  function getCardLabel(play) {
    const suit = normalizeSuit(play.card_suit || play.suit);

    if (suit === "HEART") return "J♥";
    if (suit === "SPADE") return "J♠";
    if (suit === "CLUB") return "J♣";
    if (suit === "DIAMOND") return "J♦";

    return "J";
  }

  function getDescription(play) {
    return String(play.play_text || play.text || "").trim() || "Sin descripción";
  }

  function getDeckId(play) {
    return play.deck_id || play.deckId || null;
  }

  function buildJotaRowHTML(play) {
    const playId = Number(play.id || 0);
    const cardLabel = getCardLabel(play);
    const description = getDescription(play);
    const deckId = getDeckId(play);

    return `
      <button
        type="button"
        class="tablero-row tablero-row--bitacora"
        data-play-id="${playId}"
        data-deck-id="${deckId || ""}"
      >
        <div class="tablero-row__left">
          <div class="tablero-row__card">${escapeHtml(cardLabel)}</div>
        </div>

        <div class="tablero-row__center">
          <div class="tablero-row__title">
            ${escapeHtml(description)}
          </div>
        </div>

        <div class="tablero-row__right">
        </div>
      </button>
    `;
  }

  function applyFilters(plays) {
    return plays.filter((play) => {
      const suit = normalizeSuit(play.card_suit || play.suit);
      const description = getDescription(play).toLowerCase();

      const suitOk = !activeSuitFilter || suit === activeSuitFilter;
      const searchOk =
        !activeSearchQuery ||
        description.includes(activeSearchQuery.toLowerCase());

      return suitOk && searchOk;
    });
  }

  function bindRowEvents() {
    document.querySelectorAll(".tablero-row--bitacora").forEach((row) => {
      row.addEventListener("click", () => {
        const deckId = row.dataset.deckId;
        if (!deckId) return;

        window.location.href = `/mazo.html?id=${deckId}`;
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
          No hay jugadas J para mostrar.
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

  document.addEventListener("bitacora:filterSuit", (event) => {
    activeSuitFilter = String(event.detail?.suit || "").toUpperCase();
    renderJotas();
  });

  document.addEventListener("bitacora:search", (event) => {
    activeSearchQuery = String(event.detail?.query || "").trim();
    renderJotas();
  });

  document.addEventListener("DOMContentLoaded", initJotas);
})();