function renderTopbar() {
  const topbarHTML = `
    <header class="topbar">
      <div class="brand">
        <div class="brand-mark">🂡</div>
        <span>CoopTrack</span>
      </div>

      <nav class="nav">
        <a href="/">Almanaque</a>
        <a href="/help.html">Help</a>
        <a href="/login.html" class="primary">Login</a>
      </nav>
    </header>
  `;

  const container = document.getElementById("topbar-container");

  if (container) {
    container.innerHTML = topbarHTML;
  }
}

renderTopbar();