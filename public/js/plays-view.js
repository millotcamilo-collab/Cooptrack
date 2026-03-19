function clearPlaysView() {
  const container = document.getElementById("mazo-records-container");
  if (!container) return;
  container.innerHTML = "";
}

function getCardLabel(cardType) {
  const map = {
    J_HEART: "J♥",
    J_SPADE: "J♠",
    J_DIAMOND: "J♦",
    J_CLUB: "J♣"
  };

  return map[cardType] || cardType;
}

function getSuitClass(suit) {
  const map = {
    HEART: "plays-view__card--heart",
    DIAMOND: "plays-view__card--diamond",
    SPADE: "plays-view__card--spade",
    CLUB: "plays-view__card--club"
  };

  return map[suit] || "";
}

function formatDate(dateString) {
  if (!dateString) return "";

  try {
    const date = new Date(dateString);
    return date.toLocaleString();
  } catch {
    return "";
  }
}

function buildPlayRowHTML(play) {
  const cardLabel = getCardLabel(play.cardType);
  const suitClass = getSuitClass(play.suit);

  return `
    <div class="plays-view__row">

      <div class="plays-view__left">
        <span class="plays-view__card ${suitClass}">
          ${cardLabel}
        </span>
      </div>

      <div class="plays-view__center">
        <div class="plays-view__text">
          ${play.text || ""}
        </div>

        <div class="plays-view__meta">
          <span class="plays-view__user">
            ${play.createdByNickname || "Usuario"}
          </span>
          <span class="plays-view__date">
            ${formatDate(play.createdAt)}
          </span>
        </div>
      </div>

      <div class="plays-view__right">
        <!-- futuro: Q / acciones / estado -->
      </div>

    </div>
  `;
}

function renderPlaysView(deck) {
  const container = document.getElementById("mazo-records-container");

  if (!container) {
    console.warn("mazo-records-container no encontrado");
    return;
  }

  const plays = Array.isArray(deck.plays) ? deck.plays : [];

  if (!plays.length) {
    container.innerHTML = `
      <section class="plays-view">
        <div class="page-container">
          <div class="plays-view__empty">
            Todavía no hay jugadas en este mazo.
          </div>
        </div>
      </section>
    `;
    return;
  }

  container.innerHTML = `
    <section class="plays-view">
      <div class="page-container">

        <div class="plays-view__list">
          ${plays.map((play) => buildPlayRowHTML(play)).join("")}
        </div>

      </div>
    </section>
  `;
}
