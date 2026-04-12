(function () {
  function renderDia({
    headerText = "",
    bodyHtml = "",
    isToday = false,
    isCurrent = false,
    isOutsideMonth = false,
    extraClass = ""
  } = {}) {
    let className = "dia";

    if (isCurrent) className += " dia--current";
    if (isToday) className += " dia--today";
    if (isOutsideMonth) className += " dia--outside-month";
    if (extraClass) className += ` ${extraClass}`;

    return `
      <article class="${className}">
        <div class="dia__header">${headerText}</div>
        <div class="dia__body">${bodyHtml}</div>
      </article>
    `;
  }

  window.renderDia = renderDia;
})();