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

  function getSourceUser(play) {
    return {
      id: play.created_by_user_id,
      nickname: play.created_by_nickname || "Anfitrión",
      profile_photo_url:
        play.created_by_profile_photo_url || "/assets/icons/singeta120.gif"
    };
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
      page: "lienzo-new",
      photoUrl: host.dataset.photoUrl,
      title: host.dataset.title,
      rank: "A",
      suit: "HEART",
      showCurrency: false,
      leftCards: [
        {
          id: "virtual-Q-HEART",
          rank: "Q",
          suit: "HEART",
          isVirtual: true
        }
      ],
      plays: getAllPlays()
    });
  }

  function renderColombes(play) {
    const user = getSourceUser(play);

    return `
      <section class="lienzo-panel lienzo-panel--source">
        <div class="panel-topbar">
          <div class="panel-topbar__col panel-topbar__col--identity">
            <div class="lienzo-source-header lienzo-source-header--top">
              <img
                class="lienzo-source-header__photo"
                src="${escapeHtml(user.profile_photo_url)}"
                alt="${escapeHtml(user.nickname)}"
              />
              <div class="lienzo-source-header__name">
                ${escapeHtml(user.nickname)}
              </div>
            </div>
          </div>
        </div>

        <div class="lienzo-source-cards">
          <div
            class="lienzo-parent-play-box lienzo-parent-play-box--inline lienzo-play-card-box"
            style="background-image:url('/assets/icons/Jpike.gif')"
          >
            <div class="lienzo-play-card-box__info">
              <div class="play-text">${escapeHtml(play.play_text || "Sin texto")}</div>

              ${play.start_date ? `
                <div class="play-meta">
                  <img class="play-meta__icon" src="/assets/icons/reloj60.gif" alt="" />
                  <span>${escapeHtml(formatTime(play.start_date))}</span>
                </div>
              ` : ""}

              ${play.location ? `
                <div class="play-meta">
                  <img class="play-meta__icon" src="/assets/icons/LocGlobito80.gif" alt="" />
                  <span>${escapeHtml(play.location)}</span>
                </div>
              ` : ""}
            </div>
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
            <img class="lienzo-card-image" src="/assets/icons/Qcorazon.gif" alt="Q♥" />
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

  function renderAmsterdam(play) {
    return `
      <section class="lienzo-panel lienzo-panel--target">
        <div class="panel-topbar">
          <div class="panel-topbar__col panel-topbar__col--identity">
            <div class="lienzo-target-header lienzo-target-header--top">
              <img
                class="lienzo-target-header__photo"
                src="/assets/icons/Extra120.gif"
                alt="Publicar"
              />
              <div class="lienzo-target-header__name">
                Publicar
              </div>
            </div>
          </div>
        </div>

        <div class="lienzo-target-mainrow">
          <div id="lienzo-jpica-dropzone" class="lienzo-target-dropzone">
            <div class="lienzo-play-card-box">
              <div class="lienzo-play-card-box__info">
                <div class="play-text">
                  Vas a publicar esta actividad como noticia.
                </div>

                <div class="play-meta">
                  A partir de la publicación, todos los usuarios de CoopTrack podrán leer su contenido y verla en Noticias.
                </div>

                <div class="play-meta">
                  Si querés convertirla en una publicación con valor económico, bajá una Q♥ a esta tribuna.
                </div>
              </div>

              <div class="lienzo-play-card-box__actions">
                <button id="lienzo-publish-simple-btn" class="icon-btn" title="Publicar">
                  <img src="/assets/icons/Extra120.gif" alt="Publicar" />
                </button>
              </div>
            </div>
          </div>

          ${hasDroppedQHeart() ? renderQHeartBox(play) : ""}
        </div>
      </section>
    `;
  }

  function bindDropzone(play) {
    const zone = document.getElementById("lienzo-jpica-dropzone");
    if (!zone) return;

    zone.addEventListener("dragover", (event) => {
      event.preventDefault();

      const card = window.__draggingPlacardCard || null;
      const isQHeart =
        String(card?.rank || "").toUpperCase() === "Q" &&
        String(card?.suit || "").toUpperCase() === "HEART";

      zone.classList.toggle("is-drag-valid", isQHeart);
      zone.classList.toggle("is-drag-invalid", !isQHeart);

      event.dataTransfer.dropEffect = isQHeart ? "copy" : "none";
    });

    zone.addEventListener("dragleave", () => {
      zone.classList.remove("is-drag-valid", "is-drag-invalid");
    });

    zone.addEventListener("drop", (event) => {
      event.preventDefault();
      zone.classList.remove("is-drag-valid", "is-drag-invalid");

      const card = window.__draggingPlacardCard || null;
      const isQHeart =
        String(card?.rank || "").toUpperCase() === "Q" &&
        String(card?.suit || "").toUpperCase() === "HEART";

      if (!isQHeart) return;

      setDroppedQHeart({
        rank: "Q",
        suit: "HEART",
        targetZone: "AMSTERDAM",
        playId: play.id
      });

      renderLienzoJpica(play);
    });
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

  function renderLienzoJpica(play) {
    const container = getLienzoContainer();
    const deck = getCurrentDeck();

    if (!container) return;

    container.innerHTML = `
      ${renderDeckHeader(deck)}

      <section class="lienzo-grid">
        ${renderColombes(play)}
        ${renderAmsterdam(play)}
      </section>
    `;

    mountPlacard(play);
    bindDropzone(play);
    bindActions(play);
  }

  function init() {
    const playId = getPlayIdFromUrl();
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
  }

  document.addEventListener("DOMContentLoaded", init);
})();