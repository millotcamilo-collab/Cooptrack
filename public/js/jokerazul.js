(() => {
  const API_BASE_URL = "https://cooptrack-backend.onrender.com";
  const ADMIN_USER_ID = 1; // cambiar por tu user id admin real

  function getDeckIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get("deckId") || params.get("mazoId") || "";
  }

  function setMessage(text, type = "normal") {
    const msgEl = document.getElementById("jokerBlueMsg");
    if (!msgEl) return;

    msgEl.textContent = text;

    if (type === "error") {
      msgEl.style.color = "#8a2d2d";
    } else if (type === "success") {
      msgEl.style.color = "#1f5f3a";
    } else {
      msgEl.style.color = "#222";
    }
  }

  async function sendJokerBlueRequest(deckId) {
  try {
    const token = localStorage.getItem("cooptrackToken");

    if (!token) {
      setMessage("No estás logueado.", "error");
      return;
    }

    const payload = JSON.parse(atob(token.split(".")[1]));
    const userId = payload.userId;
    const now = new Date().toISOString();

    const playCode =
      `${deckId}§${userId}§${now}§JOKER§BLUE§request_blue_joker§U:${userId}§manual§U:${ADMIN_USER_ID}`;

    setMessage("Enviando solicitud...");

    const response = await fetch(`${API_BASE_URL}/plays`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
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

    if (!response.ok || !data.ok) {
      console.error("Error backend:", data);
      setMessage(data.error || "Error al crear la solicitud.", "error");
      return;
    }

    setMessage("Solicitud de certificación enviada.", "success");

    window.location.href = `/mazo.html?id=${deckId}&tableroView=A`;
  } catch (error) {
    console.error("Error enviando solicitud de certificación:", error);
    setMessage("Falló el envío de la solicitud.", "error");
  }
}
  function initJokerBluePage() {
    const sendBtn = document.getElementById("sendJokerBlueBtn");
    const deckId = getDeckIdFromUrl();

    if (!sendBtn) {
      console.warn("sendJokerBlueBtn no encontrado");
      return;
    }

    if (!deckId) {
      sendBtn.disabled = true;
      setMessage("Falta deckId en la URL.", "error");
      return;
    }

    setMessage(`Solicitud preparada para el mazo ${deckId}.`);

    sendBtn.addEventListener("click", async () => {
      await sendJokerBlueRequest(deckId);
    });
  }

  document.addEventListener("DOMContentLoaded", initJokerBluePage);
})();
