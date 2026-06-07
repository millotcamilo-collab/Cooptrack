window.renderAmsterdamMobile = function renderAmsterdamMobile(play, helpers = {}) {
  const {
    resolveTargetUser,
    renderPlayCardBox,
    escapeHtml
  } = helpers;

  const user = resolveTargetUser(play);
  const userName = user?.nickname || user?.full_name || user?.name || "Invitado";
  const userPhoto = user?.profile_photo_url || "/assets/icons/singeta120.gif";

  return `
    <section class="lienzo-tribune lienzo-tribune--target tribuna-single tribuna-single--amsterdam">
      <div class="lienzo-tribune__corporates"></div>

      <div class="lienzo-tribune__identity">
        <img
          class="lienzo-tribune__avatar"
          src="${escapeHtml(userPhoto)}"
          alt="${escapeHtml(userName)}"
        />

        <div class="lienzo-tribune__name">
          ${escapeHtml(userName)}
        </div>
      </div>

      <div class="lienzo-tribune__stage">
        <div id="lienzo-target-dropzone" class="lienzo-target-dropzone">
          ${renderPlayCardBox(play)}
        </div>
      </div>
    </section>
  `;
};