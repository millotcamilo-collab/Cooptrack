(function () {
  const PLAY_SEPARATOR = '§';
  let activeTableroFilter = null;
  let activeTableroStatusFilter = null;

  const API_BASE_URL = "https://cooptrack-backend.onrender.com";

  function normalizeStatus(value) {
  return String(value || "").trim().toUpperCase();
}

function isStructuralPlay(play) {
  const action = safeTrim(play?.action).toLowerCase();
  return action === "init_ace" || action === "puedejugar";
}

function matchesStatusFilter(play, statusFilter) {
  const currentStatus = normalizeStatus(play?.play_status || play?.status);

  if (!statusFilter) return true;

  return currentStatus === normalizeStatus(statusFilter);
}
  
  function safeTrim(value) {
    if (value === null || value === undefined) return '';
    return String(value).trim();
  }

  function normalizeEmpty(value) {
    const v = safeTrim(value);
    return v === '' ? null : v;
  }

  function normalizeRank(rank) {
    const value = safeTrim(rank).toUpperCase();
    return value || null;
  }

  function normalizeSuit(suit) {
    const value = safeTrim(suit).toUpperCase();
    return value || null;
  }

  function parseList(value) {
    const raw = normalizeEmpty(value);
    if (!raw) return [];
    return raw
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatDate(value) {
    if (!value) return '—';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return escapeHtml(value);

    try {
      return date.toLocaleString('es-UY', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (error) {
      return escapeHtml(value);
    }
  }

  function parsePlayCode(playCode) {
    if (typeof playCode !== 'string' || !playCode.trim()) {
      return null;
    }

    const raw = playCode.trim();
    const parts = raw.split(PLAY_SEPARATOR);

    while (parts.length < 9) {
      parts.push('');
    }

    if (parts.length > 9) {
      return null;
    }

    return {
      raw,
      mazoId: normalizeEmpty(parts[0]),
      userId: normalizeEmpty(parts[1]),
      date: normalizeEmpty(parts[2]),
      rank: normalizeRank(parts[3]),
      suit: normalizeSuit(parts[4]),
      action: normalizeEmpty(parts[5]),
      authorized: normalizeEmpty(parts[6]),
      flow: normalizeEmpty(parts[7]),
      recipients: normalizeEmpty(parts[8]),
      authorizedList: parseList(parts[6]),
      recipientList: parseList(parts[8]),
    };
  }

  function normalizePlay(play) {
    const parsed = parsePlayCode(play?.play_code);

    const rank = parsed?.rank || normalizeRank(play?.card_rank);
    const suit = parsed?.suit || normalizeSuit(play?.card_suit);

    return {
      ...play,
      parsed,
      rank,
      suit,
      action: parsed?.action || null,
      flow: parsed?.flow || null,
      authorized: parsed?.authorized || null,
      recipients: parsed?.recipients || null,
      authorizedList: parsed?.authorizedList || [],
      recipientList: parsed?.recipientList || [],
      displayDate:
        parsed?.date ||
        play?.created_at ||
        play?.updated_at ||
        null,
      createdByNickname:
        play?.created_by_nickname ||
        play?.created_by_user_nickname ||
        '—',
      targetNickname:
        play?.target_user_nickname ||
        play?.target_nickname ||
        '—',
    };
  }

  
function belongsToTablero(play) {
  const rank = normalizeRank(play?.rank);
  const suit = normalizeSuit(play?.suit);

  if (!rank || !suit) return false;
  if (isStructuralPlay(play)) return false;

  if (rank === 'J') return true;
  if (rank === 'A' && suit !== 'HEART') return true;

  return false;
}
  function matchesTableroFilter(play, filterSuit) {
  const rank = normalizeRank(play?.rank);
  const suit = normalizeSuit(play?.suit);
  const filter = normalizeSuit(filterSuit);

  if (!filter) {
    return belongsToTablero(play);
  }

  if (filter === 'HEART') {
    return rank === 'J' && suit === 'HEART';
  }

  if (filter === 'SPADE') {
    return rank === 'J' && suit === 'SPADE';
  }

  if (filter === 'DIAMOND') {
    return rank === 'J' && suit === 'DIAMOND';
  }

  if (filter === 'CLUB') {
    return (rank === 'J' && suit === 'CLUB') || (rank === 'A');
  }

  return belongsToTablero(play);
}

  function getComponentName(play) {
    const rank = normalizeRank(play?.rank);
    const suit = normalizeSuit(play?.suit);

    if (rank === 'J' && suit === 'HEART') return 'Jcorazon';
    if (rank === 'J' && suit === 'SPADE') return 'Jpike';
    if (rank === 'J' && suit === 'CLUB') return 'Jtrebol';
    if (rank === 'J' && suit === 'DIAMOND') return 'Jdiamante';

    if (rank === 'Q' && suit === 'SPADE') return 'Qpike';
    if (rank === 'Q' && suit === 'CLUB') return 'Qtrebol';

    if (rank === 'A' && suit === 'SPADE') return 'Apike';
    if (rank === 'A' && suit === 'DIAMOND') return 'Adiamante';
    if (rank === 'A' && suit === 'CLUB') return 'Atrebol';

    return null;
  }

  function getCardLabel(play) {
    const rank = normalizeRank(play?.rank) || '?';
    const suit = normalizeSuit(play?.suit) || '?';

    const suitMap = {
      HEART: '♥',
      SPADE: '♠',
      CLUB: '♣',
      DIAMOND: '♦',
    };

    return `${rank}${suitMap[suit] || suit}`;
  }

  function renderFallbackRow(play) {
    const label = getCardLabel(play);
    const text = escapeHtml(play.play_text || 'Sin texto');
    const action = escapeHtml(play.action || '—');
    const flow = escapeHtml(play.flow || '—');
    const author = escapeHtml(play.createdByNickname || '—');
    const date = formatDate(play.displayDate);

    return `
      <article class="tablero-row tablero-row--fallback">
        <div class="tablero-row__left">
          <div class="tablero-row__card">${label}</div>
        </div>

        <div class="tablero-row__center">
          <div class="tablero-row__title">${escapeHtml(label)} · ${action}</div>
          <div class="tablero-row__text">${text}</div>
          <div class="tablero-row__meta">
            <span>Autor: ${author}</span>
            <span>Fecha: ${date}</span>
            <span>Flujo: ${flow}</span>
          </div>
        </div>

        <div class="tablero-row__right">
          <button type="button" disabled>Sin componente</button>
        </div>
      </article>
    `;
  }

  function renderEmptyState() {
    return `
      <section class="tablero-empty">
        <p>No hay jugadas para mostrar en el tablero.</p>
      </section>
    `;
  }

  function renderErrorState(message) {
    return `
      <section class="tablero-empty">
        <p>${escapeHtml(message || 'Error cargando tablero')}</p>
      </section>
    `;
  }

  function getRenderer(componentName) {
    if (!componentName) return null;

    const globalName = `render${componentName}`;
    const renderer = window[globalName];

    return typeof renderer === 'function' ? renderer : null;
  }

  function sortTableroPlays(plays) {
    return [...plays].sort((a, b) => {
      const aDate = new Date(a.displayDate || a.created_at || 0).getTime();
      const bDate = new Date(b.displayDate || b.created_at || 0).getTime();

      if (aDate !== bDate) return aDate - bDate;

      const aId = Number(a.id || 0);
      const bId = Number(b.id || 0);

      return aId - bId;
    });
  }

  function buildContext(deck, state) {
    return {
      deck,
      state,
      helpers: {
        escapeHtml,
        formatDate,
        getCardLabel,
      },
      dispatch(eventName, detail) {
        document.dispatchEvent(
          new CustomEvent(eventName, {
            detail: detail || {},
          })
        );
      },
    };
  }


  function renderTablero(deck, plays, state = {}) {
    const container = document.getElementById('tablero-container');

    if (!container) {
      console.warn('No existe #tablero-container');
      return;
    }

    try {
      const rawPlays = Array.isArray(plays) ? plays : [];
      const normalized = rawPlays.map(normalizePlay);

     const tableroPlays = sortTableroPlays(
  normalized.filter((play) => {
    if (!belongsToTablero(play)) return false;
    if (!matchesTableroFilter(play, activeTableroFilter)) return false;
    if (!matchesStatusFilter(play, activeTableroStatusFilter)) return false;
    return true;
  })
);

      if (!tableroPlays.length) {
        container.innerHTML = renderEmptyState();
        return;
      }

      const context = buildContext(deck, state);

      const rowsHtml = tableroPlays
        .map((play) => {
          const componentName = getComponentName(play);
          const renderer = getRenderer(componentName);

          if (renderer) {
            try {
              return renderer(play, context);
            } catch (error) {
              console.error(`Error renderizando ${componentName}`, error);
              return renderFallbackRow(play);
            }
          }

          return renderFallbackRow(play);
        })
        .join('');

      container.innerHTML = `
        <section class="tablero">
          ${rowsHtml}
        </section>
      `;
    } catch (error) {
      console.error('Error en renderTablero', error);
      container.innerHTML = renderErrorState('No se pudo renderizar el tablero');
    }
  }

  document.addEventListener('mazobar:filter', (event) => {
    const nextFilter = normalizeSuit(event?.detail?.filter);

    if (!nextFilter) {
      activeTableroFilter = null;
    } else if (activeTableroFilter === nextFilter) {
      activeTableroFilter = null;
    } else {
      activeTableroFilter = nextFilter;
    }

    const deck = window.__currentDeck || null;
    const state = window.__currentState || {};
    const plays = Array.isArray(state?.plays) ? state.plays : [];

    renderTablero(deck, plays, state);
  });
  
document.addEventListener("tablero:cancel-play", async (event) => {
  try {
    const playId = Number(event?.detail?.playId || 0);
    if (!playId) return;

    const token = localStorage.getItem("cooptrackToken");
    if (!token) {
      alert("No estás logueado");
      return;
    }

    const response = await fetch(`${API_BASE_URL}/plays/${playId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        play_status: "CANCELLED"
      })
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      console.error("Error cancelando jugada:", data);
      alert("No se pudo cancelar la jugada");
      return;
    }

    const deckId =
      data.deckId ||
      window.__currentDeck?.id ||
      window.__currentState?.deck?.id ||
      null;

    document.dispatchEvent(new CustomEvent("plays:changed", {
      detail: { deckId }
    }));
  } catch (error) {
    console.error("Error en tablero:cancel-play", error);
    alert("Error cancelando la jugada");
  }
});

document.addEventListener("tablero:change-suit", async (event) => {
  try {
    const {
      playId,
      nextSuit
    } = event.detail || {};

    if (!playId || !nextSuit) {
      alert("Datos inválidos para cambiar de palo");
      return;
    }

    const token = localStorage.getItem("cooptrackToken");
    if (!token) {
      alert("No estás logueado");
      return;
    }

    const response = await fetch(`${API_BASE_URL}/plays/${playId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        card_suit: nextSuit
      })
    });

    const data = await response.json();

    if (!response.ok || !data.ok || !data.play) {
      console.error("Error cambiando palo:", data);
      alert("No se pudo cambiar el palo de la jugada");
      return;
    }

    const deck = window.__currentDeck || null;
    const state = window.__currentState || {};
    const currentPlays = Array.isArray(state.plays) ? state.plays : [];

    const nextPlays = currentPlays.map((play) =>
      Number(play.id) === Number(data.play.id) ? data.play : play
    );

    const nextState = {
      ...state,
      plays: nextPlays
    };

    window.__currentState = nextState;
    renderTablero(deck, nextPlays, nextState);
  } catch (error) {
    console.error("Error en tablero:change-suit", error);
    alert("Error cambiando el palo");
  }
});
  
document.addEventListener("mazobar:showCancelled", () => {
  if (activeTableroStatusFilter === "CANCELLED") {
    activeTableroStatusFilter = null;
  } else {
    activeTableroStatusFilter = "CANCELLED";
  }

  activeTableroFilter = null;

  const deck = window.__currentDeck || null;
  const state = window.__currentState || {};
  const plays = Array.isArray(state?.plays) ? state.plays : [];

  renderTablero(deck, plays, state);
});

document.addEventListener("tablero:add-child-play", async (event) => {
  try {
    const {
      parentPlayId,
      childRank,
      childSuit
    } = event.detail || {};

    if (!parentPlayId || !childRank || !childSuit) {
      alert("Datos inválidos para crear jugada hija");
      return;
    }

    const token = localStorage.getItem("cooptrackToken");
    if (!token) {
      alert("No estás logueado");
      return;
    }

    const deckId =
      window.__currentDeck?.id ||
      window.__currentState?.deck?.id ||
      null;

    const userId =
      window.__currentState?.userId ||
      window.__currentUser?.id ||
      null;

    const currentPlays = Array.isArray(window.__currentState?.plays)
      ? window.__currentState.plays
      : [];

    const parentPlay = currentPlays.find(
      (play) => Number(play.id) === Number(parentPlayId)
    );

    if (!deckId || !userId || !parentPlay) {
      alert("No se pudo identificar la jugada madre");
      return;
    }

    const text = childRank === "J" && childSuit === "CLUB"
      ? ""
      : String(parentPlay.play_text || "").trim();

    
    const when = new Date().toISOString();

    const playCode = [
      deckId,
      userId,
      when,
      String(childRank).toUpperCase(),
      String(childSuit).toUpperCase(),
      "create_child",
      `U:${userId}`,
      `child_of:${parentPlayId}`,
      `U:${userId}`
    ].join("§");

    const response = await fetch(`${API_BASE_URL}/plays`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        deck_id: deckId,
        parent_play_id: parentPlayId,
        play_code: playCode,
        text,
        play_status: "ACTIVE"
      })
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      console.error("Error creando jugada hija:", data);
      alert("No se pudo crear la jugada hija");
      return;
    }

    document.dispatchEvent(new CustomEvent("plays:changed", {
      detail: { deckId }
    }));
  } catch (error) {
    console.error("Error en tablero:add-child-play", error);
    alert("Error creando la jugada hija");
  }
});
  
  document.addEventListener("tablero:save-play", async (event) => {
  try {
    const {
      playId,
      text,
      spadeMode,
      startDate,
      endDate,
      location,
      amount
    } = event.detail || {};

    console.log("SAVE DETAIL =", event.detail);

    if (!playId) {
      alert("playId inválido");
      return;
    }

    const token = localStorage.getItem("cooptrackToken");
    if (!token) {
      alert("No estás logueado");
      return;
    }

    const response = await fetch(`${API_BASE_URL}/plays/${playId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        text,
        spadeMode,
        startDate,
        endDate,
        location,
        amount
      })
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      console.error("Error guardando play:", data);
      alert("No se pudo guardar la jugada");
      return;
    }

    const deckId =
      window.__currentDeck?.id ||
      window.__currentState?.deck?.id ||
      null;

    document.dispatchEvent(new CustomEvent("plays:changed", {
      detail: { deckId }
    }));
  } catch (error) {
    console.error("Error en tablero:save-play", error);
    alert("Error guardando la jugada");
  }
});
  
  window.renderTablero = function renderTableroWithState(deck, plays, state = {}) {
    window.__currentDeck = deck || null;
    window.__currentState = state || {};
    renderTablero(deck, plays, state);
  };

  window.normalizeTableroPlay = normalizePlay;
  window.belongsToTablero = belongsToTablero;
})();
