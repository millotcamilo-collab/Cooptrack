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

  function getReadOnlyDismissedIds() {
    try {
      const raw = localStorage.getItem("cooptrackReadOnlyDismissedIds");
      const parsed = JSON.parse(raw || "[]");
      return Array.isArray(parsed) ? parsed.map((id) => Number(id)).filter(Boolean) : [];
    } catch (error) {
      return [];
    }
  }

  function saveReadOnlyDismissedIds(ids) {
    try {
      const unique = [...new Set((ids || []).map((id) => Number(id)).filter(Boolean))];
      localStorage.setItem("cooptrackReadOnlyDismissedIds", JSON.stringify(unique));
    } catch (error) {
      console.warn("No se pudo guardar dismissedIds", error);
    }
  }

  function markReadOnlyDismissed(playId) {
    const current = getReadOnlyDismissedIds();
    current.push(Number(playId || 0));
    saveReadOnlyDismissedIds(current);
  }

  function isReadOnlyDismissed(playId) {
    return getReadOnlyDismissedIds().includes(Number(playId || 0));
  }

  function normalizeText(value) {
    return String(value || "").trim().toUpperCase();
  }

  function isCorporateIncomingPlay(play) {
    const rank = normalizeText(play?.card_rank || play?.rank);
    return rank === "Q" || rank === "K" || rank === "A";
  }

  function getPendingKindForUser(play, currentUserId) {
    if (!play || !currentUserId) return null;

    const status = normalizeText(play?.play_status || play?.status);
    const sourceUserId = Number(play?.created_by_user_id || 0);
    const targetUserId = Number(play?.target_user_id || 0);

    const isSource = sourceUserId === Number(currentUserId);
    const isTarget = targetUserId === Number(currentUserId);

    // 1) Pendiente real de acción del invitado/destinatario
    if (isTarget && (status === "SENT" || status === "PENDING")) {
      return "ACTION_REQUIRED";
    }

    // 1b) Settlement confirmado sobre la misma QQ♠ para el pagador
    if (isTarget && status === "APPROVED" && playHasSettlement(play)) {
      return "ACTION_REQUIRED";
    }

    // 2) Notificación solo lectura para el anfitrión
    if (isSource && (status === "APPROVED" || status === "REJECTED")) {
      if (isReadOnlyDismissed(play?.id)) {
        return null;
      }
      return "READ_ONLY";
    }

    // 3) Ya enterado: no debe aparecer más
    if (isSource && status === "ACKNOWLEDGED") {
      return null;
    }

    // 4) Enviada pero esperando al otro: no es pendiente del anfitrión
    if (isSource && status === "SENT") {
      return null;
    }

    return null;
  }

  async function getTopbarNotifications(currentUserId) {
    try {
      const token = localStorage.getItem("cooptrackToken");
      if (!token) {
        return {
          latestActionRequired: null,
          latestReadOnly: null
        };
      }

      const response = await fetch(`${API_BASE_URL}/plays/pending`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) {
        return {
          latestActionRequired: null,
          latestReadOnly: null
        };
      }

      const data = await response.json();
      const plays = Array.isArray(data?.plays) ? data.plays : [];

      const candidates = plays
        .filter(isCorporateIncomingPlay)
        .map((play) => {
          const pendingKind = getPendingKindForUser(play, currentUserId);
          return pendingKind ? { ...play, pendingKind } : null;
        })
        .filter(Boolean);

      const actionRequired = candidates
        .filter((play) => play.pendingKind === "ACTION_REQUIRED")
        .sort((a, b) => Number(b.id || 0) - Number(a.id || 0));

      const readOnly = candidates
        .filter((play) => play.pendingKind === "READ_ONLY")
        .sort((a, b) => Number(b.id || 0) - Number(a.id || 0));

      return {
        latestActionRequired: actionRequired[0] || null,
        latestReadOnly: readOnly[0] || null
      };
    } catch (error) {
      console.error("Error leyendo pendientes para topbar:", error);
      return {
        latestActionRequired: null,
        latestReadOnly: null
      };
    }
  }

  function parsePlayCode(code) {
    const parts = String(code || "").split("§");

    return {
      deckId: parts[0] || null,
      userId: parts[1] || null,
      date: parts[2] || null,
      rank: parts[3] || null,
      suit: parts[4] || null,
      action: parts[5] || null,
      autorizados: parts[6] || null,
      flow: parts[7] || null,
      recipients: parts[8] || null
    };
  }

  function parseFlowMetadata(flowValue) {
    const raw = String(flowValue || "").trim();
    if (!raw) return { baseFlow: "", payment: null };

    const chunks = raw
      .split(";")
      .map((item) => item.trim())
      .filter(Boolean);

    let baseFlow = "";
    let payment = null;

    chunks.forEach((chunk) => {
      if (chunk.startsWith("pay:QHEART")) {
        const parts = chunk.split("|");
        const paymentData = {
          attachedRank: "Q",
          attachedSuit: "HEART"
        };

        parts.forEach((part, index) => {
          if (index === 0) return;

          const separatorIndex = part.indexOf(":");
          if (separatorIndex === -1) return;

          const key = part.slice(0, separatorIndex).trim();
          const value = part.slice(separatorIndex + 1).trim();

          if (!key) return;
          paymentData[key] = value;
        });

        payment = paymentData;
      } else if (!baseFlow) {
        baseFlow = chunk;
      }
    });

    return { baseFlow, payment };
  }

  function playHasSettlement(play) {
    const playCode = String(play?.play_code || "").toUpperCase();
    return (
      playCode.includes("SETTLEMENT:PAID") ||
      playCode.includes("SETTLEMENT:COMPLAINED")
    );
  }

  function playHasQHeartAttachment(play) {
    const parsed = parsePlayCode(play?.play_code || "");
    const meta = parseFlowMetadata(parsed.flow);

    if (!meta?.payment) return false;

    const amount = String(meta.payment.amount || "").trim();
    const payDate = String(meta.payment.payDate || "").trim();
    const concept = String(meta.payment.concept || "").trim();

    return !!(amount && payDate && concept);
  }

  function resolveLienzoPageForPlay(play) {
    const rank = normalizeText(play?.card_rank || play?.rank);
    const suit = normalizeText(play?.card_suit || play?.suit);

    if (rank === "Q" && suit === "SPADE") {
      return playHasQHeartAttachment(play)
        ? "/lienzoQQpica.html"
        : "/lienzoQpica.html";
    }

    if (rank === "K") {
      return "/lienzoK.html";
    }

    if (rank === "A") {
      return "/lienzoA.html";
    }

    return "/lienzo.html";
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

  function isMazosPage() {
    return (
      window.location.pathname.endsWith("/mazos.html") ||
      window.location.pathname === "/mazos.html"
    );
  }

  function goToCreateDeckPage() {
    window.location.href = "/nuevo-mazo.html";
  }

  async function hasArchivedDecks() {
    try {
      const token = localStorage.getItem("cooptrackToken");
      if (!token) return false;

      const response = await fetch(`${API_BASE_URL}/decks?archived=true`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) return false;

      const data = await response.json();
      const mazos = data?.mazos || data?.decks || [];

      return mazos.length > 0;
    } catch (error) {
      console.error(error);
      return false;
    }
  }

  async function goToPlayNotification(play) {
    if (!play) return;

    const deckId = play.deck_id;
    const playId = play.id;
    const token = localStorage.getItem("cooptrackToken");

    try {
      let playForRouting = play;

      if (token && playId) {
        const response = await fetch(`${API_BASE_URL}/plays/${playId}`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        const data = await response.json().catch(() => null);

        if (response.ok && data?.ok && data.play) {
          playForRouting = data.play;
        }
      }

      const nextPage = resolveLienzoPageForPlay(playForRouting);
      window.location.href = `${nextPage}?deckId=${deckId}&playId=${playId}`;
    } catch (error) {
      console.error("Error resolviendo notificación:", error);
      const nextPage = resolveLienzoPageForPlay(play);
      window.location.href = `${nextPage}?deckId=${deckId}&playId=${playId}`;
    }
  }

  async function renderTopbar() {
    const user = await getLoggedUser();
    const userHasDecks = await hasDecks();
    const userHasJPlays = user ? await hasUserJPlays(user.id) : false;

    const onMazosPage = isMazosPage();
    const userHasArchivedDecks = await hasArchivedDecks();

    const notifications = user
      ? await getTopbarNotifications(user.id)
      : { latestActionRequired: null, latestReadOnly: null };

    const latestActionRequired = notifications.latestActionRequired;
    const latestReadOnly = notifications.latestReadOnly;

    const userHasPendingApprovals = !!latestActionRequired;
    const userHasReadNotifications = !!latestReadOnly;

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
                <span class="topbar__nickname">${user.nickname || ""}</span>
                <img src="${getProfileImage(user)}" class="topbar__icon-img topbar__icon-img--profile" />
              </a>

              <button
                class="topbar__icon-btn"
                id="newDeckBtn"
                title="El as de corazon constituye la primer jugada de un mazo. Comprende el nombre, la imagen y la moneda de referencia y solo se juega una vez"
              >
                <img src="/assets/icons/Acorazon.gif" class="topbar__icon-img" />
              </button>

              ${userHasPendingApprovals
          ? `
                <button class="topbar__icon-btn" id="pendingBtn" title="Pendientes">
                <img src="/assets/icons/Dorso70.gif" class="topbar__icon-img" />
                </button>
                `
          : ""
        }

        ${userHasReadNotifications
          ? `
          <button class="topbar__icon-btn" id="reedBtn" title="Lecturas pendientes">
            <img src="/assets/icons/DorsoRojo70.gif" class="topbar__icon-img" />
          </button>
          `
          : ""
        }

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

              ${userHasArchivedDecks
          ? `
                    <button
                      class="topbar__icon-btn"
                      id="archivoBtn"
                      title="archivo"
                    >
                      <img src="/assets/icons/archivo80.gif" class="topbar__icon-img" />
                    </button>
                  `
          : ""
        }

              ${userHasJPlays
          ? `
                    <button
                      class="topbar__icon-btn"
                      id="bitacoraBtn"
                      title="log de jotas"
                    >
                      <img src="/assets/icons/maquina80.gif" class="topbar__icon-img" />
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
                title="Almanaque"
              >
                <img src="/assets/icons/Schedule80.gif" class="topbar__icon-img" />
              </a>

              <a
                href="/noticias.html"
                class="topbar__icon-btn"
                title="Noticias"
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

    const contabilidadBtn = document.getElementById("contabilidadBtn");
    if (contabilidadBtn) {
      contabilidadBtn.addEventListener("click", () => {
        window.location.href = "/contabilidad.html";
      });
    }

    const pendingBtn = document.getElementById("pendingBtn");
    if (pendingBtn && latestActionRequired) {
      pendingBtn.addEventListener("click", async () => {
        goToPlayNotification(latestActionRequired);
      });
    }

    const reedBtn = document.getElementById("reedBtn");
    if (reedBtn && latestReadOnly) {
      reedBtn.addEventListener("click", async () => {
        const play = latestReadOnly;

        markReadOnlyDismissed(play?.id);
        reedBtn.remove();

        goToPlayNotification(play);
      });
    }

  }

  document.addEventListener("DOMContentLoaded", renderTopbar);
})();