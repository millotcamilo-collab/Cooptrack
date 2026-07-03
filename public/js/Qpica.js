(function () {
  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function parseFlowMetadata(flowValue) {
    const raw = String(flowValue || "").trim();
    if (!raw) return { payment: null };

    const chunks = raw.split(";").map(s => s.trim());

    for (const chunk of chunks) {
      if (chunk.startsWith("pay:QHEART")) {
        return { payment: true };
      }
    }

    return { payment: null };
  }

  function renderQpike(play, context = {}) {
    const helpers = context.helpers || {};
    const escape = helpers.escapeHtml || escapeHtml;
    const primarySuit = String(
      context?.primarySuit || play?.card_suit || play?.suit || "SPADE"
    ).trim().toUpperCase();

    const deckId =
      context?.deck?.id ||
      context?.state?.deck?.id ||
      play?.deck_id ||
      "";

    const targetPhoto =
      play.target_user_profile_photo_url ||
      play.target_user_photo_url ||
      "/assets/icons/singeta120.gif";

    const targetName =
      play.target_user_nickname ||
      play.target_nickname ||
      `Usuario ${play.target_user_id || "—"}`;


      console.log("QPICA STATUS DEBUG", play.id, play.play_status, play.status);

    const status = String(play.play_status || play.status || "").toUpperCase();

    let statusLabel = "Pendiente";
    if (status === "SENT") statusLabel = "Enviada";
    if (status === "APPROVED") statusLabel = "Aceptada";
    if (status === "REJECTED") statusLabel = "Rechazada";
    if (status === "CANCELLED") statusLabel = "Cancelada";

    function parsePlayCode(code) {
      const parts = String(code || "").split("§");
      return {
        flow: parts[7] || ""
      };
    }

    function parseFlowMetadata(flowValue) {
      const raw = String(flowValue || "").trim();
      if (!raw) return { payment: null };

      const chunks = raw
        .split(";")
        .map((item) => item.trim())
        .filter(Boolean);

      let payment = null;

      chunks.forEach((chunk) => {
        if (!chunk.startsWith("pay:QHEART")) return;

        const parts = chunk.split("|");
        const paymentData = {
          attachedRank: "Q",
          attachedSuit: "HEART"
        };

        parts.forEach((part, index) => {
          if (index === 0) return;

          const separatorIndex = part.indexOf(":");
          if (separatorIndex === -1) return;

          const key = part.slice(0, separatorIndex).trim();
          const value = part.slice(separatorIndex + 1).trim();

          if (!key) return;
          paymentData[key] = value;
        });

        payment = paymentData;
      });

      return { payment };
    }

    const parsed = parsePlayCode(play?.play_code || "");
    const meta = parseFlowMetadata(parsed.flow);
    const payment = meta.payment;
    const playCodeUpper = String(play?.play_code || "").toUpperCase();
    const showMetaDisabledIcon =
      playCodeUpper.includes("BOMB:DONE") ||
      playCodeUpper.includes("BOMB:DISABLED");

    const mainSuitSymbol = primarySuit === "CLUB" ? "♣" : "♠";
    const mainSuitHtml = `<span class="qpike-row__suit qpike-row__suit--spade">${mainSuitSymbol}</span>`;
    let paymentHtml = "";

    function getEconomicSuit(statusValue) {
      const normalized = String(statusValue || "").toUpperCase();
      const acceptedStatuses = ["APPROVED", "DONE", "QUIT"];
      return acceptedStatuses.includes(normalized) ? "♦" : "♥";
    }

    if (payment) {
      const economicSuit = getEconomicSuit(status);
      const currency = String(payment.currency || "").trim();
      const amount = String(payment.amount || "").trim();
      const paymentValue = [escape(currency), escape(amount)].filter(Boolean).join(" ");

      paymentHtml = `
        <span class="qpike-row__payment">
          <span class="qpike-row__suit qpike-row__suit--red">${economicSuit}</span>
          ${paymentValue ? `<span class="qpike-row__payment-value">${paymentValue}</span>` : ""}
        </span>
      `;
    }

    const statusIconHtml = showMetaDisabledIcon
      ? `
        <img
          class="qpike-row__status-icon"
          src="/assets/icons/META60.gif"
          alt="Bomba desactivada"
          title="Bomba desactivada"
        />
      `
      : "";

    return `
    <button
      type="button"
      class="tablero-row tablero-row--qpike tablero-row--link"
      id="tablero-row-${play.id}"
      data-open-lienzo="true"
      data-play-id="${play.id}"
      data-deck-id="${deckId}"
      title="Abrir lienzo"
    >
      <div class="tablero-row__left">
        <div class="tablero-row__card-wrap">
          <span class="tablero-row__card qpike-row__rank">Q</span>
          ${mainSuitHtml}
        </div>
      </div>

      <div class="tablero-row__center qpike-row__center">
        <img
          class="qpike-row__photo"
          src="${escape(targetPhoto)}"
          alt="${escape(targetName)}"
        />
        <div class="qpike-row__content qpike-row__content--inline">
          <span class="qpike-row__nickname">${escape(targetName)}</span>
          ${paymentHtml}
          <span class="qpike-row__meta">${escape(statusLabel)}</span>
        </div>
      </div>

      <div class="tablero-row__right qpike-row__right">${statusIconHtml}</div>
    </button>
  `;
  }

  window.renderQpike = renderQpike;
})();