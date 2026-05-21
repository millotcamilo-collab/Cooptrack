(() => {
  const API_BASE_URL = "https://cooptrack-backend.onrender.com";

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function normalize(value) {
    return String(value || "").trim().toUpperCase();
  }

  function getSuitSymbol(suit) {
    const s = normalize(suit);
    if (s === "HEART") return "♥";
    if (s === "SPADE") return "♠";
    if (s === "DIAMOND") return "♦";
    if (s === "CLUB") return "♣";
    return "";
  }

  function getCardLabel(play) {
    const rank = normalize(play?.card_rank || play?.rank) || "?";
    const suit = getSuitSymbol(play?.card_suit || play?.suit);
    return `${rank}${suit}`;
  }

  function formatDate(value) {
    if (!value) return "—";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);

    return date.toLocaleString("es-UY", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function getDeckName(play) {
    return String(play?.deck_name || play?.deckName || "").trim();
  }

  function getArchiveTitle(play) {
    const rank = normalize(play?.card_rank);
    const status = normalize(play?.play_status);
    const targetName = play?.target_user_nickname || "destinatario";
    const sourceName = play?.created_by_nickname || "anfitrión";

    if (rank === "K") {
      if (status === "REJECTED") return `K rechazada por ${targetName}`;
      if (status === "QUIT") return `${targetName} renunció a una K`;
      if (status === "FIRED") return `${sourceName} despidió a ${targetName}`;
      return "K archivada";
    }

    if (rank === "A") {
      if (status === "REJECTED") return `Transferencia de A rechazada por ${targetName}`;
      if (status === "QUIT") return `Transferencia de A finalizada`;
      if (status === "FIRED") return `Transferencia de A cancelada`;
      return "A archivada";
    }

    if (rank === "Q") {
      if (status === "REJECTED") return `Q rechazada por ${targetName}`;
      if (status === "CANCELLED") return `Q cancelada por ${sourceName}`;
      return "Q archivada";
    }

    return "Jugada archivada";
  }

  function getArchiveMeta(play) {
    const parts = [];

    if (play?.deck_name) parts.push(`Mazo: ${play.deck_name}`);
    if (play?.play_status) parts.push(`Estado: ${play.play_status}`);
    if (play?.updated_at || play?.created_at) {
      parts.push(`Fecha: ${formatDate(play.updated_at || play.created_at)}`);
    }

    return parts.join(" · ");
  }

  function getArchiveHref(play) {
    const rank = normalize(play?.card_rank);
    const deckId = Number(play?.deck_id || 0);
    const playId = Number(play?.id || 0);

    if (!playId) return "#";

    if (rank === "K") {
      return `/lienzoRQF.html?deckId=${deckId}&playId=${playId}`;
    }

    if (rank === "A") {
      return `/lienzo.html?deckId=${deckId}&playId=${playId}`;
    }

    if (rank === "Q") {
      return `/lienzoQpica.html?deckId=${deckId}&playId=${playId}`;
    }

    return "#";
  }

  function renderArchiveRow(play) {
    const href = getArchiveHref(play);
    const rank = normalize(play?.card_rank || play?.rank);
    const deckName = getDeckName(play);
    const isQ = rank === "Q";

    return `
  <a class="tablero-row tablero-row--archived ${isQ ? "tablero-row--archive-q" : ""}" href="${escapeHtml(href)}">
    <div class="tablero-row__left">
      <div class="tablero-row__card">${escapeHtml(getCardLabel(play))}</div>
    </div>

    <div class="tablero-row__center">
      <div class="tablero-row__title">
        ${escapeHtml(isQ ? String(play?.play_text || getArchiveTitle(play)) : getArchiveTitle(play))}
      </div>

      ${isQ && deckName
        ? `<div class="tablero-row__deck">${escapeHtml(deckName)}</div>`
        : `
            <div class="tablero-row__meta">
              ${escapeHtml(getArchiveMeta(play))}
            </div>

            ${play?.play_text
          ? `<div class="tablero-row__meta">${escapeHtml(play.play_text)}</div>`
          : ""
        }
          `
      }
    </div>

    <div class="tablero-row__right"></div>
  </a>
`;
  }

  async function loadArchive() {
    const container = document.getElementById("archivo-container");
    if (!container) return;

    const token = localStorage.getItem("cooptrackToken");

    if (!token) {
      container.innerHTML = `
        <p class="tablero-archivado__empty">Tenés que iniciar sesión para ver el archivo.</p>
      `;
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/plays/archive`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.ok) {
        container.innerHTML = `
          <p class="tablero-archivado__empty">
            ${escapeHtml(data?.error || "No se pudo cargar el archivo.")}
          </p>
        `;
        return;
      }

      const plays = Array.isArray(data.plays) ? data.plays : [];

      if (!plays.length) {
        container.innerHTML = `
          <p class="tablero-archivado__empty">No hay jugadas archivadas para mostrar.</p>
        `;
        return;
      }

      container.innerHTML = plays.map(renderArchiveRow).join("");

    } catch (error) {
      console.error("Error cargando archivo:", error);

      container.innerHTML = `
        <p class="tablero-archivado__empty">Error cargando archivo.</p>
      `;
    }
  }

  document.addEventListener("DOMContentLoaded", loadArchive);
})();