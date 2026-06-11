window.QPICA_RESPONDE = {
  render(ctx) {
    const { play, helpers } = ctx;

    return `
      <section class="lienzo-tribune lienzo-tribune--target tribuna-single tribuna-single--amsterdam">
        <div class="lienzo-tribune__corporates"></div>

        <div id="lienzo-target-dropzone" class="lienzo-target-dropzone">
          <div class="amsterdam-card-stack">

            <div class="amsterdam-card-stack__primary">
              <div id="qpica-j-animation"></div>
              <div id="qpica-q-animation"></div>

              ${helpers.renderPlayCardBox(play)}
            </div>

          </div>
        </div>
      </section>
    `;
  }
};