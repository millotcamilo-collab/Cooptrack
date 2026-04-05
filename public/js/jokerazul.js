(() => {
  const API_BASE_URL = "https://cooptrack-backend.onrender.com";
  const ADMIN_USER_ID = 1; // cambiar por el user id real del server/admin

  function getDeckIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return Number(params.get("deckId") || params.get("mazoId") || 0);
  }

  function getToken() {
    return localStorage.getItem("cooptrackToken") || "";
  }

  function decodeJwtPayload(token) {
    try {
      const base64 = token.split(".")[1];
      if (!base64) return null;
      return JSON.parse(atob(base64));
    } catch (error) {
      console.error("No se pudo decodificar el token", error);
      return null;
    }
  }

  function setMessage(text, type = "normal") {
    const msgEl = document.getElementById("jokerBlueMsg");
    if (!msgEl) return;

    msgEl.textContent = text || "";

    if (type === "error") {
      msgEl.style.color = "#8a2d2d";
      return;
    }

    if (type === "success") {
      msgEl.style.color = "#1f5f3a";
      return;
    }

    msgEl.style.color = "#222";
  }

  function setSendButtonState(disabled, label) {
    const btn = document.getElementById("sendJokerBlueBtn");
    if (!btn) return;

    btn.disabled = !!disabled;

    if (label) {
      btn.textContent = label;
    }
  }

  function renderJokerBluePlacard(deckId) {
    const host = document.getElementById("jokerBluePlacard");
    if (!host) return;

    if (typeof window.renderPlacard !== "function") {
      console.warn("renderPlacard no está disponible");
      return;
    }

    window.renderPlacard(host, {
      photoUrl: "/assets/icons/joker_blue.gif",
      rank: "JOKER",
      suit: "BLUE",
      title: deckId
        ? `Solicitud Joker azul · mazo ${deckId}`
        : "Solicitud Joker azul",
      currencyCode: "",
      currencyName: "",
      showCurrency: false
    });
  }

  function buildJokerBluePlayCode(deckId, userId, nowIso) {
    return [
      deckId,
      userId,
      nowIso,
      "JOKER",
      "BLUE",
      "request_blue_joker",
      `U:${userId}`,
      "manual",
      `U:${ADMIN_USER_ID}`
    ].join("§");
  }

  async function sendJokerBlueRequest(deckId) {
    try {
      const token = getToken();

      if (!token) {
        setMessage("No estás logueado.", "error");
        return null;
      }

      const payload = decodeJwtPayload(token);
      const userId = Number(payload?.userId || 0);

      if (!userId) {
        setMessage("No se pudo identificar al solicitante.", "error");
        return null;
      }

      const now = new Date().toISOString();
      const playCode = buildJokerBluePlayCode(deckId, userId, now);

      setMessage("Enviando solicitud al server...");

      const response = await fetch(`${API_BASE_URL}/plays`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          deck_id: deckId,
          parent_play_id: null,
          target_user_id: ADMIN_USER_ID,
          play_code: playCode,
          play_status: "PENDING",
          text: "Solicitud de certificación"
        })
      });

      const data = await response.json();

      if (!response.ok || !data?.ok) {
        console.error("Error backend Joker Azul:", data);
        setMessage(data?.error || "Error al crear la solicitud.", "error");
        return null;
      }

      const createdPlayId = Number(data?.play?.id || 0);

      setMessage(
        "Solicitud de certificación enviada. Queda pendiente de aprobación.",
        "success"
      );

      return {
        ok: true,
        playId: createdPlayId
      };
    } catch (error) {
      console.error("Error enviando solicitud de certificación:", error);
      setMessage("Falló el envío de la solicitud.", "error");
      return null;
    }
  }

  function goToDeck(deckId, playId) {
    if (!deckId) {
      window.location.href = "/mazos.html";
      return;
    }

    const focusPart = playId ? `&focusPlayId=${playId}` : "";
    window.location.href = `/mazo.html?id=${deckId}&adminView=A${focusPart}`;
  }

  function bindSend(deckId) {
    const sendBtn = document.getElementById("sendJokerBlueBtn");
    if (!sendBtn) {
      console.warn("sendJokerBlueBtn no encontrado");
      return;
    }

    sendBtn.addEventListener("click", async () => {
      setSendButtonState(true, "Sending...");

      const result = await sendJokerBlueRequest(deckId);

      if (!result?.ok) {
        setSendButtonState(false, "Send");
        return;
      }

      setTimeout(() => {
        goToDeck(deckId, result.playId);
      }, 700);
    });
  }

  function initJokerBluePage() {
    const deckId = getDeckIdFromUrl();

    renderJokerBluePlacard(deckId);

    const sendBtn = document.getElementById("sendJokerBlueBtn");
    if (!sendBtn) return;

    if (!deckId) {
      sendBtn.disabled = true;
      setMessage("Falta deckId en la URL.", "error");
      return;
    }

    setMessage(
      `Solicitud preparada para el mazo ${deckId}. Se enviará al server para aprobación.`
    );

    bindSend(deckId);
  }

  document.addEventListener("DOMContentLoaded", initJokerBluePage);
})();