(function () {
  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function normalizeRank(value) {
    return String(value || "").trim().toUpperCase();
  }

  function normalizeSuit(value) {
    return String(value || "").trim().toUpperCase();
  }

  function getSuitSymbol(suit) {
    const s = normalizeSuit(suit);
    if (s === "HEART") return "♥";
    if (s === "SPADE") return "♠";
    if (s === "DIAMOND") return "♦";
    if (s === "CLUB") return "♣";
    return "";
  }

  function getCardLabel(play) {
    const rank = normalizeRank(play?.card_rank || play?.rank) || "?";
    const suit = getSuitSymbol(play?.card_suit || play?.suit);
    return `${rank}${suit}`;
  }

  function formatDate(value) {
    if (!value) return "—";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return escapeHtml(value);

    try {
      return date.toLocaleString("es-UY", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch (error) {
      return escapeHtml(value);
    }
  }

  function buildMetaLine(play) {
    const parts = [];

    const status = String(play?.play_status || "").trim();
    const location = String(play?.location || "").trim();
    const amount = play?.amount;
    const createdAt = play?.created_at;

    if (status) parts.push(`Estado: ${status}`);
    if (location) parts.push(`Lugar: ${location}`);
    if (amount !== null && amount !== undefined && amount !== "") {
      parts.push(`Monto: ${amount}`);
    }
    if (createdAt) parts.push(`Fecha: ${formatDate(createdAt)}`);

    return parts.join(" · ");
  }

  function renderArchiveRow(play, depth = 0) {
    return `
      <article class="tablero-row tablero-row--archived${depth > 0 ? ` tablero-row--child tablero-row--child-depth-${depth}` : ""}">
        <div class="tablero-row__left">
          <div class="tablero-row__card">${escapeHtml(getCardLabel(play))}</div>
        </div>

        <div class="tablero-row__center">
          <div class="tablero-row__title">
            ${escapeHtml(String(play?.play_text || "Sin texto"))}
          </div>
          <div class="tablero-row__meta">
            ${escapeHtml(buildMetaLine(play))}
          </div>
        </div>
      </article>
    `;
  }

  function sortPlaysTree(plays) {
    const sorted = [...plays].sort((a, b) => {
      const aDate = new Date(a?.created_at || 0).getTime();
      const bDate = new Date(b?.created_at || 0).getTime();

      if (aDate !== bDate) return aDate - bDate;

      return Number(a?.id || 0) - Number(b?.id || 0);
    });

    const byParent = new Map();
    const roots = [];

    for (const play of sorted) {
      const parentId = play?.parent_play_id ? Number(play.parent_play_id) : null;

      if (!parentId) {
        roots.push(play);
        continue;
      }

      if (!byParent.has(parentId)) {
        byParent.set(parentId, []);
      }

      byParent.get(parentId).push(play);
    }

    const result = [];

    function appendNode(play, depth = 0) {
      result.push({ ...play, __archiveDepth: depth });

      const children = byParent.get(Number(play.id)) || [];
      for (const child of children) {
        appendNode(child, depth + 1);
      }
    }

    for (const root of roots) {
      appendNode(root, 0);
    }

    return result;
  }

  function renderArchivedTablero(container, plays) {
    if (!container) return;

    const safePlays = Array.isArray(plays) ? plays : [];
    const sorted = sortPlaysTree(safePlays);

    if (!sorted.length) {
      container.innerHTML = `
        <section class="tablero">
          <p class="tablero-archivado__empty">No hay jugadas archivadas para mostrar.</p>
        </section>
      `;
      return;
    }

    const html = sorted
      .map((play) => renderArchiveRow(play, Number(play.__archiveDepth || 0)))
      .join("");

    container.innerHTML = `
      <section class="tablero tablero--archivado">
        ${html}
      </section>
    `;
  }

  window.renderArchivedTablero = renderArchivedTablero;
})();