(function () {
  let administradoresDeck = null;
  let administradoresState = {};
  let administradoresPlays = [];
  let activeAdministradoresMode = "AK";

  function getContainer() {
    return (
      document.getElementById("autoridades-container") ||
      document.getElementById("administradores-container")
    );
  }

  function safeTrim(value) {
    if (value === null || value === undefined) return "";
    return String(value).trim();
  }

  function normalizeRank(value) {
    return safeTrim(value).toUpperCase();
  }

  function normalizeSuit(value) {
    return safeTrim(value).toUpperCase();
  }

  function normalizeEmpty(value) {
    const v = safeTrim(value);
    return v === "" ? null : v;
  }

  function parseList(value) {
    const raw = normalizeEmpty(value);
    if (!raw) return [];
    return raw
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatDate(value) {
    if (!value) return "—";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return escapeHtml(value);

    try {
      return date.toLocaleString("es-UY", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch (error) {
      return escapeHtml(value);
    }
  }

  function parsePlayCode(playCode) {
    if (typeof playCode !== "string" || !playCode.trim()) {
      return null;
    }

    const raw = playCode.trim();
    const parts = raw.split("§");

    while (parts.length < 9) {
      parts.push("");
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
      recipientList: parseList(parts[8])
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
        null,
      targetNickname:
        play?.target_user_nickname ||
        play?.target_nickname ||
        null,
      targetProfilePhotoUrl:
        play?.target_user_profile_photo_url ||
        play?.target_profile_photo_url ||
        null
    };
  }

  function isStructuralPlay(play) {
    const action = safeTrim(play?.action).toLowerCase();
    return action === "init_ace" || action === "puedejugar";
  }

  function belongsToAdministradores(play, mode = "AK") {
    const rank = normalizeRank(play?.rank);
    const suit = normalizeSuit(play?.suit);

    if (!rank) return false;

    if (rank === "JOKER" && suit === "BLUE") {
      return true;
    }

    if (rank === "A") {
      return true;
    }

    if (rank === "K") {
      return mode === "AK";
    }

    return false;
  }

  function getComponentName(play) {
    const rank = normalizeRank(play?.rank);
    const suit = normalizeSuit(play?.suit);

    if (rank === "A" || rank === "K") return "Arow";
    if (rank === "JOKER" && suit === "BLUE") return "Jokerazul";

    return null;
  }

  function getRenderer(componentName) {
    if (!componentName) return null;

    const globalName = `render${componentName}`;
    const renderer = window[globalName];

    return typeof renderer === "function" ? renderer : null;
  }

  function sortAdministradoresPlays(plays) {
    return [...plays].sort((a, b) => {
      const aRank = normalizeRank(a?.rank);
      const bRank = normalizeRank(b?.rank);

      const rankOrder = {
        JOKER: 0,
        A: 1,
        K: 2
      };

      const aRankOrder = rankOrder[aRank] ?? 99;
      const bRankOrder = rankOrder[bRank] ?? 99;

      if (aRankOrder !== bRankOrder) {
        return aRankOrder - bRankOrder;
      }

      const aSuit = normalizeSuit(a?.suit);
      const bSuit = normalizeSuit(b?.suit);

      const suitOrder = {
        BLUE: 0,
        HEART: 1,
        SPADE: 2,
        DIAMOND: 3,
        CLUB: 4
      };

      const aSuitOrder = suitOrder[aSuit] ?? 99;
      const bSuitOrder = suitOrder[bSuit] ?? 99;

      if (aSuitOrder !== bSuitOrder) {
        return aSuitOrder - bSuitOrder;
      }

      const aDate = new Date(a.displayDate || a.created_at || 0).getTime();
      const bDate = new Date(b.displayDate || b.created_at || 0).getTime();

      if (aDate !== bDate) {
        return aDate - bDate;
      }

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
        formatDate
      },
      dispatch(eventName, detail) {
        document.dispatchEvent(
          new CustomEvent(eventName, {
            detail: detail || {}
          })
        );
      }
    };
  }

  function getAdminViewFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return String(params.get("adminView") || "").toUpperCase();
  }

  function renderEmptyState(mode) {
    const label = mode === "AK"
      ? "As, Reyes y Joker azul"
      : "As y Joker azul";

    return `
      <section class="tablero-empty">
        <p>No hay ${escapeHtml(label)} para mostrar.</p>
      </section>
    `;
  }

  function renderErrorState(message) {
    return `
      <section class="tablero-empty">
        <p>${escapeHtml(message || "Error cargando administradores")}</p>
      </section>
    `;
  }

  function showAdministradoresContainer() {
    const container = getContainer();
    if (container) {
      container.style.display = "";
    }

    const tablero = document.getElementById("tablero-container");
    if (tablero) {
      tablero.style.display = "none";
    }
  }

  function hideAdministradoresContainer() {
    const container = getContainer();
    if (container) {
      container.style.display = "none";
    }
  }

  function renderAdministradoresView(mode = "AK") {
    const container = getContainer();

    if (!container) {
      console.warn("No existe autoridades-container / administradores-container");
      return;
    }

    try {
      activeAdministradoresMode =
        String(mode || "").toUpperCase() === "A" ? "A" : "AK";

      const normalized = Array.isArray(administradoresPlays)
        ? administradoresPlays.map(normalizePlay)
        : [];

      const filtered = sortAdministradoresPlays(
        normalized.filter((play) =>
          belongsToAdministradores(play, activeAdministradoresMode)
        )
      );

      if (!filtered.length) {
        container.innerHTML = renderEmptyState(activeAdministradoresMode);
        return;
      }

      const context = buildContext(
        administradoresDeck,
        administradoresState
      );

      const rowsHtml = filtered
        .map((play) => {
          const componentName = getComponentName(play);
          const renderer = getRenderer(componentName);

          if (!renderer) {
            return "";
          }

          try {
            return renderer(play, context);
          } catch (error) {
            console.error("Error renderizando row de administradores", error, play);
            return "";
          }
        })
        .filter(Boolean)
        .join("");

      container.innerHTML = `
      <section class="administradores-view administradores-view--mode-${escapeHtml(activeAdministradoresMode)}">
        ${rowsHtml}
      </section>
    `;
    } catch (error) {
      console.error("Error en renderAdministradoresView", error);
      container.innerHTML = renderErrorState(error?.message);
    }
  }

  function renderAdministradores(deck, plays, state = {}) {
    administradoresDeck = deck || null;
    administradoresState = state || {};
    administradoresPlays = Array.isArray(plays) ? plays : [];

    const container = getContainer();
    if (!container) {
      console.warn("No existe autoridades-container / administradores-container");
      return;
    }

    const urlMode = getAdminViewFromUrl();

    if (urlMode === "A" || urlMode === "AK") {
      activeAdministradoresMode = urlMode;
      showAdministradoresContainer();
    } else {
      hideAdministradoresContainer();
    }

    renderAdministradoresView(activeAdministradoresMode);
  }

  document.addEventListener("mazobar:showAutoridades", (event) => {
    const mode = String(event?.detail?.mode || "A").toUpperCase();
    showAdministradoresContainer();
    renderAdministradoresView(mode);
  });

  window.renderAdministradores = renderAdministradores;
  window.renderAutoridades = renderAdministradores;

  window.showAdministradoresView = function (mode = "A") {
    showAdministradoresContainer();
    renderAdministradoresView(mode);
  };

  window.hideAdministradoresView = hideAdministradoresContainer;
})();