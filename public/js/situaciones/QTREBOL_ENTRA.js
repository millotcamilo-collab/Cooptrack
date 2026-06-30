window.QTREBOL_ENTRA = {
  escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  },

  normalizeText(value) {
    return String(value || "").trim().toUpperCase();
  },

  getSenderFromParent(play) {
    const parent = play?.parent_play || play?.parent || null;

    return {
      nickname:
        parent?.created_by_nickname ||
        play?.created_by_nickname ||
        "Oferente",
      profile_photo_url:
        parent?.created_by_profile_photo_url ||
        play?.created_by_profile_photo_url ||
        "/assets/icons/singeta120.gif"
    };
  },

  renderOfferRow(play) {
    const sender = this.getSenderFromParent(play);
    const senderNick = this.escapeHtml(sender.nickname);
    const senderPhoto = this.escapeHtml(sender.profile_photo_url);

    return `
      <div class="qtrebol-offer-row" aria-label="Oferta J trebol">
        <div class="qtrebol-offer-row__card">J♣</div>

        <div class="qtrebol-offer-row__sender">
          <img
            class="qtrebol-offer-row__avatar"
            src="${senderPhoto}"
            alt="${senderNick}"
          />
          <span class="qtrebol-offer-row__nick">${senderNick}</span>
        </div>
      </div>
    `;
  },

  renderQtrebolReadOnly(ctx) {
    const { play, helpers } = ctx;

    return helpers.renderPlayCardBox({
      ...play,
      rank: "Q",
      suit: "CLUB",
      play_text: play?.play_text || "",
      actionsHtml: "",
      showOwner: true,
      showActions: false
    });
  },

  render(ctx) {
    const qheartHtml =
      typeof ctx?.helpers?.renderEconomicCard === "function"
        ? ctx.helpers.renderEconomicCard(ctx.play)
        : "";

    return `
      <section class="lienzo-tribune lienzo-tribune--target tribuna-single tribuna-single--amsterdam tribuna-single--qtrebol-offer">
        <div class="lienzo-tribune__corporates"></div>

        <div id="lienzo-target-dropzone" class="lienzo-target-dropzone">
          <div class="amsterdam-card-stack amsterdam-card-stack--qtrebol-offer">
            <div class="qtrebol-offer-stack__sender-row">
              ${this.renderOfferRow(ctx.play)}
            </div>

            <div class="amsterdam-card-stack__primary qtrebol-offer-stack__primary">
              ${this.renderQtrebolReadOnly(ctx)}
            </div>

            <div class="amsterdam-card-stack__economic qtrebol-offer-stack__economic">
              ${qheartHtml}
            </div>
          </div>
        </div>
      </section>
    `;
  }
};
