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

  function isQHeartSaved() {
    return !!window.__lienzoQHeartSaved;
  }

function renderQHeartSummary() {
  const data = window.__lienzoQHeartSaved;
  if (!data) return "";

  return `
    <div class="placard-qheart-summary">
      ${escapeHtml(data.concept)}
      ${escapeHtml(data.currency)} ${escapeHtml(data.amount)}
      ${escapeHtml(data.payDate)}
      paga ${escapeHtml(data.payerLabel)}
    </div>
  `;
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
        ? `<img src="${escapeHtml(iconSrc)}" alt="♦" class="placard__suit" />`
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

  function buildLeftCardsHTML(leftCardsHtml) {
    if (!leftCardsHtml) return "";
    return `
      <div class="placard__left-cards">
        ${leftCardsHtml}
      </div>
    `;
  }

  function buildTopCardImageHTML(card) {
    const rank = String(card?.rank || card?.card_rank || "").trim().toUpperCase();
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

    const rightHtml = config?.rightHtml
      ? `<div class="placard__right">${config.rightHtml}</div>`
      : "";

    const photoHtml = buildPhotoHTML(photoUrl, canEditPhoto);
    const photoEditorHtml = buildPhotoEditorHTML(config);

    const leftCardsHtml = buildLeftCardsHTML(
      config?.leftCardsHtml || buildTopCardsHTML(config?.leftCards || [])
    );

    const qHeartHtml = renderQHeartSummary();

    container.innerHTML = `
  <section class="placard">
    <div class="placard__left">
      ${leftCardsHtml}
      ${photoHtml}
    </div>

    <div class="placard__center">
      <div class="placard__titleline">
        <span class="placard__rank">${escapeHtml(rank)}</span>

        ${suitIcon
        ? `<img src="${escapeHtml(suitIcon)}" alt="" class="placard__suit" />`
        : ""
      }

        <span class="placard__name">${escapeHtml(title)}</span>

        ${showCurrency
        ? buildCurrencyHTML("DIAMOND", currencyCode, currencyName)
        : ""
      }
      </div>

      ${photoEditorHtml}

      ${qHeartHtml}  <!-- 👈 ACA VA -->
    </div>

    ${rightHtml}
  </section>
`;
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
          console.log("DRAG START", payload);

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

  window.renderPlacard = renderPlacard;
})();