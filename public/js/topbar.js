async function getLoggedUser() {
  try {
    const token = localStorage.getItem("cooptrackToken");
    if (!token) return null;

    const response = await fetch("https://cooptrack-backend.onrender.com/me", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!response.ok) {
      if (response.status === 401) {
        return null;
      }

      throw new Error(`Error HTTP ${response.status}`);
    }

    const data = await response.json();
    return data?.user || null;
  } catch (error) {
    console.error("Error obteniendo usuario autenticado:", error);
    return null;
  }
}

function logout() {
  localStorage.removeItem("cooptrackUser");
  localStorage.removeItem("cooptrackToken");
  window.location.href = "/index.html";
}

function getProfileImage(user) {
  if (user && user.profile_photo_url && user.profile_photo_url.trim() !== "") {
    return user.profile_photo_url;
  }
  return "/assets/icons/singeta120.gif";
}

async function hasDecks() {
  try {
    const response = await fetch("/decks", {
      method: "GET"
    });

    if (!response.ok) {
      throw new Error(`Error HTTP ${response.status}`);
    }

    const data = await response.json();
    const decks = Array.isArray(data?.decks) ? data.decks : [];
    return decks.length > 0;
  } catch (error) {
    console.error("Error leyendo mazos desde servidor:", error);
    return false;
  }
}

async function hasPendingApprovals() {
  return false;
}

function isMazosPage() {
  return window.location.pathname.endsWith("/mazos.html") ||
         window.location.pathname === "/mazos.html";
}

function goToCreateDeckPage() {
  window.location.href = "/nuevo-mazo.html";
}

async function renderTopbar() {
  const user = await getLoggedUser();
  const userHasDecks = await hasDecks();
  const userHasPendingApprovals = await hasPendingApprovals();
  const onMazosPage = isMazosPage();

  let topbarHTML = "";

  if (user) {
    topbarHTML = `
      <header class="topbar">
        <div class="page-container topbar__inner">

          <div class="topbar__left">
            <a href="/index.html" class="topbar__logo" aria-label="CoopTrack">
              <img src="/assets/icons/cooptrack.png" alt="CoopTrack" class="topbar__logo-img" />
            </a>
          </div>

          <nav class="topbar__right" aria-label="Navegación principal">

            <a href="/profile.html" class="topbar__icon-btn" title="Perfil" aria-label="Perfil">
              <img src="${getProfileImage(user)}" alt="Perfil" class="topbar__icon-img topbar__icon-img--profile" />
            </a>

            <button class="topbar__icon-btn" id="newDeckBtn" title="Nuevo mazo" aria-label="Nuevo mazo">
              <img src="/assets/icons/Acorazon.gif" alt="Nuevo mazo" class="topbar__icon-img" />
            </button>

            ${
              userHasDecks
                ? `
                  <a href="${onMazosPage ? "/index.html" : "/mazos.html"}"
                     class="topbar__icon-btn"
                     title="Mazos"
                     aria-label="Mazos">
                    <img
                      src="${
                        onMazosPage
                          ? "/assets/icons/portafolioAbierto.png"
                          : "/assets/icons/portafolios80.gif"
                      }"
                      alt="Mazos"
                      class="topbar__icon-img topbar__icon-img--portfolio"
                    />
                  </a>
                `
                : ""
            }

            ${
              userHasPendingApprovals
                ? `
                  <a href="/notificaciones.html" class="topbar__icon-btn" title="Notificaciones" aria-label="Notificaciones">
                    <img src="/assets/icons/Dorso70.gif" alt="Notificaciones" class="topbar__icon-img" />
                  </a>
                `
                : ""
            }

            <a href="/almanaque.html" class="topbar__icon-btn" title="Almanaque" aria-label="Almanaque">
              <img src="/assets/icons/Schedule80.gif" alt="Almanaque" class="topbar__icon-img" />
            </a>

            <a href="/noticias.html" class="topbar__icon-btn" title="Noticias" aria-label="Noticias">
              <img src="/assets/icons/Extra120.gif" alt="Noticias" class="topbar__icon-img" />
            </a>

            <a href="/help.html" class="topbar__icon-btn" title="Help" aria-label="Help">
              <img src="/assets/icons/bastonRecortado80.gif" alt="Help" class="topbar__icon-img" />
            </a>

            <button class="topbar__icon-btn topbar__exit-btn" id="logoutBtn" title="Salir" aria-label="Salir">
              <img src="/assets/icons/exit80.gif" alt="Salir" class="topbar__icon-img topbar__icon-img--exit" />
            </button>

          </nav>
        </div>
      </header>
    `;
  } else {
    topbarHTML = `
      <header class="topbar">
        <div class="page-container topbar__inner">

          <div class="topbar__left">
            <a href="/index.html" class="topbar__logo" aria-label="CoopTrack">
              <img src="/assets/icons/cooptrack.png" alt="CoopTrack" class="topbar__logo-img" />
            </a>
          </div>

          <nav class="topbar__right" aria-label="Navegación principal">
            <a href="/almanaque.html" class="topbar__icon-btn" title="Almanaque" aria-label="Almanaque">
              <img src="/assets/icons/Schedule80.gif" alt="Almanaque" class="topbar__icon-img" />
            </a>

            <a href="/help.html" class="topbar__icon-btn" title="Help" aria-label="Help">
              <img src="/assets/icons/bastonRecortado80.gif" alt="Help" class="topbar__icon-img" />
            </a>

            <a href="/login.html" class="topbar__login-link" title="Login" aria-label="Login">
              Login
            </a>
          </nav>
        </div>
      </header>
    `;
  }

  const container = document.getElementById("topbar-container");

  if (!container) {
    console.warn("topbar-container no encontrado");
    return;
  }

  container.innerHTML = topbarHTML;

  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", logout);
  }

  const newDeckBtn = document.getElementById("newDeckBtn");
  if (newDeckBtn) {
    newDeckBtn.addEventListener("click", goToCreateDeckPage);
  }
}

renderTopbar();
