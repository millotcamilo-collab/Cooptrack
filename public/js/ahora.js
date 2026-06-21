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

function renderAhoraSlotBody(items = []) {
  if (!items.length) return "";

  return items.map((play) => {
    const rank = String(play.card_rank || "").toUpperCase();
    const suit = String(play.card_suit || "").toUpperCase();
    const deckId = Number(play.deck_id || 0);
    const playId = Number(play.id || 0);
    const playCode = String(play.play_code || "");
    const hasPayment = playCode.includes("pay:QHEART");

    let href = `/lienzo.html?deckId=${deckId}&playId=${playId}&mobile=1`;

    if (rank === "J" && suit === "SPADE") {
      href = `/lienzoJpica.html?deckId=${deckId}&playId=${playId}&mobile=1`;
    } else if (rank === "Q" && suit === "SPADE") {
      href = hasPayment
        ? `/lienzoQQpica.html?deckId=${deckId}&playId=${playId}&mobile=1`
        : `/lienzoQpica.html?deckId=${deckId}&playId=${playId}&mobile=1`;
    } else if (rank === "K") {
      href = `/lienzoK.html?deckId=${deckId}&playId=${playId}&mobile=1`;
    }

    const label = `${getCardLabel(play)} ${play.play_text || play.parent_play_text || ""}`.trim();

    return `
      <a class="dia__item-link" href="${escapeHtml(href)}">
        ${escapeHtml(label)}
      </a>
    `;
  }).join("");
}

  function getHourLabel(hour) {
    return `${String(hour).padStart(2, "0")}:00`;
  }

  function getPlayHour(play) {
    const value =
      play.end_date ||
      play.parent_end_date ||
      play.start_date ||
      play.parent_start_date ||
      play.created_at;

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;

    return date.getHours();
  }

