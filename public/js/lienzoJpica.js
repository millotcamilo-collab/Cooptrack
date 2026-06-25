(function () {
  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function getParams() {
    return new URLSearchParams(window.location.search);
  }

  const AUTO_EDIT_JHEART_KEY = "cooptrack.jpica.autoEditJHeartId";

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

  function isFutureDate(value) {
    if (!value) return false;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return false;
    return date.getTime() > Date.now();
  }

  function userIsSpadeAceHolder() {
    const userId = Number(window.__currentUser?.id || getCurrentState()?.userId || 0);

    return getCardsOwnedByUser(userId).some((card) =>
      normalizeRank(card.card_rank) === "A" &&
      normalizeSuit(card.card_suit) === "SPADE"
    );
  }

  function isDeadlineJpica(play) {
    return String(play?.spade_mode || "").toUpperCase() === "DEADLINE";
  }

  function isCurrentUserPlayOwner(play) {
    const userId = Number(
      window.__currentUser?.id ||
      getCurrentState()?.userId ||
      getCurrentState()?.currentUser?.id ||
      0
    );

    const ownerId =
      Number(play?.target_user_id || 0) ||
      Number(play?.created_by_user_id || 0);

    return !!userId && userId === ownerId;
  }

  function getOpenChildQspades(parentPlayId) {
    const closed = ["DONE", "CANCELLED", "REJECTED"];
    return getAllPlays().filter((p) => {
      const rank = normalizeRank(p?.card_rank || p?.rank);
      const suit = normalizeSuit(p?.card_suit || p?.suit);
      const status = normalizeRank(p?.play_status || p?.status);

      return (
        Number(p?.parent_play_id || 0) === Number(parentPlayId) &&
        rank === "Q" &&
        suit === "SPADE" &&
        !closed.includes(status)
      );
    });
  }

  function canResolveBomb(play) {
    return (
      isDeadlineJpica(play) &&
      isCurrentUserPlayOwner(play) &&
      String(play?.play_status || "").toUpperCase() === "APPROVED" &&
      isFutureDate(play?.end_date)
    );
  }

function getBombStampIcon(play) {
  const code = String(play?.play_code || "").toUpperCase();
  const actions = window.ICONS?.actions || {};

  if (code.includes("BOMB:DONE")) {
    return actions.deadline || "/assets/icons/META60.gif";
  }

  if (code.includes("BOMB:EXPLODED")) {
    return actions.boom || "/assets/icons/Boom80.gif";
  }

  if (code.includes("BOMB:DISABLED")) {
    return actions.stop || actions.cancel || "/assets/icons/stop60.gif";
  }

  if (
    isDeadlineJpica(play) &&
    play?.end_date &&
    !isFutureDate(play.end_date)
  ) {
    return actions.boom || "/assets/icons/Boom80.gif";
  }

  return "";
}

  function canCancelApprovedJpica(play) {
    const status = String(play?.play_status || "").trim().toUpperCase();
    if (status !== "APPROVED") return false;

    return isFutureDate(play?.end_date || play?.start_date);
  }

  function getPlayIdFromUrl() {
    return Number(getParams().get("playId") || 0);
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
    return state.deck || state.mazo || window.__currentDeck || {};
  }

  function getPlayById(playId) {
    return getAllPlays().find((p) => Number(p.id) === Number(playId)) || null;
  }

  function getLienzoContainer() {
    return document.getElementById("lienzo-container");
  }

  function formatTime(value) {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString("es-UY", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit"
    });
  }
  function canLaunchQspade(play) {
    const limitValue = play?.end_date || play?.start_date;
    if (!limitValue) return false;

    const limit = new Date(limitValue);

    if (Number.isNaN(limit.getTime())) {
      return false;
    }

    const margen = 30 * 60 * 1000;

    return (limit.getTime() + margen) > Date.now();
  }
  function getSourceUser(play) {
    return {
      id: play.created_by_user_id,
      nickname: play.created_by_nickname || "Anfitrión",
      profile_photo_url:
        play.created_by_profile_photo_url || "/assets/icons/singeta120.gif"
    };
  }

  function resolveTargetUser(play) {
    return {
      id: Number(play?.target_user_id || 0),
      nickname: play?.target_user_nickname || "Destinatario",
      profile_photo_url:
        play?.target_user_profile_photo_url || "/assets/icons/singeta120.gif"
    };
  }

  function getPlayOwnerUser(play) {
    return Number(play?.target_user_id || 0)
      ? resolveTargetUser(play)
      : getSourceUser(play);
  }

  function normalizeRank(value) {
    return String(value || "").trim().toUpperCase();
  }

  function normalizeSuit(value) {
    return String(value || "").trim().toUpperCase();
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
      .filter((p) => {
        const parts = String(p?.play_code || "").split("§");

        const rank = normalizeRank(p?.card_rank || p?.rank || parts[3]);
        const suit = normalizeSuit(p?.card_suit || p?.suit || parts[4]);
        const action = String(parts[5] || "").trim().toLowerCase();
        const status = normalizeRank(p?.play_status || p?.status);

        if (!["A", "K"].includes(rank)) return false;
        if (!["HEART", "SPADE", "DIAMOND", "CLUB"].includes(suit)) return false;

        if (finalStatuses.includes(status)) return false;
        if (action === "puedejugar") return false;

        const cardOwnerId =
          Number(p?.target_user_id || 0) ||
          Number(p?.created_by_user_id || 0) ||
          Number(parts[1] || 0);

        return cardOwnerId === ownerId;
      })
      .map((p) => {
        const parts = String(p?.play_code || "").split("§");

        return {
          card_rank: normalizeRank(p?.card_rank || p?.rank || parts[3]),
          card_suit: normalizeSuit(p?.card_suit || p?.suit || parts[4])
        };
      })
      .filter((card, index, self) => {
        const key = `${card.card_rank}_${card.card_suit}`;
        return index === self.findIndex((c) => {
          return `${c.card_rank}_${c.card_suit}` === key;
        });
      })
      .sort(compareCorporateCards);
  }

  function hasDroppedQHeart() {
    const selection = window.__lienzoJpicaDropSelection || null;
    return selection?.rank === "Q" && selection?.suit === "HEART";
  }

  function setDroppedQHeart(value) {
    window.__lienzoJpicaDropSelection = value || null;
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
      page: "lienzo-jpica",
      play,
      photoUrl: host.dataset.photoUrl,
      title: host.dataset.title,
      rank: "A",
      suit: "HEART",
      showCurrency: false,
      leftCards: [],
      plays: getAllPlays()
    });
  }

