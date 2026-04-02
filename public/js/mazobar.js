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

    return `/assets/icons/${r}${suitPart}.gif`;
  }

  function getSuitButtonImageSrc(suit) {
    const suitPart = getSuitFilePart(suit);
    if (!suitPart) return null;

    const map = {
      corazon: "/assets/icons/cor40.gif",
      pike: "/assets/icons/pik40.gif",
      diamante: "/assets/icons/dia40.gif",
      trebol: "/assets/icons/tre40.gif"
    };

    return map[suitPart] || null;
  }

  function getDeckAvatarSrc(deck) {
    const raw = String(deck?.deck_image_url || "").trim();
    return raw || "/assets/icons/sinPicture.gif";
  }

  function getCurrencyCode(deck) {
    return String(deck?.currency_symbol || "").trim().toUpperCase();
  }

  function getBalanceValue(deck) {
    const value = deck?.viewer_balance;

    if (value === null || value === undefined || value === "") {
      return "0";
    }

    return String(value);
  }

  function getEnabledTopCards(plays) {
    return plays.filter((p) => {
      const rank = String(p.rank || "").toUpperCase();
      const action = String(p.action || "");
      const status = String(p.status || "").toUpperCase();

      if (status !== "ACTIVE") return false;

      return (rank === "A" || rank === "K") && action === "puedeJugar";
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
    const rank = String(card.rank || "").toUpperCase();
    const suit = String(card.suit || "").toUpperCase();
    const playId = Number(card.id || 0);

    if (imgSrc) {
      return `
        <img
          src="${imgSrc}"
          alt="${label}"
          title="${label}"
          class="mazobar__topcard-image"
          draggable="true"
          data-play-id="${playId}"
          data-rank="${rank}"
          data-suit="${suit}"
        />
      `;
    }

    return `
      <div
        class="mazobar__topcard-fallback"
        title="${label}"
        draggable="true"
        data-play-id="${playId}"
        data-rank="${rank}"
        data-suit="${suit}"
      >
        ${label}
      </div>
    `;
  }).join("");
}
  
