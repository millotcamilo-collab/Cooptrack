const ICONS = window.ICONS || {
  suits: {
    HEART: "/assets/icons/cor40.gif",
    SPADE: "/assets/icons/pik40.gif",
    DIAMOND: "/assets/icons/dia40.gif",
    CLUB: "/assets/icons/tre40.gif"
  },
  actions: {
    edit: "/assets/icons/desarrollo40.gif",
    save: "/assets/icons/salvar40.gif",
    delete: "/assets/icons/papelera30.gif",
    start: "/assets/icons/reloj60.gif",
    end: "/assets/icons/Campana80.gif",
    location: "/assets/icons/LocGlobito.gif",
    deadline: "/assets/icons/META60.gif",
    bomb: "/assets/icons/bombaRedonda60.gif",
    stop: "/assets/icons/stop60.gif",
    boom: "/assets/icons/Boom80.gif",
    approve: "/assets/icons/Sello40.gif",
    exit: "/assets/icons/exit40.gif",
    cancel: "/assets/icons/stop60.gif",
    routine: "/assets/icons/ActividadIterativa80.gif",
    fired: "/assets/icons/pistola60.gif",
    send: "/assets/icons/buzon60.gif",
    register: "/assets/icons/lacre80.gif",
    reject: "/assets/icons/stepback40.gif",
    quit: "/assets/icons/step60.gif"
  }
};

let currentSuitFilter = null;
let lastDeck = null;
let lastPlays = [];
let lastState = null;

const {
  escapeHTML,
  formatDate,
  getPlaySuit,
  getPlayText,
  getPlayAmount,
  getPlayStartDate,
  getPlayEndDate,
  getSpadeMode,
  getPlayLocation,
  isApproved,
  isChildPlay,
  getVisiblePlays,
  getFilterTitle,
  buildRecurrencePanel,
  buildRecurrenceMarker,
  buildIconButton,
  buildSuitBadge,
  buildApproveButton,
  buildApprovedMeta
} = window.PlayUIHelpers;

const {
  buildHeartBody,
  buildHeartActions,
  buildClubBody,
  buildClubActions,
  buildSpadeBody,
  buildSpadeActions
} = window.JRenderer;

function buildPlayRow(play) {
  const suit = getPlaySuit(play);
  const childClass = isChildPlay(play) ? "plays-view__row--child" : "";

  let bodyHTML = "";
  let actionsHTML = "";

  if (suit === "HEART") {
    bodyHTML = buildHeartBody(play);
    actionsHTML = buildHeartActions(play);
  } else if (suit === "CLUB") {
    bodyHTML = buildClubBody(play);
    actionsHTML = buildClubActions(play);
  } else if (suit === "SPADE") {
    bodyHTML = buildSpadeBody(play);
    actionsHTML = buildSpadeActions(play);
  } else {
    bodyHTML = `<div class="plays-view__text">${escapeHTML(getPlayText(play) || "Jugada")}</div>`;
    actionsHTML = isApproved(play) ? buildApprovedMeta(play) : buildApproveButton(play);
  }

  return `
    <article class="plays-view__row ${isApproved(play) ? "plays-view__row--approved" : ""} ${childClass}" data-play-id="${escapeHTML(play.id)}">
      <div class="plays-view__left">
        ${buildSuitBadge(play)}
      </div>

      <div class="plays-view__center">
        ${bodyHTML}
      </div>

      <div class="plays-view__right">
        ${actionsHTML}
      </div>
    </article>
  `;
}

function renderPlaysView(deck, plays = [], state = null) {
  const container = document.getElementById("plays-view-container");
  if (!container) return;

  lastDeck = deck;
  lastPlays = Array.isArray(plays) ? plays : [];
  lastState = state;

  const visiblePlays = getVisiblePlays(lastPlays, currentSuitFilter);

  if (!visiblePlays.length) {
    container.innerHTML = `
      <section class="plays-view">
        <div class="page-container">
          <div class="plays-view__empty">No hay jugadas visibles.</div>
        </div>
      </section>
    `;
    return;
  }

  const rowsHTML = visiblePlays.map(buildPlayRow).join("");

  container.innerHTML = `
    <section class="plays-view">
      <div class="page-container">
        <div class="plays-view__header">
          <h2 class="plays-view__title">${escapeHTML(getFilterTitle(currentSuitFilter))}</h2>
        </div>
        <div class="plays-view__list">
          ${rowsHTML}
        </div>
      </div>
    </section>
  `;

  bindPlaysViewEvents();
}

function updateLocalPlay(playId, patch = {}) {
  lastPlays = lastPlays.map((play) => {
    if (String(play.id) !== String(playId)) return play;
    return { ...play, ...patch };
  });
}

function removeLocalPlay(playId) {
  lastPlays = lastPlays.filter((play) => String(play.id) !== String(playId));
}

function getFieldValue(playId, fieldName) {
  const field = document.querySelector(`[data-field="${fieldName}"][data-play-id="${playId}"]`);
  return field ? field.value : "";
}

