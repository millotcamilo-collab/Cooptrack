window.AS_RESPONDE = {
    render(ctx) {
        const {
            play,
            plays = [],
            senderOwner = null,
            helpers
        } = ctx;

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

const suit = String(play?.card_suit || play?.suit || "")
  .trim()
  .toUpperCase();

const shouldShowFallbackKing =
  String(play?.play_status || "").toUpperCase() === "APPROVED" &&
  (suit === "SPADE" || suit === "DIAMOND");

const fallbackKing = shouldShowFallbackKing
  ? plays.find((p) =>
      String(p?.card_rank || "").toUpperCase() === "K" &&
      String(p?.card_suit || "").toUpperCase() === suit &&
      Number(p?.parent_play_id || 0) === Number(play?.parent_play_id || 0) &&
      Number(p?.created_by_user_id || 0) === Number(play?.created_by_user_id || 0) &&
      String(p?.play_status || "").toUpperCase() === "APPROVED"
    )
  : null;

const fallbackKingHtml = fallbackKing
  ? helpers.renderPlayCardBox({
      ...fallbackKing,
      rank: "K",
      suit,
      title: fallbackKing.play_text || "K conservada",
      play_text: fallbackKing.play_text || "K conservada",
      ownerUser: {
        nickname:
          senderOwner?.nickname ||
          play?.created_by_nickname ||
          "Antiguo propietario",
        profile_photo_url:
          senderOwner?.profile_photo_url ||
          play?.created_by_profile_photo_url ||
          "/assets/icons/singeta120.gif"
      },
      ownerCards: [],
      showOwner: true,
      showActions: false
    })
  : "";

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
              hideInnerSuit: true,
              showActions: false
            })}

            ${fallbackKingHtml}

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