(function () {
  function normalizeRank(value) {
    return String(value || "").trim().toUpperCase();
  }

  window.__lienzoAnimationState = window.__lienzoAnimationState || {
    sourceCardDelivered: false
  };

  function bindActionButtons() {
    const saveBtn = document.getElementById("lienzo-save-btn");
    const exitBtn = document.getElementById("lienzo-exit-btn");

    if (saveBtn) {
      saveBtn.addEventListener("click", handleSavePlay);
    }

    if (exitBtn) {
      exitBtn.addEventListener("click", handleExit);
    }
  }
  async function handleSavePlay() {
    try {
      const draft = window.__lienzoNewDraft;
      const token = localStorage.getItem("cooptrackToken");

      if (!draft?.deckId) {
        alert("Deck inválido");
        return;
      }

      if (!draft?.parentPlayId) {
        alert("Falta la jugada madre");
        return;
      }

      if (!draft?.card_rank || !draft?.card_suit) {
        alert("Falta la carta a crear");
        return;
      }

      if (!draft?.target_user_id) {
        alert("Seleccioná un destinatario");
        return;
      }

      if (!token) {
        alert("No estás logueado");
        return;
      }

      const userId =
        window.__currentState?.userId ||
        window.__currentUser?.id ||
        null;

      if (!userId) {
        alert("No se pudo identificar el usuario");
        return;
      }

      const when = new Date().toISOString();

      const playCode = [
        draft.deckId,
        userId,
        when,
        String(draft.card_rank).toUpperCase(),
        String(draft.card_suit).toUpperCase(),
        "create_from_lienzo",
        `U:${userId}`,
        `child_of:${draft.parentPlayId}`,
        `U:${draft.target_user_id}`
      ].join("§");

      const response = await fetch("/plays", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          deck_id: draft.deckId,
          parent_play_id: draft.parentPlayId,
          target_user_id: draft.target_user_id,
          play_code: playCode,
          text: draft.play_text || "",
          play_status: "ACTIVE"
        })
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        console.error("Error guardando jugada:", data);
        alert(data?.error || "No se pudo guardar la jugada");
        return;
      }

      const newPlay = data.play || null;
      const playId = Number(newPlay?.id || 0);

      if (!playId) {
        alert("La jugada se guardó, pero no volvió el id");
        return;
      }

      window.location.href = `/lienzo.html?deckId=${draft.deckId}&playId=${playId}`;
    } catch (error) {
      console.error("Error en SAVE", error);
      alert("No se pudo guardar la jugada");
    }
  }
  function handleExit() {
    const draft = window.__lienzoNewDraft;
    const deckId = draft?.deckId;

    if (!deckId) {
      window.location.href = "/mazos.html";
      return;
    }

    window.location.href = `/mazo.html?id=${deckId}`;
  }

  function getCurrentUserCorporateCards() {
    const state = getCurrentState();
    const plays = Array.isArray(state?.plays) ? state.plays : [];

    const currentUser = getCurrentUser();
    const userId = Number(currentUser?.id || 0);

    if (!userId) return [];

    const cards = deriveOwnedCorporateCards(plays, userId);

    return cards.sort(compareCorporateCards);
  }

  function compareCorporateCards(a, b) {
    const order = {
      A_HEART: 1,
      A_SPADE: 2,
      A_DIAMOND: 3,
      A_CLUB: 4,
      K_HEART: 5,
      K_SPADE: 6,
      K_DIAMOND: 7,
      K_CLUB: 8
    };

    const aKey = `${normalizeRank(a?.card_rank)}_${normalizeSuit(a?.card_suit)}`;
    const bKey = `${normalizeRank(b?.card_rank)}_${normalizeSuit(b?.card_suit)}`;

    return (order[aKey] || 999) - (order[bKey] || 999);
  }

  function buildSourceCardsScene(draft) {
    const ownedCards = getCurrentUserCorporateCards();

    const activeRank = normalizeRank(draft?.card_rank);
    const activeSuit = normalizeSuit(draft?.card_suit);

    const parentPlay = draft?.parentPlay || null;
    const parentRank = normalizeRank(parentPlay?.card_rank || parentPlay?.rank);
    const parentSuit = normalizeSuit(parentPlay?.card_suit || parentPlay?.suit);

    // Caso especial: Q♠
    if (activeRank === "Q" && activeSuit === "SPADE") {
      const stackCards = [];

      // 1) A♣ si lo tiene
      const clubAce = ownedCards.find((card) => {
        return (
          normalizeRank(card?.card_rank) === "A" &&
          normalizeSuit(card?.card_suit) === "CLUB"
        );
      });

      if (clubAce) {
        stackCards.push({
          card_rank: clubAce.card_rank,
          card_suit: clubAce.card_suit,
          id: clubAce.id
        });
      }

      // 2) J♠ madre
      if (parentPlay && parentRank === "J" && parentSuit === "SPADE") {
        stackCards.push({
          card_rank: parentPlay.card_rank || parentPlay.rank,
          card_suit: parentPlay.card_suit || parentPlay.suit,
          id: parentPlay.id
        });
      }

      return {
        backgroundCards: stackCards,
        activeCard: {
          card_rank: activeRank,
          card_suit: activeSuit
        }
      };
    }

    // Caso general: deja detrás las corporativas menos la activa
    const backgroundCards = ownedCards.filter((card) => {
      const rank = normalizeRank(card?.card_rank);
      const suit = normalizeSuit(card?.card_suit);

      return !(rank === activeRank && suit === activeSuit);
    });

    return {
      backgroundCards,
      activeCard: {
        card_rank: activeRank,
        card_suit: activeSuit
      }
    };
  }

  function renderBackgroundCard(card, index) {
    const src = getCardImageSrc(card?.card_rank, card?.card_suit);

    return `
    <img
      class="lienzo-source-stack__card"
      src="${escapeHtml(src)}"
      alt=""
      style="left:${index * 18}px;"
    />
  `;
  }
  function animateCardToUser(user) {
    const source = document.getElementById("lienzo-source-card");
    if (!source) {
      console.warn("No hay carta origen");
      return;
    }

    const rect = source.getBoundingClientRect();

    // 👻 crear carta fantasma
    const ghost = source.cloneNode(true);
    ghost.style.position = "fixed";
    ghost.style.left = rect.left + "px";
    ghost.style.top = rect.top + "px";
    ghost.style.width = rect.width + "px";
    ghost.style.height = rect.height + "px";
    ghost.style.margin = "0";
    ghost.style.zIndex = "9999";
    ghost.style.transition = "all 450ms ease";
    ghost.style.pointerEvents = "none";

    document.body.appendChild(ghost);

    // ocultar carta original
    source.style.visibility = "hidden";

    // 🎯 destino (centro del panel derecho por ahora)
    const container = document.querySelector(".lienzo-grid__right");
    const targetRect = container.getBoundingClientRect();

    const targetX = targetRect.left + targetRect.width / 2 - rect.width / 2;
    const targetY = targetRect.top + targetRect.height / 3;

    requestAnimationFrame(() => {
      ghost.style.left = targetX + "px";
      ghost.style.top = targetY + "px";
      ghost.style.transform = "scale(1.05)";
    });

    ghost.addEventListener("transitionend", () => {
      if (!ghost.parentNode) return;

      ghost.remove();

      window.__lienzoAnimationState = {
        ...(window.__lienzoAnimationState || {}),
        sourceCardDelivered: true
      };

      const leftContainer = document.querySelector(".lienzo-grid__left");
      if (leftContainer) {
        leftContainer.innerHTML = renderSourcePlayerPanel(window.__lienzoNewDraft);
      }

      renderAssignedTargetPanel(user);

      bindActionButtons();

      setTimeout(() => {
        mountCardInTarget(source);
      }, 50);
    });
  }

  function mountCardInTarget(sourceCard) {
    const dropzone = document.getElementById("lienzo-target-dropzone");
    if (!dropzone) return;

    const card = sourceCard.cloneNode(true);

    card.style.visibility = "visible";
    card.removeAttribute("id");

    dropzone.appendChild(card);
  }

  function renderAssignedTargetPanel(user) {
    const container = document.querySelector(".lienzo-grid__right");
    if (!container) return;

    const photo =
      user?.profile_photo_url || "/assets/icons/singeta120.gif";

    const name =
      user?.nickname ||
      user?.full_name ||
      user?.name ||
      `Usuario ${user?.id || ""}`;

    container.innerHTML = `
    <section class="lienzo-panel lienzo-panel--target">
      <div class="lienzo-target-header">
        <img
          class="lienzo-target-header__photo"
          src="${photo}"
          alt="${name}"
        />
        <div class="lienzo-target-header__name">
          ${name}
        </div>
      </div>

      <div id="lienzo-target-dropzone" class="lienzo-target-dropzone">
        <!-- acá aterriza la carta -->
      </div>
    </section>
  `;
  }

  function renderActionButtons() {
    const saveIcon = window.ICONS?.actions?.save || "/assets/icons/salvar40.gif";
    const exitIcon = window.ICONS?.actions?.exit || "/assets/icons/exit40.gif";

    return `
    <div class="lienzo-actions">
      <button id="lienzo-save-btn" class="icon-btn" title="Salvar">
        <img src="${saveIcon}" alt="Salvar" />
      </button>

      <button id="lienzo-exit-btn" class="icon-btn" title="Exit">
        <img src="${exitIcon}" alt="Exit" />
      </button>
    </div>
  `;
  }

  function normalizeSuit(value) {
    return String(value || "").trim().toUpperCase();
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function getCurrentState() {
    return window.__currentState || {};
  }

  function getAllPlays() {
    const state = getCurrentState();
    return Array.isArray(state.plays) ? state.plays : [];
  }

  function deriveOwnedCorporateCards(plays, currentUserId) {
    if (!Array.isArray(plays) || !currentUserId) return [];

    return plays
      .filter((p) => {
        const rank = String(p.card_rank || p.rank || "").toUpperCase();
        const suit = String(p.card_suit || p.suit || "").toUpperCase();

        if (rank !== "A") return false;

        // 👇 propiedad por "nombre en el libro"
        const ownerId =
          Number(p.target_user_id || 0) ||
          Number(p.created_by_user_id || 0);

        return ownerId === Number(currentUserId);
      })
      .map((p) => ({
        card_rank: p.card_rank || p.rank,
        card_suit: p.card_suit || p.suit,
        id: p.id
      }));
  }

  function getCurrentDeck() {
    const state = getCurrentState();

    return (
      state?.deck ||
      state?.mazo ||
      window.__currentDeck ||
      {}
    );
  }
  function getPlayById(playId) {
    const id = Number(playId || 0);
    if (!id) return null;

    return getAllPlays().find((play) => Number(play?.id || 0) === id) || null;
  }

  function getSuitSymbol(suit) {
    const s = normalizeSuit(suit);

    if (s === "HEART") return "♥";
    if (s === "SPADE") return "♠";
    if (s === "DIAMOND") return "♦";
    if (s === "CLUB") return "♣";

    return "";
  }

  function getCardImageSrc(rank, suit) {
    const r = normalizeRank(rank);
    const s = normalizeSuit(suit);

    const map = {
      A_HEART: "/assets/icons/Acorazon.gif",
      A_SPADE: "/assets/icons/Apike.gif",
      A_DIAMOND: "/assets/icons/Adiamante.gif",
      A_CLUB: "/assets/icons/Atrebol.gif",

      K_HEART: "/assets/icons/Kcorazon.gif",
      K_SPADE: "/assets/icons/Kpike.gif",
      K_DIAMOND: "/assets/icons/Kdiamante.gif",
      K_CLUB: "/assets/icons/Ktrebol.gif",

      Q_HEART: "/assets/icons/Qcorazon.gif",
      Q_SPADE: "/assets/icons/Qpike.gif",
      Q_DIAMOND: "/assets/icons/Qdiamante.gif",
      Q_CLUB: "/assets/icons/Qtrebol.gif",

      J_HEART: "/assets/icons/Jcorazon.gif",
      J_SPADE: "/assets/icons/Jpike.gif",
      J_DIAMOND: "/assets/icons/Jdiamante.gif",
      J_CLUB: "/assets/icons/Jtrebol.gif"
    };

    return map[`${r}_${s}`] || "/assets/icons/Dorso70.gif";
  }

  function getDeckAvatarSrc(deck) {
    console.log("deck completo =", deck);
    console.log("posibles campos imagen =", {
      deck_image_url: deck?.deck_image_url,
      image_url: deck?.image_url,
      photo_url: deck?.photo_url,
      avatar: deck?.avatar
    });

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

  function getBalanceValue(deck) {
    const value = deck?.viewer_balance;

    if (value === null || value === undefined || value === "") {
      return "0";
    }

    return String(value);
  }

  function getLienzoContainer() {
    return document.getElementById("lienzo-container");
  }

  function getLienzoNewParams() {
    const params = new URLSearchParams(window.location.search);

    return {
      deckId: Number(params.get("deckId") || 0),
      parentPlayId: Number(params.get("parentPlayId") || 0),
      childRank: normalizeRank(params.get("childRank")),
      childSuit: normalizeSuit(params.get("childSuit"))
    };
  }

  function buildDraftFromParams() {
    const { deckId, parentPlayId, childRank, childSuit } = getLienzoNewParams();
    const parentPlay = getPlayById(parentPlayId);
    const deck = getCurrentDeck();
    const currentUser = getCurrentUser();

    return {
      mode: "new",
      deckId: deckId || Number(deck?.id || 0),
      parentPlayId,
      parentPlay,
      card_rank: childRank,
      card_suit: childSuit,
      target_user_id: currentUser?.id || null,
      target_user: currentUser || null,
      play_text: "",
      status: "DRAFT"
    };
  }

  function renderDeckHeader(deck) {
    const avatarSrc = getDeckAvatarSrc(deck);
    const deckName = deck?.name || "Mazo";
    const currencyCode = getCurrencyCode(deck);
    const currencyName =
      String(deck?.currency_name || "").trim() ||
      String(deck?.currency_label || "").trim() ||
      "";

    return `
    <div
      id="lienzo-placard"
      data-photo-url="${escapeHtml(avatarSrc)}"
      data-rank="A"
      data-suit="HEART"
      data-title="${escapeHtml(deckName)}"
      data-currency-code="${escapeHtml(currencyCode)}"
      data-currency-name="${escapeHtml(currencyName)}"
    ></div>
  `;
  }

  function mountPlacardFromDataset() {
    const placardHost = document.getElementById("lienzo-placard");
    if (!placardHost) return;
    if (typeof window.renderPlacard !== "function") return;

    window.renderPlacard(placardHost, {
      photoUrl: placardHost.dataset.photoUrl || "",
      rank: placardHost.dataset.rank || "A",
      suit: placardHost.dataset.suit || "HEART",
      title: placardHost.dataset.title || "Mazo",
      currencyCode: placardHost.dataset.currencyCode || "",
      currencyName: placardHost.dataset.currencyName || "",
      showCurrency: false
    });
  }

  function bindDeckHeaderExit() {
    const btn = document.getElementById("lienzo-exit-btn");
    if (!btn) return;

    const deck = getCurrentDeck();
    const deckId = Number(deck?.id || getCurrentState()?.deckId || 0);

    btn.addEventListener("click", () => {
      if (deckId) {
        window.location.href = `/mazo.html?id=${deckId}`;
        return;
      }

      window.history.back();
    });
  }

  function buildPanelTopbar({ identityHtml, actionsHtml, single = false }) {
    return `
    <div class="panel-topbar ${single ? "panel-topbar--single" : ""}">
      <div class="panel-topbar__col panel-topbar__col--identity">
        ${identityHtml}
      </div>
      ${single
        ? ""
        : `
      <div class="panel-topbar__col panel-topbar__col--actions">
        ${actionsHtml}
      </div>`
      }
    </div>
  `;
  }

  function renderUsersPanel() {
    const topbar = buildPanelTopbar({
      identityHtml: `
      <div class="lienzo-target-header lienzo-target-header--top">
        <div class="lienzo-target-header__name">
          Destinatario
        </div>
        <img
          class="lienzo-target-header__photo"
          src="/assets/icons/singeta120.gif"
          alt="Destinatario"
        />
      </div>
    `,
      single: true
    });

    return `
    <section class="lienzo-panel lienzo-panel--users panel--split-top">
      ${topbar}

      <div id="lienzo-users-picker" class="lienzo-users-picker"></div>
    </section>
  `;
  }

  async function refreshCurrentUser() {
    try {
      const token = localStorage.getItem("cooptrackToken");
      if (!token) return getCurrentUser();

      const response = await fetch("/me", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) {
        return getCurrentUser();
      }

      const data = await response.json();
      const freshUser = data?.user || null;

      if (freshUser) {
        window.__currentUser = freshUser;

        window.__currentState = {
          ...(window.__currentState || {}),
          currentUser: freshUser
        };
      }

      return freshUser || getCurrentUser();
    } catch (error) {
      console.error("No se pudo refrescar el usuario actual", error);
      return getCurrentUser();
    }
  }

  function getCurrentUser() {
    return window.__currentUser || window.__currentState?.currentUser || null;
  }

  function pad2(value) {
    return String(value).padStart(2, "0");
  }

  function parseLocalDateTime(value) {
    if (!value) return null;

    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return value;
    }

    if (typeof value === "string") {
      const trimmed = value.trim();

      const onlyDateMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (onlyDateMatch) {
        const year = Number(onlyDateMatch[1]);
        const month = Number(onlyDateMatch[2]) - 1;
        const day = Number(onlyDateMatch[3]);
        return new Date(year, month, day);
      }

      const localDateTimeMatch = trimmed.match(
        /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/
      );
      if (localDateTimeMatch) {
        const year = Number(localDateTimeMatch[1]);
        const month = Number(localDateTimeMatch[2]) - 1;
        const day = Number(localDateTimeMatch[3]);
        const hour = Number(localDateTimeMatch[4]);
        const minute = Number(localDateTimeMatch[5]);
        return new Date(year, month, day, hour, minute, 0, 0);
      }
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed;
  }

  function getSessionDateFromPlay(play) {
    if (!play) return null;

    const suit = normalizeSuit(play?.card_suit || play?.suit);
    const spadeMode = String(play?.spade_mode || "").trim().toUpperCase();

    if (suit === "SPADE" && spadeMode === "DEADLINE") {
      return parseLocalDateTime(play?.end_date || play?.date || play?.created_at);
    }

    if (suit === "SPADE") {
      return parseLocalDateTime(
        play?.start_date ||
        play?.scheduled_for ||
        play?.play_date ||
        play?.date ||
        play?.created_at
      );
    }

    return parseLocalDateTime(
      play?.scheduled_for ||
      play?.play_date ||
      play?.date ||
      play?.created_at
    );
  }

  function formatSessionDayHeader(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
      return "—";
    }

    const weekdayMap = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
    const monthMap = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

    return `${weekdayMap[date.getDay()]} ${date.getDate()} ${monthMap[date.getMonth()]} ${date.getFullYear()}`;
  }

  function formatTimeLabel(value) {
    const date = parseLocalDateTime(value);
    if (!date) return "";

    return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
  }

  function renderSourceSessionDia(play) {
    if (!play || typeof window.renderDia !== "function") {
      return "";
    }

    const suit = normalizeSuit(play?.card_suit || play?.suit);
    if (suit !== "SPADE") {
      return "";
    }

    const spadeMode = String(play?.spade_mode || "").trim().toUpperCase();
    const sessionDate = getSessionDateFromPlay(play);

    if (!sessionDate) {
      return "";
    }

    let bodyHtml = "";

    if (spadeMode === "DEADLINE") {
      const endLabel = formatTimeLabel(play?.end_date);

      bodyHtml = `
      <div class="lienzo-session-dia__row">
        <img
          class="lienzo-session-dia__icon"
          src="/assets/icons/bombaRedonda60.gif"
          alt="Deadline"
        />
        <span class="lienzo-session-dia__time">${escapeHtml(endLabel || "—")}</span>
      </div>
    `;
    } else {
      const startLabel = formatTimeLabel(play?.start_date);
      const endLabel = formatTimeLabel(play?.end_date);
      const location = String(play?.location || "").trim();

      bodyHtml = `
      <div class="lienzo-session-dia__row">
        <img
          class="lienzo-session-dia__icon"
          src="/assets/icons/reloj60.gif"
          alt="Inicio"
        />
        <span class="lienzo-session-dia__time">${escapeHtml(startLabel || "—")}</span>

        ${endLabel ? `
          <img
            class="lienzo-session-dia__icon"
            src="/assets/icons/campana60.gif"
            alt="Fin"
          />
          <span class="lienzo-session-dia__time">${escapeHtml(endLabel)}</span>
        ` : ""}
      </div>

      ${location ? `
        <div class="lienzo-session-dia__row">
          <img
            class="lienzo-session-dia__icon"
            src="/assets/icons/LocGlobito.gif"
            alt="Lugar"
          />
          <span class="lienzo-session-dia__location">
            ${escapeHtml(location)}
          </span>
        </div>
      ` : ""}
    `;
    }

    return `
    <div class="lienzo-session-dia-wrap">
      ${window.renderDia({
      headerText: formatSessionDayHeader(sessionDate),
      bodyHtml,
      extraClass: "lienzo-session-dia"
    })}
    </div>
  `;
  }

  function renderSourcePlayerPanel(draft) {
    const user = getCurrentUser();
    const userPhoto = user?.profile_photo_url || "/assets/icons/singeta120.gif";
    const userName =
      user?.nickname ||
      user?.full_name ||
      user?.name ||
      "Creador";

    const scene = buildSourceCardsScene(draft);
    const delivered =
      window.__lienzoAnimationState?.sourceCardDelivered === true;

    const parentPlay = draft?.parentPlay || null;
    const sessionDiaHtml = renderSourceSessionDia(parentPlay);

    const topbar = buildPanelTopbar({
      identityHtml: `
      <div class="lienzo-source-header lienzo-source-header--top">
        <div class="lienzo-source-header__name">
          ${escapeHtml(userName)}
        </div>
        <img
          class="lienzo-source-header__photo"
          src="${escapeHtml(userPhoto)}"
          alt="${escapeHtml(userName)}"
        />
      </div>
    `,
      actionsHtml: delivered
        ? `
        <div class="nuevo-mazo-target-actions nuevo-mazo-target-actions--top">
          ${renderActionButtons()}
        </div>
      `
        : ``
    });

    return `
    <section class="lienzo-panel lienzo-panel--source panel--split-top">
      ${topbar}

      <div class="lienzo-source-cards">
        <div class="lienzo-source-stack">
          ${scene.backgroundCards.map(renderBackgroundCard).join("")}

          ${delivered
        ? ""
        : `
              <div class="lienzo-source-active">
                <img
                  id="lienzo-source-card"
                  class="lienzo-card-image"
                  src="${escapeHtml(
          getCardImageSrc(
            scene.activeCard.card_rank,
            scene.activeCard.card_suit
          )
        )}"
                  alt=""
                />
              </div>
            `}
        </div>
      </div>

      ${sessionDiaHtml}
    </section>
  `;
  }

  function renderDraftCardPanel(draft) {
    const rank = normalizeRank(draft?.card_rank);
    const suit = normalizeSuit(draft?.card_suit);
    const symbol = getSuitSymbol(suit);
    const imageSrc = getCardImageSrc(rank, suit);

    return `
      <section class="lienzo-panel lienzo-panel--card">

        <div class="lienzo-card-wrap">
          <img
            id="lienzo-source-card"
            class="lienzo-card-image"
            src="${escapeHtml(imageSrc)}"
            alt="Carta ${escapeHtml(rank)}${escapeHtml(symbol)}"
          />
        </div>
      </section>
    `;
  }

  function bindUsersPicker(draft) {
    const selectedBox = document.getElementById("lienzo-user-selected");

    if (typeof window.renderUsersPicker !== "function") {
      const picker = document.getElementById("lienzo-users-picker");
      if (picker) {
        picker.innerHTML = `
        <div class="lienzo-error">
          No se pudo cargar users.js
        </div>
      `;
      }
      return;
    }

    window.renderUsersPicker("lienzo-users-picker", {
      onSelect(user) {
        window.__lienzoNewDraft = {
          ...window.__lienzoNewDraft,
          target_user_id: Number(user?.id || 0) || null,
          target_user: user || null
        };

        if (!selectedBox) return;

        if (!user) {
          selectedBox.textContent = "Nadie seleccionado";
          return;
        }

        selectedBox.textContent =
          "Seleccionado: " +
          (user.nickname ||
            user.full_name ||
            user.name ||
            `Usuario ${user.id}`);
      },

      onAnimateSelect(user) {
        window.__lienzoNewDraft = {
          ...window.__lienzoNewDraft,
          target_user_id: Number(user?.id || 0) || null,
          target_user: user || null
        };

        if (selectedBox && user) {
          selectedBox.textContent =
            "Seleccionado: " +
            (user.nickname ||
              user.full_name ||
              user.name ||
              `Usuario ${user.id}`);
        }

        document.dispatchEvent(
          new CustomEvent("lienzo:animate-card-to-user", {
            detail: { user }
          })
        );
      }
    });
  }
  function bindCreateButton() {
    const btn = document.getElementById("lienzo-new-save-btn");
    if (!btn) return;

    btn.addEventListener("click", () => {
      const draft = window.__lienzoNewDraft || null;

      if (!draft) {
        alert("No se pudo armar el borrador.");
        return;
      }

      if (!draft.parentPlayId) {
        alert("Falta la jugada madre.");
        return;
      }

      if (!draft.card_rank || !draft.card_suit) {
        alert("Falta la carta a crear.");
        return;
      }

      if (!draft.target_user_id) {
        alert("Seleccioná un destinatario.");
        return;
      }

      document.dispatchEvent(
        new CustomEvent("lienzo:new-play", {
          detail: {
            deckId: draft.deckId,
            parentPlayId: draft.parentPlayId,
            childRank: draft.card_rank,
            childSuit: draft.card_suit,
            targetUserId: draft.target_user_id
          }
        })
      );
    });
  }

  async function renderNewLienzo() {
    await refreshCurrentUser();

    const container = getLienzoContainer();
    const deck = getCurrentDeck();
    const draft = buildDraftFromParams();

    if (!container) return;

    if (!draft.parentPlayId) {
      container.innerHTML = `
        <div class="lienzo-error">
          Falta parentPlayId en la URL.
        </div>
      `;
      return;
    }

    if (!draft.card_rank || !draft.card_suit) {
      container.innerHTML = `
        <div class="lienzo-error">
          Faltan childRank o childSuit en la URL.
        </div>
      `;
      return;
    }

    if (!draft.parentPlay) {
      container.innerHTML = `
        <div class="lienzo-error">
          No se encontró la jugada madre ${escapeHtml(draft.parentPlayId)}.
        </div>
      `;
      return;
    }

    window.__lienzoNewDraft = draft;

    container.innerHTML = `
  ${renderDeckHeader(deck)}

  <div class="lienzo-grid">
    <div id="colombes" class="lienzo-grid__left">
      ${renderSourcePlayerPanel(draft)}
    </div>

    <div id="amsterdam" class="lienzo-grid__right" id="lienzo-right-panel">
      ${renderUsersPanel()}
    </div>
  </div>
`;
    mountPlacardFromDataset();
    bindUsersPicker(draft);
  }
  document.addEventListener("lienzo:animate-card-to-user", (event) => {
    const user = event.detail?.user;
    if (!user) return;

    animateCardToUser(user);
  });



  window.openNewLienzo = renderNewLienzo;
  bindActionButtons();
})();
