(() => {
  const animationState = {
    jokerDelivered: false
  };

  function getParams() {
    const params = new URLSearchParams(window.location.search);

    return {
      deckId: Number(params.get("deckId") || params.get("id") || 0),
      playId: Number(params.get("playId") || params.get("focusPlayId") || 0)
    };
  }

  function getToken() {
    return localStorage.getItem("cooptrackToken") || "";
  }

  function getEl(id) {
    return document.getElementById(id);
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function setMessage(text, type = "normal") {
    const msgEl = getEl("jokerBlueApprovedMsg");
    if (!msgEl) return;

    msgEl.textContent = text || "";

    if (type === "error") {
      msgEl.style.color = "#8a2d2d";
      return;
    }

    if (type === "success") {
      msgEl.style.color = "#1f5f3a";
      return;
    }

    msgEl.style.color = "#222";
  }

  async function fetchDeckState(deckId) {
    const token = getToken();

    if (!token) {
      throw new Error("Token no encontrado");
    }

    const response = await fetch(`/mazo/${deckId}/state`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error("No se pudo cargar el estado del mazo");
    }

    const data = await response.json();
    return data?.state || data || {};
  }

  async function fetchPlayById(playId) {
    if (!playId) return null;

    const token = getToken();
    if (!token) return null;

    try {
      const response = await fetch(`/plays/${playId}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) {
        console.warn("No se pudo leer la jugada aprobada");
        return null;
      }

      const data = await response.json();
      return data?.play || data || null;
    } catch (error) {
      console.warn("Falló la lectura de la jugada aprobada", error);
      return null;
    }
  }

  async function fetchMe() {
    const token = getToken();

    if (!token) {
      throw new Error("Token no encontrado");
    }

    const response = await fetch("/me", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error("No se pudo cargar el usuario actual");
    }

    const data = await response.json();
    return data?.user || data || null;
  }

  function resolveCurrentUser(state, me) {
    return (
      me ||
      state?.currentUser ||
      state?.viewer ||
      window.__currentUser ||
      null
    );
  }

  function getDeckAvatarSrc(deck) {
    const raw =
      deck?.deck_image_url ||
      deck?.image_url ||
      deck?.photo_url ||
      deck?.avatar ||
      "";

    return String(raw).trim() || "/assets/icons/sinPicture.gif";
  }

  function getCurrencyCode(deck) {
    return String(deck?.currency_symbol || "").trim().toUpperCase();
  }

  function getCurrencyName(deck) {
    return (
      String(deck?.currency_name || "").trim() ||
      String(deck?.currency_label || "").trim() ||
      ""
    );
  }

  function renderPlacard(deck) {
    const host = getEl("jokerBlueApprovedPlacard");
    if (!host) return;
    if (typeof window.renderPlacard !== "function") return;

    window.renderPlacard(host, {
      photoUrl: getDeckAvatarSrc(deck),
      rank: "JOKER",
      suit: "BLUE",
      title: deck?.name || "Joker azul aprobado",
      currencyCode: getCurrencyCode(deck),
      currencyName: getCurrencyName(deck),
      showCurrency: false
    });
  }

  function getViewerName(user) {
    return (
      user?.nickname ||
      user?.full_name ||
      user?.name ||
      `Usuario ${user?.id || ""}`
    );
  }

  function getViewerPhoto(user) {
    return user?.profile_photo_url || "/assets/icons/singeta120.gif";
  }

  function renderEnabledActionsPanel() {
    return `
      <div class="lienzo-server-next">
        <div class="lienzo-server-next__title">Ahora se habilita</div>

        <div class="lienzo-server-next__item">
          <img
            src="/assets/icons/Sello40.gif"
            alt="Aprobar"
            class="lienzo-server-next__icon"
          />
          <span class="lienzo-server-next__label">Aprobar J</span>
        </div>

        <div class="lienzo-server-next__item">
          <img
            src="/assets/icons/buzon60.gif"
            alt="Enviar"
            class="lienzo-server-next__icon"
          />
          <span class="lienzo-server-next__label">Enviar Q</span>
        </div>

        <div class="lienzo-server-next__item">
          <img
            src="/assets/icons/pistola60.gif"
            alt="Despedir"
            class="lienzo-server-next__icon"
          />
          <span class="lienzo-server-next__label">Despedir Q</span>
        </div>

        <div class="lienzo-server-next__item">
          <img
            src="/assets/icons/joker_blue.gif"
            alt="Joker azul"
            class="lienzo-server-next__icon"
          />
          <span class="lienzo-server-next__label">Mazo certificado</span>
        </div>
      </div>
    `;
  }

  function renderLeftInitial(user) {
    return `
      <section class="lienzo-panel lienzo-panel--source">
        <div class="lienzo-source-header">
          <img
            class="lienzo-source-header__photo"
            src="${escapeHtml(getViewerPhoto(user))}"
            alt="${escapeHtml(getViewerName(user))}"
          />
          <div class="lienzo-source-header__name">
            ${escapeHtml(getViewerName(user))}
          </div>
        </div>

        <div class="lienzo-source-cards">
          <div class="lienzo-card-wrap">
            <img
              id="jokerBlueApprovedSourceCard"
              src="/assets/icons/joker_blue.gif"
              alt="Joker azul"
              class="lienzo-card-image"
            />
          </div>
        </div>
      </section>
    `;
  }

  function renderRightInitial() {
    return `
      <section class="lienzo-panel lienzo-panel--target">
        <div class="lienzo-panel__header">
          <div class="lienzo-panel__title">Aprobado por CoopTrack server</div>
          <div class="lienzo-panel__subtitle">
            La certificación fue concedida. El Joker azul pasa a formar parte del mazo.
          </div>
        </div>

        <div id="jokerBlueApprovedTargetZone" class="lienzo-card-wrap"></div>

        <div
          id="jokerBlueApprovedMsg"
          class="lienzo-card-text"
          style="margin-top: 14px;"
        >
          Resolviendo concesión...
        </div>

        <div class="lienzo-target-actions" style="margin-top:16px;">
          <button id="jokerBlueApprovedContinueBtn" class="icon-btn" type="button" title="Volver al mazo" aria-label="Volver al mazo">
            <img src="/assets/icons/exit80.gif" alt="Salir" />
          </button>
        </div>
      </section>
    `;
  }

  function renderApprovedScene(deck, user) {
    const left = getEl("colombes");
    const right = getEl("amsterdam");

    if (!left || !right) return;

    left.innerHTML = renderLeftInitial(user);
    right.innerHTML = renderRightInitial();

    bindContinueButton(deck);
  }

  function revealEnabledActions(user) {
    const left = getEl("colombes");
    if (!left) return;

    left.innerHTML = `
      <section class="lienzo-panel lienzo-panel--source">
        <div class="lienzo-source-header">
          <img
            class="lienzo-source-header__photo"
            src="${escapeHtml(getViewerPhoto(user))}"
            alt="${escapeHtml(getViewerName(user))}"
          />
          <div class="lienzo-source-header__name">
            ${escapeHtml(getViewerName(user))}
          </div>
        </div>

        <div class="lienzo-source-cards">
          ${renderEnabledActionsPanel()}
        </div>
      </section>
    `;
  }

  function renderDeliveredOnRight() {
    const target = getEl("jokerBlueApprovedTargetZone");
    if (!target) return;

    target.innerHTML = `
      <img
        src="/assets/icons/joker_blue.gif"
        alt="Joker azul concedido"
        class="lienzo-card-image"
      />
    `;
  }

  function animateApprovedJoker(user) {
    if (animationState.jokerDelivered) return;

    const source = getEl("jokerBlueApprovedSourceCard");
    const targetZone = getEl("jokerBlueApprovedTargetZone");

    if (!source || !targetZone) {
      revealEnabledActions(user);
      renderDeliveredOnRight();
      setMessage("Certificación concedida.", "success");
      animationState.jokerDelivered = true;
      return;
    }

    const sourceRect = source.getBoundingClientRect();
    const targetRect = targetZone.getBoundingClientRect();

    const ghost = source.cloneNode(true);
    ghost.style.position = "fixed";
    ghost.style.left = sourceRect.left + "px";
    ghost.style.top = sourceRect.top + "px";
    ghost.style.width = sourceRect.width + "px";
    ghost.style.height = sourceRect.height + "px";
    ghost.style.margin = "0";
    ghost.style.zIndex = "9999";
    ghost.style.pointerEvents = "none";
    ghost.style.transition = "all 650ms ease";

    document.body.appendChild(ghost);
    source.style.visibility = "hidden";

    const targetX =
      targetRect.left + targetRect.width / 2 - sourceRect.width / 2;
    const targetY =
      targetRect.top + targetRect.height / 2 - sourceRect.height / 2;

    requestAnimationFrame(() => {
      ghost.style.left = targetX + "px";
      ghost.style.top = targetY + "px";
      ghost.style.transform = "scale(1.03)";
    });

    ghost.addEventListener(
      "transitionend",
      () => {
        if (ghost.parentNode) {
          ghost.remove();
        }

        animationState.jokerDelivered = true;
        revealEnabledActions(user);
        renderDeliveredOnRight();
        setMessage("Certificación concedida. Ya tenés nuevos juguetes.", "success");
      },
      { once: true }
    );
  }

  function bindContinueButton(deck) {
    const btn = getEl("jokerBlueApprovedContinueBtn");
    if (!btn) return;

    btn.addEventListener("click", () => {
      const deckId = Number(deck?.id || 0);

      if (!deckId) {
        window.location.href = "/mazos.html";
        return;
      }

      window.location.href = `/mazo.html?id=${deckId}`;
    });
  }

  function isApprovedPlay(play) {
    const status = String(play?.play_status || play?.status || "")
      .trim()
      .toUpperCase();

    return status === "APPROVED" || status === "ACTIVE";
  }

  async function initApprovedPage() {
    try {
      const { deckId, playId } = getParams();

      if (!deckId) {
        throw new Error("Falta deckId en la URL");
      }

      const [state, me, play] = await Promise.all([
        fetchDeckState(deckId),
        fetchMe().catch(() => null),
        fetchPlayById(playId).catch(() => null)
      ]);

      const deck = state?.deck || state?.mazo || {};
      const user = resolveCurrentUser(state, me);

      window.__currentState = state;
      window.__currentDeck = deck;
      window.__currentUser = user;

      renderPlacard(deck);
      renderApprovedScene(deck, user);

      if (playId && play && !isApprovedPlay(play)) {
        setMessage("La solicitud todavía no figura como aprobada.", "error");
        return;
      }

      setTimeout(() => {
        animateApprovedJoker(user);
      }, 250);
    } catch (error) {
      console.error("Error iniciando jokerazul-approved:", error);
      setMessage(error.message || "No se pudo abrir la concesión.", "error");

      const left = getEl("colombes");
      const right = getEl("amsterdam");

      if (left) {
        left.innerHTML = `
          <section class="lienzo-panel">
            <div class="lienzo-card-text">No se pudo cargar Colombes.</div>
          </section>
        `;
      }

      if (right) {
        right.innerHTML = `
          <section class="lienzo-panel">
            <div class="lienzo-card-text">No se pudo cargar Amsterdam.</div>
          </section>
        `;
      }
    }
  }

  document.addEventListener("DOMContentLoaded", initApprovedPage);
})();