function renderColombes(play) {
  const spadeMode = String(play?.spade_mode || "").trim().toUpperCase();
  const isDeadline = spadeMode === "DEADLINE";

  const mainDate = isDeadline
    ? play.end_date
    : play.start_date;

  const mainIcon = isDeadline
    ? "/assets/icons/bombaRedonda60.gif"
    : "/assets/icons/reloj60.gif";

  const showBombActions = canResolveBomb(play);
  const bombStampIcon = isDeadline ? getBombStampIcon(play) : "";

  return `
    <section class="lienzo-tribune lienzo-tribune--source">
      <div class="lienzo-tribune__corporates"></div>

      <div class="lienzo-tribune__stage">
        <div id="lienzo-jpica-card">
          ${window.CartaTipo.renderPlayCardBox({
            rank: "J",
            suit: "SPADE",
            title: play.play_text || "Sin texto",
            play_text: play.play_text,
            spade_mode: play.spade_mode,
            start_date: play.start_date,
            end_date: play.end_date,
            location: play.location,
            ownerUser: getPlayOwnerUser(play),
            ownerCards: getCardsOwnedByUser(getPlayOwnerUser(play).id),
            metas: [
              mainDate
                ? {
                    icon: mainIcon,
                    text: formatTime(mainDate)
                  }
                : null,
              play.location
                ? {
                    icon: "/assets/icons/LocGlobito80.gif",
                    text: play.location
                  }
                : null
            ].filter(Boolean),
            actionsHtml: bombStampIcon ? `
              <img
                class="lv2-play-card__decision-icon"
                src="${bombStampIcon}"
                alt="Estado de bomba"
              />
            ` : showBombActions ? `
              <button
                type="button"
                id="jpica-done-btn"
                class="icon-btn"
                title="Hecho / apagar bomba"
              >
                <img src="${window.ICONS.actions.deadline}" alt="Hecho" />
              </button>

              <button
                type="button"
                id="jpica-cancel-bomb-btn"
                class="icon-btn"
                title="Cancelar / apagar bomba"
              >
                <img src="${window.ICONS.actions.cancel}" alt="Cancelar" />
              </button>
            ` : ""
          })}
        </div>
      </div>
    </section>
  `;
}

  function renderQHeartBox(play) {
    const deck = getCurrentDeck();
    const currency = String(deck.currency_symbol || "").trim().toUpperCase();

    return `
      <div class="lienzo-target-extra-slot">
        <div class="lienzo-qheart-box">
          <div class="lienzo-qheart-box__card">
            <img class="lienzo-card-image" src="/assets/icons/Qcorazon.png" alt="Q♥" />
          </div>

          <div class="lienzo-qheart-box__content">
            <div class="lienzo-qheart-box__title">Publicación con Q♥</div>

            <div class="lienzo-qheart-box__body">
              <input
                type="text"
                class="lienzo-qheart-box__concept"
                placeholder="Descripción"
                value="Ticket"
              />

              <div class="lienzo-qheart-box__amount-row">
                <span class="lienzo-qheart-box__currency">${escapeHtml(currency)}</span>
                <input
                  type="text"
                  class="lienzo-qheart-box__amount"
                  placeholder="0"
                  inputmode="decimal"
                />
              </div>

              <input
                type="date"
                class="lienzo-qheart-box__paydate"
              />

              <button
                id="lienzo-publish-qheart-btn"
                class="icon-btn lienzo-qheart-box__save"
                title="Publicar con Q♥"
              >
                <img src="/assets/icons/salvar40.gif" alt="Publicar con Q♥" />
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function getChildQSpades(parentPlayId) {
    return getAllPlays()
      .filter((p) => {
        const rank = normalizeRank(p?.card_rank || p?.rank);
        const suit = normalizeSuit(p?.card_suit || p?.suit);
        return (
          Number(p?.parent_play_id || 0) === Number(parentPlayId) &&
          rank === "Q" &&
          suit === "SPADE"
        );
      })
      .sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
  }

  function qspadeHasPayment(play) {
    const playCode = String(play?.play_code || "");
    return playCode.includes("pay:QHEART");
  }

  function bindInvitationRows() {
    document
      .querySelectorAll(".jpica-q-row")
      .forEach((row) => {
        row.addEventListener("click", () => {
          const playId = Number(row.getAttribute("data-play-id") || 0);
          if (!playId) return;

          const deckId = Number(getCurrentDeck()?.id || 0);
          if (!deckId) return;

          const childPlay = getPlayById(playId);
          if (!childPlay) return;

          const targetPage = qspadeHasPayment(childPlay)
            ? "lienzoQQpica.html"
            : "lienzoQpica.html";

          window.location.href = `/${targetPage}?deckId=${deckId}&playId=${playId}`;
        });
      });
  }

  async function createQpicaFromUser(parentPlay, user) {
    const token = localStorage.getItem("cooptrackToken");
    const deckId = Number(getCurrentDeck()?.id || parentPlay?.deck_id || 0);
    const userId = Number(window.__currentUser?.id || window.__currentState?.currentUser?.id || 0);
    const targetUserId = Number(user?.id || 0);

    if (!token || !deckId || !userId || !targetUserId) {
      alert("Faltan datos para crear la Q♠.");
      return;
    }

    const when = new Date().toISOString();

    const playCode = [
      deckId,
      userId,
      when,
      "Q",
      "SPADE",
      "create_from_jpica",
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
      console.error("Error creando Q♠:", data);
      alert(data?.error || "No se pudo crear la Q♠.");
      return;
    }

    const newPlayId = Number(data?.play?.id || 0);

    if (!newPlayId) {
      alert("Se creó la Q♠ pero no volvió el id.");
      return;
    }

    window.location.href = `/lienzoQpica.html?deckId=${deckId}&playId=${newPlayId}`;
  }

  async function createJtrebolFromJpica(parentPlay) {
    const token = localStorage.getItem("cooptrackToken");
    const deckId = Number(getCurrentDeck()?.id || parentPlay?.deck_id || 0);
    const userId = Number(
      window.__currentUser?.id ||
      window.__currentState?.userId ||
      window.__currentState?.currentUser?.id ||
      0
    );

    if (!token || !deckId || !userId || !parentPlay?.id) {
      alert("Faltan datos para crear la J♣.");
      return;
    }

    const when = new Date().toISOString();

    const playCode = [
      deckId,
      userId,
      when,
      "J",
      "CLUB",
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
        amount: null,
        play_status: "ACTIVE"
      })
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      console.error("Error creando J♣:", data);
      alert(data?.error || "No se pudo crear la J♣.");
      return;
    }

    window.location.reload();
  }

  async function createJcorazonFromJpica(parentPlay) {
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

  function bindJpicaChildHeader(parentPlay) {
    document.getElementById("jpica-toggle-users-btn")?.addEventListener("click", () => {
      document.getElementById("jpica-users-picker")?.classList.toggle("is-hidden");
    });

    document.getElementById("jpica-create-jclub-btn")?.addEventListener("click", () => {
      createJtrebolFromJpica(parentPlay);
    });

    document.getElementById("jpica-create-jheart-btn")?.addEventListener("click", () => {
      createJcorazonFromJpica(parentPlay);
    });

    document.getElementById("jpica-help-btn")?.addEventListener("click", () => {
      window.location.href = `/help.html?rank=J&suit=SPADE&playId=${parentPlay.id}`;
    });

    document.getElementById("jpica-approve-btn")?.addEventListener("click", async () => {
      const ok = await patchJpica(parentPlay.id, {
        play_status: "APPROVED"
      });

      if (ok) {
        window.location.reload();
      }
    });

    document.getElementById("jpica-cancel-bomb-btn")?.addEventListener("click", async () => {
      const ok = await patchJpica(parentPlay.id, {
        play_status: "CANCELLED",
        play_code: `${parentPlay.play_code || ""}§BOMB:DISABLED`
      });

      if (!ok) return;

      await patchChildQspades(parentPlay.id, {
        play_status: "CANCELLED"
      });

      window.location.reload();
    });

    document.getElementById("jpica-done-btn")?.addEventListener("click", async () => {
      const ok = await patchJpica(parentPlay.id, {
        play_status: "APPROVED",
        text: parentPlay.play_text,
        play_code: `${parentPlay.play_code || ""}§BOMB:DONE`
      });

      if (!ok) return;

      await patchChildQspades(parentPlay.id, {
        play_status: "APPROVED",
        play_code: `${parentPlay.play_code || ""}§BOMB:DONE`
      });

      window.location.reload();
    });

  }

  function mountUsersPickerForQpica(parentPlay) {
    if (typeof window.renderUsersPicker !== "function") {
      console.warn("users.js no está cargado");
      return;
    }

    window.renderUsersPicker("jpica-users-picker", {
      currentUserId: Number(window.__currentUser?.id || 0),
      deckId: Number(getCurrentDeck()?.id || parentPlay?.deck_id || 0),
      parentPlayId: Number(parentPlay?.id || 0),
      childRank: "Q",
      childSuit: "SPADE",
      plays: getAllPlays(),

      onExtraAction(actionId) {
        if (actionId === "jclub") {
          createJtrebolFromJpica(parentPlay);
        }

        if (actionId === "jheart") {
          createJcorazonFromJpica(parentPlay);
        }

        if (actionId === "publish") {
          publishSimple(parentPlay);
        }
      },

      onAnimateSelect(user) {
        if (!canLaunchQspade(parentPlay)) {
          alert("Ya no se pueden agregar invitaciones a esta actividad.");
          return;
        }

        createQpicaFromUser(parentPlay, user);
      }
    });
  }

  function renderAmsterdam(play, options = {}) {
    const autoEditJHeartId = Number(options.autoEditJHeartId || 0);

    const isApproved =
      String(play?.play_status || "").toUpperCase() === "APPROVED";

    const showApprove =
      !isApproved && userIsSpadeAceHolder();

    const showCancel =
      canCancelApprovedJpica(play);

    const childPlays = getAllPlays()
      .filter(
        (p) => Number(p?.parent_play_id || 0) === Number(play.id)
      )
      .sort(
        (a, b) =>
          new Date(a.created_at || 0) -
          new Date(b.created_at || 0)
      );

    const status = String(play?.play_status || "").toUpperCase();

    const showQpica =
      status === "APPROVED" &&
      canLaunchQspade(play);

    return `
    <section class="lienzo-tribune lienzo-tribune--target">

      <div class="lienzo-tribune__corporates"></div>

      <div class="lienzo-tribune__stage lienzo-tribune__stage--column">

        <div class="lienzo-jpica-panel">

<div class="jpica-users-header">

<div class="jpica-child-actions">
  ${showQpica ? `
  <button type="button" id="jpica-toggle-users-btn" class="jpica-child-btn">Q♠</button>
` : ""}
  <button type="button" id="jpica-create-jclub-btn" class="jpica-child-btn">J♣</button>
  <button type="button" id="jpica-create-jheart-btn" class="jpica-child-btn jpica-child-btn--heart">J♥</button>

  ${showApprove ? `
<button
  type="button"
  id="jpica-approve-btn"
  class="jpica-child-btn"
  title="Aprobar"
>
  <img src="${window.ICONS.actions.approve}" alt="Aprobar" />
</button>

` : ""}

${showCancel ? `
<button
  type="button"
  id="jpica-cancel-btn"
  class="jpica-child-btn"
  title="Cancelar"
>
  <img src="${window.ICONS.actions.cancel}" alt="Cancelar" />
</button>
` : ""}

<button
  type="button"
  id="jpica-help-btn"
  class="jpica-child-btn"
  title="Ayuda"
>
  <img src="${window.ICONS.actions.help}" alt="Ayuda" />
</button>
</div>

  <div id="jpica-users-picker" class="jpica-users-picker is-hidden"></div>
</div>

          <div class="lienzo-jpica-invitations-list tablero">

            ${childPlays.length
        ? childPlays
          .map((child) => {

            const rank = normalizeRank(
              child?.card_rank || child?.rank
            );

            const suit = normalizeSuit(
              child?.card_suit || child?.suit
            );

            if (
              rank === "Q" &&
              suit === "SPADE" &&
              typeof window.renderQpike === "function"
            ) {
              return `
                          <div
                            class="jpica-q-row"
                            data-play-id="${child.id}"
                          >
                            ${window.renderQpike(child, {
                deck: getCurrentDeck(),
                state: getCurrentState(),
                helpers: {
                  escapeHtml,
                  formatDate: formatTime,
                  getCardLabel: () => "Q♠"
                }
              })}
                          </div>
                        `;
            }

            if (
              rank === "J" &&
              suit === "CLUB" &&
              typeof window.renderJtrebol === "function"
            ) {
              return window.renderJtrebol(child, {
                deck: getCurrentDeck(),
                state: getCurrentState(),
                helpers: {
                  escapeHtml,
                  formatDate: formatTime,
                  getCardLabel: () => "J♣"
                }
              });
            }

            if (
              rank === "J" &&
              suit === "HEART" &&
              typeof window.renderJcorazon === "function"
            ) {
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

          })
          .join("")
        : `
                    <div class="lienzo-jpica-empty">
                      Todavía no hay invitaciones.
                    </div>
                  `
      }

          </div>

        </div>

      </div>

    </section>
  `;
  }

  async function publishSimple(play) {
    const token = localStorage.getItem("cooptrackToken");
    if (!token) {
      alert("No estás logueado");
      return;
    }

    const response = await fetch(`/plays/${play.id}/readers/public`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      alert(data.error || "No se pudo publicar");
      return;
    }

    alert("Noticia publicada");
    window.location.href = "/noticias.html";
  }


  function bindActions(play) {
    const publishSimpleBtn = document.getElementById("lienzo-publish-simple-btn");

    publishSimpleBtn?.addEventListener("click", () => {
      publishSimple(play);
    });

    const publishQHeartBtn = document.getElementById("lienzo-publish-qheart-btn");

    publishQHeartBtn?.addEventListener("click", () => {
      alert("Acá seguimos: crear publicación económica / QQpica desde esta J♠.");
    });
  }

  async function patchChildQspades(parentPlayId, payload) {
    const children = getOpenChildQspades(parentPlayId);

    for (const child of children) {
      await patchJpica(child.id, payload);
    }
  }

  async function patchJpica(playId, payload) {
    const token = localStorage.getItem("cooptrackToken");

    if (!token) {
      alert("No estás logueado");
      return false;
    }

    console.log("PATCH J♠ payload", playId, payload);

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
      console.error("Error actualizando J♠:", data);
      alert(data?.error || "No se pudo actualizar la J♠.");
      return false;
    }

    return true;
  }

  async function patchJtrebol(playId, payload) {
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
      console.error("Error actualizando J♣:", data);
      alert(data?.error || "No se pudo actualizar la J♣.");
      return false;
    }

    return true;
  }

  async function deleteJtrebol(playId) {
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
      console.error("Error borrando J♣:", data);
      alert(data?.error || "No se pudo borrar la J♣.");
      return false;
    }

    return true;
  }

  function bindJtrebolEventsInLienzo() {

    document.addEventListener("tablero:save-play", async (event) => {
      const {
        playId,
        text,
        amount
      } = event.detail || {};

      const ok = await patchJtrebol(playId, {
        text,
        amount
      });

      if (ok) {
        window.location.reload();
      }
    });

    document.addEventListener("tablero:approve-play", async (event) => {
      const {
        playId,
        text,
        amount
      } = event.detail || {};

      const ok = await patchJtrebol(playId, {
        text,
        amount,
        play_status: "APPROVED"
      });

      if (ok) {
        window.location.reload();
      }
    });

    document.addEventListener("tablero:delete-play", async (event) => {
      const playId = Number(event?.detail?.playId || 0);

      if (!playId) return;

      const ok = await deleteJtrebol(playId);

      if (ok) {
        window.location.reload();
      }
    });

  }

  function renderLienzoJpica(play) {
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
    bindActions(play);
    bindInvitationRows();
    mountUsersPickerForQpica(play);
    bindJpicaChildHeader(play);
    bindJtrebolEventsInLienzo();
  }

  window.openLienzoJpicaByPlayId = function (playId) {
    const play = getPlayById(playId);
    const container = getLienzoContainer();

    if (!play) {
      if (container) {
        container.innerHTML = `
        <div class="lienzo-error">
          No se encontró la J♠ para publicar.
        </div>
      `;
      }
      return;
    }

    renderLienzoJpica(play);
  };
})();