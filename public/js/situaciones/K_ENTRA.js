window.K_ENTRA = {
  render(ctx) {


const senderNick =
  play?.created_by_nickname ||
  "Remitente";

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
      A♦ A♣
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