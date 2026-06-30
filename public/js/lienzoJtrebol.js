(function () {
  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function normalizeRank(value) {
    return String(value || "").trim().toUpperCase();
  }

  function normalizeSuit(value) {
    return String(value || "").trim().toUpperCase();
  }

  function getCurrentState() {
    return window.__currentState || {};
  }

  function getCurrentDeck() {
    const state = getCurrentState();
    return state.deck || state.mazo || window.__currentDeck || {};
  }

  function getAllPlays() {
    const state = getCurrentState();
    return Array.isArray(state.plays) ? state.plays : [];
  }

  function getPlayById(playId) {
    const id = Number(playId || 0);
    if (!id) return null;
    return getAllPlays().find((play) => Number(play?.id || 0) === id) || null;
  }

  function getLienzoContainer() {
    return document.getElementById("lienzo-container");
  }

  function formatTime(value) {
    if (!value) return "";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";

    return date.toLocaleString("es-UY", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function getPlayOwnerUser(play) {
    const targetUserId = Number(play?.target_user_id || 0);

    if (targetUserId) {
      return {
        id: targetUserId,
        nickname: play?.target_user_nickname || `Usuario ${targetUserId}`,
        profile_photo_url:
          play?.target_user_profile_photo_url ||
          "/assets/icons/singeta120.gif"
      };
    }

    const sourceUserId = Number(play?.created_by_user_id || 0);

    return {
      id: sourceUserId || null,
      nickname: play?.created_by_nickname || (sourceUserId ? `Usuario ${sourceUserId}` : "Usuario"),
      profile_photo_url:
        play?.created_by_profile_photo_url ||
        "/assets/icons/singeta120.gif"
    };
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

  function getCardsOwnedByUser(userId) {
    const ownerId = Number(userId || 0);
    if (!ownerId) return [];

    const finalStatuses = ["QUIT", "FIRED", "REJECTED", "CANCELLED"];

    return getAllPlays()
      .filter((play) => {
        const rank = normalizeRank(play?.card_rank || play?.rank);
        const suit = normalizeSuit(play?.card_suit || play?.suit);
        const status = normalizeRank(play?.play_status || play?.status);

        if (!["A", "K"].includes(rank)) return false;
        if (!["HEART", "SPADE", "DIAMOND", "CLUB"].includes(suit)) return false;
        if (finalStatuses.includes(status)) return false;

        const cardOwnerId =
          Number(play?.target_user_id || 0) ||
          Number(play?.created_by_user_id || 0);

        return cardOwnerId === ownerId;
      })
      .map((play) => ({
        card_rank: normalizeRank(play?.card_rank || play?.rank),
        card_suit: normalizeSuit(play?.card_suit || play?.suit)
      }))
      .filter((card, index, self) => {
        const key = `${card.card_rank}_${card.card_suit}`;
        return index === self.findIndex((c) => `${c.card_rank}_${c.card_suit}` === key);
      })
      .sort(compareCorporateCards);
  }

  function renderDeckHeader(deck) {
    return `
      <div
        id="lienzo-placard"
        data-photo-url="${escapeHtml(deck.deck_image_url || "/assets/icons/sinPicture.gif")}" 
        data-title="${escapeHtml(deck.name || "Mazo")}" 
      ></div>
    `;
  }

  function mountPlacard(play) {
    const host = document.getElementById("lienzo-placard");
    if (!host || typeof window.renderPlacard !== "function") return;

    window.renderPlacard(host, {
      page: "lienzo-jtrebol",
      play,
      photoUrl: host.dataset.photoUrl,
      title: host.dataset.title,
      rank: "J",
      suit: "CLUB",
      showCurrency: false,
      leftCards: [],
      plays: getAllPlays()
    });
  }

  function renderColombes(play) {
    const ownerUser = getPlayOwnerUser(play);

    const cardHtml = typeof window.CartaTipo?.renderPlayCardBox === "function"
      ? window.CartaTipo.renderPlayCardBox({
          rank: "J",
          suit: "CLUB",
          title: play?.play_text || "J♣",
          play_text: play?.play_text || "",
          status: play?.play_status || play?.status || "",
          start_date: play?.start_date,
          end_date: play?.end_date,
          location: play?.location,
          ownerUser,
          ownerCards: getCardsOwnedByUser(ownerUser?.id),
          metas: [
            play?.start_date
              ? {
                  icon: "/assets/icons/reloj60.gif",
                  text: formatTime(play.start_date)
                }
              : null,
            play?.location
              ? {
                  icon: "/assets/icons/LocGlobito80.gif",
                  text: play.location
                }
              : null
          ].filter(Boolean),
          actionsHtml: "",
          showActions: false
        })
      : `
        <article class="lv2-play-card">
          <div class="lv2-play-card__body">
            <div class="lv2-play-card__title">J♣</div>
            <div class="lv2-play-card__text">${escapeHtml(play?.play_text || "Sin texto")}</div>
          </div>
        </article>
      `;

    return `
      <section class="lienzo-tribune lienzo-tribune--source">
        <div class="lienzo-tribune__corporates"></div>

        <div class="lienzo-tribune__stage lienzo-tribune__stage--column">
          <div class="amsterdam-card-stack">
            <div class="amsterdam-card-stack__primary">
              ${cardHtml}
            </div>
          </div>
        </div>
      </section>
    `;
  }

  function getChildPlays(parentPlayId) {
    return getAllPlays()
      .filter((play) => Number(play?.parent_play_id || 0) === Number(parentPlayId))
      .sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
  }

  function renderQtrebolChildRow(play) {
    if (typeof window.renderQpike === "function") {
      return `
        <div class="jpica-q-row" data-play-id="${Number(play?.id || 0)}">
          ${window.renderQpike(play, {
            deck: getCurrentDeck(),
            state: getCurrentState(),
            primarySuit: "CLUB",
            helpers: {
              escapeHtml,
              formatDate: formatTime,
              getCardLabel: () => "Q♣"
            }
          })}
        </div>
      `;
    }

    const ownerUser = getPlayOwnerUser(play);

    return `
      <div class="jpica-q-row" data-play-id="${Number(play?.id || 0)}">
        ${window.CartaTipo.renderPlayCardBox({
          rank: "Q",
          suit: "CLUB",
          title: play?.play_text || "Q♣",
          play_text: play?.play_text || "",
          status: play?.play_status || play?.status || "",
          start_date: play?.start_date,
          end_date: play?.end_date,
          location: play?.location,
          ownerUser,
          ownerCards: getCardsOwnedByUser(ownerUser?.id),
          actionsHtml: "",
          showActions: false
        })}
      </div>
    `;
  }

  function renderAmsterdam(play, options = {}) {
    const autoEditJHeartId = Number(options.autoEditJHeartId || 0);

    const childPlays = getChildPlays(play.id);

    return `
    <section class="lienzo-tribune lienzo-tribune--target">
      <div class="lienzo-tribune__corporates"></div>

      <div class="lienzo-tribune__stage lienzo-tribune__stage--column">
        <div class="lienzo-jpica-panel">
          <div class="jpica-users-header">
            <div class="jpica-child-actions">
              <button type="button" id="jtrebol-toggle-users-btn" class="jpica-child-btn">Q♣</button>
              <button type="button" id="jtrebol-create-jheart-btn" class="jpica-child-btn jpica-child-btn--heart">J♥</button>

              <button
                type="button"
                id="jtrebol-help-btn"
                class="jpica-child-btn"
                title="Ayuda"
              >
                <img src="${window.ICONS.actions.help}" alt="Ayuda" />
              </button>
            </div>

            <div id="jtrebol-users-picker" class="jpica-users-picker is-hidden"></div>
          </div>

          <div class="lienzo-jpica-invitations-list tablero">
            ${childPlays.length
              ? childPlays.map((child) => {
                  const rank = normalizeRank(child?.card_rank || child?.rank);
                  const suit = normalizeSuit(child?.card_suit || child?.suit);

                  if (rank === "Q" && suit === "CLUB") {
                    return renderQtrebolChildRow(child);
                  }

                  if (rank === "J" && suit === "HEART" && typeof window.renderJcorazon === "function") {
                    const shouldAutoEdit =
                      autoEditJHeartId > 0 &&
                      Number(child?.id || 0) === autoEditJHeartId;

                    return window.renderJcorazon(child, {
                      deck: getCurrentDeck(),
                      state: getCurrentState(),
                      forceEdit: shouldAutoEdit,
                      helpers: {
                        escapeHtml,
                        formatDate: formatTime,
                        getCardLabel: () => "J♥"
                      }
                    });
                  }

                  return "";
                }).join("")
              : `
                <div class="lienzo-jpica-empty">
                  Todavía no hay hijas Q♣ o J♥.
                </div>
              `
            }
          </div>
        </div>
      </div>
    </section>
  `;
  }

  async function createQtrebolFromUser(parentPlay, user) {
    const token = localStorage.getItem("cooptrackToken");
    const deckId = Number(getCurrentDeck()?.id || parentPlay?.deck_id || 0);
    const userId = Number(window.__currentUser?.id || window.__currentState?.currentUser?.id || 0);
    const targetUserId = Number(user?.id || 0);

    if (!token || !deckId || !userId || !targetUserId) {
      alert("Faltan datos para crear la Q♣.");
      return;
    }

    const when = new Date().toISOString();

    const playCode = [
      deckId,
      userId,
      when,
      "Q",
      "CLUB",
      "create_from_jtrebol",
      `U:${userId}`,
      `child_of:${parentPlay.id}`,
      `U:${targetUserId}`
    ].join("§");

    const response = await fetch("/plays", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        deck_id: deckId,
        parent_play_id: parentPlay.id,
        target_user_id: targetUserId,
        play_code: playCode,
        text: parentPlay.play_text || "",
        play_status: "ACTIVE",
        issued_with: []
      })
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      console.error("Error creando Q♣:", data);
      alert(data?.error || "No se pudo crear la Q♣.");
      return;
    }

    const newPlayId = Number(data?.play?.id || 0);

    if (!newPlayId) {
      alert("Se creó la Q♣ pero no volvió el id.");
      return;
    }

    window.location.href = `/lienzoQtrebol.html?deckId=${deckId}&playId=${newPlayId}`;
  }

  const AUTO_EDIT_JHEART_KEY = "cooptrack.jtrebol.autoEditJHeartId";

  function setAutoEditJHeartId(playId) {
    const id = Number(playId || 0);
    if (!id) return;

    try {
      sessionStorage.setItem(AUTO_EDIT_JHEART_KEY, String(id));
    } catch (error) {
      console.warn("No se pudo guardar auto-edit de J♥", error);
    }
  }

  function consumeAutoEditJHeartId() {
    try {
      const raw = sessionStorage.getItem(AUTO_EDIT_JHEART_KEY);
      sessionStorage.removeItem(AUTO_EDIT_JHEART_KEY);

      const parsed = Number(raw || 0);
      return parsed > 0 ? parsed : 0;
    } catch (error) {
      console.warn("No se pudo leer auto-edit de J♥", error);
      return 0;
    }
  }

  async function createJcorazonFromJtrebol(parentPlay) {
    const token = localStorage.getItem("cooptrackToken");
    const deckId = Number(getCurrentDeck()?.id || parentPlay?.deck_id || 0);
    const userId = Number(
      window.__currentUser?.id ||
      window.__currentState?.userId ||
      window.__currentState?.currentUser?.id ||
      0
    );

    if (!token || !deckId || !userId || !parentPlay?.id) {
      alert("Faltan datos para crear la J♥.");
      return;
    }

    const when = new Date().toISOString();

    const playCode = [
      deckId,
      userId,
      when,
      "J",
      "HEART",
      "create_child",
      `U:${userId}`,
      `child_of:${parentPlay.id}`,
      `U:${userId}`
    ].join("§");

    const response = await fetch("/plays", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        deck_id: deckId,
        parent_play_id: parentPlay.id,
        play_code: playCode,
        text: "",
        play_status: "ACTIVE"
      })
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      console.error("Error creando J♥:", data);
      alert(data?.error || "No se pudo crear la J♥.");
      return;
    }

    const newPlayId = Number(data?.play?.id || 0);

    if (newPlayId) {
      setAutoEditJHeartId(newPlayId);
    }

    window.location.reload();
  }

  function bindJtrebolChildHeader(parentPlay) {
    document.getElementById("jtrebol-toggle-users-btn")?.addEventListener("click", () => {
      document.getElementById("jtrebol-users-picker")?.classList.toggle("is-hidden");
    });

    document.getElementById("jtrebol-create-jheart-btn")?.addEventListener("click", () => {
      createJcorazonFromJtrebol(parentPlay);
    });

    document.getElementById("jtrebol-help-btn")?.addEventListener("click", () => {
      if (typeof window.openPlayHelp === "function") {
        window.openPlayHelp("J_CLUB");
        return;
      }

      window.location.href = `/help.html?rank=J&suit=CLUB&playId=${parentPlay.id}`;
    });
  }

  function mountUsersPickerForQtrebol(parentPlay) {
    if (typeof window.renderUsersPicker !== "function") {
      console.warn("users.js no está cargado");
      return;
    }

    window.renderUsersPicker("jtrebol-users-picker", {
      currentUserId: Number(window.__currentUser?.id || 0),
      deckId: Number(getCurrentDeck()?.id || parentPlay?.deck_id || 0),
      parentPlayId: Number(parentPlay?.id || 0),
      childRank: "Q",
      childSuit: "CLUB",
      plays: getAllPlays(),
      onAnimateSelect(user) {
        createQtrebolFromUser(parentPlay, user);
      }
    });
  }

  async function patchPlay(playId, payload) {
    const token = localStorage.getItem("cooptrackToken");

    if (!token) {
      alert("No estás logueado");
      return false;
    }

    const response = await fetch(`/plays/${playId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      console.error("Error actualizando jugada:", data);
      alert(data?.error || "No se pudo actualizar la jugada.");
      return false;
    }

    return true;
  }

  async function deletePlay(playId) {
    const token = localStorage.getItem("cooptrackToken");

    if (!token) {
      alert("No estás logueado");
      return false;
    }

    const response = await fetch(`/plays/${playId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      console.error("Error borrando jugada:", data);
      alert(data?.error || "No se pudo borrar la jugada.");
      return false;
    }

    return true;
  }

  function bindChildEventsInLienzo() {
    document.addEventListener("tablero:save-play", async (event) => {
      const { playId, text, amount, play_status } = event.detail || {};
      const payload = { text };

      if (amount !== undefined) payload.amount = amount;
      if (play_status) payload.play_status = play_status;

      const ok = await patchPlay(playId, payload);
      if (ok) window.location.reload();
    });

    document.addEventListener("tablero:approve-play", async (event) => {
      const { playId, text, amount, play_status } = event.detail || {};
      const payload = { play_status: play_status || "APPROVED" };

      if (text !== undefined) payload.text = text;
      if (amount !== undefined) payload.amount = amount;

      const ok = await patchPlay(playId, payload);
      if (ok) window.location.reload();
    });

    document.addEventListener("tablero:cancel-play", async (event) => {
      const playId = Number(event?.detail?.playId || 0);
      if (!playId) return;

      const ok = await patchPlay(playId, {
        play_status: "CANCELLED"
      });

      if (ok) window.location.reload();
    });

    document.addEventListener("tablero:delete-play", async (event) => {
      const playId = Number(event?.detail?.playId || 0);
      if (!playId) return;

      const ok = await deletePlay(playId);
      if (ok) window.location.reload();
    });
  }

  function bindChildQRows() {
    document.querySelectorAll(".jpica-q-row").forEach((row) => {
      row.addEventListener("click", () => {
        const playId = Number(row.getAttribute("data-play-id") || 0);
        const deckId = Number(getCurrentDeck()?.id || 0);

        if (!playId || !deckId) return;

        window.location.href = `/lienzoQtrebol.html?deckId=${deckId}&playId=${playId}`;
      });
    });
  }

  function renderLienzoJtrebol(play) {
    const container = getLienzoContainer();
    const deck = getCurrentDeck();

    if (!container) return;

    const autoEditJHeartId = consumeAutoEditJHeartId();

    container.innerHTML = `
    <div class="lienzo-v2-page">
      ${renderDeckHeader(deck)}

      <div class="lienzo-v2-shell">
        <div class="lienzo-v2-main">
          <div class="lienzo-v2-grid lienzo-v2-grid--jpica">
            <div id="colombes">
              ${renderColombes(play)}
            </div>

            <div id="amsterdam">
              ${renderAmsterdam(play, { autoEditJHeartId })}
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

    mountPlacard(play);
    bindChildQRows();
    mountUsersPickerForQtrebol(play);
    bindJtrebolChildHeader(play);
    bindChildEventsInLienzo();
  }

  window.openLienzoJtrebolByPlayId = function (playId) {
    const play = getPlayById(playId);
    const container = getLienzoContainer();

    if (!play) {
      if (container) {
        container.innerHTML = `
        <div class="lienzo-error">
          No se encontró la J♣ solicitada.
        </div>
      `;
      }
      return;
    }

    renderLienzoJtrebol(play);
  };
})();
