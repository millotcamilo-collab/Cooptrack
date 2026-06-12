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

  playSequence({ figureEl, prefix, from = 0, to = 29, fps = 18 }) {
    if (!figureEl) return;

    let frame = from;

    figureEl.style.setProperty(
      "--lv2-figure-url",
      `url('${this.buildFrame(prefix, frame)}')`
    );

    const interval = setInterval(() => {
      frame += 1;

      if (frame > to) {
        clearInterval(interval);
        return;
      }

      figureEl.style.setProperty(
        "--lv2-figure-url",
        `url('${this.buildFrame(prefix, frame)}')`
      );
    }, 1000 / fps);
  },

  start(play) {
    const mode = this.getParentSpadeMode(play);
    const jPrefix = mode === "DEADLINE" ? "JpicaDeadline" : "JpicaCita";

    const figures = document.querySelectorAll(
      ".amsterdam-card-stack__primary .lv2-play-card__figure"
    );

    const jFigure = figures[0];
    const qFigure = figures[1];

    this.playSequence({
      figureEl: jFigure,
      prefix: jPrefix,
      from: 0,
      to: 29,
      fps: 18
    });
const back = document.querySelector(".qpica-q-back");

if (back) {
  back.addEventListener("click", () => {
    this.open();
  }, { once: true });

  back.addEventListener("touchend", (e) => {
    e.preventDefault();
    this.open();
  }, { once: true });
}

  },

open() {
  const host = document.querySelector(".amsterdam-card-stack__primary");

  if (!host || !this.currentCtx) return;

  const back = host.querySelector(".qpica-q-back");

if (back) {
  back.classList.add("qpica-q-back--opening");
}

setTimeout(() => {
  host.innerHTML = this.renderOpen(this.currentCtx);

  const openFigures = host.querySelectorAll(".lv2-play-card__figure");
  const openQFigure = openFigures[1];

  this.playSequence({
    figureEl: openQFigure,
    prefix: "QPMira",
    from: 0,
    to: 8,
    fps: 12
  });
}, 700);

  const openFigures = host.querySelectorAll(".lv2-play-card__figure");
  const openQFigure = openFigures[1];

  this.playSequence({
    figureEl: openQFigure,
    prefix: "QPMira",
    from: 0,
    to: 8,
    fps: 12
  });
},

render(ctx) {
  this.currentCtx = ctx;
  return this.renderClosed(ctx);
},

  renderClosed(ctx) {
    const { play, helpers, parentOwner } = ctx;
    const parent = play?.parent_play || play?.parent || null;

    const mode = this.getParentSpadeMode(play);
    const jPrefix = mode === "DEADLINE" ? "JpicaDeadline" : "JpicaCita";
    console.log("PARENT", parent);
    return `
      <section class="lienzo-tribune lienzo-tribune--target tribuna-single tribuna-single--amsterdam">
        <div class="lienzo-tribune__corporates"></div>

        <div id="lienzo-target-dropzone" class="lienzo-target-dropzone">
          <div class="amsterdam-card-stack">

            <div class="amsterdam-card-stack__primary">


${parent ? helpers.renderPlayCardBox({
      ...parent,
      figureOverrideSrc: this.buildFrame(jPrefix, 0),

      ownerUser: {
        nickname: parent.created_by_nickname,
        profile_photo_url: parent.created_by_profile_photo_url
      },

      ownerCards: parent.issued_with || [],
      actionsHtml: "",
      showOwner: true,
      showActions: false
    }) : ""}

<div class="qpica-q-wrapper">

  ${helpers.renderPlayCardBox({
    ...play,
    figureOverrideSrc: this.buildFrame("QPMira", 0)
  })}

<img
  class="qpica-q-back"
  src="/assets/icons/DorsoAzul.png"
  alt=""
/>

</div>
                
              <div id="qpica-week-container" class="qpica-week-container"></div>

            </div>

          </div>
        </div>
      </section>
    `;
  },

 renderOpen(ctx) {
  const { play, helpers } = ctx;
  const parent = play?.parent_play || play?.parent || null;

  return `
${parent ? helpers.renderPlayCardBox({
  ...parent,
  play_text: "",
  parent_play_text: "",
  start_date: null,
  end_date: null,
  location: "",

  ownerUser: {
    nickname: parent.created_by_nickname,
    profile_photo_url: parent.created_by_profile_photo_url
  },
  ownerCards: parent.issued_with || [],
  actionsHtml: "",
  showOwner: true,
  showActions: false
}) : ""}

    <div class="qpica-q-wrapper qpica-q-wrapper--open">
      ${helpers.renderPlayCardBox({
        ...play,
        figureOverrideSrc: this.buildFrame("QPMira", 0)
      })}
    </div>

    <div id="qpica-week-container" class="qpica-week-container"></div>
  `;
},

};