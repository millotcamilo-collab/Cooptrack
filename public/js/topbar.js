(() => {
  const API_BASE_URL = "https://cooptrack-backend.onrender.com";

  async function getLoggedUser() {
    try {
      const token = localStorage.getItem("cooptrackToken");
      if (!token) return null;

      const response = await fetch(`${API_BASE_URL}/me`, {
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

  async function hasUserJPlays(userId) {
    try {
      const token = localStorage.getItem("cooptrackToken");

      const response = await fetch(`${API_BASE_URL}/plays/my-jotas`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) return false;

      const data = await response.json();
      return !!data.hasJ;

    } catch (error) {
      console.error(error);
      return false;
    }
  }

  function logout() {
    localStorage.removeItem("User");
    localStorage.removeItem("Token");
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
      const token = localStorage.getItem("cooptrackToken");
      if (!token) return false;

      const response = await fetch(`${API_BASE_URL}/decks`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) {
        if (response.status === 401) return false;
        throw new Error(`Error HTTP ${response.status}`);
      }

      const data = await response.json();

      const mazos = Array.isArray(data?.mazos)
        ? data.mazos
        : Array.isArray(data?.decks)
          ? data.decks
          : [];

      return mazos.length > 0;
    } catch (error) {
      console.error("Error leyendo mazos desde servidor:", error);
      return false;
    }
  }


  async function getLatestIncomingCard() {
    try {
      const token = localStorage.getItem("cooptrackToken");
      if (!token) return null;

      const response = await fetch(`${API_BASE_URL}/plays/pending`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) return null;

      const data = await response.json();
      const plays = Array.isArray(data?.plays) ? data.plays : [];

      const incoming = plays.filter((p) => {
        const rank = String(p.card_rank || p.rank || "").toUpperCase();
        return rank === "Q" || rank === "K" || rank === "A";
      });

      if (!incoming.length) return null;

      incoming.sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
      return incoming[0];
    } catch (error) {
      console.error("Error leyendo carta recibida:", error);
      return null;
    }
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

    const onMazosPage = isMazosPage();
    const userHasJPlays = user ? await hasUserJPlays(user.id) : false;
    const latestIncomingCard = await getLatestIncomingCard();
    const userHasPendingApprovals = !!latestIncomingCard;

    let topbarHTML = "";

    if (user) {
      topbarHTML = `
        <header class="topbar">
          <div class="page-container topbar__inner">

            <div class="topbar__left">
              <a href="/index.html" class="topbar__logo" title="home">
  <img src="/assets/icons/cooptrack3.png" class="topbar__logo-img" />
</a>
            </div>

            <nav class="topbar__right">

              <a href="/profile.html" class="topbar__profile">
                <span class="topbar__nickname">${user.nickname || ''}</span>
                <img src="${getProfileImage(user)}" class="topbar__icon-img topbar__icon-img--profile" />
              </a>

              <button
                class="topbar__icon-btn"
                id="newDeckBtn"
                title="El as de corazon constituye la primer jugada de un mazo. Comprende el nombre, la imagen y la moneda de referencia y solo se juega una vez"
              >
                <img src="/assets/icons/Acorazon.gif" class="topbar__icon-img" />
              </button>

              ${userHasDecks
          ? `
                    <a
                      href="${onMazosPage ? "/index.html" : "/mazos.html"}"
                      class="topbar__icon-btn"
                      title="Aqui estan los mazos"
                    >
                      <img
                        src="${onMazosPage
            ? "/assets/icons/portafolioAbierto.png"
            : "/assets/icons/portafolios80.gif"
          }"
                        class="topbar__icon-img"
                      />
                    </a>
                  `
          : ""
        }

              ${userHasPendingApprovals
          ? `
                    <button class="topbar__icon-btn" id="pendingBtn" title="Pendientes">
                      <img src="/assets/icons/Dorso70.gif" class="topbar__icon-img" />
                    </button>
                  `
          : ""
        }
${userHasJPlays
          ? `
    ${userHasJPlays
            ? `
    <button
      class="topbar__icon-btn"
      id="archivoBtn"
      title="archivo"
    >
      <img src="/assets/icons/archivo80.gif" class="topbar__icon-img" />
    </button>

    <button
      class="topbar__icon-btn"
      id="bitacoraBtn"
      title="log de jotas"
    >
      <img src="/assets/icons/maquina80.gif" class="topbar__icon-img" />
    </button>

    <button
      class="topbar__icon-btn"
      id="gestionBtn"
      title="gestión"
    >
      <img src="/assets/icons/sombrero60.gif" class="topbar__icon-img" />
    </button>

    <button
      class="topbar__icon-btn"
      id="contabilidadBtn"
      title="contabilidad"
    >
      <img src="/assets/icons/calculadora80.gif" class="topbar__icon-img" />
    </button>
    `
            : ""
          }
             <a
                href="/almanaque.html"
                class="topbar__icon-btn"
                title="Aqui esta el calendario aun no te programe"
              >
                <img src="/assets/icons/Schedule80.gif" class="topbar__icon-img" />
              </a>

              <a
                href="/noticias.html"
                class="topbar__icon-btn"
                title="Aca estan las noticias que aun no ocurren"
              >
                <img src="/assets/icons/Extra120.gif" class="topbar__icon-img" />
              </a>

              <a
                href="/help.html"
                class="topbar__icon-btn"
                title="help"
              >
                <img src="/assets/icons/bastonRecortado80.gif" class="topbar__icon-img" />
              </a>
${user.is_admin
            ? `
      <a
        href="/protected-pages/administradores.html"
        class="topbar__icon-btn"
        title="Administración de usuarios"
      >
        <img src="/assets/icons/Tools120.gif" class="topbar__icon-img" />
      </a>
    `
            : ""
          }
              <button class="topbar__icon-btn" id="logoutBtn">
                <img src="/assets/icons/exit80.gif" class="topbar__icon-img topbar__icon-img--exit" />
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
              <a href="/index.html" class="topbar__logo">
                <img src="/assets/icons/cooptrack3.png" class="topbar__logo-img" />
              </a>
            </div>

            <nav class="topbar__right">
           
              <a
                href="/almanaque.html"
                class="topbar__icon-btn"
                title="Aqui esta el calendario aun no te programe"
              >
                <img src="/assets/icons/Schedule80.gif" class="topbar__icon-img" />
              </a>

              <a
                href="/help.html"
                class="topbar__icon-btn"
                title="help"
              >
                <img src="/assets/icons/bastonRecortado80.gif" class="topbar__icon-img" />
              </a>

              <a href="/login.html" class="topbar__login-link">
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

    const bitacoraBtn = document.getElementById("bitacoraBtn");

    const archivoBtn = document.getElementById("archivoBtn");

    if (archivoBtn) {
      archivoBtn.addEventListener("click", () => {
        window.location.href = "/archivo.html";
      });
    }

    if (bitacoraBtn) {
      bitacoraBtn.addEventListener("click", () => {
        window.location.href = "/bitacora.html";
      });
    }

    const gestionBtn = document.getElementById("gestionBtn");
    if (gestionBtn) {
      gestionBtn.addEventListener("click", () => {
        window.location.href = "/gestion.html";
      });
    }

    const contabilidadBtn = document.getElementById("contabilidadBtn");
    if (contabilidadBtn) {
      contabilidadBtn.addEventListener("click", () => {
        window.location.href = "/contabilidad.html";
      });
    }
    
    const pendingBtn = document.getElementById("pendingBtn");
    if (pendingBtn && latestIncomingCard) {
      pendingBtn.addEventListener("click", () => {
        const deckId = latestIncomingCard.deck_id;
        const playId = latestIncomingCard.id;

        window.location.href = `/lienzo.html?deckId=${deckId}&playId=${playId}`;
      });
    }
  }

  document.addEventListener("DOMContentLoaded", renderTopbar);
})();
