// CoopTrack site loader (topbar + auth UI)
// - Inserta partials/topbar.html en #topbar-slot
// - Mantiene un "login simulado" con localStorage para que NO se pierda al recargar.

const AUTH_KEY = "cooptrack.auth.v1"; // "1" logueado, "0" anon
const USERNAME_KEY = "cooptrack.user.name.v1";

function getIsAuthenticated() {
  return localStorage.getItem(AUTH_KEY) === "1";
}

function setIsAuthenticated(val) {
  localStorage.setItem(AUTH_KEY, val ? "1" : "0");
}

function getUserName() {
  return localStorage.getItem(USERNAME_KEY) || "Usuario";
}

function setUserName(name) {
  localStorage.setItem(USERNAME_KEY, name || "Usuario");
}

function applyAuthUI(isAuthenticated) {
  document.querySelectorAll('[data-when="guest"]').forEach(el => {
    el.style.display = isAuthenticated ? "none" : "";
  });
  document.querySelectorAll('[data-when="auth"]').forEach(el => {
    el.style.display = isAuthenticated ? "" : "none";
  });

  const nameEl = document.getElementById("userName");
  if (nameEl) nameEl.textContent = getUserName();
}

function wireAuthButtons() {
  const btnLogin = document.getElementById("btnLogin");
  const btnLogout = document.getElementById("btnLogout");

  btnLogin?.addEventListener("click", () => {
    // simulación: luego vendrá del backend
    setIsAuthenticated(true);
    setUserName("Camilo");
    applyAuthUI(true);
  });

  btnLogout?.addEventListener("click", () => {
    setIsAuthenticated(false);
    applyAuthUI(false);
  });
}

async function loadTopbar() {
  const slot = document.getElementById("topbar-slot");
  if (!slot) return;

  const res = await fetch("/partials/topbar.html", { cache: "no-store" });
  if (!res.ok) {
    slot.innerHTML = "<!-- topbar not found -->";
    return;
  }
  slot.innerHTML = await res.text();

  // después de insertar el HTML, aplicamos auth + eventos
  const authed = getIsAuthenticated();
  applyAuthUI(authed);
  wireAuthButtons();
}

document.addEventListener("DOMContentLoaded", loadTopbar);
