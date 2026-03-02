// /assets/js/auth-ui.js
(function () {
  function isLogged() {
    // Ajustá estas keys a lo que estés usando realmente
    const token = localStorage.getItem("token");
    const user  = localStorage.getItem("user"); // opcional
    return !!token || !!user;
  }

  function applyAuthUI() {
    const logged = isLogged();

    document.querySelectorAll('[data-when="auth"]').forEach(el => {
      el.style.display = logged ? "" : "none";
    });

    document.querySelectorAll('[data-when="guest"]').forEach(el => {
      el.style.display = logged ? "none" : "";
    });

    // nombre visible si existe
    try {
      const u = JSON.parse(localStorage.getItem("user") || "null");
      if (u && u.name && document.getElementById("userName")) {
        document.getElementById("userName").textContent = u.name;
      }
    } catch (_) {}
  }

  document.addEventListener("DOMContentLoaded", applyAuthUI);

  // por si tu login ocurre y querés refrescar UI sin recargar
  window.applyAuthUI = applyAuthUI;
})();
