window.K_ENTRA = {
  render(ctx) {
    const { play, helpers } = ctx;

    return `
      <section class="lienzo-tribune lienzo-tribune--target tribuna-single tribuna-single--america">
        <div class="lienzo-tribune__corporates"></div>

        <div id="lienzo-target-dropzone" class="lienzo-target-dropzone">
          <div class="amsterdam-card-stack">
            <div class="amsterdam-card-stack__primary">

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