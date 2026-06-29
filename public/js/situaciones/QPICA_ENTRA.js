window.QPICA_ENTRA = {
  getParentSpadeMode(play) {
    const parent = play?.parent_play || play?.parent || null;
    return String(parent?.spade_mode || play?.spade_mode || "").toUpperCase();
  },

  getQpicaOwnerUser(play) {
    const targetUserId = Number(play?.target_user_id || 0);

    if (targetUserId) {
      return {
        id: targetUserId,
        nickname:
          play?.target_user_nickname ||
          play?.target_nickname ||
          play?.created_by_nickname ||
          `Usuario ${targetUserId}`,
        profile_photo_url:
          play?.target_user_profile_photo_url ||
          play?.target_user_photo_url ||
          play?.created_by_profile_photo_url ||
          "/assets/icons/singeta120.gif"
      };
    }

    const sourceUserId = Number(play?.created_by_user_id || 0);

    return {
      id: sourceUserId || null,
      nickname:
        play?.created_by_nickname ||
        (sourceUserId ? `Usuario ${sourceUserId}` : "Usuario"),
      profile_photo_url:
        play?.created_by_profile_photo_url ||
        "/assets/icons/singeta120.gif"
    };
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

  renderMiniDay(play) {
    return `
    <div class="lv2-mini-day">

      <div class="lv2-mini-day__row">17</div>
      <div class="lv2-mini-day__row">18</div>

      <div class="lv2-mini-day__row lv2-mini-day__row--active">
        <span class="lv2-mini-day__hour">19</span>
        <span class="lv2-mini-day__text">
          ${play.play_text || ""}
        </span>
        <span class="lv2-mini-day__location">📍</span>
      </div>

      <div class="lv2-mini-day__row">20</div>
      <div class="lv2-mini-day__row">21</div>

    </div>
  `;
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
    const status = String(play?.play_status || play?.status || "")
      .trim()
      .toUpperCase();

    if (!["SENT", "PENDING"].includes(status)) {
      return;
    }

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

      if (typeof window.bindAmsterdamTargetActions === "function") {
        window.bindAmsterdamTargetActions(this.currentCtx.play);
      }

      if (typeof window.bindLienzoActions === "function") {
        window.bindLienzoActions();
      }

      if (typeof window.bindQpicaActions === "function") {
        window.bindQpicaActions();
      }

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

  },

  render(ctx) {
    this.currentCtx = ctx;

    const status = String(ctx?.play?.play_status || ctx?.play?.status || "")
      .trim()
      .toUpperCase();

    const shouldAnimate =
      status === "SENT" ||
      status === "PENDING";

    return shouldAnimate
      ? this.renderClosed(ctx)
      : this.renderFinal(ctx);
  },

  renderClosed(ctx) {
    const { play, helpers, parentOwner } = ctx;
    const parent = play?.parent_play || play?.parent || null;
    const qOwnerUser = this.getQpicaOwnerUser(play);

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
      play_text: parent.play_text,
      start_date: parent.start_date,
      end_date: parent.end_date,
      location: parent.location,
      spade_mode: parent?.spade_mode || play.spade_mode,
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
      play_text: parent?.play_text || play.play_text,
      start_date: parent?.start_date || play.start_date,
      end_date: parent?.end_date || play.end_date,
      location: parent?.location || play.location,
      spade_mode: parent?.spade_mode || play.spade_mode,
      figureOverrideSrc: this.buildFrame("QPMira", 0),
      ownerUser: qOwnerUser,
      showOwner: true
    })}

<img
  class="qpica-q-back"
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

  renderFinal(ctx) {
    return `
    <section class="lienzo-tribune lienzo-tribune--target tribuna-single tribuna-single--amsterdam">
      <div class="lienzo-tribune__corporates"></div>

      <div id="lienzo-target-dropzone" class="lienzo-target-dropzone">
        <div class="amsterdam-card-stack">
          <div class="amsterdam-card-stack__primary">
            ${this.renderOpen(ctx)}
          </div>
        </div>
      </div>
    </section>
  `;
  },

  renderOpen(ctx) {
    const { play, helpers } = ctx;
    const parent = play?.parent_play || play?.parent || null;
    const qOwnerUser = this.getQpicaOwnerUser(play);

    return `
  ${parent ? helpers.renderPlayCardBox({
      ...parent,
      play_text: parent.play_text,
      start_date: parent.start_date,
      end_date: parent.end_date,
      location: parent.location,
      spade_mode: parent?.spade_mode || play.spade_mode,
      ownerUser: {
        nickname: parent.created_by_nickname,
        profile_photo_url: parent.created_by_profile_photo_url
      },
      ownerCards: parent.issued_with || [],
      actionsHtml: "",
      showOwner: true,
      showActions: false
    }) : ""}

    <div class="qpica-q-wrapper qpica-q-wrapper--open qpica-q-wrapper--invitee-open">
${helpers.renderPlayCardBox({
      ...play,
      play_text: parent?.play_text || play.play_text,
      start_date: parent?.start_date || play.start_date,
      end_date: parent?.end_date || play.end_date,
      location: parent?.location || play.location,
      spade_mode: parent?.spade_mode || play.spade_mode,
  figureOverrideSrc: this.buildFrame("QPMira", 0),
  ownerUser: qOwnerUser,
  showOwner: true
    })}
    </div>


  `;
  },

};