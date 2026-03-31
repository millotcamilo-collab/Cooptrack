(function () {
  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function getOrCreateQpicaContainer(parentPlayId) {
  const containerId = `qpica-panel-container-${parentPlayId}`;
  let container = document.getElementById(containerId);

  if (container) return container;

  container = document.createElement("div");
  container.id = containerId;
  container.className = "qpica-panel-container";

  const parentRow = document.getElementById(`tablero-row-${parentPlayId}`);

  if (parentRow && parentRow.parentNode) {
    parentRow.insertAdjacentElement("afterend", container);
  } else {
    const tablero = document.getElementById("tablero-container");
    if (tablero) {
      tablero.appendChild(container);
    } else {
      document.body.appendChild(container);
    }
  }

  return container;
}
  function buildCardHtml() {
    return `
      <div class="qpica-panel__left">
        <img
          class="qpica-panel__card-image"
          src="/assets/icons/Qpike.gif"
          alt="Q de picas"
        />
      </div>
    `;
  }

  function buildPickerHtml() {
    return `
      <div class="qpica-panel__right">
        <div class="qpica-panel__picker-title">Seleccionar invitado</div>
        <div id="qpica-users-picker"></div>
      </div>
    `;
  }

  function renderQpicaPanel(parentPlayId) {
    const container = getOrCreateQpicaContainer(parentPlayId);

    container.innerHTML = `
      <section class="qpica-panel" data-parent-play-id="${escapeHtml(parentPlayId)}">
        ${buildCardHtml()}
        ${buildPickerHtml()}
      </section>
    `;

    if (typeof window.renderUsersPicker === "function") {
      window.renderUsersPicker("qpica-users-picker", {
        onSelect(user) {
          console.log("Usuario seleccionado para Q♠:", user);

          window.__qpicaDraft = {
            parentPlayId,
            selectedUser: user || null
          };
        }
      });
    } else {
      const picker = document.getElementById("qpica-users-picker");
      if (picker) {
        picker.innerHTML = `
          <div class="qpica-panel__error">
            No se pudo cargar users.js
          </div>
        `;
      }
    }
  }

function clearQpicaPanel(parentPlayId) {
  const container = document.getElementById(`qpica-panel-container-${parentPlayId}`);
  if (container) {
    container.remove();
  }

  if (
    window.__qpicaDraft &&
    Number(window.__qpicaDraft.parentPlayId) === Number(parentPlayId)
  ) {
    window.__qpicaDraft = null;
  }
}

  document.addEventListener("qpica:open", (event) => {
    const parentPlayId = Number(event.detail?.parentPlayId || 0);
    if (!parentPlayId) return;

    renderQpicaPanel(parentPlayId);
  });

document.addEventListener("qpica:close", (event) => {
  const parentPlayId = Number(event.detail?.parentPlayId || 0);
  if (!parentPlayId) return;

  clearQpicaPanel(parentPlayId);
});

  window.renderQpicaPanel = renderQpicaPanel;
  window.clearQpicaPanel = clearQpicaPanel;
  window.renderQpike = renderQpike;
})();
