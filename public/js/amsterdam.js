window.renderAmsterdamMobile = function renderAmsterdamMobile(play, helpers = {}) {
  const {
    renderPlayCardBox
  } = helpers;

  return `
    <section class="lienzo-tribune lienzo-tribune--target tribuna-single tribuna-single--amsterdam">
      <div class="lienzo-tribune__corporates"></div>

      <div class="lienzo-tribune__stage">
        <div id="lienzo-target-dropzone" class="lienzo-target-dropzone">
          ${renderPlayCardBox(play)}
        </div>
      </div>
    </section>
  `;
};