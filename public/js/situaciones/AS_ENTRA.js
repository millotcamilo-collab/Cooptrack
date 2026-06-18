window.AS_ENTRA = {
    render(ctx) {
        const { play, helpers } = ctx;

        const senderNick =
            play?.created_by_nickname ||
            "Remitente";

        const issuedWith = Array.isArray(play?.issued_with)
            ? play.issued_with
            : [];

        const senderCards = issuedWith
            .map((card) => {
                if (card === "A_HEART") return "A♥";
                if (card === "A_SPADE") return "A♠";
                if (card === "A_DIAMOND") return "A♦";
                if (card === "A_CLUB") return "A♣";


                return "";
            })
            .filter(Boolean)
            .join(" ");

        const senderPhoto =
            play?.created_by_profile_photo_url ||
            "/assets/icons/singeta120.gif";

      

        return `
      <section class="lienzo-tribune lienzo-tribune--target tribuna-single tribuna-single--america">
        <div class="lienzo-tribune__corporates"></div>

        <div id="lienzo-target-dropzone" class="lienzo-target-dropzone">
          <div class="amsterdam-card-stack">
            <div class="amsterdam-card-stack__primary">

<div class="asentra-remitente">
  <img
    class="asentra-remitente__photo"
    src="${helpers.escapeHtml(senderPhoto)}"
    alt=""
  />

  <div class="asentra-remitente__info">
    <div class="asentra-remitente__nick">
      ${helpers.escapeHtml(senderNick)}
    </div>

    <div class="asentra-remitente__cards">
      ${helpers.escapeHtml(senderCards)}
    </div>
  </div>
</div>
              <div class="asentra-a-wrapper asentra-a-wrapper--open">
  ${helpers.renderPlayCardBox({
    ...play,

    rank: "A",
    suit: play.card_suit,

    play_text: play.play_text || "",
    title: play.play_text || "Transferencia de As",

    ownerUser: {
      nickname:
        play?.target_user_nickname || "Invitado",

      profile_photo_url:
        play?.target_user_profile_photo_url ||
        "/assets/icons/singeta120.gif"
    },

    ownerCards: [],
    showOwner: true,
    hideInnerSuit: true
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