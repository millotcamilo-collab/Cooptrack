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

  function getSuitIconSrc(suit) {
    const s = normalizeSuit(suit);

    if (s === "HEART") return "/assets/icons/cor40.gif";
    if (s === "SPADE") return "/assets/icons/pik40.gif";
    if (s === "DIAMOND") return "/assets/icons/dia40.gif";
    if (s === "CLUB") return "/assets/icons/tre40.gif";

    return "";
  }

  function buildCurrencyHTML(currencySuit, currencyCode, currencyName) {
    if (!currencyCode && !currencyName) return "";

    const iconSrc = getSuitIconSrc(currencySuit || "DIAMOND");

    return `
      <div class="placard__currency">
        ${iconSrc
        ? `<img src="${escapeHtml(iconSrc)}" alt="♦" class="placard__currency-suit" />`
        : ""
      }
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

  function buildPhotoHTML(photoUrl, canEditPhoto) {
    if (canEditPhoto) {
      return `
        <button
          type="button"
          class="placard__photo-button"
          id="placardPhotoBtn"
          title="Editar foto del mazo"
          aria-label="Editar foto del mazo"
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

    return `
      <img
        src="${escapeHtml(photoUrl)}"
        alt="Foto del mazo"
        class="placard__photo"
        onerror="this.onerror=null;this.src='/assets/icons/sinPicture.gif';"
      />
    `;
  }

  function buildPhotoEditorHTML(config) {
    if (!(config?.canEditPhoto && config?.isEditingPhoto)) return "";

    return `
      <div class="placard__photo-editor" id="placardPhotoEditor">
        <input
          id="placardPhotoUrlInput"
          class="placard__photo-input"
          type="text"
          placeholder="URL picture"
          value="${escapeHtml(config?.draftPhotoUrl || "")}"
          autocomplete="off"
        />

        <button
          id="placardPhotoSaveBtn"
          class="placard__photo-action"
          type="button"
          title="Guardar"
          aria-label="Guardar"
        >
          <img src="/assets/icons/salvar40.gif" alt="Guardar" />
        </button>

        <button
          id="placardPhotoCancelBtn"
          class="placard__photo-action"
          type="button"
          title="Salir"
          aria-label="Salir"
        >
          <img src="/assets/icons/exit80.gif" alt="Salir" />
        </button>
      </div>
    `;
  }

  function buildTopCardImageHTML(card) {
    const rank = String(card?.rank || card?.card_rank || "")
      .trim()
      .toUpperCase();
    const suit = normalizeSuit(card?.suit || card?.card_suit);

    let src = "";

    if (rank === "A" && suit === "HEART") src = "/assets/icons/Acorazon.gif";
    if (rank === "A" && suit === "SPADE") src = "/assets/icons/Apike.gif";
    if (rank === "A" && suit === "DIAMOND") src = "/assets/icons/Adiamante.gif";
    if (rank === "A" && suit === "CLUB") src = "/assets/icons/Atrebol.gif";

    if (rank === "K" && suit === "HEART") src = "/assets/icons/Kcorazon.gif";
    if (rank === "K" && suit === "SPADE") src = "/assets/icons/Kpike.gif";
    if (rank === "K" && suit === "DIAMOND") src = "/assets/icons/Kdiamante.gif";
    if (rank === "K" && suit === "CLUB") src = "/assets/icons/Ktrebol.gif";

    if (rank === "Q" && suit === "HEART") src = "/assets/icons/Qcorazon.gif";
    if (rank === "Q" && suit === "SPADE") src = "/assets/icons/Qpike.gif";
    if (rank === "Q" && suit === "DIAMOND") src = "/assets/icons/Qdiamante.gif";
    if (rank === "Q" && suit === "CLUB") src = "/assets/icons/Qtrebol.gif";

    const labelMap = {
      HEART: "♥",
      SPADE: "♠",
      DIAMOND: "♦",
      CLUB: "♣"
    };

    const label = `${rank}${labelMap[suit] || ""}`;

    if (src) {
      return `
        <img
          src="${escapeHtml(src)}"
          alt="${escapeHtml(label)}"
          title="${escapeHtml(label)}"
          class="placard__topcard-image"
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
      .querySelectorAll(".placard__topcard-image, .placard__topcard-fallback")
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

  function getPlacardHeadline(config) {
    const page = String(config?.page || "").trim().toLowerCase();
    const mode = String(config?.mode || "").trim().toUpperCase();

    if (page === "lienzo-new" || mode === "LIENZO_NEW") {
      return "Nueva jugada";
    }

    return "";
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
    const suitIcon = getSuitIconSrc(suit);
    const title = String(config?.title || "").trim() || "Mazo";

    const currencyCode = String(config?.currencyCode || "").trim();
    const currencyName = String(config?.currencyName || "").trim();
    const showCurrency = Boolean(config?.showCurrency);
    const canEditPhoto = Boolean(config?.canEditPhoto);
    const mode = String(config?.mode || "DEFAULT").trim().toUpperCase();
    const headline = getPlacardHeadline(config);

    const photoHtml = buildPhotoHTML(photoUrl, canEditPhoto);
    const photoEditorHtml = buildPhotoEditorHTML(config);

    const leftCardsHtml = buildLeftCardsHTML(
      config?.leftCardsHtml || buildTopCardsHTML(config?.leftCards || [])
    );

    function getFirstApprovedJHeartText(plays) {
      if (!Array.isArray(plays)) return "";

      const j = plays.find((p) => {
        const rank = String(p?.card_rank || "").toUpperCase();
        const suit = String(p?.card_suit || "").toUpperCase();
        const status = String(p?.play_status || "").toUpperCase();

        return rank === "J" && suit === "HEART" && status === "APPROVED";
      });

      return j?.play_text || "";
    }
    const jHeartText = getFirstApprovedJHeartText(config?.plays || []);

    let subtitleHtml = "";

    if (jHeartText) {
      subtitleHtml = `
    <div class="placard__subtitle">
      ${escapeHtml(jHeartText)}
    </div>
  `;
    }

    container.innerHTML = `
  <section class="placard">
    <div class="placard__row">
      <div class="placard__lead">
        ${leftCardsHtml}
        <div class="placard__photo-wrap">
          ${photoHtml}
        </div>
      </div>

      <div class="placard__maincard">
        <img
          src="/assets/icons/Acorazon.gif"
          alt="A♥"
          class="placard__maincard-image"
        />
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
        ${photoEditorHtml}
      </div>
    </div>
  </section>

  ${
    headline
      ? `
      <section class="placard placard--headline">
        <div class="placard__headline">
          ${escapeHtml(headline)}
        </div>
      </section>
    `
      : ""
  }
`;
    bindPlacardDrag(container);
  }

  window.renderPlacard = renderPlacard;
})();