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

  function buildPickerHtml(parentPlayId) {
  const ICONS = window.ICONS || {};
  const ACTIONS = ICONS.actions || {};

  const saveIcon = ACTIONS.save || "";
  const sendIcon = ACTIONS.send || "";
  const cancelIcon = ACTIONS.exit || ACTIONS.cancel || "";

  return `
    <div class="qpica-panel__right">
      <div class="qpica-panel__picker-title">Seleccionar invitado</div>
      <div id="qpica-users-picker-${parentPlayId}"></div>

      <div class="qpica-panel__selected" id="qpica-selected-${parentPlayId}">
        Nadie seleccionado
      </div>

      <div class="qpica-panel__actions">
        <button type="button" id="qpica-save-${parentPlayId}" title="Guardar">
          ${saveIcon ? `<img src="${saveIcon}" alt="Guardar" />` : "Save"}
        </button>

        <button type="button" id="qpica-send-${parentPlayId}" title="Enviar">
          ${sendIcon ? `<img src="${sendIcon}" alt="Enviar" />` : "Send"}
        </button>

        <button type="button" id="qpica-cancel-${parentPlayId}" title="Cancelar">
          ${cancelIcon ? `<img src="${cancelIcon}" alt="Cancelar" />` : "Cancelar"}
        </button>
      </div>
    </div>
  `;
}
  function renderQpicaPanel(parentPlayId) {
    const container = getOrCreateQpicaContainer(parentPlayId);

    container.innerHTML = `
      <section class="qpica-panel" data-parent-play-id="${escapeHtml(parentPlayId)}">
        ${buildCardHtml()}
        ${buildPickerHtml(parentPlayId)}
      </section>
    `;

    const pickerId = `qpica-users-picker-${parentPlayId}`;
    const selectedBox = document.getElementById(`qpica-selected-${parentPlayId}`);
    const btnSave = document.getElementById(`qpica-save-${parentPlayId}`);
    const btnSend = document.getElementById(`qpica-send-${parentPlayId}`);
    const btnCancel = document.getElementById(`qpica-cancel-${parentPlayId}`);

    let selectedUser = null;

    if (typeof window.renderUsersPicker === "function") {
      window.renderUsersPicker(pickerId, {
        onSelect(user) {
          selectedUser = user || null;

          window.__qpicaDraft = {
            parentPlayId,
            selectedUser
          };

          if (selectedBox) {
            selectedBox.textContent = selectedUser
              ? `Seleccionado: ${selectedUser.nickname || selectedUser.full_name || selectedUser.name || `Usuario ${selectedUser.id}`}`
              : "Nadie seleccionado";
          }
        }
      });
    } else {
      const picker = document.getElementById(pickerId);
      if (picker) {
        picker.innerHTML = `
          <div class="qpica-panel__error">
            No se pudo cargar users.js
          </div>
        `;
      }
    }

    btnSave?.addEventListener("click", () => {
      if (!selectedUser) {
        alert("Primero seleccioná un usuario.");
        return;
      }

      window.__qpicaDraft = {
        parentPlayId,
        selectedUser
      };

      console.log("Q♠ draft salvado:", window.__qpicaDraft);
      alert("Selección salvada.");
    });

    btnSend?.addEventListener("click", () => {
      if (!selectedUser) {
        alert("Primero seleccioná un usuario.");
        return;
      }

      document.dispatchEvent(new CustomEvent("plays:add-qspade-requested", {
        detail: {
          parentPlayId,
          targetUserId: selectedUser.id
        }
      }));
    });

    btnCancel?.addEventListener("click", () => {
      clearQpicaPanel(parentPlayId);
    });
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

  function renderQpike(play, context = {}) {
    const helpers = context.helpers || {};
    const escape = helpers.escapeHtml || ((v) => String(v ?? ""));

    return `
      <article class="tablero-row tablero-row--qpike" id="tablero-row-${play.id}">
        <div class="tablero-row__left">
          <div class="tablero-row__card">Q♠</div>
        </div>

        <div class="tablero-row__center">
          <div class="tablero-row__title">Invitación</div>
          <div class="tablero-row__text">
            Invitado: ${escape(play.target_user_nickname || play.target_nickname || play.target_user_id || "—")}
          </div>
        </div>

        <div class="tablero-row__right"></div>
      </article>
    `;
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
