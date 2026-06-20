(function () {
  const API_BASE_URL = "";

  function getParams() {
    return new URLSearchParams(window.location.search);
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function normalizeRank(value) {
    return String(value || "").trim().toUpperCase();
  }

  function normalizeSuit(value) {
    return String(value || "").trim().toUpperCase();
  }

  function getCurrentUserId() {
    return Number(
      window.__currentUser?.id ||
      window.__currentState?.currentUser?.id ||
      window.__currentState?.userId ||
      0
    );
  }

  function getParentPlay(play) {
    return play?.parent_play || play?.parent || null;
  }

  function isCurrentUserHost(play) {
    const parent = getParentPlay(play) || play;
    const currentUserId = getCurrentUserId();

    return (
      currentUserId &&
      Number(parent?.created_by_user_id || 0) === currentUserId
    );
  }

  function getBombDate(play) {
    const parent = getParentPlay(play) || play;
    return parent?.end_date || play?.end_date || null;
  }

  function isBombExploded(play) {
    const value = getBombDate(play);
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return false;

    return Date.now() >= date.getTime();
  }

  function isBombDisabled(play) {
    const parent = getParentPlay(play) || play;
    const code = String(parent?.play_code || play?.play_code || "");
    return code.includes("bomb:DISABLED");
  }

  function buildStampHtml(play) {
    if (isBombDisabled(play)) {
      return `
        <div class="bomba-stamp bomba-stamp--done">
          <img src="/assets/icons/done.gif" alt="Desactivada" />
        </div>
      `;
    }

    if (isBombExploded(play)) {
      return `
        <div class="bomba-stamp bomba-stamp--exploded">
          <img src="/assets/icons/estallido.gif" alt="Explotó" />
        </div>
      `;
    }

    return `
      <button
        type="button"
        id="bomba-disable-btn"
        class="icon-btn bomba-disable-btn"
        title="Desactivar bomba"
      >
        <img src="/assets/icons/Meta60.gif" alt="Desactivar bomba" />
      </button>
    `;
  }

  function buildCardPlay(play) {
    const parent = getParentPlay(play);
    const host = isCurrentUserHost(play);

    if (host && parent) {
      return {
        ...parent,
        rank: "J",
        card_rank: "J",
        suit: "SPADE",
        card_suit: "SPADE",
        play_text: parent.play_text || play.play_text || "",
        start_date: parent.start_date || play.start_date,
        end_date: parent.end_date || play.end_date,
        location: parent.location || play.location
      };
    }

    return {
      ...play,
      rank: "Q",
      card_rank: "Q",
      suit: "SPADE",
      card_suit: "SPADE",
      play_text: parent?.play_text || play.play_text || "",
      start_date: parent?.start_date || play.start_date,
      end_date: parent?.end_date || play.end_date,
      location: parent?.location || play.location
    };
  }

  async function fetchBombPlay(deckId, playId) {
    const token = localStorage.getItem("cooptrackToken");

    const response = await fetch(
      `${API_BASE_URL}/mazos/${deckId}/state`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json"
        }
      }
    );

    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data?.error || "No se pudo cargar la bomba");
    }

    window.__currentState = data;
    window.__currentDeck = data.deck || data.mazo || null;

    const plays = Array.isArray(data.plays) ? data.plays : [];

    const play =
      plays.find((p) => Number(p.id || 0) === Number(playId)) || null;

    if (!play) return null;

    const parent =
      plays.find((p) => Number(p.id || 0) === Number(play.parent_play_id || 0)) ||
      null;

    if (parent) {
      play.parent_play = parent;
      play.parent = parent;
    }

    return play;
  }

  function renderBomb(play) {
    const content = document.getElementById("tribuna-content") ||
      document.getElementById("bomba-content");

    const actions = document.getElementById("tribuna-actions") ||
      document.getElementById("bomba-actions");

    if (!content) return;

    const cardPlay = buildCardPlay(play);

    const cardHtml = window.CartaTipo.renderPlayCardBox({
      ...cardPlay,
      play_text: cardPlay.play_text,
      start_date: cardPlay.start_date,
      end_date: cardPlay.end_date,
      location: cardPlay.location,
      spade_mode: "DEADLINE",
      showOwner: true,
      showActions: false
    });

    if (typeof window.renderAmsterdamMobile === "function") {
      content.innerHTML = window.renderAmsterdamMobile(cardPlay, {
        renderPlayCardBox: () => cardHtml
      });

      window.enableAmsterdamPeek?.();
    } else {
      content.innerHTML = `
        <section class="lienzo-tribune lienzo-tribune--target tribuna-single tribuna-single--amsterdam">
          <div class="lienzo-tribune__corporates"></div>
          <div class="lienzo-target-dropzone">
            ${cardHtml}
          </div>
        </section>
      `;
    }

    if (actions) {
      actions.innerHTML = buildStampHtml(play);
    }
  }

  async function initBomba() {
    const params = getParams();
    const deckId = Number(params.get("deckId") || 0);
    const playId = Number(params.get("playId") || 0);

    const content = document.getElementById("tribuna-content") ||
      document.getElementById("bomba-content");

    if (!deckId || !playId) {
      if (content) content.innerHTML = `<div class="lienzo-error">Falta deckId o playId.</div>`;
      return;
    }

    try {
      const play = await fetchBombPlay(deckId, playId);

      if (!play) {
        if (content) content.innerHTML = `<div class="lienzo-error">No se encontró la bomba.</div>`;
        return;
      }

      renderBomb(play);
    } catch (error) {
      console.error("Error cargando bomba:", error);
      if (content) {
        content.innerHTML = `<div class="lienzo-error">${escapeHtml(error.message)}</div>`;
      }
    }
  }

  document.addEventListener("DOMContentLoaded", initBomba);
})();