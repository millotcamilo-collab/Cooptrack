window.QQPICA_ENTRA = {
    ...window.QPICA_ENTRA,

    renderClosed(ctx) {
        const { play, helpers } = ctx;
        const parent = play?.parent_play || play?.parent || null;

        const mode = this.getParentSpadeMode(play);
        const jPrefix = mode === "DEADLINE" ? "JpicaDeadline" : "JpicaCita";

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

<div class="qpica-q-wrapper qpica-q-wrapper--back-only">
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
            ownerUser: this.getQpicaOwnerUser(play),
            showOwner: true
        })}
      </div>

      <div class="qpica-q-wrapper qpica-q-wrapper--open qqpica-qheart-wrapper">
        ${helpers.renderEconomicCard
                ? helpers.renderEconomicCard(play)
                : ""}
      </div>
    `;
    }
};