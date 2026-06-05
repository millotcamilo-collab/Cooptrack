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
    <section class="mobile-tribune mobile-tribune--amsterdam">
      <header class="mobile-tribune__identity">
        <img
          class="mobile-tribune__avatar"
          src="${escapeHtml(userPhoto)}"
          alt="${escapeHtml(userName)}"
        />
        <div class="mobile-tribune__name">
          ${escapeHtml(userName)}
        </div>
      </header>

      <main class="mobile-tribune__stage">
        ${renderPlayCardBox(play)}
      </main>
    </section>
  `;
};