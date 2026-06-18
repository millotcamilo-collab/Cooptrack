window.API_BASE_URL = window.API_BASE_URL || "https://cooptrack-backend.onrender.com";

function getAuthToken() {
  return localStorage.getItem("cooptrackToken") || "";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function startsWithSearch(fullText, searchText) {
  const normalizedFull = normalizeText(fullText);
  const normalizedSearch = normalizeText(searchText);

  if (!normalizedSearch) return true;
  return normalizedFull.startsWith(normalizedSearch);
}

function getUserTypeIcon(user) {
  const category = String(user.qCategory || user.user_type || "").toLowerCase();

  if (category === "senior") return "/assets/icons/senior120.gif";
  if (category === "active") return "/assets/icons/activo120.gif";
  return "/assets/icons/guest80.gif";
}

function getUserDisplayName(user) {
  return user.nickname || user.full_name || user.name || `Usuario ${user.id}`;
}

function getUserPhoto(user) {
  return user.profile_photo_url || "/assets/icons/singeta120.gif";
}
async function fetchUsers() {
  const token = getAuthToken();

  const response = await fetch(`${window.API_BASE_URL}/users-picker`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();

  if (!response.ok || !data.ok) {
    throw new Error(data.error || "No se pudieron cargar los usuarios");
  }

  return Array.isArray(data.users) ? data.users : [];
}
async function resolveUser(payload) {
  const token = getAuthToken();

  const response = await fetch(`${window.API_BASE_URL}/users/resolve`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) {
    const error = new Error(data.error || "No se pudo resolver el usuario");
    error.payload = data;
    throw error;
  }

  return data;
}

function normalizeEmailValue(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizePhoneValue(value) {
  return String(value || "").replace(/\D+/g, "");
}

function isDeckUserCard(play) {
  const rank = String(play?.card_rank || play?.rank || "").toUpperCase();
  return ["A", "K", "Q"].includes(rank);
}

function addUserToMap(map, user) {
  const id = Number(user?.id || 0);
  if (!id || map.has(id)) return;

  map.set(id, {
    id,
    nickname: user.nickname || user.full_name || user.name || `Usuario ${id}`,
    full_name: user.full_name || "",
    name: user.name || "",
    profile_photo_url: user.profile_photo_url || "/assets/icons/singeta120.gif",
    user_type: user.user_type || user.qCategory || "active",
    qCategory: user.qCategory || user.user_type || "active"
  });
}

function getDeckUsersFromPlays(plays = [], currentUserId = 0) {
  const map = new Map();

  plays.forEach((play) => {
    if (!isDeckUserCard(play)) return;

    addUserToMap(map, {
      id: play.created_by_user_id,
      nickname: play.created_by_nickname,
      profile_photo_url: play.created_by_profile_photo_url
    });

    addUserToMap(map, {
      id: play.target_user_id,
      nickname: play.target_user_nickname,
      profile_photo_url: play.target_user_profile_photo_url
    });
  });

  return Array.from(map.values()).filter(
    (user) => Number(user.id) !== Number(currentUserId || 0)
  );

}

function getSuitSymbol(suit) {
  const s = String(suit || "").toUpperCase();

  if (s === "HEART") return "♥";
  if (s === "SPADE") return "♠";
  if (s === "DIAMOND") return "♦";
  if (s === "CLUB") return "♣";

  return "";
}

function getUserDeckSummary(userId, plays = []) {
  const uid = Number(userId || 0);

  const aces = new Set();
  const kings = new Set();
  let qspades = 0;

  plays.forEach((play) => {
    const ownerId =
      Number(play?.target_user_id || 0) ||
      Number(play?.created_by_user_id || 0);

    if (ownerId !== uid) return;

    const rank = String(play?.card_rank || play?.rank || "").toUpperCase();
    const suit = String(play?.card_suit || play?.suit || "").toUpperCase();

    if (rank === "A") {
      aces.add(getSuitSymbol(suit));
    }

    if (rank === "K") {
      kings.add(getSuitSymbol(suit));
    }

    if (rank === "Q" && suit === "SPADE") {
      qspades += 1;
    }
  });

  return {
    aces: Array.from(aces),
    kings: Array.from(kings),
    qspades
  };
}

function renderUserDeckSummary(user, plays) {
  const s = getUserDeckSummary(user.id, plays);

  return `
    <div class="users-picker__row-summary">
      ${s.aces.length ? `A ${s.aces.join(" ")}` : ""}
      ${s.kings.length ? ` K ${s.kings.join(" ")}` : ""}
      ${s.qspades ? ` Q♠ ${s.qspades}` : ""}
    </div>
  `;
}

function renderUsersPicker(containerId, options = {}) {
  const container = document.getElementById(containerId);
  if (!container) {
    console.warn(`No existe el contenedor #${containerId} para users.js`);
    return null;
  }

  const state = {
    deckId: options.deckId || null,
    allUsers: [],
    filteredUsers: [],
    deckUsers: getDeckUsersFromPlays(
      options.plays || [],
      options.currentUserId || 0
    ),
    selectedUser: options.selectedUser || null,
    searchValue: "",
    loaded: false,
    loading: false,
    error: "",

    isCreatingUser: false,
    createUserLoading: false,
    createUserError: "",
    createUserMessage: "",
    conflictUsers: [],

    newUserNickname: "",
    newUserEmail: "",
    newUserPhone: "",
  };

  async function ensureUsersLoaded() {
    if (state.loaded || state.loading) return;

    state.loading = true;
    state.error = "";

    try {
      state.allUsers = await fetchUsers();
      state.filteredUsers = [];
      state.loaded = true;
    } catch (error) {
      console.error(error);
      state.error = error.message || "Error cargando usuarios";
      state.loaded = true;
    } finally {
      state.loading = false;
    }
  }

  function filterUsers(searchText) {
    const trimmed = String(searchText || "").trim();
    state.searchValue = trimmed;

    if (!trimmed) {
      state.filteredUsers = [];
      return;
    }

    state.filteredUsers = state.allUsers.filter((user) => {
      const userId = Number(user?.id || 0);
      const currentUserId = Number(options.currentUserId || 0);

      if (currentUserId && userId === currentUserId) return false;

      return startsWithSearch(getUserDisplayName(user), trimmed);
    });
  }

  function handleSelect(userId) {
    const selected =
      state.filteredUsers.find((u) => String(u.id) === String(userId)) ||
      state.deckUsers.find((u) => String(u.id) === String(userId)) ||
      state.allUsers.find((u) => String(u.id) === String(userId));

    if (!selected) return;

    state.selectedUser = selected;
    rerender();

    if (typeof options.onSelect === "function") {
      options.onSelect(selected);
    }
  }

  function handleEditSelected() {
    state.selectedUser = null;
    state.isCreatingUser = false;
    state.createUserLoading = false;
    state.createUserError = "";
    state.createUserMessage = "";
    state.conflictUsers = [];
    rerender();

    if (typeof options.onEdit === "function") {
      options.onEdit();
    }
  }

  function handleExit() {
    if (typeof options.onExit === "function") {
      options.onExit(state.selectedUser || null);
      return;
    }

    container.innerHTML = "";
  }

  function handleCreateUser() {
    state.isCreatingUser = true;
    state.createUserError = "";
    state.createUserMessage = "";
    state.conflictUsers = [];
    state.newUserNickname = state.searchValue || "";
    state.newUserEmail = "";
    state.newUserPhone = "";
    rerender();
  }

  function handleCancelCreateUser() {
    state.isCreatingUser = false;
    state.createUserLoading = false;
    state.createUserError = "";
    state.createUserMessage = "";
    state.conflictUsers = [];
    state.newUserNickname = "";
    state.newUserEmail = "";
    state.newUserPhone = "";
    rerender();
  }

  async function handleSaveNewUser() {
    const nickname = String(state.newUserNickname || "").trim();
    const email = normalizeEmailValue(state.newUserEmail);
    const phone = normalizePhoneValue(state.newUserPhone);

    state.createUserError = "";
    state.createUserMessage = "";
    state.conflictUsers = [];

    if (!nickname) {
      state.createUserError = "El nickname es obligatorio.";
      rerender();
      return;
    }

    if (!email && !phone) {
      state.createUserError = "Ingresá email o teléfono.";
      rerender();
      return;
    }

    state.createUserLoading = true;
    rerender();

    try {
      const data = await resolveUser({
        nickname,
        email: email || null,
        phone: phone || null,
      });

      const resolvedUser = data.user || null;

      if (!resolvedUser) {
        throw new Error("El servidor no devolvió usuario.");
      }

      const alreadyExists = state.allUsers.some(
        (user) => String(user.id) === String(resolvedUser.id)
      );

      if (!alreadyExists) {
        state.allUsers.push(resolvedUser);
      }

      state.selectedUser = resolvedUser;
      state.isCreatingUser = false;
      state.createUserLoading = false;
      state.createUserError = "";
      state.createUserMessage = data.message || "";
      state.conflictUsers = [];

      rerender();

      if (typeof options.onAnimateSelect === "function") {
        options.onAnimateSelect(resolvedUser);
      } else if (typeof options.onSelect === "function") {
        options.onSelect(resolvedUser);
      }
    } catch (error) {
      console.error(error);

      state.createUserLoading = false;
      state.createUserError = error.message || "Error creando usuario";
      state.conflictUsers = Array.isArray(error.payload?.existingUsers)
        ? error.payload.existingUsers
        : [];

      rerender();
    }
  }

  function handleConflictSelect(userId) {
    const selected =
      state.conflictUsers.find((u) => String(u.id) === String(userId)) ||
      state.allUsers.find((u) => String(u.id) === String(userId));

    if (!selected) return;

    const alreadyExists = state.allUsers.some(
      (user) => String(user.id) === String(selected.id)
    );

    if (!alreadyExists) {
      state.allUsers.push(selected);
    }

    state.selectedUser = selected;
    state.isCreatingUser = false;
    state.createUserError = "";
    state.createUserMessage = "";
    state.conflictUsers = [];

    rerender();

    if (typeof options.onSelect === "function") {
      options.onSelect(selected);
    }
  }
  async function handleSearchClick() {
    await ensureUsersLoaded();
    filterUsers(state.searchValue);
    rerender();

    if (typeof options.onSearch === "function") {
      options.onSearch(state.searchValue, state.filteredUsers);
    }
  }

  function bindEvents() {
    const input = container.querySelector("[data-users-search-input]");
    const searchBtn = container.querySelector("[data-users-search-btn]");
    const sealBtn = container.querySelector("[data-users-seal-btn]");
    const exitBtn = container.querySelector("[data-users-exit-btn]");
    const editBtn = container.querySelector("[data-users-edit-btn]");
    const rowSelectButtons = container.querySelectorAll("[data-users-row-select-id]");
    const rowAnimateButtons = container.querySelectorAll("[data-users-row-animate-id]");

    const createFields = container.querySelectorAll("[data-users-create-field]");
    const saveNewBtn = container.querySelector("[data-users-save-new]");
    const cancelNewBtn = container.querySelector("[data-users-cancel-new]");
    const conflictButtons = container.querySelectorAll("[data-users-conflict-id]");
    const extraActionButtons = container.querySelectorAll("[data-users-extra-action]");

    extraActionButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const actionId = btn.getAttribute("data-users-extra-action");

        if (typeof options.onExtraAction === "function") {
          options.onExtraAction(actionId, state);
        }
      });
    });

    if (input) {
      input.addEventListener("input", (event) => {
        state.searchValue = event.target.value || "";
      });

      input.addEventListener("keydown", async (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          await handleSearchClick();
        }
      });
    }

    if (searchBtn) {
      searchBtn.addEventListener("click", handleSearchClick);
    }

    if (sealBtn) {
      sealBtn.addEventListener("click", handleCreateUser);
    }

    if (exitBtn) {
      exitBtn.addEventListener("click", handleExit);
    }

    if (editBtn) {
      editBtn.addEventListener("click", handleEditSelected);
    }

    // 🚫 DESACTIVADO: click sobre toda la fila
    rowSelectButtons.forEach((btn) => {
      btn.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        // no hacemos nada → dejamos solo la claqueta activa
      });
    });

    rowAnimateButtons.forEach((btn) => {
      btn.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();

        const userId = btn.getAttribute("data-users-row-animate-id");

        const selected =
          state.filteredUsers.find((u) => String(u.id) === String(userId)) ||
          state.deckUsers.find((u) => String(u.id) === String(userId)) ||
          state.allUsers.find((u) => String(u.id) === String(userId));

        if (!selected) return;

        state.selectedUser = selected;
        rerender();

        if (typeof options.onAnimateSelect === "function") {
          options.onAnimateSelect(selected);
        }
      });
    });

    createFields.forEach((field) => {
      field.addEventListener("input", (event) => {
        const fieldName = event.target.getAttribute("data-users-create-field");
        const value = event.target.value || "";

        if (fieldName === "nickname") state.newUserNickname = value;
        if (fieldName === "email") state.newUserEmail = value;
        if (fieldName === "phone") state.newUserPhone = value;
      });
    });

    if (saveNewBtn) {
      saveNewBtn.addEventListener("click", handleSaveNewUser);
    }

    if (cancelNewBtn) {
      cancelNewBtn.addEventListener("click", handleCancelCreateUser);
    }

    conflictButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        handleConflictSelect(btn.getAttribute("data-users-conflict-id"));
      });
    });
  }

  function renderCreateUserState() {
    const conflictHtml = state.conflictUsers.length
      ? `
      <div class="users-picker__conflicts">
        <div class="users-picker__conflicts-title">
          Ya existe un usuario con ese email o teléfono. Elegilo para continuar:
        </div>
        <div class="users-picker__results">
          ${state.conflictUsers.map((user) => `
            <button
              type="button"
              class="users-picker__row"
              data-users-conflict-id="${escapeHtml(user.id)}"
            >
              <img
                class="users-picker__row-type-icon"
                src="${escapeHtml(getUserTypeIcon(user))}"
                alt="${escapeHtml(user.qCategory || user.user_type || "Usuario")}"
              />
              <img
                class="users-picker__row-photo"
                src="${escapeHtml(getUserPhoto(user))}"
                alt="${escapeHtml(getUserDisplayName(user))}"
              />
              <span class="users-picker__row-name">${escapeHtml(getUserDisplayName(user))}</span>
            </button>
          `).join("")}
        </div>
      </div>
    `
      : "";

    return `
    <div class="users-picker__top">
      <img
        class="users-picker__people-icon"
        src="${escapeHtml(options.sealIcon || "/assets/icons/lacre120.gif")}"
        alt="Nuevo usuario"
      />

      <div class="users-picker__create-wrap">
        <input
          class="users-picker__create-input"
          type="text"
          placeholder="Nickname"
          value="${escapeHtml(state.newUserNickname)}"
          data-users-create-field="nickname"
        />

        <input
          class="users-picker__create-input"
          type="email"
          placeholder="Email"
          value="${escapeHtml(state.newUserEmail)}"
          data-users-create-field="email"
        />

        <input
          class="users-picker__create-input"
          type="text"
          placeholder="Teléfono"
          value="${escapeHtml(state.newUserPhone)}"
          data-users-create-field="phone"
        />

        <div class="users-picker__create-actions">
          <button
            type="button"
            class="users-picker__text-btn"
            data-users-save-new
            ${state.createUserLoading ? "disabled" : ""}
          >
            ${state.createUserLoading ? "Salvando..." : "Salvar"}
          </button>

          <button
            type="button"
            class="users-picker__text-btn"
            data-users-cancel-new
            ${state.createUserLoading ? "disabled" : ""}
          >
            Cancelar
          </button>
        </div>

        ${state.createUserError ? `<div class="users-picker__error">${escapeHtml(state.createUserError)}</div>` : ""}
        ${state.createUserMessage ? `<div class="users-picker__message">${escapeHtml(state.createUserMessage)}</div>` : ""}
        ${conflictHtml}
      </div>
    </div>
  `;
  }

  function renderSearchState() {
    if (options.hideSearch) {
      return "";
    }
    console.log("EXTRA ACTIONS", options.extraActions);
    return `
    <div class="users-picker__top">


      <div class="users-picker__search-wrap">
        <input
          class="users-picker__search-input"
          type="text"
          value="${escapeHtml(state.searchValue)}"
          data-users-search-input
        />

        <button
          type="button"
          class="users-picker__icon-btn"
          data-users-search-btn
          title="Buscar"
        >
          <img src="${escapeHtml(options.searchIcon || "/assets/icons/lupa60.gif")}" alt="Buscar" />
        </button>

        <button
          type="button"
          class="users-picker__icon-btn"
          data-users-seal-btn
          title="Registrar usuario"
        >
          <img src="${escapeHtml(options.sealIcon || "/assets/icons/lacre120.gif")}" alt="Registrar usuario" />
        </button>

${Array.isArray(options.extraActions)
        ? options.extraActions.map((action) => `
      <button
        type="button"
        class="
${action.plain ? "users-picker__icon-btn" : "users-picker__extra-btn"}
${action.id === "jheart" ? " users-picker__extra-btn--heart" : ""}
"
        data-users-extra-action="${action.id}"
        title="${action.title || ""}"
      >
        ${action.label
            ? action.label
            : `<img src="${action.icon}" alt="">`
          }
      </button>
    `).join("")
        : ""
      }
        
      </div>
    </div>
  `;
  }

  function hasActiveInvitationForUser(user) {
    const userId = Number(user?.id || 0);
    const plays = Array.isArray(options.plays) ? options.plays : [];

    const deckId = Number(options.deckId || 0);
    const parentPlayId = Number(options.parentPlayId || 0);
    const childRank = String(options.childRank || "").toUpperCase();
    const childSuit = String(options.childSuit || "").toUpperCase();

    if (!userId || !deckId || !childRank || !childSuit) return false;

    return plays.some((play) => {
      const status = String(play?.play_status || play?.status || "")
        .trim()
        .toUpperCase();

      const inactiveStatuses = ["REJECTED", "CANCELLED", "QUIT", "FIRED"];

      if (inactiveStatuses.includes(status)) return false;

      const playDeckId = Number(play?.deck_id || 0);
      const playTargetId = Number(play?.target_user_id || 0);
      const playCreatorId = Number(play?.created_by_user_id || 0);
      const playRank = String(play?.card_rank || play?.rank || "").toUpperCase();
      const playSuit = String(play?.card_suit || play?.suit || "").toUpperCase();

      if (playDeckId !== deckId) return false;
      if (playRank !== childRank) return false;
      if (playSuit !== childSuit) return false;

      if (childRank === "Q" && childSuit === "SPADE") {
        return (
          playTargetId === userId &&
          Number(play?.parent_play_id || 0) === parentPlayId
        );
      }

      if (childRank === "K" || childRank === "A") {
        return playTargetId === userId;
      }

      return false;
    });
  }

  function renderResultsState() {
    let resultsHtml = "";

    if (state.loading) {
      resultsHtml = `<div class="users-picker__empty">Cargando usuarios...</div>`;
    } else if (state.error) {
      resultsHtml = `<div class="users-picker__empty">${escapeHtml(state.error)}</div>`;
    } else {
      const usersToRender = state.searchValue.trim()
        ? state.filteredUsers
        : state.deckUsers;

      if (!usersToRender.length) {
        resultsHtml = `<div class="users-picker__empty">No hay usuarios AKQ en este mazo.</div>`;
      } else {

        const childRank = String(options.childRank || "").toUpperCase();
        const childSuit = String(options.childSuit || "").toUpperCase();

        resultsHtml = usersToRender.map((user) => {
          const alreadyInvited = hasActiveInvitationForUser(user);

          const actionLabel =
            `${childRank}${childSuit === "HEART" ? "♥" :
              childSuit === "SPADE" ? "♠" :
                childSuit === "DIAMOND" ? "♦" :
                  "♣"
            }`;

          return `
        <div class="users-picker__row" data-users-row-id="${escapeHtml(user.id)}">
          <button
            type="button"
            class="users-picker__row-main"
            data-users-row-select-id="${escapeHtml(user.id)}"
          >


            <img class="users-picker__row-photo"
              src="${escapeHtml(getUserPhoto(user))}"
              alt="${escapeHtml(getUserDisplayName(user))}" />

            <span class="users-picker__row-name">
              ${escapeHtml(getUserDisplayName(user))}
            </span>
            ${renderUserDeckSummary(user, options.plays || [])}
          </button>

${options.readonly
  ? ""
  : alreadyInvited
    ? `<span class="users-picker__row-action users-picker__row-action--disabled" title="Ya invitado">${escapeHtml(actionLabel)}</span>`
    : `
      <button
        type="button"
        class="users-picker__row-action"
        data-users-row-animate-id="${escapeHtml(user.id)}"
        title="Asignar usuario"
      >
        <img src="/assets/icons/ClaquetaAbierta.gif" alt="Asignar usuario" />
      </button>
    `
}
        </div>
      `;
        }).join("");
      }
    }

    return `
    ${state.isCreatingUser ? renderCreateUserState() : renderSearchState()}
    ${state.isCreatingUser ? "" : `
      <div class="users-picker__results">
        ${resultsHtml}
      </div>
    `}
  `;
  }

  function renderSelectedState() {
    const user = state.selectedUser;

    return `
    <div class="users-picker__top">
      <img
        class="users-picker__people-icon"
        src="${escapeHtml(getUserPhoto(user))}"
        alt="${escapeHtml(getUserDisplayName(user))}"
      />

      <div class="users-picker__search-wrap">
        <span class="users-picker__selected-name">${escapeHtml(getUserDisplayName(user))}</span>

        <button
          type="button"
          class="users-picker__icon-btn"
          data-users-edit-btn
          title="Editar selección"
        >
          <img src="${escapeHtml(options.editIcon || "/assets/icons/desarrollo40.gif")}" alt="Editar" />
        </button>

        
      </div>
    </div>
  `;
  }

  function rerender() {
    const html = `
    <section class="users-picker">
      ${state.selectedUser ? renderSelectedState() : renderResultsState()}
    </section>
  `;

    container.innerHTML = html;
    bindEvents();
  }

  rerender();

  return {
    rerender,
    clear() {
      container.innerHTML = "";
    },
    getSelectedUser() {
      return state.selectedUser;
    },
    setSelectedUser(user) {
      state.selectedUser = user || null;
      rerender();
    },
  };
}
window.renderUsersPicker = renderUsersPicker;
