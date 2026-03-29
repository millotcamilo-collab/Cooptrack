(function () {
  const PLAY_SEPARATOR = '§';
  let activeTableroFilter = null;

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

    if (rank === 'J') return true;
    if (rank === 'Q' && (suit === 'SPADE' || suit === 'CLUB')) return true;
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
      return false;
    }

    if (filter === 'CLUB') {
      return rank === 'A';
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
        normalized.filter((play) => matchesTableroFilter(play, activeTableroFilter))
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

  window.renderTablero = function renderTableroWithState(deck, plays, state = {}) {
    window.__currentDeck = deck || null;
    window.__currentState = state || {};
    renderTablero(deck, plays, state);
  };

  window.normalizeTableroPlay = normalizePlay;
  window.belongsToTablero = belongsToTablero;
})();