function hasPlayWithStatus(plays, statusList) {
    const expected = new Set(
      statusList.map((status) => String(status || "").toUpperCase())
    );

    return plays.some((play) => {
      const status = String(play.status || "").toUpperCase();
      return expected.has(status);
    });
  }

  function getAlertButtonsConfig(plays) {
    const buttons = [];

    if (hasPlayWithStatus(plays, ["CANCELLED", "CANCELED"])) {
      buttons.push({
        id: "btnCancelled",
        label: "Canceladas",
        title: "Jugadas canceladas",
        eventName: "mazobar:showCancelled",
        type: "cancelled"
      });
    }

    if (hasPlayWithStatus(plays, ["DISMISSED"])) {
      buttons.push({
        id: "btnDismissed",
        label: "Despidos",
        title: "Jugadas despedidas",
        eventName: "mazobar:showDismissed",
        type: "dismissed"
      });
    }

    if (hasPlayWithStatus(plays, ["DECLINED", "REJECTED_BY_RECIPIENT"])) {
      buttons.push({
        id: "btnDeclined",
        label: "Rechazos",
        title: "Invitaciones rechazadas",
        eventName: "mazobar:showDeclined",
        type: "declined"
      });
    }

    if (hasPlayWithStatus(plays, ["RESIGNED"])) {
      buttons.push({
        id: "btnResigned",
        label: "Renuncias",
        title: "Jugadas renunciadas",
        eventName: "mazobar:showResigned",
        type: "resigned"
      });
    }

    return buttons;
  }

  function buildAlertButtonsHTML(plays) {
    const buttons = getAlertButtonsConfig(plays);

    if (!buttons.length) return "";

    return buttons.map((button) => `
      <button
        id="${button.id}"
        type="button"
        class="mazobar__cmd-btn mazobar__cmd-btn--alert"
        data-alert-type="${button.type}"
        data-alert-event="${button.eventName}"
        title="${button.title}"
        aria-label="${button.title}"
      >
        ${button.label}
      </button>
    `).join("");
  }

  function buildCommandButtonsHTML(plays) {
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

    const alertButtons = buildAlertButtonsHTML(plays);

    return `
  <button
  id="btnAddJ"
  type="button"
  class="mazobar__cmd-btn mazobar__cmd-btn--primary"
  title="Nueva jugada"
  aria-label="Nueva jugada"
>
  <img
    src="/assets/icons/maquina80.gif"
    alt="J+"
    class="mazobar__cmd-icon"
  />
</button>

      ${suitButtons}
      ${alertButtons}
    `;
  }

  function buildJokersHTML(plays) {
    const redActive = hasRedJoker(plays);
    const blueActive = hasBlueJoker(plays);

    return `
      <div class="mazobar__jokers">
        <img
          src="/assets/icons/Joker120.gif"
          alt="Joker rojo"
          title="Joker rojo"
          class="mazobar__joker ${redActive ? "is-active" : "is-inactive"}"
        />
        <img
          src="/assets/icons/joker_blue.gif"
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
    const avatarSrc = getDeckAvatarSrc(deck);
    const deckName = deck?.name || "Mazo";
    const currencyCode = getCurrencyCode(deck);
    const balance = getBalanceValue(deck);

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
                    alt="Foto del mazo"
                    class="mazobar__avatar"
                    onerror="this.onerror=null;this.src='/assets/icons/sinPicture.gif';"
                  />
                </div>
              </div>

              <div class="mazobar__top-center">
                <div class="mazobar__titleline">
                  <span class="mazobar__title-rank">A</span>
                  <img
                    src="/assets/icons/cor40.gif"
                    alt="♥"
                    class="mazobar__title-suit"
                  />
                  <span class="mazobar__title-name">${deckName}</span>
                  <img
                    src="/assets/icons/dia40.gif"
                    alt="♦"
                    class="mazobar__balance-icon"
                  />
                  <span class="mazobar__balance-currency">${currencyCode}</span>
                  <span class="mazobar__balance-value">${balance}</span>
                </div>

                <div class="mazobar__commands">
                  ${buildCommandButtonsHTML(normalizedPlays)}
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
    
document.querySelectorAll(".mazobar__topcard-image, .mazobar__topcard-fallback")
  .forEach((cardEl) => {
    cardEl.addEventListener("dragstart", (event) => {
      const playId = Number(cardEl.dataset.playId || 0);
      const rank = cardEl.dataset.rank || "";
      const suit = cardEl.dataset.suit || "";

      const payload = { playId, rank, suit };

      event.dataTransfer.setData(
        "application/json",
        JSON.stringify(payload)
      );

      event.dataTransfer.setData("text/plain", `${playId}|${rank}|${suit}`);
      event.dataTransfer.effectAllowed = "copy";
    });
  });
    
    document.querySelectorAll("[data-command-suit]").forEach((button) => {
      button.addEventListener("click", () => {
        const suit = button.dataset.commandSuit;
        document.dispatchEvent(new CustomEvent("mazobar:filter", {
          detail: { filter: suit }
        }));
      });
    });

    document.querySelectorAll("[data-alert-event]").forEach((button) => {
      button.addEventListener("click", () => {
        const eventName = button.dataset.alertEvent;
        const alertType = button.dataset.alertType;

        document.dispatchEvent(new CustomEvent(eventName, {
          detail: { type: alertType }
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
          play_status: "ACTIVE",
          text: text
        })
      });

      const data = await response.json();

      if (!data.ok) {
        console.error("Error backend:", data);
        alert("Error al guardar jugada");
        return;
      }

      document.dispatchEvent(new CustomEvent("plays:changed", {
        detail: { deckId }
      }));
    } catch (error) {
      console.error("Error creando play:", error);
    }
  });
})();
