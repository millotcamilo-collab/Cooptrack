window.renderAmsterdamMobile = function renderAmsterdamMobile(play, helpers = {}) {
  const {
    renderPlayCardBox,
    renderEconomicCard,
    renderSenderCard
  } = helpers;

  const economicHtml =
    typeof renderEconomicCard === "function"
      ? renderEconomicCard(play)
      : "";

  const senderHtml =
    typeof renderSenderCard === "function"
      ? renderSenderCard(play)
      : "";

  return `
    <section class="lienzo-tribune lienzo-tribune--target tribuna-single tribuna-single--amsterdam">
      <div class="lienzo-tribune__corporates"></div>

      <div id="lienzo-target-dropzone" class="lienzo-target-dropzone">
        <div class="amsterdam-card-stack">

          <div class="amsterdam-card-stack__primary js-qqpica-peek-card">
            ${renderPlayCardBox(play)}
          </div>

          ${economicHtml ? `
            <div class="amsterdam-card-stack__economic">
              ${economicHtml}
            </div>
          ` : ""}

          ${senderHtml ? `
            <div class="amsterdam-card-stack__sender">
              ${senderHtml}
            </div>
          ` : ""}

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