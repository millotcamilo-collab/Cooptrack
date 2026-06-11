window.QPICA_ENTRA = {
  getParentSpadeMode(play) {
    const parent = play?.parent_play || play?.parent || null;
    return String(parent?.spade_mode || play?.spade_mode || "").toUpperCase();
  },

  buildFrame(prefix, index) {

    const number =
      prefix === "QPMira"
        ? String(index)
        : String(index).padStart(2, "0");

    const src = `/assets/animations/${prefix}${number}.png`;

    console.log("FRAME", src);

    return src;
  },

  playSequence({ hostId, prefix, from = 0, to = 29, fps = 18 }) {
    const host = document.getElementById(hostId);
    if (!host) return;

    let frame = from;

    host.innerHTML = `
      <img
        class="qpica-animation-frame"
        src="${this.buildFrame(prefix, frame)}"
        alt=""
      />
    `;

    const img = host.querySelector("img");
    if (!img) return;

    const interval = setInterval(() => {
      frame += 1;

      if (frame > to) {
        clearInterval(interval);
        return;
      }

      img.src = this.buildFrame(prefix, frame);
    }, 1000 / fps);
  },

  render(ctx) {
    const { play, helpers } = ctx;

    return `
      <section class="lienzo-tribune lienzo-tribune--target tribuna-single tribuna-single--amsterdam">
        <div class="lienzo-tribune__corporates"></div>

        <div id="lienzo-target-dropzone" class="lienzo-target-dropzone">
          <div class="amsterdam-card-stack">

            <div class="amsterdam-card-stack__primary">


              ${helpers.renderPlayCardBox({
      ...play,
      figureOverrideSrc: this.buildFrame("QPMira", 0)
    })}
                
              <div id="qpica-week-container" class="qpica-week-container"></div>

            </div>

          </div>
        </div>
      </section>
    `;
  },


};