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
    parsed
  };
}

function buildEmptyPlaysHTML() {
  return `
    <section class="plays-view">
      <div class="page-container">
        <div class="plays-view__empty">
          Todavía no hay jugadas en este mazo.
        </div>
      </div>
    </section>
  `;
}

function buildPlayRowHTML(play) {
  const suitSymbol = getSuitSymbol(play.suit);
  const actionText = play.action || "(sin acción)";
  const dateText = formatPlayDate(play.date);
  const authorizedText = play.authorized ? ` · ${play.authorized}` : "";

  return `
    <article class="play-row" data-play-id="${play.id || ""}" data-suit="${play.suit || ""}">
      <div class="play-row__main">
        <div class="play-row__card">
          <span class="play-row__rank">${play.rank}</span>
          <span class="play-row__suit">${suitSymbol}</span>
        </div>

        <div class="play-row__body">
          <div class="play-row__text">
            ${actionText}${authorizedText}
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

  if (!normalizedPlays.length) {
    container.innerHTML = buildEmptyPlaysHTML();
    return;
  }

  const rowsHTML = normalizedPlays
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
