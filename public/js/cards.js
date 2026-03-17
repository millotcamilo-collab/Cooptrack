function escapeHtml(text) {
  return String(text || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(dateString) {
  if (!dateString) return "";
  const date = new Date(dateString);
  return Number.isNaN(date.getTime()) ? dateString : date.toLocaleString();
}

function getCardVisual(record) {
  const type = record.card_type;

  if (type === "J_HEART") {
    return {
      suit: "♥",
      suitClass: "heart",
      cardClass: "card-heart",
      title: record.title || "Anotación",
      text: record.description || "Sin descripción"
    };
  }

  if (type === "J_CLUB") {
    return {
      suit: "♣",
      suitClass: "club",
      cardClass: "card-club",
      title: record.title || "Bien",
      text: record.description || "Sin descripción"
    };
  }

  if (type === "J_SPADE") {
    const lines = [record.description || "Sin descripción"];

    if (record.start_date) {
      lines.push(`Inicio: ${formatDate(record.start_date)}`);
    }

    if (record.end_date) {
      lines.push(`Fin: ${formatDate(record.end_date)}`);
    }

    if (record.location) {
      lines.push(`Lugar: ${record.location}`);
    }

    return {
      suit: "♠",
      suitClass: "spade",
      cardClass: "card-spade",
      title: record.title || "Actividad",
      text: lines.join("\n")
    };
  }

  if (type === "J_DIAMOND") {
    const lines = [];

    if (record.amount !== null && record.amount !== undefined) {
      lines.push(`$ ${record.amount}`);
    }

    if (record.description) {
      lines.push(record.description);
    }

    return {
      suit: "♦",
      suitClass: "diamond",
      cardClass: "card-diamond",
      title: record.title || "Monto",
      text: lines.length > 0 ? lines.join("\n") : "Sin monto"
    };
  }

  return {
    suit: "?",
    suitClass: "",
    cardClass: "",
    title: record.title || "Registro",
    text: record.description || "Sin descripción"
  };
}

function renderCard(record) {
  const visual = getCardVisual(record);

  return `
    <div class="record-card ${visual.cardClass}">
      <div class="record-top ${visual.suitClass}">
        <span>J</span>
        <span>${visual.suit}</span>
      </div>

      <div class="record-center">
        <div class="record-suit-big ${visual.suitClass}">
          ${visual.suit}
        </div>

        <div class="record-title">
          ${escapeHtml(visual.title)}
        </div>

        <div class="record-text">
          ${escapeHtml(visual.text)}
        </div>
      </div>

      <div class="record-bottom ${visual.suitClass}">
        <span>${visual.suit}</span>
        <span>J</span>
      </div>
    </div>
  `;
}