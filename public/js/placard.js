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
        ${
          iconSrc
            ? `<img src="${escapeHtml(iconSrc)}" alt="♦" class="placard__suit" />`
            : ""
        }
        ${
          currencyCode
            ? `<span class="placard__currency-code">${escapeHtml(currencyCode)}</span>`
            : ""
        }
        ${
          currencyName
            ? `<span class="placard__currency-name">${escapeHtml(currencyName)}</span>`
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
      String(config?.photoUrl || "").trim() || "/assets/icons/sinPicture.gif";

    const rank = String(config?.rank || "").trim() || "A";
    const suit = normalizeSuit(config?.suit || "HEART");
    const suitIcon = getSuitIconSrc(suit);
    const title = String(config?.title || "").trim() || "Mazo";

    const currencyCode = String(config?.currencyCode || "").trim();
    const currencyName = String(config?.currencyName || "").trim();
    const showCurrency = Boolean(config?.showCurrency);

    const rightHtml = config?.rightHtml
      ? `<div class="placard__right">${config.rightHtml}</div>`
      : "";

    container.innerHTML = `
      <section class="placard">
        <div class="placard__left">
          <img
            src="${escapeHtml(photoUrl)}"
            alt="Foto"
            class="placard__photo"
            onerror="this.onerror=null;this.src='/assets/icons/sinPicture.gif';"
          />
        </div>

        <div class="placard__center">
          <div class="placard__titleline">
            <span class="placard__rank">${escapeHtml(rank)}</span>

            ${
              suitIcon
                ? `<img src="${escapeHtml(suitIcon)}" alt="" class="placard__suit" />`
                : ""
            }

            <span class="placard__name">${escapeHtml(title)}</span>

            ${
              showCurrency
                ? buildCurrencyHTML("DIAMOND", currencyCode, currencyName)
                : ""
            }
          </div>
        </div>

        ${rightHtml}
      </section>
    `;
  }

  window.renderPlacard = renderPlacard;
})();