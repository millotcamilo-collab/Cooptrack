(function () {
  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function normalizeSuit(value) {
    return String(value || "").trim().toUpperCase();
  }

  function buildCurrencyHTML(currencySuit, currencyCode, currencyName) {
    if (!currencyCode && !currencyName) return "";

    const symbol = getSuitSymbol(currencySuit || "DIAMOND");
    const colorClass = ["HEART", "DIAMOND"].includes(normalizeSuit(currencySuit))
      ? "placard__currency-suit--red"
      : "placard__currency-suit--black";

    return `
      <div class="placard__currency">
        <span class="placard__currency-suit ${colorClass}">${escapeHtml(symbol)}</span>
        ${currencyCode
        ? `<span class="placard__currency-code">${escapeHtml(currencyCode)}</span>`
        : ""
      }
        ${currencyName
        ? `<span class="placard__currency-name">${escapeHtml(currencyName)}</span>`
        : ""
      }
      </div>
    `;
  }

  function buildPhotoHTML(photoUrl) {
    return `
    <button
      type="button"
      class="placard__photo-button"
      id="placardPhotoBtn"
      title="Ir al mazo"
      aria-label="Ir al mazo"
    >
      <img
        src="${escapeHtml(photoUrl)}"
        alt="Foto del mazo"
        class="placard__photo"
        onerror="this.onerror=null;this.src='/assets/icons/sinPicture.gif';"
      />
    </button>
  `;
  }

  function buildTopCardImageHTML(card) {
    const rank = String(card?.rank || card?.card_rank || "")
      .trim()
      .toUpperCase();
    const suit = normalizeSuit(card?.suit || card?.card_suit);

    let src = "";

    if (rank === "A" && suit === "HEART") src = "/assets/icons/Acorazon.png";
    if (rank === "A" && suit === "SPADE") src = "/assets/icons/Apike.png";
    if (rank === "A" && suit === "DIAMOND") src = "/assets/icons/Adiamante.png";
    if (rank === "A" && suit === "CLUB") src = "/assets/icons/Atrebol.png";

    if (rank === "K" && suit === "HEART") src = "/assets/icons/Kcorazon.png";
    if (rank === "K" && suit === "SPADE") src = "/assets/icons/Kpike.png";
    if (rank === "K" && suit === "DIAMOND") src = "/assets/icons/Kdiamante.png";
    if (rank === "K" && suit === "CLUB") src = "/assets/icons/Ktrebol.png";

    if (rank === "Q" && suit === "HEART") src = "/assets/icons/Qcorazon.png";
    if (rank === "Q" && suit === "SPADE") src = "/assets/icons/Qpike.png";
    if (rank === "Q" && suit === "DIAMOND") src = "/assets/icons/Qdiamante.png";
    if (rank === "Q" && suit === "CLUB") src = "/assets/icons/Qtrebol.png";

    const labelMap = {
      HEART: "♥",
      SPADE: "♠",
      DIAMOND: "♦",
      CLUB: "♣"
    };

    const label = `${rank}${labelMap[suit] || ""}`;

    if (rank === "Q" && suit === "HEART") {
      return `
    <div
      class="placard__qheart-card placard__qheart-card--pulse"
      title="${escapeHtml(label)}"
      draggable="true"
      data-rank="${escapeHtml(rank)}"
      data-suit="${escapeHtml(suit)}"
      data-card-id="${escapeHtml(card?.id || "")}"
      data-virtual="${card?.isVirtual ? "true" : "false"}"
    >
      <div class="placard__qheart-corner placard__qheart-corner--tl">
        <span>Q</span>
        <span>♥</span>
      </div>

      <div class="placard__qheart-inner">
        <div class="placard__qheart-portrait"></div>
      </div>

      <div class="placard__qheart-corner placard__qheart-corner--br">
        <span>Q</span>
        <span>♥</span>
      </div>
    </div>
  `;
    }

    if (src) {
      return `
        <img
          src="${escapeHtml(src)}"
          alt="${escapeHtml(label)}"
          title="${escapeHtml(label)}"
          class="placard__topcard-image ${rank === "Q" && suit === "HEART"
          ? "placard__topcard-image--pulse"
          : ""}"
          draggable="true"
          data-rank="${escapeHtml(rank)}"
          data-suit="${escapeHtml(suit)}"
          data-card-id="${escapeHtml(card?.id || "")}"
          data-virtual="${card?.isVirtual ? "true" : "false"}"
        />
      `;
    }

    return `
      <div
        class="placard__topcard-fallback"
        title="${escapeHtml(label)}"
        draggable="true"
        data-rank="${escapeHtml(rank)}"
        data-suit="${escapeHtml(suit)}"
        data-card-id="${escapeHtml(card?.id || "")}"
        data-virtual="${card?.isVirtual ? "true" : "false"}"
      >
        ${escapeHtml(label)}
      </div>
    `;
  }

  function buildTopCardsHTML(cards) {
    if (!Array.isArray(cards) || !cards.length) return "";
    return cards.map(buildTopCardImageHTML).join("");
  }

  function buildLeftCardsHTML(leftCardsHtml) {
    if (!leftCardsHtml) return "";
    return `
      <div class="placard__lead-cards">
        ${leftCardsHtml}
      </div>
    `;
  }

  function bindPlacardDrag(container) {
    container
      .querySelectorAll(".placard__topcard-image, .placard__topcard-fallback, .placard__qheart-card")
      .forEach((cardEl) => {
        cardEl.addEventListener("dragstart", (event) => {
          const payload = {
            source: "placard",
            rank: String(cardEl.dataset.rank || "").toUpperCase(),
            suit: String(cardEl.dataset.suit || "").toUpperCase(),
            cardId: cardEl.dataset.cardId || null,
            isVirtual: cardEl.dataset.virtual === "true"
          };

          window.__draggingPlacardCard = payload;

          event.dataTransfer.setData(
            "application/json",
            JSON.stringify(payload)
          );
          event.dataTransfer.setData(
            "text/plain",
            `${payload.rank}|${payload.suit}`
          );
          event.dataTransfer.effectAllowed = "copy";
        });
      });

    document.addEventListener("dragend", () => {
      window.__draggingPlacardCard = null;
    });
  }


  function getNickname(value, fallback = "invitado") {
    const text = String(value || "").trim();
    return text || fallback;
  }

  function getSuitLabelEs(suit) {
    const s = normalizeSuit(suit);

    if (s === "HEART") return "corazón";
    if (s === "SPADE") return "picas";
    if (s === "DIAMOND") return "diamantes";
    if (s === "CLUB") return "trébol";
    return "palo";
  }

  function getSettlementStatus(config) {
    const settlement = config?.settlement || null;
    const play = config?.play || null;
    const playCode = String(play?.play_code || "").toUpperCase();

    if (settlement?.status) {
      return String(settlement.status).trim().toUpperCase();
    }

    if (playCode.includes("SETTLEMENT:PAID")) return "PAID";
    if (playCode.includes("SETTLEMENT:COMPLAINED")) return "COMPLAINED";
    if (playCode.includes("SETTLEMENT:MOUSTACHE")) return "MOUSTACHE";

    return "";
  }

  function getInvitationResolutionLabel(status) {
    const s = String(status || "").trim().toUpperCase();

    if (s === "APPROVED") return "aceptada";
    if (s === "REJECTED") return "rechazada";
    if (s === "CANCELLED") return "cancelada";

    return "";
  }

  function getPlacardHeadline(config) {
    const page = String(config?.page || "").trim().toLowerCase();

    if (page === "lienzo-new") {
      return "Nueva jugada";
    }

    if (page === "lienzo-qpica") {
      return getQpicaHeadline(config);
    }

    if (page === "lienzo-qqpica") {
      return getQQpicaHeadline(config);
    }

    if (page === "lienzo-jpica") {
      return "";
    }
    // 👇 RQF primero y dinámico por tipo de carta
    if (page === "lienzo-rqf") {
      const rank = String(config?.play?.card_rank || "").trim().toUpperCase();

      if (rank === "K") return getKHeadline(config);
      if (rank === "A") return getAHeadline(config);
      if (rank === "Q") return getQpicaHeadline(config);

      return "Jugada archivada";
    }

    if (page === "lienzo-k") {
      return getKHeadline(config);
    }

    if (page === "lienzo-a") {
      return getAHeadline(config);
    }

    if (page === "lienzo-jcorazon") {
      return getJHeartHeadline(config);
    }

    return "";
  }

  function buildTickerHtml(texts, title, options = {}) {
    const safeTexts = Array.isArray(texts)
      ? texts.map((text) => String(text || "").trim()).filter(Boolean)
      : [];

    if (!safeTexts.length) return "";

    const buttonId = String(options.buttonId || "").trim();
    const extraClass = String(options.extraClass || "").trim();
    const rootClass = [
      "placard__subtitle",
      "placard__subtitle--ticker",
      extraClass
    ].filter(Boolean).join(" ");

    const trackHtml = `
        <div class="placard__ticker-track">
          ${safeTexts
            .map((text) => `<span class="placard__ticker-item">${escapeHtml(text)}</span>`)
            .join("")}
        </div>
      `;

    if (buttonId) {
      return `
      <button
        type="button"
        class="${rootClass} placard__ticker-btn"
        id="${escapeHtml(buttonId)}"
        title="${escapeHtml(title || "Ver jugadas de corazón") }"
        aria-label="${escapeHtml(title || "Ver jugadas de corazón") }"
      >
        ${trackHtml}
      </button>
    `;
    }

    return `
      <div class="${rootClass}" title="${escapeHtml(title || "Ver jugadas de corazón") }">
        ${trackHtml}
      </div>
    `;
  }

  function getStampedTexts(stamps, stampType) {
    return Array.isArray(stamps)
      ? stamps
          .filter((stamp) => String(stamp?.stamp_type || "").toUpperCase() === String(stampType || "").toUpperCase())
          .map((stamp) => String(stamp?.stamp_data?.play_text || stamp?.stamp_data?.text || "").trim())
          .filter(Boolean)
      : [];
  }

  function getLiveJHeartTexts(plays, parentPlayId = null) {
    const list = Array.isArray(plays) ? plays : [];

    return list
      .filter((play) => {
        const rank = String(play?.card_rank || play?.rank || "").trim().toUpperCase();
        const suit = String(play?.card_suit || play?.suit || "").trim().toUpperCase();
        const status = String(play?.play_status || play?.status || "").trim().toUpperCase();
        const currentParentId = Number(play?.parent_play_id || 0);

        const parentMatches = parentPlayId === null
          ? !currentParentId
          : currentParentId === Number(parentPlayId || 0);

        return rank === "J" && suit === "HEART" && status === "APPROVED" && parentMatches;
      })
      .map((play) => String(play?.play_text || play?.text || "").trim())
      .filter(Boolean);
  }

  function getJHeartSubtitleHtml(config) {
    const page = String(config?.page || "").trim().toLowerCase();

    const supportsJHeartSubtitles = [
      "lienzo-jpica",
      "lienzo-jtrebol",
      "lienzo-qtrebol",
      "tribuna-amsterdam",
      "bomba",
      "lienzo-qpica",
      "lienzo-qqpica"
    ].includes(page);

    if (!supportsJHeartSubtitles) return "";

    const currentPlay = config?.play || null;
    const currentPlayId = Number(currentPlay?.id || 0);
    const parentPlayId = Number(
      currentPlay?.parent_play_id || currentPlay?.parent_play?.id || 0
    );

    const childHeartsParentId =
      page === "tribuna-amsterdam" ||
      page === "lienzo-qpica" ||
      page === "lienzo-qqpica" ||
      page === "lienzo-qtrebol"
        ? parentPlayId
        : currentPlayId;

    const childSubtitleTitle =
      page === "lienzo-jtrebol" || page === "lienzo-qtrebol"
        ? "J corazones hijas de J trébol aprobadas"
        : "J corazones hijas de J pica aprobadas";

    const plays = Array.isArray(config?.plays) ? config.plays : [];

    const stampedRootTexts = getStampedTexts(currentPlay?.stamps || config?.stamps || [], "APPROVED_J_HEART");
    const stampedChildTexts = getStampedTexts(currentPlay?.stamps || config?.stamps || [], "APPROVED_CHILD_J_HEART");

    const liveRootTexts = getLiveJHeartTexts(plays, null);
    const liveChildTexts = childHeartsParentId
      ? getLiveJHeartTexts(plays, childHeartsParentId)
      : [];

    const rootTexts = stampedRootTexts.length ? stampedRootTexts : liveRootTexts;
    const childTexts = stampedChildTexts.length ? stampedChildTexts : liveChildTexts;

    if (!rootTexts.length && !childTexts.length) return "";

    return `
      <div class="placard__subtitles placard__subtitles--jpica">
        ${rootTexts.length
          ? buildTickerHtml(rootTexts, "J corazones aprobadas del mazo", {
              extraClass: "placard__subtitle--jpica-root"
            })
          : ""
        }

        ${childTexts.length
          ? buildTickerHtml(childTexts, childSubtitleTitle, {
              extraClass: "placard__subtitle--jpica-child"
            })
          : ""
        }
      </div>
    `;
  }

  function renderPlacard(containerId, config) {
    const container =
      typeof containerId === "string"
        ? document.getElementById(containerId)
        : containerId;

    if (!container) return;

    const photoUrl =
      String(config?.deckPhotoUrl || config?.photoUrl || "").trim() ||
      "/assets/icons/sinPicture.gif";

    const rank = String(config?.rank || "").trim() || "A";
    const suit = normalizeSuit(config?.suit || "HEART");
    const title = String(config?.title || "").trim() || "Mazo";

    const currencyCode = String(config?.currencyCode || "").trim();
    const currencyName = String(config?.currencyName || "").trim();
    const showCurrency = Boolean(config?.showCurrency);

    const mode = String(config?.mode || "DEFAULT").trim().toUpperCase();


    const deckId =
      config?.deckId ||
      config?.deck?.id ||
      config?.mazo?.id ||
      config?.id ||
      new URLSearchParams(window.location.search).get("deckId") ||
      new URLSearchParams(window.location.search).get("id");

    const canOpenMazo = config?.canOpenMazo !== false;
    const photoHtml = buildPhotoHTML(photoUrl);


    const leftCardsHtml = buildLeftCardsHTML(
      config?.leftCardsHtml || buildTopCardsHTML(config?.leftCards || [])
    );

    const subtitleHtml = getJHeartSubtitleHtml(config);

const contextHtml = String(config?.contextHtml || "").trim();

container.innerHTML = `
  <section class="placard">
    <div class="placard__row">

      <div class="placard__lead">
        ${leftCardsHtml}
        <div class="placard__photo-wrap">
          ${canOpenMazo
            ? photoHtml
            : `
              <div class="placard__photo-static">
                <img
                  src="${escapeHtml(photoUrl)}"
                  alt="Foto del mazo"
                  class="placard__photo"
                  onerror="this.onerror=null;this.src='/assets/icons/sinPicture.gif';"
                />
              </div>
            `
          }
        </div>
      </div>

      <div class="placard__maincard">
        ${canOpenMazo
          ? `
            <button
              type="button"
              class="placard__maincard-btn"
              id="placardAdminBtn"
              title="Ir a administradores"
              aria-label="Ir a administradores"
            >
              <img
                src="/assets/icons/Acorazon.png"
                alt="A♥"
                class="placard__maincard-image"
              />
            </button>
          `
          : `
            <div class="placard__maincard-static">
              <img
                src="/assets/icons/Acorazon.png"
                alt="A♥"
                class="placard__maincard-image"
              />
            </div>
          `
        }
      </div>

      <div class="placard__text">
        <div class="placard__titleline">
          <span class="placard__name">${escapeHtml(title)}</span>
          ${showCurrency
            ? buildCurrencyHTML("DIAMOND", currencyCode, currencyName)
            : ""
          }
        </div>

        ${subtitleHtml}

        ${contextHtml
          ? `
            <div class="placard__context">
              ${contextHtml}
            </div>
          `
          : ""
        }
      </div>

    </div>
  </section>

`;
    // 👉 ir a administradores (A♥)
    const adminBtn = container.querySelector("#placardAdminBtn");

    if (adminBtn && canOpenMazo) {
      adminBtn.addEventListener("click", () => {
        if (!deckId) return;
        window.location.href = `/mazoAdministradores.html?id=${deckId}`;
      });
    }

    // 👉 ir a mazo (foto)
    const photoBtn = container.querySelector("#placardPhotoBtn");

    if (photoBtn && canOpenMazo) {
      photoBtn.addEventListener("click", () => {
        if (!deckId) return;
        window.location.href = `/mazo.html?id=${deckId}`;
      });
    }

    const tickerBtn = container.querySelector("#placardTickerBtn");

    if (tickerBtn && canOpenMazo) {
      tickerBtn.addEventListener("click", () => {
        if (!deckId) return;
        window.location.href = `/mazo.html?id=${deckId}&suit=HEART`;
      });
    }

    bindPlacardDrag(container);
  }

  window.renderPlacard = renderPlacard;
})();