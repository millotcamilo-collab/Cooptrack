(function () {
  function normalizeRank(value) {
    return String(value || "").trim().toUpperCase();
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

  function getCurrentDeck() {
    const state = getCurrentState();
    return (
      state?.deck ||
      state?.mazo ||
      window.__currentDeck ||
      {}
    );
  }

  function parseLocalReferenceDate(value) {
    if (!value) return null;

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
        /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/
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

  function parseDraggedCardPayload(event) {
    try {
      const json = event.dataTransfer.getData("application/json");
      if (!json) return null;

      const payload = JSON.parse(json);

      return {
        source: String(payload?.source || "").trim(),
        rank: normalizeRank(payload?.rank),
        suit: normalizeSuit(payload?.suit),
        cardId: payload?.cardId || null,
        isVirtual: Boolean(payload?.isVirtual)
      };
    } catch (error) {
      console.warn("No se pudo parsear drag payload", error);
      return null;
    }
  }

  function canDropCardOnZone(card, zoneName) {
    const rank = normalizeRank(card?.rank);
    const suit = normalizeSuit(card?.suit);
    const zone = String(zoneName || "").trim().toUpperCase();

    if (rank === "Q" && suit === "HEART") {
      return zone === "COLOMBES" || zone === "AMSTERDAM";
    }

    if ((rank === "A" || rank === "K")) {
      return zone === "COLOMBES";
    }

    return false;
  }

  function getCardLabel(rank, suit) {
    const symbol = getSuitSymbol(suit);
    return `${normalizeRank(rank)}${symbol}`;
  }

  function setLienzoDropSelection(selection) {
    window.__lienzoDropSelection = selection || null;
  }

  function getLienzoDropSelection() {
    return window.__lienzoDropSelection || null;
  }

  function renderDroppedCardPreview(container, selection) {
    if (!container) return;

    const preview = container.querySelector(".lienzo-drop-preview");
    if (!preview) return;

    if (!selection?.rank || !selection?.suit) {
      preview.innerHTML = "";
      return;
    }

    const imageSrc = getCardImageSrc(selection.rank, selection.suit);
    const label = getCardLabel(selection.rank, selection.suit);

    preview.innerHTML = `
    <div class="lienzo-drop-preview__card">
      <img
        class="lienzo-drop-preview__image"
        src="${escapeHtml(imageSrc)}"
        alt="${escapeHtml(label)}"
        title="${escapeHtml(label)}"
      />
    </div>
  `;
  }

  function resolveCalendarDateFromPlay(play) {
    if (!play) return null;

    const suit = normalizeSuit(play?.card_suit || play?.suit);
    const spadeMode = String(play?.spade_mode || "").trim().toUpperCase();

    let candidates = [];

    if (suit === "SPADE") {
      if (spadeMode === "APPOINTMENT") {
        candidates = [
          play?.start_date,
          play?.scheduled_for,
          play?.play_date,
          play?.date,
          play?.created_at
        ];
      } else if (spadeMode === "DEADLINE") {
        candidates = [
          play?.end_date,
          play?.scheduled_for,
          play?.play_date,
          play?.date,
          play?.created_at
        ];
      } else {
        candidates = [
          play?.start_date,
          play?.end_date,
          play?.scheduled_for,
          play?.play_date,
          play?.date,
          play?.created_at
        ];
      }
    } else {
      candidates = [
        play?.scheduled_for,
        play?.play_date,
        play?.date,
        play?.created_at
      ];
    }

    for (const value of candidates) {
      const parsed = parseLocalReferenceDate(value);
      if (parsed) return parsed;
    }

    return null;
  }

  function parsePlayReferenceDate(play) {
    const parentPlay = getPlayById(play?.parent_play_id);

    return (
      resolveCalendarDateFromPlay(parentPlay) ||
      resolveCalendarDateFromPlay(play) ||
      new Date()
    );
  }

  function startOfWeek(date) {
    const base = new Date(date);
    const day = base.getDay();
    const diff = (day + 6) % 7; // lunes = inicio
    base.setHours(0, 0, 0, 0);
    base.setDate(base.getDate() - diff);
    return base;
  }

  function isSameDay(a, b) {
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  }

  function renderWeekRow(referenceDate) {
    const start = startOfWeek(referenceDate);
    const labels = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const daysHtml = labels.map((label, index) => {
      const currentDate = new Date(start);
      currentDate.setDate(start.getDate() + index);

      const bodyHtml = "";

      if (typeof window.renderDia === "function") {
        return window.renderDia({
          headerText: `${label} ${currentDate.getDate()}`,
          bodyHtml,
          isCurrent: isSameDay(currentDate, referenceDate),
          isToday: isSameDay(currentDate, today),
          isOutsideMonth: currentDate.getMonth() !== referenceDate.getMonth(),
          extraClass: "lienzo-weekday lienzo-weekday--compact"
        });
      }

      return `
        <article class="dia lienzo-weekday">
          <div class="dia__header">${label}</div>
          <div class="dia__body">${bodyHtml}</div>
        </article>
      `;
    }).join("");

    return `
      <section class="lienzo-week-row-wrap">
        <div class="lienzo-week-row">
          ${daysHtml}
        </div>
      </section>
    `;
  }

  function getCurrentUser() {
    return window.__currentUser || null;
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

  function getLienzoContainer() {
    return document.getElementById("lienzo-container");
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

  function normalizePlayForTopCards(play) {
    if (!play) return null;

    const parsed = parsePlayCode(play.play_code);

    return {
      id: play.id || null,
      rank: parsed.rank || play.card_rank || play.rank || "",
      suit: parsed.suit || play.card_suit || play.suit || "",
      action: parsed.action || play.action || "",
      status: play.play_status || play.status || "",
      createdByUserId:
        Number(play.created_by_user_id || 0) ||
        Number(parsed.userId || 0),
      raw: play
    };
  }

  function compareEnabledTopCards(a, b) {
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

    const aKey = `${normalizeRank(a?.rank)}_${normalizeSuit(a?.suit)}`;
    const bKey = `${normalizeRank(b?.rank)}_${normalizeSuit(b?.suit)}`;

    return (order[aKey] || 999) - (order[bKey] || 999);
  }

  function getEnabledTopCardsForCurrentUser() {
    const plays = getAllPlays();
    const currentUser = getCurrentUser();
    const currentUserId = Number(currentUser?.id || 0);

    if (!currentUserId || !Array.isArray(plays)) {
      return [];
    }

    const cards = plays
      .map(normalizePlayForTopCards)
      .filter(Boolean)
      .filter((play) => {
        const rank = normalizeRank(play.rank);
        const suit = normalizeSuit(play.suit);
        const action = String(play.action || "").trim();
        const status = String(play.status || "").trim().toUpperCase();

        if (!["A", "K"].includes(rank)) return false;
        if (!["HEART", "SPADE", "DIAMOND", "CLUB"].includes(suit)) return false;
        if (status !== "ACTIVE") return false;
        if (action !== "puedeJugar") return false;

        return Number(play.createdByUserId || 0) === currentUserId;
      })
      .sort(compareEnabledTopCards);

    // 🔵 AGREGAR Q♥ SI HAY JOKER AZUL
    if (hasBlueJokerActive()) {
      cards.push({
        id: "virtual-Q-HEART",
        rank: "Q",
        suit: "HEART",
        isVirtual: true
      });
    }

    return cards;
  }

  function deriveOwnedCorporateCards(plays, currentUserId) {
    if (!Array.isArray(plays) || !currentUserId) return [];

    return plays
      .filter((p) => {
        const rank = normalizeRank(p.card_rank || p.rank);
        const suit = normalizeSuit(p.card_suit || p.suit);

        if (rank !== "A") return false;
        if (!["HEART", "SPADE", "DIAMOND", "CLUB"].includes(suit)) return false;

        const ownerId =
          Number(p.target_user_id || 0) ||
          Number(p.created_by_user_id || 0);

        return ownerId === Number(currentUserId);
      })
      .map((p) => ({
        id: p.id,
        card_rank: p.card_rank || p.rank,
        card_suit: p.card_suit || p.suit
      }));
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

  function getOwnedCorporateCardsForCurrentUser() {
    const plays = getAllPlays();
    const currentUser = getCurrentUser();
    const userId = Number(currentUser?.id || 0);

    if (!userId) return [];

    return deriveOwnedCorporateCards(plays, userId).sort(compareCorporateCards);
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

  function hasBlueJokerActive() {
    const plays = getAllPlays();

    if (!Array.isArray(plays)) return false;

    return plays.some((p) => {
      const parsed = parsePlayCode(p.play_code);

      const rank = normalizeRank(parsed.rank || p.card_rank || p.rank);
      const suit = normalizeSuit(parsed.suit || p.card_suit || p.suit);
      const status = String(p.play_status || p.status || "").toUpperCase();

      return rank === "JOKER" && suit === "BLUE" && status === "ACTIVE";
    });
  }

  function mountPlacardFromDataset() {
    const placardHost = document.getElementById("lienzo-placard");
    if (!placardHost) return;
    if (typeof window.renderPlacard !== "function") return;

    const enabledTopCards = getEnabledTopCardsForCurrentUser();

    window.renderPlacard(placardHost, {
      photoUrl: placardHost.dataset.photoUrl || "",
      rank: placardHost.dataset.rank || "A",
      suit: placardHost.dataset.suit || "HEART",
      title: placardHost.dataset.title || "Mazo",
      currencyCode: placardHost.dataset.currencyCode || "",
      currencyName: placardHost.dataset.currencyName || "",
      showCurrency: false,
      leftCards: enabledTopCards
    });
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

  function buildSourceCardsScene(play) {
    const ownedCards = getOwnedCorporateCardsForCurrentUser();

    const activeRank = normalizeRank(play?.card_rank || play?.rank);
    const activeSuit = normalizeSuit(play?.card_suit || play?.suit);

    const parentPlay = getPlayById(play?.parent_play_id);
    const parentRank = normalizeRank(parentPlay?.card_rank || parentPlay?.rank);
    const parentSuit = normalizeSuit(parentPlay?.card_suit || parentPlay?.suit);

    // Caso especial: Q♠
    if (activeRank === "Q" && activeSuit === "SPADE") {
      const stackCards = [];

      const clubAce = ownedCards.find((card) => {
        return (
          normalizeRank(card?.card_rank) === "A" &&
          normalizeSuit(card?.card_suit) === "CLUB"
        );
      });

      if (clubAce) {
        stackCards.push({
          id: clubAce.id,
          card_rank: clubAce.card_rank,
          card_suit: clubAce.card_suit
        });
      }

      if (parentPlay && parentRank === "J" && parentSuit === "SPADE") {
        stackCards.push({
          id: parentPlay.id,
          card_rank: parentPlay.card_rank || parentPlay.rank,
          card_suit: parentPlay.card_suit || parentPlay.suit
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

    // Caso general: K, A, etc.
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

  function resolveSourceUser(play) {
    const plays = getAllPlays();
    const sourceUserId =
      Number(play?.created_by_user_id || 0) ||
      Number(play?.target_user_id || 0);

    if (!sourceUserId) return null;

    const relatedPlay = plays.find((p) => {
      const candidateId =
        Number(p?.created_by_user_id || 0) ||
        Number(p?.target_user_id || 0);
      return candidateId === sourceUserId;
    });

    return {
      id: sourceUserId,
      nickname:
        play?.created_by_nickname ||
        relatedPlay?.created_by_nickname ||
        `Usuario ${sourceUserId}`,
      profile_photo_url:
        play?.created_by_profile_photo_url ||
        relatedPlay?.created_by_profile_photo_url ||
        "/assets/icons/singeta120.gif"
    };
  }

  function resolveTargetUser(play) {
    const targetUserId = Number(play?.target_user_id || 0);

    if (!targetUserId) return null;

    return {
      id: targetUserId,
      nickname:
        play?.target_user_nickname ||
        `Usuario ${targetUserId}`,
      profile_photo_url:
        play?.target_user_profile_photo_url ||
        "/assets/icons/singeta120.gif"
    };
  }

  function isCurrentUserSource(play) {
    const currentUser = getCurrentUser();
    const currentUserId = Number(currentUser?.id || 0);
    const sourceUserId = Number(play?.created_by_user_id || 0);

    return currentUserId && sourceUserId && currentUserId === sourceUserId;
  }

  function isCurrentUserTarget(play) {
    const currentUser = getCurrentUser();
    const currentUserId = Number(currentUser?.id || 0);
    const targetUserId = Number(play?.target_user_id || 0);

    return currentUserId && targetUserId && currentUserId === targetUserId;
  }

  function renderSourceActions(play) {
    const status = String(play?.play_status || "").trim().toUpperCase();
    const rank = normalizeRank(play?.card_rank || play?.rank);
    const suit = normalizeSuit(play?.card_suit || play?.suit);

    const exitIcon = window.ICONS?.actions?.exit || "/assets/icons/exit40.gif";

    const showSend =
      rank === "Q" &&
      suit === "SPADE" &&
      status !== "SENT" &&
      status !== "APPROVED" &&
      status !== "REJECTED" &&
      status !== "CANCELLED" &&
      status !== "ACKNOWLEDGED";

    const sendIcon = "/assets/icons/buzon60.gif";

    return `
    <div class="nuevo-mazo-target-actions nuevo-mazo-target-actions--top">
      ${showSend ? `
        <button id="lienzo-send-btn" class="icon-btn" title="Enviar">
          <img src="${sendIcon}" alt="Enviar" />
        </button>
      ` : ""}

      <button id="lienzo-exit-btn" class="icon-btn" title="Salir">
        <img src="${exitIcon}" alt="Salir" />
      </button>
    </div>
  `;
  }

  function renderTargetActions() {
    const acceptIcon = "/assets/icons/Sello40.gif";
    const rejectIcon = "/assets/icons/stepback40.gif";
    const exitIcon = window.ICONS?.actions?.exit || "/assets/icons/exit40.gif";

    return `
    <div class="nuevo-mazo-target-actions nuevo-mazo-target-actions--top">
      <button id="lienzo-accept-btn" class="icon-btn" title="Aceptar">
        <img src="${acceptIcon}" alt="Aceptar" />
      </button>

      <button id="lienzo-reject-btn" class="icon-btn" title="Rechazar">
        <img src="${rejectIcon}" alt="Rechazar" />
      </button>

      <button id="lienzo-exit-btn" class="icon-btn" title="Salir">
        <img src="${exitIcon}" alt="Salir" />
      </button>
    </div>
  `;
  }

  function bindLienzoActions(play) {
    const sendBtn = document.getElementById("lienzo-send-btn");
    const acceptBtn = document.getElementById("lienzo-accept-btn");
    const rejectBtn = document.getElementById("lienzo-reject-btn");
    const exitBtn = document.getElementById("lienzo-exit-btn");

    if (sendBtn) {
      sendBtn.addEventListener("click", () => {
        handleSendPlay(play);
      });
    }

    if (acceptBtn) {
      acceptBtn.addEventListener("click", () => {
        handleAcceptPlay(play);
      });
    }

    if (rejectBtn) {
      rejectBtn.addEventListener("click", () => {
        handleRejectPlay(play);
      });
    }

    if (exitBtn) {
      exitBtn.addEventListener("click", handleExitLienzo);
    }
  }

  async function handleSendPlay(play) {
    try {
      const playId = Number(play?.id || 0);
      const token = localStorage.getItem("cooptrackToken");

      if (!playId) {
        alert("playId inválido");
        return;
      }

      if (!token) {
        alert("No estás logueado");
        return;
      }

      const response = await fetch(`/plays/${playId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          play_status: "SENT"
        })
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        console.error("Error enviando jugada:", data);
        alert(data?.error || "No se pudo enviar la jugada");
        return;
      }

      alert("Invitación enviada");

      const deckId =
        Number(play?.deck_id || 0) ||
        Number(getCurrentDeck()?.id || 0);

      if (deckId) {
        window.location.href = `/mazo.html?id=${deckId}`;
        return;
      }

      window.history.back();
    } catch (error) {
      console.error("Error en handleSendPlay", error);
      alert("No se pudo enviar la jugada");
    }
  }

  async function autoAcknowledgeApprovedPlay(play) {
    try {
      const playId = Number(play?.id || 0);
      const token = localStorage.getItem("cooptrackToken");

      if (!playId || !token) return;

      const rank = normalizeRank(play?.card_rank || play?.rank);
      const suit = normalizeSuit(play?.card_suit || play?.suit);
      const status = String(play?.play_status || "").trim().toUpperCase();

      if (!(rank === "Q" && suit === "SPADE" && status === "APPROVED")) {
        return;
      }

      if (!isCurrentUserSource(play)) {
        return;
      }

      const response = await fetch(`/plays/${playId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          play_status: "ACKNOWLEDGED"
        })
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        console.error("No se pudo marcar como leída la confirmación:", data);
        return;
      }

      play.play_status = "ACKNOWLEDGED";
    } catch (error) {
      console.error("Error en autoAcknowledgeApprovedPlay", error);
    }
  }

  async function handleAcceptPlay(play) {
    try {
      const playId = Number(play?.id || 0);
      const token = localStorage.getItem("cooptrackToken");

      if (!playId) {
        alert("playId inválido");
        return;
      }

      if (!token) {
        alert("No estás logueado");
        return;
      }

      const response = await fetch(`/plays/${playId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          play_status: "APPROVED"
        })
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        console.error("Error aprobando jugada:", data);
        alert(data?.error || "No se pudo aprobar la jugada");
        return;
      }

      alert("Invitación aceptada");

      const deckId =
        Number(play?.deck_id || 0) ||
        Number(getCurrentDeck()?.id || 0);

      if (deckId) {
        window.location.href = `/mazo.html?id=${deckId}`;
        return;
      }

      window.history.back();

    } catch (error) {
      console.error("Error en handleAcceptPlay", error);
      alert("No se pudo aprobar la jugada");
    }
  }

  async function handleRejectPlay(play) {
    try {
      const playId = Number(play?.id || 0);
      const token = localStorage.getItem("cooptrackToken");

      if (!playId) {
        alert("playId inválido");
        return;
      }

      if (!token) {
        alert("No estás logueado");
        return;
      }

      const confirmed = window.confirm("¿Querés rechazar esta invitación?");
      if (!confirmed) {
        return;
      }

      const response = await fetch(`/plays/${playId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          play_status: "REJECTED"
        })
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        console.error("Error rechazando jugada:", data);
        alert(data?.error || "No se pudo rechazar la invitación");
        return;
      }

      alert("Invitación rechazada");
      window.location.href = "/archivo.html";
    } catch (error) {
      console.error("Error en handleRejectPlay", error);
      alert("No se pudo rechazar la invitación");
    }
  }

  function handleExitLienzo() {
    const deckId = Number(getCurrentDeck()?.id || 0);

    if (deckId) {
      window.location.href = `/mazo.html?id=${deckId}`;
      return;
    }

    window.history.back();
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

    const clockIcon = "/assets/icons/reloj60.gif";
    const bellIcon = "/assets/icons/campana60.gif";
    const bombIcon = "/assets/icons/bombaRedonda60.gif";

    let bodyHtml = "";

    if (spadeMode === "DEADLINE") {
      const endLabel = formatTimeLabel(play?.end_date);

      bodyHtml = `
      <div class="lienzo-session-dia__row">
        <img
          class="lienzo-session-dia__icon"
          src="${bombIcon}"
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
        src="${clockIcon}"
        alt="Inicio"
      />
      <span class="lienzo-session-dia__time">${escapeHtml(startLabel || "—")}</span>

      ${endLabel ? `
        <img
          class="lienzo-session-dia__icon"
          src="${bellIcon}"
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

  function buildPanelTopbar({ identityHtml, actionsHtml = "", single = false }) {
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
            </div>
          `
      }
    </div>
  `;
  }

  function renderSourcePlayerPanel(play) {
    const user = resolveSourceUser(play);
    const userPhoto = user?.profile_photo_url || "/assets/icons/singeta120.gif";
    const userName =
      user?.nickname ||
      user?.full_name ||
      user?.name ||
      "Anfitrión";

    const scene = buildSourceCardsScene(play);
    const showActionsHere = isCurrentUserSource(play);

    const parentPlay = getPlayById(play?.parent_play_id);
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
      actionsHtml: showActionsHere ? renderSourceActions(play) : ""
    });

    return `
    <section class="lienzo-panel lienzo-panel--source panel--split-top">
      ${topbar}

      <div class="lienzo-source-cards">
        <div class="lienzo-source-stack">
          ${scene.backgroundCards.map(renderBackgroundCard).join("")}
        </div>
      </div>

      ${sessionDiaHtml}
            <div
        id="lienzo-dropzone-colombes"
        class="lienzo-side-dropzone"
        data-dropzone="COLOMBES"
      >
        <div class="lienzo-side-dropzone__label">Colombes</div>
        <div class="lienzo-drop-preview"></div>
      </div>
    </section>
  `;
  }

  function renderTargetPlayerPanel(play) {
    const user = resolveTargetUser(play);
    const userPhoto = user?.profile_photo_url || "/assets/icons/singeta120.gif";
    const userName =
      user?.nickname ||
      user?.full_name ||
      user?.name ||
      "Invitado";

    const rank = normalizeRank(play?.card_rank || play?.rank);
    const suit = normalizeSuit(play?.card_suit || play?.suit);
    const imageSrc = getCardImageSrc(rank, suit);

    const showActionsHere = isCurrentUserTarget(play);
    const showWeekHere = isCurrentUserTarget(play);

    const topbar = buildPanelTopbar({
      identityHtml: `
      <div class="lienzo-target-header lienzo-target-header--top">
        <div class="lienzo-target-header__name">
          ${escapeHtml(userName)}
        </div>
        <img
          class="lienzo-target-header__photo"
          src="${escapeHtml(userPhoto)}"
          alt="${escapeHtml(userName)}"
        />
      </div>
    `,
      actionsHtml: showActionsHere ? renderTargetActions() : ""
    });

    return `
    <section class="lienzo-panel lienzo-panel--target panel--split-top">
      ${topbar}

      <div id="lienzo-target-dropzone" class="lienzo-target-dropzone">
        <img
          class="lienzo-card-image"
          src="${escapeHtml(imageSrc)}"
          alt=""
        />
      </div>

      <div
        id="lienzo-dropzone-amsterdam"
        class="lienzo-side-dropzone"
        data-dropzone="AMSTERDAM"
      >
        <div class="lienzo-side-dropzone__label">Amsterdam</div>
        <div class="lienzo-drop-preview"></div>
      </div>

      ${showWeekHere ? renderWeekRow(parsePlayReferenceDate(play)) : ""}
    </section>
  `;
  }

  function bindLienzoDropzones(play) {
    const zones = [
      {
        el: document.getElementById("lienzo-dropzone-colombes"),
        zoneName: "COLOMBES"
      },
      {
        el: document.getElementById("lienzo-dropzone-amsterdam"),
        zoneName: "AMSTERDAM"
      }
    ];

    zones.forEach(({ el, zoneName }) => {
      if (!el) return;

      el.addEventListener("dragover", (event) => {
        const card = parseDraggedCardPayload(event);
        if (!card) return;

        if (canDropCardOnZone(card, zoneName)) {
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
          el.classList.add("is-drag-valid");
          el.classList.remove("is-drag-invalid");
        } else {
          el.classList.add("is-drag-invalid");
          el.classList.remove("is-drag-valid");
        }
      });

      el.addEventListener("dragleave", () => {
        el.classList.remove("is-drag-valid");
        el.classList.remove("is-drag-invalid");
      });

      el.addEventListener("drop", (event) => {
        const card = parseDraggedCardPayload(event);
        el.classList.remove("is-drag-valid");
        el.classList.remove("is-drag-invalid");

        if (!card) return;
        if (!canDropCardOnZone(card, zoneName)) return;

        event.preventDefault();

        const selection = {
          targetZone: zoneName,
          rank: card.rank,
          suit: card.suit,
          cardId: card.cardId,
          isVirtual: card.isVirtual,
          playId: Number(play?.id || 0)
        };

        setLienzoDropSelection(selection);

        const colombesZone = document.getElementById("lienzo-dropzone-colombes");
        const amsterdamZone = document.getElementById("lienzo-dropzone-amsterdam");

        renderDroppedCardPreview(
          colombesZone,
          selection.targetZone === "COLOMBES" ? selection : null
        );

        renderDroppedCardPreview(
          amsterdamZone,
          selection.targetZone === "AMSTERDAM" ? selection : null
        );
      });
    });
  }

  function renderLienzo(play) {
    const container = getLienzoContainer();
    const deck = getCurrentDeck();

    if (!container || !play) return;

    container.innerHTML = `
      ${renderDeckHeader(deck)}

      <div class="lienzo-grid">
        <div id="colombes" class="lienzo-grid__left">
          ${renderSourcePlayerPanel(play)}
        </div>

        <div id="amsterdam" class="lienzo-grid__right">
          ${renderTargetPlayerPanel(play)}
        </div>
      </div>
    `;

    mountPlacardFromDataset();
    bindLienzoActions(play);
    bindLienzoDropzones(play);
  }

  async function openLienzoByPlayId(playId) {
    const play = getPlayById(playId);

    if (!play) {
      const container = getLienzoContainer();
      if (container) {
        container.innerHTML = `
        <div class="lienzo-error">
          No se encontró la jugada ${escapeHtml(playId)}.
        </div>
      `;
      }
      return;
    }

    await autoAcknowledgeApprovedPlay(play);
    renderLienzo(play);
  }

  window.openLienzoByPlayId = openLienzoByPlayId;
})();