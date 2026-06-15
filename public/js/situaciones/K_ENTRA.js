window.K_ENTRA = {
  currentCtx: null,

  buildFrame(prefix, index) {
    const number = String(index).padStart(2, "0");
    return `/assets/animations/${prefix}${number}.png`;
  },

  render(ctx) {
    this.currentCtx = ctx;
    return this.renderClosed(ctx);
  },

  start(play) {
    const back = document.querySelector(".kentra-k-back");

    if (back) {
      back.addEventListener("click", () => {
        this.open();
      }, { once: true });

      back.addEventListener("touchend", (event) => {
        event.preventDefault();
        this.open();
      }, { once: true });
    }
  },

  open() {
    const host = document.querySelector(".amsterdam-card-stack__primary");

    if (!host || !this.currentCtx) return;

    const back = host.querySelector(".kentra-k-back");

    if (back) {
      back.classList.add("qpica-q-back--opening");
    }

    setTimeout(() => {
      host.innerHTML = this.renderOpen(this.currentCtx);

      if (typeof window.bindAmericaTargetActions === "function") {
        window.bindAmericaTargetActions(this.currentCtx.play);
      }

      if (typeof window.bindLienzoActions === "function") {
        window.bindLienzoActions();
      }
    }, 700);
  },

  renderClosed(ctx) {
    const { play, helpers } = ctx;

    return `
      <section class="lienzo-tribune lienzo-tribune--target tribuna-single tribuna-single--america">
        <div class="lienzo-tribune__corporates"></div>

        <div id="lienzo-target-dropzone" class="lienzo-target-dropzone">
          <div class="amsterdam-card-stack">
            <div class="amsterdam-card-stack__primary">

              ${helpers.renderPlayCardBox({
                rank: "A",
                suit: "HEART",
                card_rank: "A",
                card_suit: "HEART",
                play_text: "Autoridad del mazo",
                title: "Autoridad del mazo",
                actionsHtml: "",
                showOwner: false,
                showActions: false
              })}

              <div class="kentra-k-wrapper">
                ${helpers.renderPlayCardBox({
                  ...play,
                  play_text: play.play_text || "",
                  title: play.play_text || "Invitación K",
                  actionsHtml: "",
                  showActions: false
                })}

                <img
                  class="kentra-k-back qpica-q-back"
                  src="/assets/icons/DorsoAzul.png"
                  alt=""
                />
              </div>

            </div>
          </div>
        </div>
      </section>
    `;
  },

  renderOpen(ctx) {
    const { play, helpers } = ctx;

    return `
      ${helpers.renderPlayCardBox({
        rank: "A",
        suit: "HEART",
        card_rank: "A",
        card_suit: "HEART",
        play_text: "Autoridad del mazo",
        title: "Autoridad del mazo",
        actionsHtml: "",
        showOwner: false,
        showActions: false
      })}

      <div class="kentra-k-wrapper kentra-k-wrapper--open">
        ${helpers.renderPlayCardBox({
          ...play,
          play_text: play.play_text || "",
          title: play.play_text || "Invitación K"
        })}
      </div>
    `;
  }
};