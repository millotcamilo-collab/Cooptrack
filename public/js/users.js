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
    selectedUser: options.selectedUser || null,
    searchValue: "",
    loaded: false,
    loading: false,
    error: "",
  };

  async function ensureUsersLoaded() {
    if (state.loaded || state.loading) return;

    if (!state.deckId) {
      state.error = "Falta deckId para cargar usuarios";
      state.loaded = true;
      return;
    }

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

    state.filteredUsers = state.allUsers.filter((user) =>
      startsWithSearch(getUserDisplayName(user), trimmed)
    );
  }

  function handleSelect(userId) {
    const selected = state.filteredUsers.find((u) => String(u.id) === String(userId))
      || state.allUsers.find((u) => String(u.id) === String(userId));

    if (!selected) return;

    state.selectedUser = selected;
    rerender();

    if (typeof options.onSelect === "function") {
      options.onSelect(selected);
    }
  }

  function handleEditSelected() {
    state.selectedUser = null;
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
    if (typeof options.onCreateUser === "function") {
      options.onCreateUser();
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
    const rowButtons = container.querySelectorAll("[data-users-row-id]");

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

    rowButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        handleSelect(btn.getAttribute("data-users-row-id"));
      });
    });
  }

  function renderSearchState() {
    return `
      <div class="users-picker__top">
        <img
          class="users-picker__people-icon"
          src="${escapeHtml(options.peopleIcon || "/assets/icons/Gente120.gif")}"
          alt="Usuarios"
        />

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
            <img src="${escapeHtml(options.sealIcon || "/assets/icons/lacre80.gif")}" alt="Registrar usuario" />
          </button>

          <button
            type="button"
            class="users-picker__icon-btn"
            data-users-exit-btn
            title="Salir"
          >
            <img src="${escapeHtml(options.exitIcon || "/assets/icons/exit80.gif")}" alt="Salir" />
          </button>
        </div>
      </div>
    `;
  }

  function renderResultsState() {
    let resultsHtml = "";

    if (state.loading) {
      resultsHtml = `<div class="users-picker__empty">Cargando usuarios...</div>`;
    } else if (state.error) {
      resultsHtml = `<div class="users-picker__empty">${escapeHtml(state.error)}</div>`;
    } else if (!state.searchValue.trim()) {
      resultsHtml = "";
    } else if (!state.filteredUsers.length) {
      resultsHtml = `<div class="users-picker__empty">No se encontraron usuarios.</div>`;
    } else {
      resultsHtml = state.filteredUsers.map((user) => `
  <button
    type="button"
    class="users-picker__row"
    data-users-row-id="${escapeHtml(user.id)}"
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
`).join("");
    }

    return `
      ${renderSearchState()}
      <div class="users-picker__results">
        ${resultsHtml}
      </div>
    `;
  }

  function renderSelectedState() {
    const user = state.selectedUser;

    return `
      <div class="users-picker__top">
        <img
          class="users-picker__people-icon"
         src="${escapeHtml(options.peopleIcon || "/assets/icons/Gente120.gif")}"
          alt="Usuarios"
        />

        <div class="users-picker__search-wrap">
          <span class="users-picker__selected-name">${escapeHtml(getUserDisplayName(user))}</span>

          <button
            type="button"
            class="users-picker__icon-btn"
            data-users-edit-btn
            title="Editar selección"
          >
            <img src="${escapeHtml(options.editIcon || "/assets/icons/edit80.gif")}" alt="Editar" />
          </button>

          <button
            type="button"
            class="users-picker__icon-btn"
            data-users-exit-btn
            title="Salir"
          >
            <img src="${escapeHtml(options.exitIcon || "/assets/icons/exit80.gif")}" alt="Salir" />
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
