window.API_BASE_URL = window.API_BASE_URL || "https://cooptrack-backend.onrender.com";

function getLoggedUser() {
  try {
    const raw = localStorage.getItem("cooptrackUser");
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.error("Error leyendo cooptrackUser:", error);
    return null;
  }
}

function getStoredDecksViewOpen() {
  try {
    return localStorage.getItem("cooptrackDecksViewOpen") === "true";
  } catch (error) {
    console.error("Error leyendo cooptrackDecksViewOpen:", error);
    return false;
  }
}

function setStoredDecksViewOpen(value) {
  try {
    localStorage.setItem("cooptrackDecksViewOpen", value ? "true" : "false");
  } catch (error) {
    console.error("Error guardando cooptrackDecksViewOpen:", error);
  }
}

async function hasPendingItems() {
  try {
    const token = localStorage.getItem("cooptrackToken");
    if (!token) return false;

    const response = await fetch(`${window.API_BASE_URL}/plays/pending`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      console.warn("Pendientes no disponibles:", data);
      return false;
    }

    return Array.isArray(data.plays) && data.plays.length > 0;
  } catch (error) {
    console.error("Error consultando pendientes:", error);
    return false;
  }
}

async function renderTopbar() {
  const container = document.getElementById("topbar-container");
  if (!container) return;

  const user = getLoggedUser();
  const token = localStorage.getItem("cooptrackToken");
  const isAuthenticated = !!token;

  let hasPending = false;

  try {
    hasPending = await hasPendingItems();
  } catch (error) {
    console.error("Error resolviendo pendientes en topbar:", error);
    hasPending = false;
  }

  container.innerHTML = `
    <header class="topbar">
      <div class="page-container topbar__inner">
        <div class="topbar__left">
          <a href="/index.html" class="topbar__logo-link" aria-label="CoopTrack">
            <img
              src="/assets/icons/cooptrack.png"
              alt="CoopTrack"
              class="topbar__logo"
            />
          </a>
        </div>

        <div class="topbar__right">
          ${
            isAuthenticated
              ? `
                <button type="button" class="topbar__icon-btn" id="profileBtn" title="Perfil">
                  <img
                    src="${user?.profile_photo_url || "/assets/icons/singeta120.gif"}"
                    alt="Perfil"
                    class="topbar__icon-img topbar__icon-img--avatar"
                  />
                </button>

                <button type="button" class="topbar__icon-btn" id="newDeckBtn" title="Nuevo mazo">
                  <img src="/assets/icons/Acorazon.gif" alt="Nuevo mazo" class="topbar__icon-img" />
                </button>

                <button type="button" class="topbar__icon-btn" id="toggleDecksBtn" title="Portafolios">
                  <img
                    src="${getStoredDecksViewOpen() ? "/assets/icons/portafolioAbierto.png" : "/assets/icons/portafolios80.gif"}"
                    alt="Portafolios"
                    class="topbar__icon-img"
                  />
                </button>

                ${
                  hasPending
                    ? `
                      <button type="button" class="topbar__icon-btn" id="pendingBtn" title="Jugadas pendientes">
                        <img src="/assets/icons/Dorso70.gif" alt="Pendientes" class="topbar__icon-img" />
                      </button>
                    `
                    : ""
                }

                <button type="button" class="topbar__icon-btn" id="scheduleBtn" title="Almanaque">
                  <img src="/assets/icons/Schedule80.gif" alt="Almanaque" class="topbar__icon-img" />
                </button>

                <button type="button" class="topbar__icon-btn" id="newsBtn" title="Noticias">
                  <img src="/assets/icons/Extra120.gif" alt="Noticias" class="topbar__icon-img" />
                </button>

                <button type="button" class="topbar__icon-btn" id="helpBtn" title="Ayuda">
                  <img src="/assets/icons/bastonRecortado80.gif" alt="Ayuda" class="topbar__icon-img" />
                </button>

                <button type="button" class="topbar__icon-btn" id="logoutBtn" title="Salir">
                  <img src="/assets/icons/exit80.gif" alt="Salir" class="topbar__icon-img" />
                </button>
              `
              : `
                <a href="/login.html" class="topbar__login-link">Ingresar</a>
              `
          }
        </div>
      </div>
    </header>
  `;

  bindTopbarEvents();
}

function bindTopbarEvents() {
  const profileBtn = document.getElementById("profileBtn");
  if (profileBtn) {
    profileBtn.addEventListener("click", () => {
      window.location.href = "/perfil.html";
    });
  }

  const newDeckBtn = document.getElementById("newDeckBtn");
  if (newDeckBtn) {
    newDeckBtn.addEventListener("click", () => {
      window.location.href = "/nuevo-mazo.html";
    });
  }

  const toggleDecksBtn = document.getElementById("toggleDecksBtn");
  if (toggleDecksBtn) {
    toggleDecksBtn.addEventListener("click", () => {
      const nextValue = !getStoredDecksViewOpen();
      setStoredDecksViewOpen(nextValue);

      document.dispatchEvent(
        new CustomEvent("topbar:toggle-decks", {
          detail: { open: nextValue }
        })
      );

      renderTopbar();
    });
  }

  const pendingBtn = document.getElementById("pendingBtn");
  if (pendingBtn) {
    pendingBtn.addEventListener("click", () => {
      window.location.href = "/pendientes.html";
    });
  }

  const scheduleBtn = document.getElementById("scheduleBtn");
  if (scheduleBtn) {
    scheduleBtn.addEventListener("click", () => {
      window.location.href = "/almanaque.html";
    });
  }

  const newsBtn = document.getElementById("newsBtn");
  if (newsBtn) {
    newsBtn.addEventListener("click", () => {
      window.location.href = "/noticias.html";
    });
  }

  const helpBtn = document.getElementById("helpBtn");
  if (helpBtn) {
    helpBtn.addEventListener("click", () => {
      window.location.href = "/help.html";
    });
  }

  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      localStorage.removeItem("cooptrackToken");
      localStorage.removeItem("cooptrackUser");
      localStorage.removeItem("cooptrackDecksViewOpen");
      window.location.href = "/login.html";
    });
  }
}

window.renderTopbar = renderTopbar;
