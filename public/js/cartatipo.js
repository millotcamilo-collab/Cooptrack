(function () {
  function normalizeRank(value) {
    return String(value || "").trim().toUpperCase();
  }

  function normalizeSuit(value) {
    return String(value || "").trim().toUpperCase();
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function getSuitSymbol(suit) {
    const s = normalizeSuit(suit);
    if (s === "HEART") return "♥";
    if (s === "SPADE") return "♠";
    if (s === "DIAMOND") return "♦";
    if (s === "CLUB") return "♣";
    return "";
  }

  function getFigureImageSrc(rank, suit) {
    const r = normalizeRank(rank);
    const s = normalizeSuit(suit);

    const map = {
      J_HEART: "/assets/icons/JC.png",
      J_SPADE: "/assets/icons/JP.png",
      J_DIAMOND: "/assets/icons/JD.png",
      J_CLUB: "/assets/icons/JT.png",

      Q_HEART: "/assets/icons/QC.png",
      Q_SPADE: "/assets/icons/QP.png",
      Q_DIAMOND: "/assets/icons/QD.png",
      Q_CLUB: "/assets/icons/QT.png",

      K_HEART: "/assets/icons/KC.png",
      K_SPADE: "/assets/icons/KP.png",
      K_DIAMOND: "/assets/icons/KD.png",
      K_CLUB: "/assets/icons/KT.png"
    };

    return map[`${r}_${s}`] || "";
  }

  function renderCardCorners(rank, suit) {
    const symbol = getSuitSymbol(suit);
    const normalizedSuit = normalizeSuit(suit);

    const redClass =
      normalizedSuit === "HEART" || normalizedSuit === "DIAMOND"
        ? " lv2-card-corner--red"
        : "";

    return `
      <div class="lv2-card-corner lv2-card-corner--tl${redClass}">
        <span class="lv2-card-corner__rank">${escapeHtml(rank)}</span>
        <span class="lv2-card-corner__suit">${escapeHtml(symbol)}</span>
      </div>

      <div class="lv2-card-corner lv2-card-corner--br${redClass}">
        <span class="lv2-card-corner__rank">${escapeHtml(rank)}</span>
        <span class="lv2-card-corner__suit">${escapeHtml(symbol)}</span>
      </div>
    `;
  }

  function renderDecisionStamp(status) {
    const safeStatus = String(status || "").trim().toUpperCase();

    if (safeStatus === "APPROVED") {
      return `
      <img
        class="lv2-play-card__decision-icon"
        src="/assets/icons/Sello80.gif"
        alt="Aprobada"
      />
    `;
    }

    if (safeStatus === "REJECTED") {
      return `
      <img
        class="lv2-play-card__decision-icon"
        src="/assets/icons/stepback80.gif"
        alt="Rechazada"
      />
    `;
    }

    return "";
  }

  function renderPlayCardBox({
    rank,
    suit,
    title = "",
    metas = [],
    status = "",
    ownerUser = null,
    ownerLabel = "",
    ownerCards = [],
    actionsHtml = "",
      showOwner = true,
  showActions = true
  }) {
    const safeRank = normalizeRank(rank);
    const safeSuit = normalizeSuit(suit);
    const figureSrc = getFigureImageSrc(safeRank, safeSuit);
    const decisionHtml = renderDecisionStamp(status);

    const ownerCardsHtml = Array.isArray(ownerCards) && ownerCards.length
      ? `
    <div class="lv2-play-card__owner-cards">
      ${ownerCards.map((card) => {
        const r = normalizeRank(card.card_rank || card.rank);
        const s = normalizeSuit(card.card_suit || card.suit);
        const redClass =
          s === "HEART" || s === "DIAMOND"
            ? " lv2-play-card__owner-card--red"
            : "";

        return `
  <span class="lv2-play-card__owner-card${redClass}">
    ${escapeHtml(r)}${escapeHtml(getSuitSymbol(s))}
  </span>
`;
      }).join("")}
    </div>
  `
      : "";

    const ownerHtml = showOwner && ownerUser ? `
  <div class="lv2-play-card__owner">
    <img
      class="lv2-play-card__owner-avatar"
      src="${escapeHtml(
      ownerUser.profile_photo_url ||
      "/assets/icons/singeta120.gif"
    )}"
      alt="${escapeHtml(
      ownerUser.nickname ||
      ownerUser.full_name ||
      ownerUser.name ||
      "Usuario"
    )}"
    />

   <span class="lv2-play-card__owner-name">
  ${escapeHtml(
    ownerUser.nickname ||
    ownerUser.full_name ||
    ownerUser.name ||
    "Usuario"
  )}
</span>

${ownerLabel ? `
  <span class="lv2-play-card__owner-label">
    ${escapeHtml(ownerLabel)}
  </span>
` : ""}

    ${ownerCardsHtml}
  </div>
` : "";

    return `
    <div class="lv2-play-card">
      ${renderCardCorners(safeRank, safeSuit)}

      <div
        class="lv2-play-card__figure"
        style="--lv2-figure-url: url('${escapeHtml(figureSrc)}');"
      ></div>

      <div class="lv2-play-card__inner lv2-play-card__inner--figure">
        ${title ? `
          <div class="lv2-play-card__title">
            ${escapeHtml(title)}
          </div>
        ` : ""}

        ${metas.map((meta) => `
          <div class="lv2-play-card__meta">
            ${meta.icon ? `
              <img
                class="lv2-play-card__meta-icon"
                src="${escapeHtml(meta.icon)}"
                alt=""
              />
            ` : ""}
            <span>${escapeHtml(meta.text || "")}</span>
          </div>
        `).join("")}

${ownerHtml}
      </div>

${showActions && (actionsHtml || decisionHtml) ? `
  <div class="lv2-play-card__actions">
    ${decisionHtml}
    ${actionsHtml}
  </div>
` : ""}
    </div>
  `;
  }

  window.CartaTipo = {
    normalizeRank,
    normalizeSuit,
    escapeHtml,
    getSuitSymbol,
    getFigureImageSrc,
    renderCardCorners,
    renderDecisionStamp,
    renderPlayCardBox
  };
})();