window.renderAmsterdamMobile = function renderAmsterdamMobile(play, helpers = {}) {
  const {
    renderPlayCardBox,
    renderQHeartBox
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
      <div id="qq-heart-slot">
  ${typeof renderQHeartBox === "function" ? renderQHeartBox(play) : ""}
</div>
    </div>

  </div>

</div>
    </section>
  `;
};

window.enableAmsterdamPeek = function enableAmsterdamPeek() {
  const card = document.querySelector(".js-qqpica-peek-card");
  if (!card) return;

  let startX = 0;
  let startY = 0;
  let currentX = 0;
  let currentY = 0;
  let dragging = false;

  function setTransform(x, y) {
    card.style.transform = `translate(${x}px, ${y}px)`;
  }

  card.addEventListener("pointerdown", (event) => {
    dragging = true;
    startX = event.clientX - currentX;
    startY = event.clientY - currentY;
    card.setPointerCapture(event.pointerId);
    card.classList.add("is-peeking");
  });

  card.addEventListener("pointermove", (event) => {
    if (!dragging) return;

    currentX = event.clientX - startX;
    currentY = event.clientY - startY;

    currentX = Math.max(-80, Math.min(80, currentX));
    currentY = Math.max(-90, Math.min(30, currentY));

    setTransform(currentX, currentY);
  });

  function endPeek(event) {
    if (!dragging) return;

    dragging = false;
    currentX = 0;
    currentY = 0;

    setTransform(0, 0);
    card.classList.remove("is-peeking");

    try {
      card.releasePointerCapture(event.pointerId);
    } catch {}
  }

  card.addEventListener("pointerup", endPeek);
  card.addEventListener("pointercancel", endPeek);
};