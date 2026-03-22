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

  // Oculta las 4 líneas iniciales de A
  if (rank === "A" && action === "init_ace") {
    return true;
  }

  // Oculta las líneas estructurales K/Q del libro inicial
  if ((rank === "K" || rank === "Q") && action === "puedeJugar") {
    return true;
  }

  return false;
}

function getVisiblePlays(plays) {
  return plays.filter((play) => !isStructuralBookLine(play));
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

  const normalizedPlays = Array.isArray(plays)
    ? plays.map(normalizePlayRow).filter(Boolean)
    : [];

  const visiblePlays = getVisiblePlays(normalizedPlays);

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

window.renderPlaysView = renderPlaysView;
