window.K_ENTRA = {
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

    if (card === "K_HEART") return "K♥";
    if (card === "K_SPADE") return "K♠";
    if (card === "K_DIAMOND") return "K♦";
    if (card === "K_CLUB") return "K♣";

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
      ${helpers.escapeHtml(senderCards)}
    </div>
  </div>
</div>
              <div class="kentra-k-wrapper kentra-k-wrapper--open">
                ${helpers.renderPlayCardBox({
                  ...play,
                  play_text: play.play_text || "",
                  title: play.play_text || "Invitación K"
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