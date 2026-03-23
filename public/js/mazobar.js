(function () {
  function parsePlayCode(code) {
    const parts = String(code || "").split("§");

    return {
      deckId: parts[0] || null,
      userId: parts[1] || null,
      date: parts[2] || null,
      rank: parts[3] || null,
      suit: parts[4] || null,
      action: parts[5] || null,
      autorizados: parts[6] || null,
      flow: parts[7] || null,
      recipients: parts[8] || null
    };
  }

  function normalizePlay(play) {
    if (!play) return null;

    const parsed = play.parsed || parsePlayCode(play.play_code);

    return {
      id: play.id || null,
      rank: parsed.rank || play.card_rank || "",
      suit: parsed.suit || play.card_suit || "",
      action: parsed.action || "",
      status: play.play_status || "",
      parsed,
      raw: play.play_code || ""
    };
  }

  function getSuitSymbol(suit) {
    switch (String(suit || "").toUpperCase()) {
      case "HEART":
        return "♥";
      case "SPADE":
        return "♠";
      case "DIAMOND":
        return "♦";
      case "CLUB":
        return "♣";
      default:
        return "";
    }
  }

  function getSuitFilePart(suit) {
    switch (String(suit || "").toUpperCase()) {
      case "HEART":
        return "corazon";
      case "SPADE":
        return "pike";
      case "DIAMOND":
        return "diamante";
      case "CLUB":
        return "trebol";
      default:
        return null;
    }
  }

  function getCardLabel(rank, suit) {
    return `${rank}${getSuitSymbol(suit)}`;
  }

  function getCardImageSrc(rank, suit) {
    const r = String(rank || "").toUpperCase();
    const suitPart = getSuitFilePart(suit);

    if (!r || !suitPart) return null;

    return `/icons/${r}${suitPart}.gif`;
  }

  function getSuitButtonImageSrc(suit) {
    const suitPart = getSuitFilePart(suit);
    if (!suitPart) return null;

    const map = {
      corazon: "/cor40.gif",
      pike: "/pik40.gif",
      diamante: "/dia40.gif",
      trebol: "/tre40.gif"
    };

    return map[suitPart] || null;
  }

  function getAvatarSrc() {
    return "/singeta120.gif";
  }

  function getUserDisplayName(deck) {
    return deck?.viewer_nickname || deck?.owner_nickname || "Fulano";
  }

  function getEnabledTopCards(plays) {
    return plays.filter((p) => {
      const rank = String(p.rank || "").toUpperCase();
      const action = String(p.action || "");
      const status = String(p.status || "").toUpperCase();

      if (status !== "ACTIVE") return false;

      return (rank === "K" || rank === "Q") && action === "puedeJugar";
    });
  }

  function hasBlueJoker(plays) {
    return plays.some((p) => {
      const rank = String(p.rank || "").toUpperCase();
      const suit = String(p.suit || "").toUpperCase();
      const status = String(p.status || "").toUpperCase();

      return status === "ACTIVE" && rank === "JOKER" && suit === "BLUE";
    });
  }

  function hasRedJoker(plays) {
    return plays.some((p) => {
      const rank = String(p.rank || "").toUpperCase();
      const suit = String(p.suit || "").toUpperCase();
      const status = String(p.status || "").toUpperCase();

      return status === "ACTIVE" && rank === "JOKER" && suit === "RED";
    });
  }

  function getVisibleCommandSuits() {
    return ["HEART", "SPADE", "DIAMOND", "CLUB"];
  }

  function buildTopCardsHTML(enabledCards) {
    if (!enabledCards.length) {
      return `<div class="mazobar__topcards-empty"></div>`;
    }

    return enabledCards.map((card) => {
      const imgSrc = getCardImageSrc(card.rank, card.suit);
      const label = getCardLabel(card.rank, card.suit);

      if (imgSrc) {
        return `
          <img
            src="${imgSrc}"
            alt="${label}"
            title="${label}"
            class="mazobar__topcard-image"
          />
        `;
      }

      return `
        <div class="mazobar__topcard-fallback" title="${label}">
          ${label}
        </div>
      `;
    }).join("");
  }

  function buildCommandButtonsHTML() {
    const suitButtons = getVisibleCommandSuits().map((suit) => {
      const imgSrc = getSuitButtonImageSrc(suit);
      const symbol = getSuitSymbol(suit);

      if (imgSrc) {
        return `
          <button
            type="button"
            class="mazobar__cmd-btn mazobar__cmd-btn--suit"
            data-command-suit="${suit}"
            title="${symbol}"
            aria-label="${symbol}"
          >
            <img src="${imgSrc}" alt="${symbol}" class="mazobar__cmd-icon" />
          </button>
        `;
      }

      return `
        <button
          type="button"
          class="mazobar__cmd-btn mazobar__cmd-btn--suit"
          data-command-suit="${suit}"
          title="${symbol}"
          aria-label="${symbol}"
        >
          ${symbol}
        </button>
      `;
    }).join("");

    return `
      <button
        id="btnAddJ"
        type="button"
        class="mazobar__cmd-btn mazobar__cmd-btn--primary"
        title="+J"
        aria-label="+J"
      >
        +J
      </button>

      ${suitButtons}

      <button
        id="btnExit"
        type="button"
        class="mazobar__cmd-btn mazobar__cmd-btn--exit"
        title="EXIT"
        aria-label="EXIT"
      >
        EXIT
      </button>
    `;
  }

  function buildJokersHTML(plays) {
    const redActive = hasRedJoker(plays);
    const blueActive = hasBlueJoker(plays);

    return `
      <div class="mazobar__jokers">
        <img
          src="/Joker120.gif"
          alt="Joker rojo"
          title="Joker rojo"
          class="mazobar__joker ${redActive ? "is-active" : "is-inactive"}"
        />
        <img
          src="/joker_blue.gif"
          alt="Joker azul"
          title="Joker azul"
          class="mazobar__joker ${blueActive ? "is-active" : "is-inactive"}"
        />
      </div>
    `;
  }

  function buildMazobarHTML(deck, plays, currentUserId) {
    const normalizedPlays = Array.isArray(plays)
      ? plays.map(normalizePlay).filter(Boolean)
      : [];

    const enabledCards = getEnabledTopCards(normalizedPlays);
    const avatarSrc = getAvatarSrc();
    const userName = getUserDisplayName(deck);
    const deckName = deck?.name || "Mazo";
    const balance = deck?.viewer_balance || 0;

    return `
      <section class="mazobar">
        <div class="page-container">
          <div class="mazobar__shell">
            <div class="mazobar__row mazobar__row--top">

              <div class="mazobar__top-left">
                <div class="mazobar__topcards">
                  ${buildTopCardsHTML(enabledCards)}
                </div>

                <div class="mazobar__userbox">
                  <img
                    src="${avatarSrc}"
                    alt="${userName}"
                    class="mazobar__avatar"
                  />
                  <div class="mazobar__username">${userName}</div>
                </div>
              </div>

              <div class="mazobar__top-center">
                <div class="mazobar__titleline">
                  <span class="mazobar__title-rank">A</span>
                  <img
                    src="/cor40.gif"
                    alt="♥"
                    class="mazobar__title-suit"
                  />
                  <span class="mazobar__title-name">${deckName}</span>
                  <img
                    src="/dia40.gif"
                    alt="♦"
                    class="mazobar__balance-icon"
                  />
                  <span class="mazobar__balance-value">${balance}</span>
                </div>

                <div class="mazobar__commands">
                  ${buildCommandButtonsHTML()}
                </div>
              </div>

              <div class="mazobar__top-right">
                ${buildJokersHTML(normalizedPlays)}
              </div>

            </div>
          </div>
        </div>
      </section>
    `;
  }

  function bindMazobarEvents() {
    document.getElementById("btnAddJ")?.addEventListener("click", () => {
      document.dispatchEvent(new CustomEvent("mazobar:addJ"));
    });

    document.getElementById("btnExit")?.addEventListener("click", () => {
      window.location.href = "/mazos.html";
    });

    document.querySelectorAll("[data-command-suit]").forEach((button) => {
      button.addEventListener("click", () => {
        const suit = button.dataset.commandSuit;
        document.dispatchEvent(new CustomEvent("mazobar:filter", {
          detail: { filter: suit }
        }));
      });
    });
  }

  function renderMazobar(deck, plays, currentUserId) {
    const container = document.getElementById("mazobar-container");
    if (!container) return;

    container.innerHTML = buildMazobarHTML(deck, plays, currentUserId);
    bindMazobarEvents();
  }

  window.renderMazobar = renderMazobar;

  document.addEventListener("playform:createPlay", async (event) => {
    try {
      const { deck, suit, text } = event.detail;

      const token = localStorage.getItem("cooptrackToken");
      if (!token) {
        alert("No estás logueado");
        return;
      }

      const payload = JSON.parse(atob(token.split(".")[1]));
      const userId = payload.userId;
      const deckId = deck.id;

      const playCode =
        `${deckId}§${userId}§${new Date().toISOString()}§J§${suit}§write_play§U:${userId}§manual§U:${userId}`;

      const response = await fetch("https://cooptrack-backend.onrender.com/plays", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          deck_id: deckId,
          parent_play_id: null,
          play_code: playCode,
          card_rank: "J",
          card_suit: suit,
          play_status: "ACTIVE"
        })
      });

      const data = await response.json();

      if (!data.ok) {
        console.error("Error backend:", data);
        alert("Error al guardar jugada");
        return;
      }

      window.location.reload();
    } catch (error) {
      console.error("Error creando play:", error);
    }
  });
})();
