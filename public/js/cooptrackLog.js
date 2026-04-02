(() => {
  const API_BASE_URL = "https://cooptrack-backend.onrender.com";

  function getToken() {
    return localStorage.getItem("cooptrackToken");
  }

  function getContainer() {
    return document.getElementById("cooptrack-log-container");
  }

  function escapeHTML(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatDate(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleString("es-UY");
  }

  function getSuitSymbol(suit) {
    const normalized = String(suit || "").toUpperCase();

    if (normalized === "HEART") return "♥";
    if (normalized === "SPADE") return "♠";
    if (normalized === "DIAMOND") return "♦";
    if (normalized === "CLUB") return "♣";
    if (normalized === "RED") return "🃏";
    if (normalized === "BLUE") return "🃏";

    return "";
  }

  function getPlayLabel(play) {
    const rank = String(play?.card_rank || "").toUpperCase();
    const suit = getSuitSymbol(play?.card_suit);
    return `${rank}${suit}`;
  }

  function getRelevantText(play) {
    return (
      play?.play_text ||
      play?.text ||
      play?.description ||
      play?.play_code ||
      "Sin detalle"
    );
  }

  function isRelevantPlay(play) {
    const rank = String(play?.card_rank || "").toUpperCase();
    return ["A", "K", "Q", "J"].includes(rank);
  }

  function sortNewestFirst(plays) {
    return [...plays].sort((a, b) => {
      const aTime = new Date(a?.created_at || 0).getTime();
      const bTime = new Date(b?.created_at || 0).getTime();
      return bTime - aTime;
    });
  }

  function renderEmpty(message) {
    const container = getContainer();
    if (!container) return;
    container.innerHTML = `<div class="noticias-empty">${escapeHTML(message)}</div>`;
  }

  function renderPlays(plays) {
    const container = getContainer();
    if (!container) return;

    if (!Array.isArray(plays) || !plays.length) {
      renderEmpty("Todavía no hay noticias para mostrar.");
      return;
    }

    container.innerHTML = plays
      .map((play) => {
        const label = getPlayLabel(play);
        const text = getRelevantText(play);
        const createdAt = formatDate(play?.created_at);
        const deckId = play?.deck_id ? `Mazo ${play.deck_id}` : "Sin mazo";

        return `
          <article class="noticia-row">
            <div class="noticia-row__left">
              <div class="noticia-row__card">${escapeHTML(label)}</div>
            </div>

            <div class="noticia-row__center">
              <div class="noticia-row__text">${escapeHTML(text)}</div>
              <div class="noticia-row__meta">
                <span>${escapeHTML(deckId)}</span>
                ${createdAt ? `<span>· ${escapeHTML(createdAt)}</span>` : ""}
              </div>
            </div>
          </article>
        `;
      })
      .join("");
  }

  async function fetchPlays() {
    const token = getToken();
    if (!token) {
      renderEmpty("No hay sesión iniciada.");
      return;
    }

    try {
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

      const plays = Array.isArray(data?.plays)
        ? data.plays
        : Array.isArray(data)
          ? data
          : [];

      const relevant = sortNewestFirst(plays).filter(isRelevantPlay);

      renderPlays(relevant);
    } catch (error) {
      console.error("Error cargando noticias:", error);
      renderEmpty("No se pudieron cargar las noticias.");
    }
  }

  document.addEventListener("DOMContentLoaded", fetchPlays);
})();
