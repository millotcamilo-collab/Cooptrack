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

function getAuthToken() {
  return localStorage.getItem("cooptrackToken") || "";
}

function normalizeNickname(play) {
  return (
    play?.target_user_nickname ||
    play?.target_nickname ||
    play?.recipient_nickname ||
    play?.nickname ||
    play?.__selectedUser?.nickname ||
    (play?.target_user_id ? `Usuario #${play.target_user_id}` : "Sin destinatario")
  );
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

function replaceLocalPlay(playId, nextPlay) {
  lastPlays = lastPlays.map((play) => {
    if (String(play.id) !== String(playId)) return play;
    return nextPlay;
  });
}

function getFieldValue(playId, fieldName) {
  const field = document.querySelector(
    `[data-field="${fieldName}"][data-play-id="${playId}"]`
  );
  return field ? field.value : "";
}

function normalizeQSpadeNickname(play) {
  return (
    play?.target_user_nickname ||
    play?.target_nickname ||
    play?.recipient_nickname ||
    play?.nickname ||
    play?.__selectedUser?.nickname ||
    (play?.target_user_id ? `Usuario #${play.target_user_id}` : "Sin destinatario")
  );
}

function buildQSpadeBody(play) {
  if (!play.__isExpanded) {
    return `
      <div class="plays-view__text">
        Invitación para: <strong>${escapeHTML(normalizeQSpadeNickname(play))}</strong>
      </div>
    `;
  }

  if (!play.__selectedUser) {
    return `
      <div class="plays-view__qspade-expanded">
        <div class="plays-view__qspade-body">
          <div id="q-user-picker-${play.id}"></div>
        </div>
      </div>
    `;
  }

  return `
    <div class="plays-view__qspade-expanded">
      <div class="plays-view__qspade-body">
        <div class="plays-view__text">
          Invitación para: <strong>${escapeHTML(play.__selectedUser.nickname || "Usuario")}</strong>
        </div>
      </div>
    </div>
  `;
}

function currentUserHasClubAce() {
  if (!lastState) return false;

  const cards = Array.isArray(lastState.corporateCards)
    ? lastState.corporateCards
    : [];

  return cards.some((card) => {
    const rank = String(card.rank || card.card_rank || "").toUpperCase();
    const suit = String(card.suit || card.card_suit || "").toUpperCase();
    return rank === "A" && suit === "CLUB";
  });
}

function buildQSpadeActions(play) {
  const canFinish = !!play.__selectedUser;
  const isDraft = !!play.__isDraft;

  if (!isDraft) {
    return `<div class="plays-view__actions"></div>`;
  }

  return `
    <div class="plays-view__actions">
      ${
        canFinish
          ? buildIconButton({
              src: window.ICONS.actions.send,
              alt: "Enviar",
              title: "Enviar invitación",
              action: "send-qspade",
              playId: play.id
            })
          : ""
      }

      ${buildIconButton({
        src: window.ICONS.actions.exit,
        alt: "Salir",
        title: "Cancelar Q♠",
        action: "cancel-qspade",
        playId: play.id
      })}
    </div>
  `;
}

function buildPlayRow(play) {
  const suit = getPlaySuit(play);
  const childClass = isChildPlay(play) ? "plays-view__row--child" : "";
  const rank = String(play.card_rank || play.rank || "").toUpperCase();

  let bodyHTML = "";
  let actionsHTML = "";

  if (rank === "Q" && suit === "SPADE") {
    bodyHTML = buildQSpadeBody(play);
    actionsHTML = buildQSpadeActions(play);
  } else if (suit === "HEART") {
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
    <article class="plays-view__row ${isApproved(play) ? "plays-view__row--approved" : ""} ${childClass}" data-play-id="${escapeHTML(String(play.id))}">
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

  requestAnimationFrame(() => {
    mountQUserPickers();
  });
}

function mountQUserPickers() {
  lastPlays.forEach((play) => {
    if (
      String(play.card_rank || "").toUpperCase() === "Q" &&
      String(play.card_suit || "").toUpperCase() === "SPADE" &&
      play.__isDraft
    ) {
      const containerId = `q-user-picker-${play.id}`;
      const container = document.getElementById(containerId);
      if (!container) return;

      renderUsersPicker(containerId, {
        deckId: lastDeck?.id,
        selectedUser: play.__selectedUser,

        onSelect: (user) => {
          play.__selectedUser = user;
          play.target_user_id = user?.id || null;
          play.__qStep = "selected";
          play.__isExpanded = false;

          renderPlaysView(lastDeck, lastPlays, lastState);
        },

        onExit: () => {
          removeLocalPlay(play.id);
          renderPlaysView(lastDeck, lastPlays, lastState);
        }
      });
    }
  });
}

function createQSpadeDraft(parentPlayId) {
  const newPlay = {
    id: `temp-q-${Date.now()}`,
    deck_id: lastDeck?.id || null,
    parent_play_id: parentPlayId,
    card_rank: "Q",
    card_suit: "SPADE",
    play_status: "DRAFT",

    __isDraft: true,
    __isExpanded: true,
    __qStep: "select-user",
    __selectedUser: null
  };

  const index = lastPlays.findIndex((p) => String(p.id) === String(parentPlayId));

  if (index === -1) {
    lastPlays.push(newPlay);
  } else {
    lastPlays.splice(index + 1, 0, newPlay);
  }

  renderPlaysView(lastDeck, lastPlays, lastState);
}

function buildQSpadePlayCode({ deckId, userId, targetUserId }) {
  const separator = "§";
  const now = new Date().toISOString();

  return [
    deckId || "",
    userId || "",
    now,
    "Q",
    "SPADE",
    "invite_activity",
    `U:${userId || ""}`,
    "direct",
    `U:${targetUserId || ""}`
  ].join(separator);
}

function getLoggedUserId() {
  try {
    const raw = localStorage.getItem("cooptrackUser");
    if (!raw) return null;
    const user = JSON.parse(raw);
    return user?.id || null;
  } catch (error) {
    console.error("Error leyendo cooptrackUser:", error);
    return null;
  }
}

async function persistQSpade(playId, mode = "save") {
  const draft = lastPlays.find((play) => String(play.id) === String(playId));

  if (!draft) throw new Error("No se encontró la Q♠ temporal");
  if (!lastDeck?.id) throw new Error("No hay deck cargado");
  if (!draft.parent_play_id) throw new Error("La Q♠ necesita parent_play_id");
  if (!draft.__selectedUser?.id) throw new Error("Primero elegí un destinatario");

  const userId = getLoggedUserId();
  const payload = {
    deck_id: Number(lastDeck.id),
    parent_play_id: Number(draft.parent_play_id),
    target_user_id: Number(draft.__selectedUser.id),
    card_rank: "Q",
    card_suit: "SPADE",
    play_status: mode === "send" ? "PENDING" : "DRAFT",
    play_code: buildQSpadePlayCode({
      deckId: lastDeck.id,
      userId,
      targetUserId: draft.__selectedUser.id
    }),
    text: `Invitación para ${draft.__selectedUser.nickname || `usuario #${draft.__selectedUser.id}`}`
  };

  const response = await fetch(`${API_BASE_URL}/plays`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getAuthToken()}`
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data?.ok || !data?.play) {
    throw new Error(data?.error || "No se pudo guardar la Q♠");
  }

  const persistedPlay = {
    ...data.play,
    __selectedUser: draft.__selectedUser,
    target_user_id: draft.__selectedUser.id,
    target_user_nickname: draft.__selectedUser.nickname,
    __isDraft: false,
    __isExpanded: false
  };

  replaceLocalPlay(playId, persistedPlay);
  renderPlaysView(lastDeck, lastPlays, lastState);
  document.dispatchEvent(new CustomEvent("plays:changed"));
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
    button.addEventListener("click", () => {
      const playId = button.dataset.playId;

      updateLocalPlay(playId, {
        spade_mode: "APPOINTMENT",
        __editingSchedule: true
      });

      renderPlaysView(lastDeck, lastPlays, lastState);

      requestAnimationFrame(() => {
        const firstField = document.querySelector(
          `[data-field="start_date"][data-play-id="${playId}"]`
        );
        if (firstField) firstField.focus();
      });
    });
  });

  containerSafeQueryAll('[data-action="set-deadline"]').forEach((button) => {
    button.addEventListener("click", () => {
      const playId = button.dataset.playId;

      updateLocalPlay(playId, {
        spade_mode: "DEADLINE",
        __editingSchedule: true,
        start_date: "",
        location: ""
      });

      renderPlaysView(lastDeck, lastPlays, lastState);

      requestAnimationFrame(() => {
        const firstField = document.querySelector(
          `[data-field="end_date"][data-play-id="${playId}"]`
        );
        if (firstField) firstField.focus();
      });
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
        amount,
        play_amount: amount
      });

      renderPlaysView(lastDeck, lastPlays, lastState);

      await savePlayPatch(playId, {
        amount
      });
    });
  });

  containerSafeQueryAll(".plays-view__child-text-input").forEach((input) => {
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
    const play = lastPlays.find((item) => String(item.id) === String(playId)) || {};
    const spadeMode = getSpadeMode(play);

    try {
      if (String(play.card_suit || "").toUpperCase() === "SPADE") {
        const startDate = getFieldValue(playId, "start_date");
        const endDate = getFieldValue(playId, "end_date");
        const location = getFieldValue(playId, "location");

        if (spadeMode === "DEADLINE" && endDate) {
          updateLocalPlay(playId, {
            end_date: endDate,
            __editingSchedule: false
          });

          await savePlayPatch(playId, {
            spade_mode: "DEADLINE",
            end_date: endDate
          });
        } else if (
          (spadeMode === "APPOINTMENT" || spadeMode === "CITA") &&
          startDate
        ) {
          updateLocalPlay(playId, {
            spade_mode: "APPOINTMENT",
            start_date: startDate,
            end_date: endDate,
            location,
            __editingSchedule: false
          });

          await savePlayPatch(playId, {
            spade_mode: "APPOINTMENT",
            start_date: startDate,
            end_date: endDate,
            location
          });
        }
      }

      updateLocalPlay(playId, { play_status: "APPROVED", status: "APPROVED" });
      renderPlaysView(lastDeck, lastPlays, lastState);
      await approvePlay(playId);
    } catch (error) {
      console.error("Error aprobando jugada:", error);
      window.alert("No se pudo aprobar la jugada");
    }
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
      const parentPlayId = button.dataset.playId;
      createQSpadeDraft(parentPlayId);
    });
  });

  containerSafeQueryAll('[data-action="save-qspade"]').forEach((button) => {
    button.addEventListener("click", async () => {
      const playId = button.dataset.playId;

      try {
        button.disabled = true;
        await persistQSpade(playId);
      } catch (error) {
        console.error("Error guardando Q♠:", error);
        window.alert(error.message || "No se pudo guardar la Q♠");
        button.disabled = false;
      }
    });
  });

    containerSafeQueryAll('[data-action="send-qspade"]').forEach((button) => {
  button.addEventListener("click", async () => {
    const playId = button.dataset.playId;

    try {
      button.disabled = true;
      await persistQSpade(playId, "send");
    } catch (error) {
      console.error("Error enviando Q♠:", error);
      window.alert(error.message || "No se pudo enviar la Q♠");
      button.disabled = false;
    }
  });
});
  
containerSafeQueryAll('[data-action="cancel-qspade"]').forEach((button) => {
  button.addEventListener("click", () => {
    const playId = button.dataset.playId;
    const play = lastPlays.find((item) => String(item.id) === String(playId));

    if (!play) return;

    if (play.__isDraft) {
      removeLocalPlay(playId);
    } else {
      updateLocalPlay(playId, { __isExpanded: false });
    }

    renderPlaysView(lastDeck, lastPlays, lastState);
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
      const typeField = row?.querySelector(
        `[data-field="recurrence_type"][data-play-id="${playId}"]`
      );
      const dayField = row?.querySelector(
        `[data-field="day_of_month"][data-play-id="${playId}"]`
      );
      const checkboxes = row
        ? row.querySelectorAll(".plays-view__recurrence-weekly input")
        : [];

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
          Authorization: `Bearer ${getAuthToken()}`
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
