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

  function getBombMode(play) {
    const parent = getParentPlay(play) || null;
    return String(
      play?.spade_mode ||
      parent?.spade_mode ||
      play?.parent_spade_mode ||
      ""
    ).trim().toUpperCase();
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
    return code.toUpperCase().includes("BOMB:DISABLED");
  }

  function buildStampHtml(play) {
    const actions = window.ICONS?.actions || {};

    if (isBombDisabled(play)) {
      return `
      <button
        type="button"
        class="icon-btn"
        title="Bomba desactivada"
        disabled
      >
        <img src="${actions.deadline || "/assets/icons/META60.gif"}" alt="Desactivada" />
      </button>
    `;
    }

    if (isBombExploded(play)) {
      return `
      <button
        type="button"
        class="icon-btn"
        title="Bomba explotada"
        disabled
      >
        <img src="${actions.boom || "/assets/icons/Boom80.gif"}" alt="Explotó" />
      </button>
    `;
    }

    return `
  <button
    type="button"
    id="bomba-disable-btn"
    class="icon-btn bomba-disable-btn"
    title="Hecho / apagar bomba"
  >
    <img src="${actions.deadline || "/assets/icons/META60.gif"}" alt="Hecho" />
  </button>

  <button
    type="button"
    id="bomba-cancel-btn"
    class="icon-btn bomba-cancel-btn"
    title="Cancelar / apagar bomba"
  >
    <img src="${actions.cancel || "/assets/icons/cancel40.gif"}" alt="Cancelar" />
  </button>
`;
  }

  function resolveBombFigure(rank) {
    const normalized = normalizeRank(rank);

    if (normalized === "J") {
      return "/assets/figures/JpicaDeadline00.png";
    }

    return "/assets/figures/qmira1.png";
  }

  function animateBombFigure(rank) {
    const normalized = normalizeRank(rank);
    const cardFigure = document.querySelector(".lv2-card__figure img, .lv2-play-card__figure img");

    if (!cardFigure) return;

    if (normalized === "J") {
      let frame = 0;

      setInterval(() => {
        const padded = String(frame).padStart(2, "0");
        cardFigure.src = `/assets/figures/JpicaDeadline${padded}.png`;
        frame = (frame + 1) % 30;
      }, 90);

      return;
    }

    // Q fija por ahora
    cardFigure.src = "/assets/figures/qmira1.png";
  }

  function buildCardPlay(play) {
    const parent = getParentPlay(play);
    const host = isCurrentUserHost(play);

    const rank = normalizeRank(play?.card_rank || play?.rank);
    const suit = normalizeSuit(play?.card_suit || play?.suit);

    const shouldShowJ =
      host &&
      (
        (rank === "J" && suit === "SPADE") ||
        parent
      );

    if (shouldShowJ) {
      const source = parent || play;

      return {
        ...source,
        rank: "J",
        card_rank: "J",
        suit: "SPADE",
        card_suit: "SPADE",
        play_text: source.play_text || play.play_text || "",
        start_date: source.start_date || play.start_date,
        end_date: source.end_date || play.end_date,
        location: source.location || play.location,
        figure_src: resolveBombFigure("J")
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
      location: parent?.location || play.location,
      figure_src: resolveBombFigure("Q")
    };
  }

  async function fetchBombPlay(deckId, playId) {
    const token = localStorage.getItem("cooptrackToken");

    const response = await fetch(
      `${API_BASE_URL}/mazo/${deckId}/state`,
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
    const placard = document.getElementById("tribuna-placard") ||
      document.getElementById("bomba-placard");
    const content = document.getElementById("tribuna-content") ||
      document.getElementById("bomba-content");

    const actions = document.getElementById("tribuna-actions") ||
      document.getElementById("bomba-actions");

    if (!content) return;

    const cardPlay = buildCardPlay(play);

    if (placard && typeof window.renderPlacard === "function") {
      placard.innerHTML = "";

      const parent = getParentPlay(play);
      const deck =
        window.__currentDeck ||
        window.__currentState?.deck ||
        window.__currentState?.mazo ||
        {};

      const placardPlay = parent || play;

      window.renderPlacard(placard, {
        page: "bomba",
        play: placardPlay,
        photoUrl: deck.deck_image_url || "/assets/icons/sinPicture.gif",
        title: deck.name || "Mazo",
        rank: "A",
        suit: "HEART",
        showCurrency: false,
        leftCards: [],
        plays: window.__currentState?.plays || []
      });
    }

    const cardHtml = window.CartaTipo.renderPlayCardBox({
      ...cardPlay,
      play_text: cardPlay.play_text,
      start_date: cardPlay.start_date,
      end_date: cardPlay.end_date,
      location: cardPlay.location,
      spade_mode: "DEADLINE",
      figure_src: cardPlay.figure_src,
      showOwner: true,
      showActions: true,
      actionsHtml: buildStampHtml(play)
    });

    if (typeof window.renderAmsterdamMobile === "function") {
      content.innerHTML = window.renderAmsterdamMobile(cardPlay, {
        renderPlayCardBox: () => cardHtml
      });

      window.enableAmsterdamPeek?.();
      animateBombFigure(cardPlay.rank || cardPlay.card_rank);
    } else {
      content.innerHTML = `
        <section class="lienzo-tribune lienzo-tribune--target tribuna-single tribuna-single--amsterdam">
          <div class="lienzo-tribune__corporates"></div>
          <div class="lienzo-target-dropzone">
            ${cardHtml}
          </div>
        </section>
      `;
      animateBombFigure(cardPlay.rank || cardPlay.card_rank);
    }

    if (actions) {
      actions.innerHTML = "";
    }
    bindBombActions(play, Number(getParams().get("deckId") || 0));
  }

  function appendFlowFlag(playCode, flag) {
    const parts = String(playCode || "").split("§");

    while (parts.length < 9) {
      parts.push("");
    }

    const flowIndex = 7;
    const currentFlow = String(parts[flowIndex] || "");

    if (currentFlow.toUpperCase().includes(flag.toUpperCase())) {
      return parts.slice(0, 9).join("§");
    }

    parts[flowIndex] = currentFlow
      ? `${currentFlow};${flag}`
      : flag;

    return parts.slice(0, 9).join("§");
  }

  async function disableBomb(play) {
    const token = localStorage.getItem("cooptrackToken");
    if (!token) {
      alert("No estás logueado.");
      return false;
    }

    const parent = getParentPlay(play) || play;
    const playId = Number(parent?.id || play?.id || 0);
    if (!playId) {
      alert("No se encontró la jugada de la bomba.");
      return false;
    }

    const currentCode = String(parent?.play_code || play?.play_code || "");
    const nextCode = appendFlowFlag(currentCode, "bomb:DISABLED");

    const response = await fetch(`${API_BASE_URL}/plays/${playId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        play_code: nextCode
      })
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      console.error("No se pudo desactivar la bomba", data);
      alert(data?.error || "No se pudo desactivar la bomba.");
      return false;
    }

    return true;
  }

  async function patchBomb(playId, payload) {
    const token = localStorage.getItem("cooptrackToken");

    if (!token) {
      alert("No estás logueado");
      return false;
    }

    const response = await fetch(`${API_BASE_URL}/plays/${playId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      console.error("Error actualizando bomba:", data);
      alert(data?.error || "No se pudo actualizar la bomba.");
      return false;
    }

    return true;
  }

  function bindBombActions(play, deckId) {
    const disableBtn = document.getElementById("bomba-disable-btn");

    if (disableBtn) {
      disableBtn.addEventListener("click", async () => {
        disableBtn.disabled = true;

        const ok = await disableBomb(play);

        if (!ok) {
          disableBtn.disabled = false;
          return;
        }

        const parent = getParentPlay(play) || play;
        const playId = Number(parent?.id || play?.id || 0);

        const freshPlay = await fetchBombPlay(deckId, playId);
        if (freshPlay) {
          renderBomb(freshPlay);
          bindBombActions(freshPlay, deckId);
        }
      });
    }

    const cancelBtn = document.getElementById("bomba-cancel-btn");

    if (cancelBtn) {
      cancelBtn.addEventListener("click", async () => {
        cancelBtn.disabled = true;

        const parent = getParentPlay(play) || play;
        const playId = Number(parent?.id || play?.id || 0);
        const currentCode = String(parent?.play_code || play?.play_code || "");
        const nextCode = appendFlowFlag(currentCode, "bomb:DISABLED");

        const ok = await patchBomb(playId, {
          play_status: "CANCELLED",
          play_code: nextCode
        });

        if (!ok) {
          cancelBtn.disabled = false;
          return;
        }

        window.location.reload();
      });
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