(function () {
  const API_BASE_URL = "";
  const DEFAULT_AVATAR = "/assets/icons/singeta120.gif";

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatDate(value) {
    const date = new Date(value || "");
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function getToken() {
    return localStorage.getItem("cooptrackToken") || "";
  }

  async function fetchMessages(playId) {
    const token = getToken();

    const response = await fetch(`${API_BASE_URL}/plays/${playId}/messages`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json"
      }
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      const err = new Error(data?.error || "No se pudo cargar el talud");
      err.statusCode = response.status;
      throw err;
    }

    return data;
  }

  async function postMessage(playId, text) {
    const token = getToken();

    const response = await fetch(`${API_BASE_URL}/plays/${playId}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        Accept: "application/json"
      },
      body: JSON.stringify({ text })
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      const err = new Error(data?.error || "No se pudo enviar el mensaje");
      err.statusCode = response.status;
      throw err;
    }

    return data.message;
  }

  function renderMessage(message, currentUserId) {
    const mine = Number(message?.author_user_id || 0) === Number(currentUserId || 0);
    const messageId = Number(message?.id || 0);
    const text = String(message?.text || "").trim();
    const nickname = message?.author_nickname || "Usuario";
    const avatar = message?.author_profile_photo_url || DEFAULT_AVATAR;
    const at = formatDate(message?.created_at);

    return `
      <article class="talud__message ${mine ? "talud__message--mine" : ""}" data-message-id="${messageId}">
        <img class="talud__message-avatar" src="${escapeHtml(avatar)}" alt="${escapeHtml(nickname)}" />

        <div class="talud__bubble-wrap">
          <div class="talud__bubble-head">
            <span class="talud__author">${escapeHtml(nickname)}</span>
            <span class="talud__at">${escapeHtml(at)}</span>
          </div>

          <div class="talud__bubble">${escapeHtml(text)}</div>
        </div>
      </article>
    `;
  }

  function renderMessages(messages, currentUserId) {
    const safeList = Array.isArray(messages) ? messages : [];

    if (!safeList.length) {
      return '<div class="talud__empty">Todavia no hay comentarios</div>';
    }

    return safeList.map((message) => renderMessage(message, currentUserId)).join("");
  }

  function getCurrentUserId() {
    return Number(
      window.__currentUser?.id ||
      window.__currentState?.currentUser?.id ||
      window.__currentState?.userId ||
      0
    );
  }

  function normalizeRank(value) {
    return String(value || "").trim().toUpperCase();
  }

  function normalizeSuit(value) {
    return String(value || "").trim().toUpperCase();
  }

  function getSuitSymbol(suit) {
    const safeSuit = normalizeSuit(suit);

    if (safeSuit === "SPADE") return "&spades;";
    if (safeSuit === "HEART") return "&hearts;";
    if (safeSuit === "DIAMOND") return "&diams;";
    if (safeSuit === "CLUB") return "&clubs;";

    return escapeHtml(safeSuit.slice(0, 1) || "?");
  }

  function isRedSuit(suit) {
    const safeSuit = normalizeSuit(suit);
    return safeSuit === "HEART" || safeSuit === "DIAMOND";
  }

  function renderParticipantCards(cards) {
    const safeCards = Array.isArray(cards) ? cards : [];

    if (!safeCards.length) return "";

    const cardsHtml = safeCards
      .map((card) => {
        const rank = normalizeRank(card?.rank);
        const suit = normalizeSuit(card?.suit);
        const redClass = isRedSuit(suit) ? " talud__participant-card--red" : "";

        return `
          <span class="talud__participant-card${redClass}" title="${escapeHtml(rank)} ${escapeHtml(suit)}">
            <span class="talud__participant-card-rank">${escapeHtml(rank || "?")}</span>
            <span class="talud__participant-card-suit">${getSuitSymbol(suit)}</span>
          </span>
        `;
      })
      .join("");

    return `<span class="talud__participant-cards">${cardsHtml}</span>`;
  }

  function renderParticipants(participants, participantCardsByUserId) {
    const safeList = Array.isArray(participants) ? participants : [];
    const cardsByUser = participantCardsByUserId && typeof participantCardsByUserId === "object"
      ? participantCardsByUserId
      : {};

    if (!safeList.length) {
      return '<div class="talud__participants-empty">Sin participantes definidos</div>';
    }

    return safeList
      .map((user) => {
        const nickname = user?.nickname || `Usuario ${user?.id || ""}`;
        const avatar = user?.profile_photo_url || DEFAULT_AVATAR;
        const userId = Number(user?.id || 0);
        const participantCards = renderParticipantCards(cardsByUser[userId] || []);

        return `
          <div class="talud__participant" title="${escapeHtml(nickname)}">
            <img class="talud__participant-avatar" src="${escapeHtml(avatar)}" alt="${escapeHtml(nickname)}" />
            ${participantCards}
            <span class="talud__participant-name">${escapeHtml(nickname)}</span>
          </div>
        `;
      })
      .join("");
  }

  function renderShell(host, state) {
    const title = state?.play?.play_text || "Talud";
    const participantsHtml = renderParticipants(
      state?.participants || [],
      state?.participantCardsByUserId || {}
    );
    const messagesHtml = renderMessages(state?.messages || [], getCurrentUserId());

    host.innerHTML = `
      <section class="talud" data-play-id="${Number(state?.play?.id || 0)}">
        <header class="talud__header">
          <h3 class="talud__title">${escapeHtml(title)}</h3>
          <div class="talud__participants">${participantsHtml}</div>
        </header>

        <div class="talud__timeline" id="talud-timeline">${messagesHtml}</div>

        <form class="talud__composer" id="talud-composer">
          <textarea
            id="talud-text"
            class="talud__textarea"
            rows="2"
            maxlength="2000"
            placeholder="Escribe un comentario..."
          ></textarea>

          <button type="submit" id="talud-send" class="talud__send">Enviar</button>
          <button type="button" id="talud-close" class="talud__close">Close Talud</button>
        </form>
      </section>
    `;
  }

  function scrollToBottom(host) {
    const timeline = host.querySelector("#talud-timeline");
    if (!timeline) return;
    timeline.scrollTop = timeline.scrollHeight;
  }

  function scrollToMessage(host, messageId) {
    const targetId = Number(messageId || 0);
    if (!targetId) {
      scrollToBottom(host);
      return;
    }

    const target = host.querySelector(`[data-message-id="${targetId}"]`);
    if (!target) {
      scrollToBottom(host);
      return;
    }

    target.scrollIntoView({ block: "center", behavior: "smooth" });
    target.classList.add("talud__message--focus");

    window.setTimeout(() => {
      target.classList.remove("talud__message--focus");
    }, 1800);
  }

  function injectStylesOnce() {
    if (document.getElementById("talud-inline-styles")) return;

    const style = document.createElement("style");
    style.id = "talud-inline-styles";
    style.textContent = `
      .talud { border: 1px solid rgba(0,0,0,.12); border-radius: 12px; background: #fff; }
      .talud--unavailable { display: flex; align-items: center; justify-content: center; min-height: 160px; }
      .talud__unavailable-content { text-align: center; padding: 20px; }
      .talud__unavailable-message { margin: 0 0 8px; font-size: 14px; font-weight: 600; color: #333; }
      .talud__unavailable-hint { margin: 0; font-size: 13px; color: #777; }
      .talud__header { padding: 10px 12px; border-bottom: 1px solid rgba(0,0,0,.08); }
      .talud__title { margin: 0 0 8px; font-size: 15px; font-weight: 600; }
      .talud__participants { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 2px; }
      .talud__participant { display: inline-flex; align-items: center; gap: 5px; }
      .talud__participant-avatar { width: 20px; height: 20px; border-radius: 50%; object-fit: cover; }
      .talud__participant-cards { display: inline-flex; align-items: center; gap: 4px; }
      .talud__participant-card { display: inline-flex; align-items: center; gap: 2px; padding: 1px 4px; border: 1px solid rgba(0,0,0,.25); border-radius: 6px; background: #fff; color: #111; font-size: 11px; line-height: 1; }
      .talud__participant-card--red { color: #b10000; border-color: rgba(177,0,0,.45); }
      .talud__participant-card-rank { font-weight: 700; }
      .talud__participant-card-suit { font-weight: 700; }
      .talud__participant-name { font-size: 12px; white-space: nowrap; }
      .talud__timeline { max-height: 320px; overflow-y: auto; padding: 10px 12px; background: #fffef9; }
      .talud__empty { font-size: 13px; color: #555; }
      .talud__message { display: flex; gap: 8px; margin-bottom: 10px; }
      .talud__message--mine { flex-direction: row-reverse; }
      .talud__message--focus { outline: 2px solid #d28a00; border-radius: 10px; }
      .talud__message-avatar { width: 26px; height: 26px; border-radius: 50%; object-fit: cover; flex: 0 0 auto; }
      .talud__bubble-wrap { max-width: min(82%, 560px); }
      .talud__bubble-head { display: flex; gap: 8px; align-items: baseline; margin-bottom: 2px; }
      .talud__author { font-size: 12px; font-weight: 600; }
      .talud__at { font-size: 11px; color: #666; }
      .talud__bubble { padding: 8px 10px; border-radius: 12px; background: #f5f5f5; font-size: 14px; line-height: 1.3; white-space: pre-wrap; word-break: break-word; }
      .talud__message--mine .talud__bubble { background: #e9f6ff; }
      .talud__composer { display: flex; gap: 8px; padding: 10px 12px; border-top: 1px solid rgba(0,0,0,.08); }
      .talud__textarea { flex: 1; resize: vertical; min-height: 38px; max-height: 130px; border: 1px solid rgba(0,0,0,.2); border-radius: 8px; padding: 8px; font: inherit; }
      .talud__send { border: 0; border-radius: 8px; padding: 0 12px; min-width: 78px; background: #202020; color: #fff; font-weight: 600; cursor: pointer; }
      .talud__send:disabled { opacity: .55; cursor: default; }
      .talud__close { border: 0; border-radius: 8px; padding: 0 12px; min-width: 96px; background: #666; color: #fff; font-weight: 600; cursor: pointer; }
    `;

    document.head.appendChild(style);
  }

  function renderUnavailable(host) {
    host.innerHTML = `
      <section class="talud talud--unavailable">
        <div class="talud__unavailable-content">
          <p class="talud__unavailable-message">
            Talud no está disponible aún en esta instalación
          </p>
          <p class="talud__unavailable-hint">
            Los comentarios de jugadas se implementarán en futuras versiones
          </p>
        </div>
      </section>
    `;
  }

  async function mount(host, options = {}) {
    const target = typeof host === "string" ? document.querySelector(host) : host;
    if (!target) throw new Error("No se encontro el contenedor de talud");

    const playId = Number(options.playId || 0);
    const focusMessageId = Number(options.focusMessageId || 0);
    const onClose = typeof options.onClose === "function" ? options.onClose : null;
    if (!playId) throw new Error("playId es obligatorio para talud");

    injectStylesOnce();

    try {
      const participantCardsByUserId =
        options?.participantCardsByUserId && typeof options.participantCardsByUserId === "object"
          ? options.participantCardsByUserId
          : {};

      const state = await fetchMessages(playId);
      renderShell(target, {
        ...state,
        participantCardsByUserId
      });
      scrollToMessage(target, focusMessageId);

      const form = target.querySelector("#talud-composer");
      const textArea = target.querySelector("#talud-text");
      const sendBtn = target.querySelector("#talud-send");
      const closeBtn = target.querySelector("#talud-close");
      const timeline = target.querySelector("#talud-timeline");

      if (!form || !textArea || !sendBtn || !timeline) {
        return {
          refresh: async function refreshOnly() {
            const nextState = await fetchMessages(playId);
            renderShell(target, {
              ...nextState,
              participantCardsByUserId
            });
          }
        };
      }

      if (closeBtn && onClose) {
        closeBtn.addEventListener("click", (event) => {
          event.preventDefault();
          onClose();
        });
      }

      form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const text = String(textArea.value || "").trim();
        if (!text) return;

        sendBtn.disabled = true;

        try {
          await postMessage(playId, text);
          textArea.value = "";

          const nextState = await fetchMessages(playId);
          timeline.innerHTML = renderMessages(nextState?.messages || [], getCurrentUserId());
          scrollToBottom(target);
        } catch (error) {
          console.error("Error enviando mensaje de talud", error);
          alert(error?.message || "No se pudo enviar el mensaje");
        } finally {
          sendBtn.disabled = false;
        }
      });

      return {
        refresh: async function refreshTalud() {
          const nextState = await fetchMessages(playId);
          timeline.innerHTML = renderMessages(nextState?.messages || [], getCurrentUserId());
        }
      };
    } catch (error) {
      console.error("Error montando talud", error);

      if (error?.statusCode === 503) {
        renderUnavailable(target);
        return {
          refresh: async function refreshNoop() {
            // no-op para unavailable
          }
        };
      }

      throw error;
    }
  }

  window.Talud = {
    mount,
    fetchMessages,
    postMessage
  };
})();
