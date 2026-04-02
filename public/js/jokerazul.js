(() => {
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
    const token = localStorage.getItem("cooptrackToken");

    if (!token) {
      setMessage("No estás logueado.", "error");
      return;
    }

    const payload = JSON.parse(atob(token.split(".")[1]));
    const userId = payload.userId;
    const now = new Date().toISOString();

    const playCode =
      `${deckId}§${userId}§${now}§JOKER§BLUE§request_blue_joker§U:${userId}§manual§U:${userId}`;

    const response = await fetch("https://cooptrack-backend.onrender.com/plays", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        deck_id: deckId,
        parent_play_id: null,
        target_user_id: null,
        play_code: playCode,
        play_status: "PENDING",
        text: "Solicitud de Joker azul"
      })
    });

    const data = await response.json();

    if (!data.ok) {
      console.error("Error backend:", data);
      setMessage(data.error || "Error al crear la solicitud.", "error");
      return;
    }

    setMessage("Solicitud de Joker azul enviada.", "success");
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