async function savePlayPatch(playId, patch) {
  document.dispatchEvent(
    new CustomEvent("plays:patch-requested", {
      detail: { playId, patch }
    })
  );
}

async function deletePlay(playId) {
  document.dispatchEvent(
    new CustomEvent("plays:delete-requested", {
      detail: { playId }
    })
  );
}

async function approvePlay(playId) {
  document.dispatchEvent(
    new CustomEvent("plays:approve-requested", {
      detail: { playId }
    })
  );
}

async function transformSuit(playId, suit) {
  document.dispatchEvent(
    new CustomEvent("plays:transform-suit-requested", {
      detail: { playId, suit }
    })
  );
}

function bindPlaysViewEvents() {
  containerSafeQueryAll('[data-action="edit-heart"]').forEach((button) => {
    button.addEventListener("click", () => {
      const playId = button.dataset.playId;
      updateLocalPlay(playId, { __editing: true });
      renderPlaysView(lastDeck, lastPlays, lastState);
    });
  });

  containerSafeQueryAll('[data-action="cancel-edit"]').forEach((button) => {
    button.addEventListener("click", () => {
      const playId = button.dataset.playId;
      updateLocalPlay(playId, { __editing: false });
      renderPlaysView(lastDeck, lastPlays, lastState);
    });
  });

  containerSafeQueryAll('[data-action="save-edit"]').forEach((button) => {
    button.addEventListener("click", async () => {
      const playId = button.dataset.playId;
      const playText = getFieldValue(playId, "text");

      updateLocalPlay(playId, {
        play_text: playText,
        __editing: false
      });

      renderPlaysView(lastDeck, lastPlays, lastState);
      await savePlayPatch(playId, { play_text: playText });
    });
  });

  containerSafeQueryAll('[data-action="to-club"]').forEach((button) => {
    button.addEventListener("click", async () => {
      const playId = button.dataset.playId;
      updateLocalPlay(playId, { card_suit: "CLUB" });
      renderPlaysView(lastDeck, lastPlays, lastState);
      await transformSuit(playId, "CLUB");
    });
  });

  containerSafeQueryAll('[data-action="to-spade"]').forEach((button) => {
    button.addEventListener("click", async () => {
      const playId = button.dataset.playId;
      updateLocalPlay(playId, { card_suit: "SPADE" });
      renderPlaysView(lastDeck, lastPlays, lastState);
      await transformSuit(playId, "SPADE");
    });
  });

  containerSafeQueryAll('[data-action="set-appointment"]').forEach((button) => {
    button.addEventListener("click", async () => {
      const playId = button.dataset.playId;

      updateLocalPlay(playId, {
        spade_mode: "APPOINTMENT",
        __editingSchedule: true
      });

      renderPlaysView(lastDeck, lastPlays, lastState);

      await savePlayPatch(playId, {
        spade_mode: "APPOINTMENT"
      });
    });
  });

  containerSafeQueryAll('[data-action="set-deadline"]').forEach((button) => {
    button.addEventListener("click", async () => {
      const playId = button.dataset.playId;

      updateLocalPlay(playId, {
        spade_mode: "DEADLINE",
        __editingSchedule: true,
        start_date: "",
        location: ""
      });

      renderPlaysView(lastDeck, lastPlays, lastState);

      await savePlayPatch(playId, {
        spade_mode: "DEADLINE"
      });
    });
  });

  containerSafeQueryAll('[data-action="edit-schedule"]').forEach((button) => {
    button.addEventListener("click", () => {
      const playId = button.dataset.playId;
      updateLocalPlay(playId, { __editingSchedule: true });
      renderPlaysView(lastDeck, lastPlays, lastState);
    });
  });

  containerSafeQueryAll('[data-action="cancel-schedule-edit"]').forEach((button) => {
    button.addEventListener("click", () => {
      const playId = button.dataset.playId;
      updateLocalPlay(playId, { __editingSchedule: false });
      renderPlaysView(lastDeck, lastPlays, lastState);
    });
  });

  containerSafeQueryAll('[data-action="save-schedule"]').forEach((button) => {
    button.addEventListener("click", async () => {
      const playId = button.dataset.playId;

      const play = lastPlays.find((item) => String(item.id) === String(playId)) || {};
      const spadeMode = getSpadeMode(play);

      const startDate = getFieldValue(playId, "start_date");
      const endDate = getFieldValue(playId, "end_date");
      const location = getFieldValue(playId, "location");

      if (spadeMode === "DEADLINE") {
        updateLocalPlay(playId, {
          end_date: endDate,
          __editingSchedule: false
        });

        renderPlaysView(lastDeck, lastPlays, lastState);

        await savePlayPatch(playId, {
          spade_mode: "DEADLINE",
          end_date: endDate
        });

        return;
      }

      updateLocalPlay(playId, {
        spade_mode: "APPOINTMENT",
        start_date: startDate,
        end_date: endDate,
        location,
        __editingSchedule: false
      });

      renderPlaysView(lastDeck, lastPlays, lastState);

      await savePlayPatch(playId, {
        spade_mode: "APPOINTMENT",
        start_date: startDate,
        end_date: endDate,
        location
      });
    });
  });

  containerSafeQueryAll('[data-field="amount"]').forEach((input) => {
    input.addEventListener("change", async () => {
      const playId = input.dataset.playId;
      const amount = input.value;

      updateLocalPlay(playId, {
        amount: amount,
        play_amount: amount
      });

      renderPlaysView(lastDeck, lastPlays, lastState);

      await savePlayPatch(playId, {
        amount: amount
      });
    });
  });

  containerSafeQueryAll('.plays-view__child-text-input').forEach((input) => {
    input.addEventListener("change", async () => {
      const playId = input.dataset.playId;
      const playText = input.value;

      updateLocalPlay(playId, {
        play_text: playText
      });

      renderPlaysView(lastDeck, lastPlays, lastState);

      await savePlayPatch(playId, {
        play_text: playText
      });
    });
  });

  containerSafeQueryAll('[data-action="delete"]').forEach((button) => {
    button.addEventListener("click", async () => {
      const playId = button.dataset.playId;
      const confirmed = window.confirm("¿Seguro que querés borrar esta jugada?");

      if (!confirmed) return;

      removeLocalPlay(playId);
      renderPlaysView(lastDeck, lastPlays, lastState);
      await deletePlay(playId);
    });
  });

  containerSafeQueryAll('[data-action="approve"]').forEach((button) => {
    button.addEventListener("click", async () => {
      const playId = button.dataset.playId;
      updateLocalPlay(playId, { play_status: "APPROVED", status: "APPROVED" });
      renderPlaysView(lastDeck, lastPlays, lastState);
      await approvePlay(playId);
    });
  });

  containerSafeQueryAll('[data-action="deadline"]').forEach((button) => {
    button.addEventListener("click", () => {
      const playId = button.dataset.playId;
      document.dispatchEvent(
        new CustomEvent("plays:deadline-requested", {
          detail: { playId }
        })
      );
    });
  });

  containerSafeQueryAll('[data-action="add-child-diamond"]').forEach((button) => {
    button.addEventListener("click", () => {
      const playId = button.dataset.playId;
      document.dispatchEvent(
        new CustomEvent("plays:add-child-diamond-requested", {
          detail: { parentPlayId: playId }
        })
      );
    });
  });

  containerSafeQueryAll('[data-action="add-child-qspade"]').forEach((button) => {
    button.addEventListener("click", () => {
      const playId = button.dataset.playId;
      document.dispatchEvent(
        new CustomEvent("plays:add-child-qspade-requested", {
          detail: { parentPlayId: playId }
        })
      );
    });
  });

  containerSafeQueryAll('[data-action="set-recurrence"]').forEach((button) => {
    button.addEventListener("click", () => {
      const playId = button.dataset.playId;

      updateLocalPlay(playId, {
        __showRecurrence: true
      });

      renderPlaysView(lastDeck, lastPlays, lastState);
    });
  });

  containerSafeQueryAll('[data-action="save-recurrence"]').forEach((button) => {
    button.addEventListener("click", async () => {
      const playId = button.dataset.playId;

      const row = document.querySelector(`.plays-view__row[data-play-id="${playId}"]`);
      const typeField = row?.querySelector(`[data-field="recurrence_type"][data-play-id="${playId}"]`);
      const dayField = row?.querySelector(`[data-field="day_of_month"][data-play-id="${playId}"]`);
      const checkboxes = row ? row.querySelectorAll(".plays-view__recurrence-weekly input") : [];

      const weekdays = Array.from(checkboxes)
        .filter((cb) => cb.checked)
        .map((cb) => cb.value)
        .join(",");

      const payload = {
        recurrence_type: typeField?.value,
        weekdays: weekdays || null,
        day_of_month: dayField?.value || null
      };

      await fetch(`${API_BASE_URL}/plays/${playId}/recurrence`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("cooptrackToken")}`
        },
        body: JSON.stringify(payload)
      });

      updateLocalPlay(playId, {
        __showRecurrence: false,
        __hasRecurrence: true
      });

      renderPlaysView(lastDeck, lastPlays, lastState);
    });
  });

  containerSafeQueryAll('[data-action="cancel-recurrence"]').forEach((button) => {
    button.addEventListener("click", () => {
      const playId = button.dataset.playId;

      updateLocalPlay(playId, {
        __showRecurrence: false
      });

      renderPlaysView(lastDeck, lastPlays, lastState);
    });
  });
}

function containerSafeQueryAll(selector) {
  return Array.from(document.querySelectorAll(selector));
}

document.addEventListener("mazobar:filter", (event) => {
  const incomingFilter = event.detail?.filter || null;
  currentSuitFilter = currentSuitFilter === incomingFilter ? null : incomingFilter;
  renderPlaysView(lastDeck, lastPlays, lastState);
});

window.renderPlaysView = renderPlaysView;