function renderAhoraDayGrid(esAhoraList = [], teMandanList = []) {
  const now = new Date();
  const startHour = now.getHours();
  const allItems = [...esAhoraList, ...teMandanList];

  const slotsHtml = Array.from({ length: 12 }, (_, index) => {
    const hour = (startHour + index) % 24;
    const items = allItems.filter((play) => getPlayHour(play) === hour);

    if (typeof window.renderDia === "function") {
      return window.renderDia({
        headerText: getHourLabel(hour),
        bodyHtml: renderAhoraSlotBody(items),
        isCurrent: index === 0,
        extraClass: "ahora-slot"
      });
    }

    return `
      <article class="dia ahora-slot ${index === 0 ? "dia--current" : ""}">
        <div class="dia__header">${getHourLabel(hour)}</div>
        <div class="dia__body">${renderAhoraSlotBody(items)}</div>
      </article>
    `;
  }).join("");

  return `<section class="ahora-grid">${slotsHtml}</section>`;
}

  function formatAhoraHeading(value = new Date()) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "Ahora";

    const weekday = date.toLocaleDateString("es-UY", { weekday: "short" });
    const day = String(date.getDate()).padStart(2, "0");
    const month = date.toLocaleDateString("es-UY", { month: "short" });
    const year = date.getFullYear();
    const hour = String(date.getHours()).padStart(2, "0");
    const minute = String(date.getMinutes()).padStart(2, "0");

    const cap = (text) =>
      String(text || "")
        .replace(".", "")
        .trim()
        .replace(/^./, (m) => m.toUpperCase());

    return `${cap(weekday)} ${day}, ${cap(month)} ${year}, ${hour}:${minute}`;
  }

  function renderAhoraHeading() {
    const heading =
      document.getElementById("ahora-title") ||
      document.querySelector(".ahora-title") ||
      document.querySelector("h1");

    if (!heading) return;

    heading.textContent = formatAhoraHeading(new Date());
  }

  function isBombCandidate(play) {
    const rank = String(play.card_rank || "").toUpperCase();
    const suit = String(play.card_suit || "").toUpperCase();
    const mode = String(play.spade_mode || play.parent_spade_mode || "").toUpperCase();

    return (
      suit === "SPADE" &&
      mode === "DEADLINE" &&
      ["J", "Q"].includes(rank)
    );
  }

  function isWithinBombWindow(play) {
    const value =
      play.end_date ||
      play.parent_end_date;

    const end = new Date(value);
    if (Number.isNaN(end.getTime())) return false;

    const diff = end.getTime() - Date.now();
    return diff >= 0 && diff <= 30 * 60 * 1000;
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
    const playText = escapeHtml(play.play_text || play.parent_play_text || "Sin concepto");
    const dateText = formatDateTime(
      play.end_date ||
      play.parent_end_date ||
      play.start_date ||
      play.parent_start_date ||
      play.created_at
    );
    const location = String(play.location || play.parent_location || "").trim();

    const playId = Number(play.id || 0);
    const deckId = Number(play.deck_id || 0);
    const isBomb = isBombCandidate(play) && isWithinBombWindow(play);

    let actionHtml = "";
    if (isBomb) {
      const rank = String(play.card_rank || "").trim().toUpperCase();
      const suit = String(play.card_suit || "").trim().toUpperCase();
      const playCode = String(play.play_code || "");
      const hasPayment = playCode.includes("pay:QHEART");

      let targetHref = `/lienzo.html?deckId=${deckId}&playId=${playId}&mobile=1`;

      if (rank === "J" && suit === "SPADE") {
        targetHref = `/lienzoJpica.html?deckId=${deckId}&playId=${playId}&mobile=1`;
      } else if (rank === "Q" && suit === "SPADE") {
        targetHref = hasPayment
          ? `/lienzoQQpica.html?deckId=${deckId}&playId=${playId}&mobile=1`
          : `/lienzoQpica.html?deckId=${deckId}&playId=${playId}&mobile=1`;
      }

      actionHtml = `
    <a href="${escapeHtml(targetHref)}" class="ahora-link">
      Abrir
    </a>
  `;
    } else {
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

      actionHtml = buttons.join("");
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
        ${actionHtml}
      </div>
    </article>
  `;
  }

  function renderTeMandanAhoraItem(play) {
    const deckName = escapeHtml(play.deck_name || "Sin mazo");
    const statusText = String(play.play_status || "").trim() || "Pendiente";
    const playId = Number(play.id || 0);
    const deckId = Number(play.deck_id || 0);
    const rank = String(play.card_rank || "").trim().toUpperCase();
    const suit = String(play.card_suit || "").trim().toUpperCase();

    let targetHref = `/lienzo.html?deckId=${deckId}&playId=${playId}&mobile=1`;

    if (rank === "Q" && suit === "SPADE") {
      const playCode = String(play.play_code || "");
      const hasPayment = playCode.includes("pay:QHEART");

      targetHref = hasPayment
        ? `/lienzoQQpica.html?deckId=${deckId}&playId=${playId}&mobile=1`
        : `/lienzoQpica.html?deckId=${deckId}&playId=${playId}&mobile=1`;
    } else if (rank === "J" && suit === "SPADE") {
      targetHref = `/lienzoJpica.html?deckId=${deckId}&playId=${playId}&mobile=1`;
    } else if (rank === "K") {
      targetHref = `/lienzoK.html?deckId=${deckId}&playId=${playId}&mobile=1`;
    }

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

      if (teContainer) {
        teContainer.innerHTML = "";
      }

      if (esContainer) {
        esContainer.innerHTML = renderAhoraDayGrid(esAhoraList, teMandanList);
      }
    } catch (error) {
      const esContainer = document.getElementById("es-ahora-list");
      const teContainer = document.getElementById("te-mandan-ahora-list");
      renderEmptyMessage(esContainer, "Error cargando tus acciones.");
      renderEmptyMessage(teContainer, "Error cargando lo que te mandan ahora.");
      console.error("Error cargando Ahora:", error);
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    renderAhoraHeading();

    document.querySelector(".ahora-page p")?.remove();
    document.querySelector("h2")?.remove();

    const headings = Array.from(document.querySelectorAll("h2, h3"));
    headings.forEach((heading) => {
      const text = String(heading.textContent || "").trim().toLowerCase();
      if (text === "es ahora" || text === "te mandan ahora") {
        heading.remove();
      }
    });

    loadAhora();
  });


})();
