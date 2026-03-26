function getLoggedUser() {
  try {
    const raw = localStorage.getItem("cooptrackUser");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/* =========================================================
   🔔 PENDIENTES (Q♠ + futuras jugadas)
========================================================= */

async function hasPendingItems() {
  try {
    const token = localStorage.getItem("cooptrackToken");
    if (!token) return false;

    const response = await fetch(`${window.API_BASE_URL}/plays/pending`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      console.warn("No se pudieron obtener pendientes");
      return false;
    }

    return Array.isArray(data.plays) && data.plays.length > 0;

  } catch (error) {
    console.error("Error consultando pendientes:", error);
    return false;
  }
}

/* =========================================================
   🧱 RENDER TOPBAR
========================================================= */

async function renderTopbar() {
  const container = document.getElementById("topbar-container");
  if (!container) return;

  const user = getLoggedUser();
  const token = localStorage.getItem("cooptrackToken");

  // 👇 NUEVO: pendientes reales
  const hasPending = await hasPendingItems();

  container.innerHTML = `
    <header class="topbar">
      <div class="topbar__inner">

        <!-- LOGO -->
        <div class="topbar__left">
          <img src="/assets/icons/cooptrack.png" class="topbar__logo" />
        </div>

        <!-- DERECHA -->
        <div class="topbar__right">

          ${
            token
              ? `
                <!-- PERFIL -->
                <div class="topbar__user">
                  <img src="${user?.profile_photo_url || "/assets/icons/singeta120.gif"}" class="topbar__avatar" />
                </div>

                <!-- NUEVO MAZO -->
                <button id="newDeckBtn" class="topbar__icon-btn">
                  <img src="/assets/icons/Acorazon.gif" class="topbar__icon-img" />
                </button>

                <!-- PORTAFOLIOS -->
                <button id="toggleDecksBtn" class="topbar__icon-btn">
                  <img src="/assets/icons/portafolios80.gif" class="topbar__icon-img" />
                </button>

                <!-- 🔔 DORSO (PENDIENTES) -->
                ${
                  hasPending
                    ? `
                      <button id="pendingBtn" class="topbar__icon-btn">
                        <img src="/assets/icons/Dorso70.gif" class="topbar__icon-img" />
                      </button>
                    `
                    : ""
                }

                <!-- ALMANAQUE -->
                <button class="topbar__icon-btn">
                  <img src="/assets/icons/Schedule80.gif" class="topbar__icon-img" />
                </button>

                <!-- NOTICIAS -->
                <button class="topbar__icon-btn">
                  <img src="/assets/icons/Extra120.gif" class="topbar__icon-img" />
                </button>

                <!-- HELP -->
                <button class="topbar__icon-btn">
                  <img src="/assets/icons/bastonRecortado80.gif" class="topbar__icon-img" />
                </button>

                <!-- SALIR -->
                <button id="logoutBtn" class="topbar__icon-btn">
                  <img src="/assets/icons/exit80.gif" class="topbar__icon-img" />
                </button>
              `
              : `
                <a href="/login.html" class="topbar__login-btn">Ingresar</a>
              `
          }

        </div>
      </div>
    </header>
  `;

  bindTopbarEvents();
}

/* =========================================================
   🎯 EVENTOS
========================================================= */

function bindTopbarEvents() {

  const newDeckBtn = document.getElementById("newDeckBtn");
  if (newDeckBtn) {
    newDeckBtn.addEventListener("click", () => {
      window.location.href = "/nuevo-mazo.html";
    });
  }

  const toggleDecksBtn = document.getElementById("toggleDecksBtn");
  if (toggleDecksBtn) {
    toggleDecksBtn.addEventListener("click", () => {
      document.dispatchEvent(new CustomEvent("topbar:toggle-decks"));
    });
  }

  /* 🔔 PENDIENTES */
  const pendingBtn = document.getElementById("pendingBtn");
  if (pendingBtn) {
    pendingBtn.addEventListener("click", () => {
      window.location.href = "/pendientes.html";
    });
  }

  /* LOGOUT */
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      localStorage.removeItem("cooptrackToken");
      localStorage.removeItem("cooptrackUser");
      window.location.href = "/login.html";
    });
  }
}

/* =========================================================
   INIT
========================================================= */

window.renderTopbar = renderTopbar;
