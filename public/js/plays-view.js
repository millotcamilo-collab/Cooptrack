let currentSuitFilter = null;
let lastDeck = null;
let lastPlays = [];
let lastState = null;

function getSuitSymbol(suit) {
  switch (String(suit || "").toUpperCase()) {
    case "HEART":
      return "♥";
    case "SPADE":
      return "♠";
    case "DIAMOND":
      return "♦";
    case "CLUB":
      return "♣";
    case "RED":
      return "🃏R";
    case "BLUE":
      return "🃏B";
    default:
      return suit || "";
  }
}

function formatPlayDate(value) {
  if (!value) return "";

  try {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return String(value);

    return date.toLocaleString("es-UY", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch (error) {
    console.error("Error formateando fecha:", error);
    return String(value);
  }
}

function normalizePlayRow(play) {
  if (!play) return null;

  const parsed = play.parsed || {};

  return {
    id: play.id || null,
    parentPlayId: play.parent_play_id || null,
    rank: parsed.rank || play.card_rank || "",
    suit: parsed.suit || play.card_suit || "",
    action: parsed.action || "",
    authorized: parsed.authorized || parsed.autorizados || "",
    date: parsed.date || play.created_at || "",
    raw: play.play_code || "",
    status: play.play_status || "",
    parsed
  };
}

function isStructuralBookLine(play) {
  if (!play) return true;

  const rank = String(play.rank || "").toUpperCase();
  const action = String(play.action || "").trim();

  if (rank === "A" && action === "init_ace") {
    return true;
  }

  if (rank === "Q" && action === "puedeJugar") {
    return true;
  }

  return false;
}

function isChildOfSpadeJack(play, allPlays) {
  if (!play || String(play.rank || "").toUpperCase() !== "Q") return false;
  if (!play.parentPlayId) return false;

  const mother = allPlays.find((candidate) => String(candidate.id) === String(play.parentPlayId));
  if (!mother) return false;

  const motherRank = String(mother.rank || "").toUpperCase();
  const motherSuit = String(mother.suit || "").toUpperCase();

  return motherRank === "J" && motherSuit === "SPADE";
}

function shouldShowPlayByFilter(play, allPlays, activeFilter) {
  const rank = String(play.rank || "").toUpperCase();
  const suit = String(play.suit || "").toUpperCase();

  if (!activeFilter) {
    if (rank === "A" || rank === "K") {
      return false;
    }
    return true;
  }

  if (activeFilter === "HEART") {
    return rank === "J" && suit === "HEART";
  }

  if (activeFilter === "SPADE") {
    if (rank === "J" && suit === "SPADE") return true;
    if (isChildOfSpadeJack(play, allPlays)) return true;
    return false;
  }

  if (activeFilter === "DIAMOND") {
    if (rank === "J" && suit === "DIAMOND") return true;
    if (rank === "Q" && suit === "DIAMOND") return true;
    return false;
  }

  if (activeFilter === "CLUB") {
    return rank === "A" || rank === "K";
  }

  return true;
}

function getVisiblePlays(plays, activeFilter = null) {
  const nonStructural = plays.filter((play) => !isStructuralBookLine(play));

  return nonStructural.filter((play) =>
    shouldShowPlayByFilter(play, nonStructural, activeFilter)
  );
}

function buildEmptyPlaysHTML() {
  return `
    <section class="plays-view">
      <div class="page-container">
        <div class="plays-view__empty">
          Todavía no hay jugadas visibles en este mazo.
        </div>
      </div>
    </section>
  `;
}

function getHumanStatus(status) {
  const normalized = String(status || "").toUpperCase();

  switch (normalized) {
    case "ACTIVE":
      return "Activa";
    case "PENDING":
      return "Pendiente";
    case "APPROVED":
      return "Aprobada";
    case "REJECTED":
      return "Rechazada";
    case "CANCELLED":
      return "Cancelada";
    default:
      return status || "";
  }
}

function escapeHTML(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function extractPlayText(play) {
  const parsed = play.parsed || {};

  return (
    parsed.text ||
    parsed.description ||
    parsed.label ||
    parsed.title ||
    parsed.name ||
    ""
  );
}

function getDefaultTitle(play) {
  const rank = String(play.rank || "").toUpperCase();
  const suit = String(play.suit || "").toUpperCase();

  if (rank === "J" && suit === "HEART") return "Nueva nota";
  if (rank === "J" && suit === "SPADE") return "Nueva actividad";
  if (rank === "J" && suit === "CLUB") return "Nuevo bien";
  if (rank === "J" && suit === "DIAMOND") return "Nuevo registro económico";
  if (rank === "Q") return "Participación";
  if (rank === "K") return "Permiso";
  if (rank === "A") return "Autoridad";

  return "Jugada";
}

function getPlayTitle(play) {
  const extracted = extractPlayText(play);
  if (extracted && extracted.trim()) {
    return extracted.trim();
  }

  return getDefaultTitle(play);
}

function getPlaySubtitle(play) {
  const parts = [];

  if (play.authorized) {
    parts.push(play.authorized);
  }

  const dateText = formatPlayDate(play.date);
  if (dateText) {
    parts.push(dateText);
  }

  return parts.join(" · ");
}

function buildStatusBadge(play) {
  const status = getHumanStatus(play.status);
  if (!status) return "";

  const statusClass = `play-row__status--${String(play.status || "").toLowerCase()}`;

  return `<span class="play-row__status ${statusClass}">${escapeHTML(status)}</span>`;
}

function buildCardHTML(play) {
  return `
    <div class="play-row__card">
      <span class="play-row__rank">${escapeHTML(play.rank)}</span>
      <span class="play-row__suit">${escapeHTML(getSuitSymbol(play.suit))}</span>
    </div>
  `;
}

function buildJHeartRowHTML(play) {
  const title = getPlayTitle(play);
  const subtitle = getPlaySubtitle(play);

  return `
    <article class="play-row play-row--heart" data-play-id="${play.id || ""}">
      <div class="play-row__main">
        ${buildCardHTML(play)}

        <div class="play-row__body">
          <div class="play-row__title">${escapeHTML(title)}</div>
          ${subtitle ? `<div class="play-row__meta">${escapeHTML(subtitle)}</div>` : ""}
        </div>

        <div class="play-row__side">
          ${buildStatusBadge(play)}
        </div>
      </div>
    </article>
  `;
}

function buildJSpadeRowHTML(play) {
  const parsed = play.parsed || {};
  const title = getPlayTitle(play);
  const subtitle = getPlaySubtitle(play);

  const startAt = parsed.start_at || parsed.startDate || parsed.start || "";
  const endAt = parsed.end_at || parsed.endDate || parsed.end || "";
  const location = parsed.location || parsed.place || parsed.address || "";

  const detailParts = [];

  if (startAt) detailParts.push(`Inicio: ${formatPlayDate(startAt)}`);
  if (endAt) detailParts.push(`Fin: ${formatPlayDate(endAt)}`);
  if (location) detailParts.push(`Lugar: ${location}`);

  return `
    <article class="play-row play-row--spade" data-play-id="${play.id || ""}">
      <div class="play-row__main">
        ${buildCardHTML(play)}

        <div class="play-row__body">
          <div class="play-row__title">${escapeHTML(title)}</div>
          ${subtitle ? `<div class="play-row__meta">${escapeHTML(subtitle)}</div>` : ""}
          ${detailParts.length
            ? `<div class="play-row__details">${detailParts.map(escapeHTML).join(" · ")}</div>`
            : ""
          }
        </div>

        <div class="play-row__side">
          ${buildStatusBadge(play)}
        </div>
      </div>
    </article>
  `;
}

function buildJClubRowHTML(play) {
  const parsed = play.parsed || {};
  const title = getPlayTitle(play);
  const subtitle = getPlaySubtitle(play);

  const amount =
    parsed.amount ||
    parsed.price ||
    parsed.total ||
    parsed.value ||
    "";

  const quantity =
    parsed.quantity ||
    parsed.qty ||
    "";

  const detailParts = [];

  if (quantity) detailParts.push(`Cantidad: ${quantity}`);
  if (amount) detailParts.push(`Monto: ${amount}`);

  return `
    <article class="play-row play-row--club" data-play-id="${play.id || ""}">
      <div class="play-row__main">
        ${buildCardHTML(play)}

        <div class="play-row__body">
          <div class="play-row__title">${escapeHTML(title)}</div>
          ${subtitle ? `<div class="play-row__meta">${escapeHTML(subtitle)}</div>` : ""}
          ${detailParts.length
            ? `<div class="play-row__details">${detailParts.map(escapeHTML).join(" · ")}</div>`
            : ""
          }
        </div>

        <div class="play-row__side">
          ${buildStatusBadge(play)}
        </div>
      </div>
    </article>
  `;
}

function buildGenericPlayRowHTML(play) {
  const title = getPlayTitle(play);
  const subtitle = getPlaySubtitle(play);

  return `
    <article class="play-row" data-play-id="${play.id || ""}">
      <div class="play-row__main">
        ${buildCardHTML(play)}

        <div class="play-row__body">
          <div class="play-row__title">${escapeHTML(title)}</div>
          ${subtitle ? `<div class="play-row__meta">${escapeHTML(subtitle)}</div>` : ""}
        </div>

        <div class="play-row__side">
          ${buildStatusBadge(play)}
        </div>
      </div>
    </article>
  `;
}

function buildPlayRowHTML(play) {
  const rank = String(play.rank || "").toUpperCase();
  const suit = String(play.suit || "").toUpperCase();

  if (rank === "J" && suit === "HEART") return buildJHeartRowHTML(play);
  if (rank === "J" && suit === "SPADE") return buildJSpadeRowHTML(play);
  if (rank === "J" && suit === "CLUB") return buildJClubRowHTML(play);

  return buildGenericPlayRowHTML(play);
}

function renderPlaysView(deck, plays = [], state = null) {
  const container = document.getElementById("plays-view-container");

  if (!container) {
    console.warn("plays-view-container no encontrado");
    return;
  }

  lastDeck = deck;
  lastPlays = plays;
  lastState = state;

  const normalizedPlays = Array.isArray(plays)
    ? plays.map(normalizePlayRow).filter(Boolean)
    : [];

  const visiblePlays = getVisiblePlays(normalizedPlays, currentSuitFilter);

  if (!visiblePlays.length) {
    container.innerHTML = buildEmptyPlaysHTML();
    return;
  }

  const rowsHTML = visiblePlays
    .map(buildPlayRowHTML)
    .join("");

  container.innerHTML = `
    <section class="plays-view">
      <div class="page-container">
        <div class="plays-view__list">
          ${rowsHTML}
        </div>
      </div>
    </section>
  `;
}

document.addEventListener("mazobar:filter", (event) => {
  const incomingFilter = event.detail?.filter || null;
  currentSuitFilter = currentSuitFilter === incomingFilter ? null : incomingFilter;
  renderPlaysView(lastDeck, lastPlays, lastState);
});

window.renderPlaysView = renderPlaysView;
