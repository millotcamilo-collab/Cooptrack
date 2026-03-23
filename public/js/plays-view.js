let currentSuitFilter = null;
let lastDeck = null;
let lastPlays = [];
let lastState = null;

function getSuitSymbol(suit) {
  switch (suit) {
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

  // Oculta las 4 líneas iniciales de A no jugadas
  if (rank === "A" && action === "init_ace") {
    return true;
  }

  // Oculta las líneas estructurales Q del libro inicial
  if (rank === "Q" && action === "puedeJugar") {
    return true;
  }

  // Las K con puedeJugar se muestran solo en filtro trébol
  // así que NO las ocultamos acá de forma permanente

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

  // Vista general
  if (!activeFilter) {
    // Mostrar todo menos corporativas A/K
    if (rank === "A" || rank === "K") {
      return false;
    }
    return true;
  }

  // Corazón: solo J♥
  if (activeFilter === "HEART") {
    return rank === "J" && suit === "HEART";
  }

  // Pique: J♠ y sus hijas Q
  if (activeFilter === "SPADE") {
    if (rank === "J" && suit === "SPADE") return true;
    if (isChildOfSpadeJack(play, allPlays)) return true;
    return false;
  }

  // Diamante: J♦ y Q♦
  if (activeFilter === "DIAMOND") {
    if (rank === "J" && suit === "DIAMOND") return true;
    if (rank === "Q" && suit === "DIAMOND") return true;
    return false;
  }

  // Trébol: corporativas visibles
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

function getHumanActionText(play) {
  const rank = String(play.rank || "").toUpperCase();
  const suitSymbol = getSuitSymbol(play.suit);
  const action = play.action || "";

  if (rank === "J") {
    if (action === "write_play") {
      return `J${suitSymbol} nueva jugada`;
    }

    return `J${suitSymbol} ${action || "jugada"}`;
  }

  if (rank === "Q") {
    return `Q${suitSymbol} ${action || "derivada"}`;
  }

  if (rank === "K") {
    return `K${suitSymbol} ${action || "permiso"}`;
  }

  if (rank === "A") {
    return `A${suitSymbol} ${action || "fundación"}`;
  }

  if (rank === "JOKER") {
    return `${suitSymbol} ${action || "joker"}`;
  }

  return `${rank}${suitSymbol} ${action || ""}`.trim();
}

function buildPlayRowHTML(play) {
  const suitSymbol = getSuitSymbol(play.suit);
  const titleText = getHumanActionText(play);
  const dateText = formatPlayDate(play.date);
  const authorizedText = play.authorized ? ` · ${play.authorized}` : "";
  const statusText = play.status ? ` · ${play.status}` : "";

  return `
    <article class="play-row" data-play-id="${play.id || ""}" data-suit="${play.suit || ""}">
      <div class="play-row__main">
        <div class="play-row__card">
          <span class="play-row__rank">${play.rank}</span>
          <span class="play-row__suit">${suitSymbol}</span>
        </div>

        <div class="play-row__body">
          <div class="play-row__text">
            ${titleText}${authorizedText}${statusText}
          </div>

          <div class="play-row__meta">
            <span>${dateText}</span>
          </div>

          <div class="play-row__code">
            ${play.raw}
          </div>
        </div>
      </div>
    </article>
  `;
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

  // tocar el mismo botón apaga el filtro
  currentSuitFilter = currentSuitFilter === incomingFilter ? null : incomingFilter;

  renderPlaysView(lastDeck, lastPlays, lastState);
});

window.renderPlaysView = renderPlaysView;
