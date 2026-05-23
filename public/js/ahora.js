(function () {
  const API_BASE_URL = "";

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatDateTime(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";

    return date.toLocaleString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function getCardLabel(play) {
    const rank = String(play.card_rank || "").trim().toUpperCase();
    const suit = String(play.card_suit || "").trim().toUpperCase();

    if (rank === "J" && suit === "SPADE") return "J♠";
    if (rank === "Q" && suit === "SPADE") return "Q♠";
    if (rank === "K") return `K${suit === "HEART" ? "♥" : suit === "SPADE" ? "♠" : suit === "DIAMOND" ? "♦" : suit === "CLUB" ? "♣" : ""}`;
    if (rank === "A") return `A${suit === "HEART" ? "♥" : suit === "SPADE" ? "♠" : suit === "DIAMOND" ? "♦" : suit === "CLUB" ? "♣" : ""}`;

    return `${rank}${suit === "HEART" ? "♥" : suit === "SPADE" ? "♠" : suit === "DIAMOND" ? "♦" : suit === "CLUB" ? "♣" : ""}`;
  }

  function renderEsAhoraItem(play) {
    const cardLabel = getCardLabel(play);
    const deckName = escapeHtml(play.deck_name || "Sin mazo");
    const playText = escapeHtml(play.play_text || "Sin concepto");
    const dateText = formatDateTime(play.start_date || play.end_date || play.created_at);
    const location = String(play.location || "").trim();

    const buttons = [];

    if (play.card_rank === "Q" && String(play.card_suit || "").toUpperCase() === "SPADE") {
      buttons.push(
        `<button type="button" class="ahora-btn">Aceptar</button>`,
        `<button type="button" class="ahora-btn ahora-btn--secondary">Rechazar</button>`
      );
    }

    if (play.card_rank === "J" && String(play.card_suit || "").toUpperCase() === "SPADE") {
      buttons.push(
        `<button type="button" class="ahora-btn">Hecho</button>`,
        `<button type="button" class="ahora-btn ahora-btn--secondary">Posponer</button>`
      );
    }

    return `
      <article class="ahora-card">
        <div class="ahora-card__header">
          <span class="ahora-card__label">${escapeHtml(cardLabel)}</span>
          <div class="ahora-card__title">
            <p class="ahora-card__deck">${deckName}</p>
            <p class="ahora-card__text">${playText}</p>
          </div>
        </div>

        <div class="ahora-card__meta">
          <span>${escapeHtml(dateText)}</span>
          ${location ? `<span>${escapeHtml(location)}</span>` : ""}
        </div>

        <div class="ahora-actions">
          ${buttons.join("")}
        </div>
      </article>
    `;
  }

  function renderTeMandanAhoraItem(play) {
    const deckName = escapeHtml(play.deck_name || "Sin mazo");
    const statusText = String(play.play_status || "").trim() || "Pendiente";
    const playId = Number(play.id || 0);
    const deckId = Number(play.deck_id || 0);
    const targetHref = `/lienzo.html?deckId=${deckId}&playId=${playId}`;

    return `
      <article class="ahora-card">
        <div class="ahora-summary">
          <div class="ahora-card-back">
            <img src="/assets/icons/Dorso70.gif" alt="Tarjeta cerrada" />
          </div>

          <div class="ahora-summary__body">
            <p class="ahora-card__deck">${deckName}</p>
            <p class="ahora-summary__status">${escapeHtml(statusText)}</p>
          </div>
        </div>

        <a href="${escapeHtml(targetHref)}" class="ahora-link">Abrir</a>
      </article>
    `;
  }

  function renderEmptyMessage(container, message) {
    container.innerHTML = `<div class="ahora-empty">${escapeHtml(message)}</div>`;
  }

  async function loadAhora() {
    const token = localStorage.getItem("cooptrackToken");
    if (!token) {
      const esContainer = document.getElementById("es-ahora-list");
      const teContainer = document.getElementById("te-mandan-ahora-list");
      renderEmptyMessage(esContainer, "Inicia sesión para ver tus acciones.");
      renderEmptyMessage(teContainer, "Inicia sesión para ver lo que te mandan ahora.");
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/plays/ahora`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const esAhoraList = Array.isArray(data.esAhora) ? data.esAhora : [];
      const teMandanList = Array.isArray(data.teMandanAhora) ? data.teMandanAhora : [];

      const esContainer = document.getElementById("es-ahora-list");
      const teContainer = document.getElementById("te-mandan-ahora-list");

      if (!esAhoraList.length) {
        renderEmptyMessage(esContainer, "No hay acciones para ahora.");
      } else {
        esContainer.innerHTML = esAhoraList.map(renderEsAhoraItem).join("");
      }

      if (!teMandanList.length) {
        renderEmptyMessage(teContainer, "No hay elementos que te mandan ahora.");
      } else {
        teContainer.innerHTML = teMandanList.map(renderTeMandanAhoraItem).join("");
      }
    } catch (error) {
      const esContainer = document.getElementById("es-ahora-list");
      const teContainer = document.getElementById("te-mandan-ahora-list");
      renderEmptyMessage(esContainer, "Error cargando tus acciones.");
      renderEmptyMessage(teContainer, "Error cargando lo que te mandan ahora.");
      console.error("Error cargando Ahora:", error);
    }
  }

  document.addEventListener("DOMContentLoaded", loadAhora);
})();
