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

    return getAllPlays()
      .map((play) => ({
        rank: normalizeRank(play?.card_rank || play?.rank),
        suit: normalizeSuit(play?.card_suit || play?.suit),
        ownerId:
          Number(play?.target_user_id || 0) || Number(play?.created_by_user_id || 0)
      }))
      .filter((card) => {
        return (
          ["A", "K"].includes(card.rank) &&
          ["HEART", "SPADE", "DIAMOND", "CLUB"].includes(card.suit) &&
          card.ownerId === ownerId
        );
      })
      .map((card) => ({ card_rank: card.rank, card_suit: card.suit }))
      .filter((card, index, self) => {
        const key = `${card.card_rank}_${card.card_suit}`;
        return index === self.findIndex((c) => `${c.card_rank}_${c.card_suit}` === key);
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
    <section class="lienzo-tribune lienzo-tribune--source">

      <div class="lienzo-tribune__corporates"></div>

      <div class="lienzo-tribune__identity">
        <img
          class="lienzo-tribune__avatar"
          src="${escapeHtml(user.profile_photo_url)}"
          alt="${escapeHtml(user.nickname)}"
        />

        <div class="lienzo-tribune__name">
          ${escapeHtml(user.nickname)}
        </div>
      </div>

      <div class="lienzo-tribune__stage">
        <div
          id="lienzo-jpica-card"
          draggable="true"
          data-rank="J"
          data-suit="SPADE"
          title="Arrastrar J♠ hacia Publicar"
        >
          ${window.CartaTipo.renderPlayCardBox({
            rank: "J",
            suit: "SPADE",
            title: play.play_text || "Sin texto",
            play_text: play.play_text,
            start_date: play.start_date,
            end_date: play.end_date,
            location: play.location,
            ownerUser: getPlayOwnerUser(play),
            ownerCards: getCardsOwnedByUser(getPlayOwnerUser(play).id),
            metas: [
              play.start_date
                ? {
                    icon: "/assets/icons/reloj60.gif",
                    text: formatTime(play.start_date)
                  }
                : null,
              play.location
                ? {
                    icon: "/assets/icons/LocGlobito80.gif",
                    text: play.location
                  }
                : null
            ].filter(Boolean)
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
  
function bindSourceDrag(play) {
  const card = document.getElementById("lienzo-jpica-card");
  if (!card) return;

  card.addEventListener("dragstart", (event) => {
    window.__draggingPlacardCard = {
      source: "lienzoJpica",
      rank: "J",
      suit: "SPADE",
      playId: play.id
    };

    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData("text/plain", "J|SPADE");
  });

  card.addEventListener("dragend", () => {
    window.__draggingPlacardCard = null;
  });
}
  function renderAmsterdam(play) {
  return `
    <section class="lienzo-tribune lienzo-tribune--target">

      <div class="lienzo-tribune__corporates"></div>

      <div class="lienzo-tribune__identity">
        <img
          class="lienzo-tribune__avatar"
          src="/assets/icons/Extra120.gif"
          alt="Publicar"
        />

        <div class="lienzo-tribune__name">
          Publicar
        </div>
      </div>

      <div class="lienzo-tribune__stage">
        <div id="lienzo-jpica-dropzone" class="lienzo-target-dropzone">
          ${
            hasDroppedJSpade()
              ? window.CartaTipo.renderPlayCardBox({
                  rank: "J",
                  suit: "SPADE",
                  title: play.play_text || "Sin texto",
                  play_text: play.play_text,
                  start_date: play.start_date,
                  end_date: play.end_date,
                  location: play.location,
                  ownerUser: getPlayOwnerUser(play),
                  ownerCards: getCardsOwnedByUser(getPlayOwnerUser(play).id),
                  metas: [
                    play.start_date
                      ? {
                          icon: "/assets/icons/reloj60.gif",
                          text: formatTime(play.start_date)
                        }
                      : null,
                    play.location
                      ? {
                          icon: "/assets/icons/LocGlobito80.gif",
                          text: play.location
                        }
                      : null
                  ].filter(Boolean),
                  actionsHtml: `
                    <button id="lienzo-publish-simple-btn" class="icon-btn" title="Publicar">
                      <img src="/assets/icons/Extra120.gif" alt="Publicar" />
                    </button>
                  `
                })
              : `<div class="lienzo-drop-hint">Soltá la J♠ acá para preparar la publicación</div>`
          }
        </div>

        ${hasDroppedQHeart() ? renderQHeartBox(play) : ""}
      </div>

    </section>
  `;
}

function bindDropzone(play) {
  const zone = document.getElementById("lienzo-jpica-dropzone");
  if (!zone) return;

  function getDraggingCard() {
    return window.__draggingPlacardCard || null;
  }

  function getCardType(card) {
    const rank = String(card?.rank || "").toUpperCase();
    const suit = String(card?.suit || "").toUpperCase();

    return {
      isJSpade: rank === "J" && suit === "SPADE",
      isQHeart: rank === "Q" && suit === "HEART"
    };
  }

  zone.addEventListener("dragover", (event) => {
    event.preventDefault();

    const card = getDraggingCard();
    const { isJSpade, isQHeart } = getCardType(card);
    const isValid = isJSpade || isQHeart;

    zone.classList.toggle("is-drag-valid", isValid);
    zone.classList.toggle("is-drag-invalid", !isValid);

    event.dataTransfer.dropEffect = isValid ? "copy" : "none";
  });

  zone.addEventListener("dragleave", () => {
    zone.classList.remove("is-drag-valid", "is-drag-invalid");
  });

  zone.addEventListener("drop", (event) => {
    event.preventDefault();
    zone.classList.remove("is-drag-valid", "is-drag-invalid");

    const card = getDraggingCard();
    const { isJSpade, isQHeart } = getCardType(card);

    if (isJSpade) {
      setDroppedJSpade({
        rank: "J",
        suit: "SPADE",
        targetZone: "AMSTERDAM",
        playId: play.id
      });

      renderLienzoJpica(play);
      return;
    }

    if (isQHeart) {
      setDroppedQHeart({
        rank: "Q",
        suit: "HEART",
        targetZone: "AMSTERDAM",
        playId: play.id
      });

      renderLienzoJpica(play);
    }
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

function hasDroppedJSpade() {
  const selection = window.__lienzoJpicaPublishedSelection || null;
  return selection?.rank === "J" && selection?.suit === "SPADE";
}

function setDroppedJSpade(value) {
  window.__lienzoJpicaPublishedSelection = value || null;
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
    <div class="lienzo-v2-page">
      ${renderDeckHeader(deck)}

      <div class="lienzo-v2-shell">
        <div class="lienzo-v2-main">

          <div class="lienzo-v2-grid lienzo-v2-grid--2">
            <div id="colombes">
              ${renderColombes(play)}
            </div>

            <div id="amsterdam">
              ${renderAmsterdam(play)}
            </div>
          </div>

        </div>
      </div>
    </div>
  `;

  mountPlacard(play);
  bindSourceDrag(play);
  bindDropzone(play);
  bindActions(play);
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