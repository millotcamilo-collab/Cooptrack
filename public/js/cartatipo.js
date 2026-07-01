(function () {
  function normalizeRank(value) {
    return String(value || "").trim().toUpperCase();
  }

  function normalizeSuit(value) {
    return String(value || "").trim().toUpperCase();
  }

  function shouldRenderMiniDay({ rank, suit, start_date, end_date }) {
    return (
      normalizeSuit(suit) === "SPADE" &&
      (start_date || end_date)
    );
  }

  function formatHour(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return `${String(date.getHours()).padStart(2, "0")}:${String(
      date.getMinutes()
    ).padStart(2, "0")}`;
  }

  function getMiniDayHours(value) {
    if (!value) return ["", "", "", ""];

    const base = new Date(value);

    const minus2 = new Date(base);
    minus2.setHours(minus2.getHours() - 2);

    const minus1 = new Date(base);
    minus1.setHours(minus1.getHours() - 1);

    const plus1 = new Date(base);
    plus1.setHours(plus1.getHours() + 1);

    const plus2 = new Date(base);
    plus2.setHours(plus2.getHours() + 2);

    return [
      formatHour(minus2),
      formatHour(minus1),
      formatHour(plus1),
      formatHour(plus2)
    ];
  }

  function getMiniDayRange(value) {
    if (!value) return null;

    const base = new Date(value);

    const from = new Date(base);
    from.setHours(from.getHours() - 2);

    const to = new Date(base);
    to.setHours(to.getHours() + 2);

    return { from, to };
  }

function getMiniDayHeaderParts(value) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const weekdays = ["DOM", "LUN", "MAR", "MIE", "JUE", "VIE", "SAB"];
  const months = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];

  return {
    dow: weekdays[date.getDay()] || "",
    day: String(date.getDate()),
    month: months[date.getMonth()] || ""
  };
}

  function renderMiniDay({
    play_text,
    start_date,
    end_date,
    location,
    spade_mode,
    dayItems,
    activityIconOverride = ""
  }) {
    const playType = String(spade_mode || "")
      .trim()
      .toUpperCase();

    const inferredType =
      playType ||
      (end_date && !start_date ? "DEADLINE" : "APPOINTMENT");

    const isDeadline = inferredType === "DEADLINE";

    const date = isDeadline
      ? (end_date || start_date)
      : (start_date || end_date);
    const [h1, h2, h3, h4] = getMiniDayHours(date);
    const range = getMiniDayRange(date);

const dayHeader = getMiniDayHeaderParts(date);

    const centerTime = date ? new Date(date).getTime() : null;

    const otherRows = Array.isArray(dayItems)
      ? dayItems
        .map((item) => {
          const itemDate = item.start_date || item.end_date;

          return {
            ...item,
            date: itemDate,
            hour: formatHour(itemDate)
          };
        })
        .filter((item) => {
          if (!item.date || !range || !centerTime) return false;

          const itemTime = new Date(item.date).getTime();

          return (
            itemTime >= range.from.getTime() &&
            itemTime <= range.to.getTime() &&
            itemTime !== centerTime
          );
        })
        .sort((a, b) => new Date(a.date) - new Date(b.date))
      : [];


    const activityIcon = activityIconOverride || (
      isDeadline
        ? "/assets/icons/bombaRedonda60.gif"
        : "/assets/icons/reloj60.gif"
    );

    return `
  <div class="lv2-mini-day">
${dayHeader ? `
  <div class="lv2-mini-day__header">
    <span class="lv2-mini-day__header-part lv2-mini-day__header-part--dow">
      ${escapeHtml(dayHeader.dow)}
    </span>

    <span class="lv2-mini-day__header-part lv2-mini-day__header-part--day">
      ${escapeHtml(dayHeader.day)}
    </span>

    <span class="lv2-mini-day__header-part lv2-mini-day__header-part--month">
      ${escapeHtml(dayHeader.month)}
    </span>
  </div>
` : ""}

    <div class="lv2-mini-day__body">
      <div class="lv2-mini-day__row">${escapeHtml(h1)}</div>
      <div class="lv2-mini-day__row">${escapeHtml(h2)}</div>

      <div class="lv2-mini-day__row lv2-mini-day__row--active">
        <span class="lv2-mini-day__hour">${escapeHtml(formatHour(date))}</span>
        <span class="lv2-mini-day__text">
          <img
            class="lv2-mini-day__activity-icon"
            src="${activityIcon}"
            alt=""
          />
          ${escapeHtml(play_text)}
        </span>

        ${location ? `
          <span
            class="lv2-mini-day__location"
            title="${escapeHtml(location)}"
          >
            📍
          </span>
        ` : ""}
      </div>

      ${otherRows
        .map(
          (item) => `
            <div class="lv2-mini-day__row">
              ${item.hour ? `<span class="lv2-mini-day__hour">${escapeHtml(item.hour)}</span>` : ""}
              <span class="lv2-mini-day__text">${escapeHtml(item.play_text || "")}</span>
              ${item.location ? `
                <span
                  class="lv2-mini-day__location"
                  title="${escapeHtml(item.location)}"
                >
                  📍
                </span>
              ` : ""}
            </div>
          `
        )
        .join("")}

      <div class="lv2-mini-day__row">${escapeHtml(h3)}</div>
      <div class="lv2-mini-day__row">${escapeHtml(h4)}</div>
    </div>
  </div>
  `;
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
      return '<span class="lv2-play-card__decision-stamp lv2-play-card__decision-stamp--approved" aria-label="Aprobado">APROBADO</span>';
    }

    if (safeStatus === "REJECTED") {
      return '<span class="lv2-play-card__decision-stamp lv2-play-card__decision-stamp--rejected" aria-label="Rechazado">RECHAZADO</span>';
    }

    if (safeStatus === "CANCELLED") {
      return '<span class="lv2-play-card__decision-stamp lv2-play-card__decision-stamp--cancelled" aria-label="Cancelado">CANCELADO</span>';
    }

    if (safeStatus === "DONE") {
      return '<span class="lv2-play-card__decision-stamp lv2-play-card__decision-stamp--done" aria-label="Hecho">HECHO</span>';
    }

    if (safeStatus === "QUIT") {
      return '<span class="lv2-play-card__decision-stamp lv2-play-card__decision-stamp--quit" aria-label="Renunciado">RENUNCIADO</span>';
    }

    if (safeStatus === "FIRED") {
      return '<span class="lv2-play-card__decision-stamp lv2-play-card__decision-stamp--fired" aria-label="Despedido">DESPEDIDO</span>';
    }

    return "";
  }

  function renderPlayCardBox({
    rank,
    suit,
    title = "",
    titleHtml = "",
    metas = [],
    status = "",
    spade_mode = "",
    start_date = null,
    end_date = null,
    location = "",
    play_text = "",
    dayItems = [],
    ownerUser = null,
    ownerLabel = "",
    ownerCards = [],
    actionsHtml = "",
    showOwner = true,
    showActions = true,
    figureOverrideSrc = "",
    hideInnerSuit = false,
    miniDayActivityIcon = ""
  }) {
    try {
      console.log("[CartaTipo.renderPlayCardBox] incoming:", {
        rank: rank,
        suit: suit,
        play_text: play_text,
        start_date: start_date,
        end_date: end_date,
        location: location,
        dayItems: dayItems,
        metas: metas,
        ownerCards: ownerCards
      });
    } catch (e) {
      // noop
    }

    const safeRank = normalizeRank(rank);
    const safeSuit = normalizeSuit(suit);
    const isAuthorityCard = safeRank === "A" || safeRank === "K";
    const figureSrc = figureOverrideSrc || getFigureImageSrc(safeRank, safeSuit);
    const decisionHtml = renderDecisionStamp(status);

    const suitSymbol = getSuitSymbol(safeSuit);
    const isRedSuit = safeSuit === "HEART" || safeSuit === "DIAMOND";
    const centerSuitClass = isRedSuit
      ? " lv2-play-card__center-suit--red"
      : "";

    const ownerCardsHtml = Array.isArray(ownerCards) && ownerCards.length
      ? (() => {
        const groups = { A: [], K: [] };

        ownerCards.forEach((card) => {
          const r = normalizeRank(card.card_rank || card.rank);
          const s = normalizeSuit(card.card_suit || card.suit);

          if ((r === "A" || r === "K") && s && !groups[r].includes(s)) {
            groups[r].push(s);
          }
        });

        const suitOrder = ["HEART", "SPADE", "DIAMOND", "CLUB"];

        const renderGroup = (rank) => {
          const suits = suitOrder.filter((s) => groups[rank].includes(s));
          if (!suits.length) return "";

          return `
          <div class="lv2-play-card__owner-card-group">
            <span class="lv2-play-card__owner-card-rank">${rank}</span>
            ${suits.map((s) => {
            const redClass =
              s === "HEART" || s === "DIAMOND"
                ? " lv2-play-card__owner-card--red"
                : "";

            return `
                <span class="lv2-play-card__owner-card${redClass}">
                  ${escapeHtml(getSuitSymbol(s))}
                </span>
              `;
          }).join("")}
          </div>
        `;
        };

        return `
        <div class="lv2-play-card__owner-cards">
          ${renderGroup("A")}
          ${renderGroup("K")}
        </div>
      `;
      })()
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

    <div class="lv2-play-card__owner-info">
      <span class="lv2-play-card__owner-name">
        ${escapeHtml(
      ownerUser.nickname ||
      ownerUser.full_name ||
      ownerUser.name ||
      "Usuario"
    )}
      </span>

      ${ownerCardsHtml}
    </div>
  </div>
` : "";

    const useMiniDay = shouldRenderMiniDay({
      rank: safeRank,
      suit: safeSuit,
      start_date,
      end_date
    });

    const bodyHtml = useMiniDay
      ? renderMiniDay({
        play_text,
        start_date,
        end_date,
        location,
        spade_mode,
        dayItems,
        activityIconOverride: miniDayActivityIcon
      })
      : metas.map((meta) => `
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
    `).join("");



    return `
    <div class="lv2-play-card${isAuthorityCard ? " lv2-play-card--authority" : ""}">
      ${renderCardCorners(safeRank, safeSuit)}

      <div
        class="lv2-play-card__figure"
        style="--lv2-figure-url: url('${escapeHtml(figureSrc)}');"
      ></div>

${safeRank === "A" && suitSymbol && !hideInnerSuit ? `
  <div class="lv2-play-card__center-suit${centerSuitClass}">
    ${escapeHtml(suitSymbol)}
  </div>
` : ""}



${safeRank !== "A" && suitSymbol ? `
  <div class="lv2-play-card__inner-suit lv2-play-card__inner-suit--tl${centerSuitClass}">
    ${escapeHtml(suitSymbol)}
  </div>

  <div class="lv2-play-card__inner-suit lv2-play-card__inner-suit--br${centerSuitClass}">
    ${escapeHtml(suitSymbol)}
  </div>
` : ""}

      <div class="lv2-play-card__inner lv2-play-card__inner--figure">
        ${ownerHtml}

${titleHtml && !useMiniDay ? `
  <div class="lv2-play-card__title lv2-play-card__title--editable">
    ${titleHtml}
  </div>
` : title && !useMiniDay ? `
  <div class="lv2-play-card__title">
    ${escapeHtml(title)}
  </div>
` : ""}

${bodyHtml}



      </div>

${showActions && (actionsHtml || decisionHtml) ? `
<div class="lv2-play-card__actions">
  ${ownerLabel ? `
    <span class="lv2-play-card__action-label">
      ${escapeHtml(ownerLabel)}
    </span>
  ` : ""}
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
    renderPlayCardBox,
    shouldRenderMiniDay,
    renderMiniDay,
  };
})();