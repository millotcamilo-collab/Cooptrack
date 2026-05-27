(function () {
  function getToken() {
    return localStorage.getItem("cooptrackToken");
  }

async function fetchNewsPlays() {
  const token = getToken();

  const response = await fetch("/plays/noticias", {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  const data = await response.json();

  if (!response.ok || !data.ok) {
    throw new Error(data.error || "No se pudieron cargar las noticias");
  }

  return data.plays || [];
}

function openPlay(play) {
  const deckId = Number(play.deck_id || 0);
  const playId = Number(play.id || 0);

  if (!deckId || !playId) return;

  window.location.href =
    `/lienzoQpica.html?deckId=${deckId}&parentPlayId=${playId}&mode=news`;
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
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString("es-UY", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function renderJHeartTicker(play) {
  const texts = Array.isArray(play.approved_jheart_texts)
    ? play.approved_jheart_texts
    : [];

  if (!texts.length) return "";

  return `
    <div class="placard__subtitle placard__subtitle--ticker">
      <div class="placard__ticker-track">
        ${texts
          .map((text) => `<span class="placard__ticker-item">${escapeHtml(text)}</span>`)
          .join("")}
      </div>
    </div>
  `;
}

function renderNewsPlay(play, index) {
  const host = document.createElement("button");
  host.type = "button";
  host.className = "noticias-card noticia-row";
  host.id = `noticia-${play.id || index}`;

  const photoUrl = play.deck_image_url || "/assets/icons/sinPicture.gif";
  const deckName = play.deck_name || "Mazo";
  const text = play.play_text || "Sin texto";
  const date = play.start_date || play.end_date || play.created_at;
  const location = play.location || "—";

  host.innerHTML = `
  <section class="placard noticia-row__placard">
    <div class="placard__row">
      <div class="placard__lead">
        <div class="placard__photo-wrap">
          <img
            src="${escapeHtml(photoUrl)}"
            alt="Foto del mazo"
            class="placard__photo"
            onerror="this.onerror=null;this.src='/assets/icons/sinPicture.gif';"
          />
        </div>
      </div>

      <div class="placard__maincard">
        <img
          src="/assets/icons/Acorazon.gif"
          alt="A♥"
          class="placard__maincard-image"
        />
      </div>

      <div class="placard__text">
        <div class="placard__titleline">
          <span class="placard__name">${escapeHtml(deckName)}</span>
        </div>

        ${renderJHeartTicker(play)}

        <div class="noticia-row__body">
          <div class="noticia-row__text">${escapeHtml(text)}</div>

          <div class="noticia-row__meta">
            <span>${escapeHtml(formatDate(date))}</span>
            <span>${escapeHtml(location)}</span>
          </div>
        </div>
      </div>
    </div>
  </section>
`;

  host.addEventListener("click", () => openPlay(play));

  return host;
}

  async function initNoticias() {
    const list = document.getElementById("noticias-list");
    if (!list) return;

    try {
      const plays = await fetchNewsPlays();

      if (!plays.length) {
        list.innerHTML = `<div class="lienzo-error">No hay noticias publicadas.</div>`;
        return;
      }

      list.innerHTML = "";

      plays.forEach((play, index) => {
        const host = renderNewsPlay(play, index);
        list.appendChild(host);

      });
    } catch (error) {
      console.error(error);
      list.innerHTML = `<div class="lienzo-error">No se pudieron cargar las noticias.</div>`;
    }
  }

  document.addEventListener("DOMContentLoaded", initNoticias);
})();