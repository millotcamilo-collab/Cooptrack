window.K_ENTRA = {
  render(ctx) {
    const { play, helpers } = ctx;

    const senderNick =
      play?.created_by_nickname ||
      "Remitente";

    const issuedWith = Array.isArray(play?.issued_with)
      ? play.issued_with
      : [];

    const suitSymbol = {
      HEART: "♥",
      SPADE: "♠",
      DIAMOND: "♦",
      CLUB: "♣"
    };

    const parsedCards = issuedWith
      .map((card) => {
        const [rank = "", suit = ""] = String(card || "").toUpperCase().split("_");
        const suitGlyph = suitSymbol[suit] || "";
        if (!rank || !suitGlyph) return null;
        return { rank, suit: suitGlyph, suitName: suit };
      })
      .filter(Boolean);

    const senderCardHtmlTokens = [];

    const renderRank = (rank) => (
      `<span class="kentra-card-rank">${helpers.escapeHtml(rank)}</span>`
    );

    const renderSuit = (card) => {
      const isRed = card.suitName === "HEART" || card.suitName === "DIAMOND";
      return `<span class="kentra-card-suit${isRed ? " kentra-card-suit--red" : ""}">${card.suit}</span>`;
    };

    for (let i = 0; i < parsedCards.length; i += 1) {
      const current = parsedCards[i];
      const group = [current];

      let j = i + 1;
      while (j < parsedCards.length && parsedCards[j].rank === current.rank) {
        group.push(parsedCards[j]);
        j += 1;
      }

      if (group.length > 1) {
        senderCardHtmlTokens.push(renderRank(current.rank));
        senderCardHtmlTokens.push(...group.map((card) => renderSuit(card)));
      } else {
        senderCardHtmlTokens.push(`${renderRank(current.rank)}${renderSuit(current)}`);
      }

      i = j - 1;
    }

    const senderCardsHtml = senderCardHtmlTokens.join(" ");

    const senderPhoto =
      play?.created_by_profile_photo_url ||
      "/assets/icons/singeta120.gif";

    return `
      <section class="lienzo-tribune lienzo-tribune--target tribuna-single tribuna-single--america">
        <div class="lienzo-tribune__corporates"></div>

        <div id="lienzo-target-dropzone" class="lienzo-target-dropzone">
          <div class="amsterdam-card-stack">
            <div class="amsterdam-card-stack__primary">

<div class="kentra-remitente">
  <img
    class="kentra-remitente__photo"
    src="${helpers.escapeHtml(senderPhoto)}"
    alt=""
  />

  <div class="kentra-remitente__info">
    <div class="kentra-remitente__nick">
      ${helpers.escapeHtml(senderNick)}
    </div>

    <div class="kentra-remitente__cards">
      ${senderCardsHtml}
    </div>
  </div>
</div>
              <div class="kentra-k-wrapper kentra-k-wrapper--open">
                ${helpers.renderPlayCardBox({
      ...play,

      play_text: play.play_text || "",
      title: play.play_text || "Invitación K",

      ownerUser: {
        nickname:
          play?.target_user_nickname || "Invitado",

        profile_photo_url:
          play?.target_user_profile_photo_url ||
          "/assets/icons/singeta120.gif"
      },

      ownerCards: [],
      showOwner: true
    })}
              </div>

            </div>
          </div>
        </div>
      </section>
    `;
  },

  start() {
    // Sin animación por ahora.
  }
};