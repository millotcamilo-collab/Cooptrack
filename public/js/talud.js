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
      throw new Error(data?.error || "No se pudo cargar el talud");
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
      throw new Error(data?.error || "No se pudo enviar el mensaje");
    }

    return data.message;
  }

  function renderParticipants(participants) {
    const safeList = Array.isArray(participants) ? participants : [];

    if (!safeList.length) {
      return '<div class="talud__participants-empty">Sin participantes definidos</div>';
    }

    return safeList
      .map((user) => {
        const nickname = user?.nickname || `Usuario ${user?.id || ""}`;
        const avatar = user?.profile_photo_url || DEFAULT_AVATAR;

        return `
          <div class="talud__participant" title="${escapeHtml(nickname)}">
            <img class="talud__participant-avatar" src="${escapeHtml(avatar)}" alt="${escapeHtml(nickname)}" />
            <span class="talud__participant-name">${escapeHtml(nickname)}</span>
          </div>
        `;
      })
      .join("");
  }

  function renderMessage(message, currentUserId) {
    const mine = Number(message?.author_user_id || 0) === Number(currentUserId || 0);
    const text = String(message?.text || "").trim();
    const nickname = message?.author_nickname || "Usuario";
    const avatar = message?.author_profile_photo_url || DEFAULT_AVATAR;
    const at = formatDate(message?.created_at);

    return `
      <article class="talud__message ${mine ? "talud__message--mine" : ""}">
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

  function renderShell(host, state) {
    const title = state?.play?.play_text || "Talud";
    const participantsHtml = renderParticipants(state?.participants || []);
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
        </form>
      </section>
    `;
  }

  function scrollToBottom(host) {
    const timeline = host.querySelector("#talud-timeline");
    if (!timeline) return;
    timeline.scrollTop = timeline.scrollHeight;
  }

  function injectStylesOnce() {
    if (document.getElementById("talud-inline-styles")) return;

    const style = document.createElement("style");
    style.id = "talud-inline-styles";
    style.textContent = `
      .talud { border: 1px solid rgba(0,0,0,.12); border-radius: 12px; background: #fff; }
      .talud__header { padding: 10px 12px; border-bottom: 1px solid rgba(0,0,0,.08); }
      .talud__title { margin: 0 0 8px; font-size: 15px; font-weight: 600; }
      .talud__participants { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 2px; }
      .talud__participant { display: inline-flex; align-items: center; gap: 5px; }
      .talud__participant-avatar { width: 20px; height: 20px; border-radius: 50%; object-fit: cover; }
      .talud__participant-name { font-size: 12px; white-space: nowrap; }
      .talud__timeline { max-height: 320px; overflow-y: auto; padding: 10px 12px; background: #fffef9; }
      .talud__empty { font-size: 13px; color: #555; }
      .talud__message { display: flex; gap: 8px; margin-bottom: 10px; }
      .talud__message--mine { flex-direction: row-reverse; }
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
    `;

    document.head.appendChild(style);
  }

  async function mount(host, options = {}) {
    const target = typeof host === "string" ? document.querySelector(host) : host;
    if (!target) throw new Error("No se encontro el contenedor de talud");

    const playId = Number(options.playId || 0);
    if (!playId) throw new Error("playId es obligatorio para talud");

    injectStylesOnce();

    const state = await fetchMessages(playId);
    renderShell(target, state);
    scrollToBottom(target);

    const form = target.querySelector("#talud-composer");
    const textArea = target.querySelector("#talud-text");
    const sendBtn = target.querySelector("#talud-send");
    const timeline = target.querySelector("#talud-timeline");

    if (!form || !textArea || !sendBtn || !timeline) {
      return {
        refresh: async function refreshOnly() {
          const nextState = await fetchMessages(playId);
          renderShell(target, nextState);
        }
      };
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
  }

  window.Talud = {
    mount,
    fetchMessages,
    postMessage
  };
})();
