window.renderAmsterdamMobile = function renderAmsterdamMobile(play, helpers = {}) {
  const {
    renderPlayCardBox
  } = helpers;

  return `
    <section class="lienzo-tribune lienzo-tribune--target tribuna-single tribuna-single--amsterdam">
      <div class="lienzo-tribune__corporates"></div>

      <div id="lienzo-target-dropzone" class="lienzo-target-dropzone">

  <div class="qqpica-card-stack">

    <div class="qqpica-card-stack__top">
      ${renderPlayCardBox(play)}
    </div>

    <div class="qqpica-card-stack__bottom">
      <div id="qq-heart-slot"></div>
    </div>

  </div>

</div>
    </section>
  `;
};