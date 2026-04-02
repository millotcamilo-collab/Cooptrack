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

    sendBtn.addEventListener("click", () => {
      setMessage(
        `Solicitud de Joker azul disparada para el mazo ${deckId}.`,
        "success"
      );
    });
  }

  document.addEventListener("DOMContentLoaded", initJokerBluePage);
})();
