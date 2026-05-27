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

    const rank = String(play.card_rank || "").toUpperCase();
    const suit = String(play.card_suit || "").toUpperCase();

    if (rank === "Q" && suit === "SPADE") {
      window.location.href = `/lienzoQpica.html?deckId=${deckId}&playId=${playId}`;
      return;
    }

    if (rank === "K") {
      window.location.href = `/lienzoK.html?deckId=${deckId}&playId=${playId}`;
      return;
    }

    window.location.href = `/lienzo.html?deckId=${deckId}&playId=${playId}`;
  }

  function renderNewsPlay(play, index) {
    const host = document.createElement("button");
    host.type = "button";
    host.className = "noticias-card";
    host.id = `noticia-${play.id || index}`;

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

        window.renderPlacard(host, {
          page: "lienzo-qpica",
          play,
          deckId: play.deck_id,
          photoUrl: play.deck_image_url || "/assets/icons/sinPicture.gif",
          title: play.deck_name || "Mazo",
          rank: "A",
          suit: "HEART",
          showCurrency: false
        });
      });
    } catch (error) {
      console.error(error);
      list.innerHTML = `<div class="lienzo-error">No se pudieron cargar las noticias.</div>`;
    }
  }

  document.addEventListener("DOMContentLoaded", initNoticias);
})();