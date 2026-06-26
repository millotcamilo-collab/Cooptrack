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

