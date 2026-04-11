(function () {
  let mazobarPhotoEditorOpen = false;
  let mazobarDraftPhotoUrl = "";

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

  function goToAdministradoresPage() {
    const deckId = window.__currentDeck?.id;
    if (!deckId) return;

    window.location.href = `/mazoAdministradores.html?id=${deckId}&adminView=AK`;
  }

  function goToMazoPage() {
    const deckId = window.__currentDeck?.id;
    if (!deckId) return;

    window.location.href = `/mazo.html?id=${deckId}`;
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


  function getCurrentJokerPlay(plays) {
    const jokerPlays = plays.filter((p) => {
      const rank = String(p.rank || "").toUpperCase();
      const suit = String(p.suit || "").toUpperCase();
      const status = String(p.status || "").toUpperCase();

      if (rank !== "JOKER") return false;
      if (status !== "ACTIVE") return false;

      return suit === "BLUE" || suit === "RED";
    });

    if (!jokerPlays.length) {
      return null;
    }

    jokerPlays.sort((a, b) => {
      const aDate = new Date(a.parsed?.date || a.created_at || a.updated_at || 0).getTime();
      const bDate = new Date(b.parsed?.date || b.created_at || b.updated_at || 0).getTime();
      return bDate - aDate;
    });

    return jokerPlays[0];
  }

  function userOwnsHeartAce(plays, currentUserId) {
    return plays.some((p) => {
      const rank = String(p.rank || "").toUpperCase();
      const suit = String(p.suit || "").toUpperCase();
      const status = String(p.status || "").toUpperCase();
      const authorId = Number(p.parsed?.userId || 0);

      return (
        rank === "A" &&
        suit === "HEART" &&
        status === "ACTIVE" &&
        authorId === Number(currentUserId || 0)
      );
    });
  }

  function showElement(id) {
    const el = document.getElementById(id);
    if (el) el.style.display = "";
  }

  function hideElement(id) {
    const el = document.getElementById(id);
    if (el) el.style.display = "none";
  }

  function closePlayformIfOpen() {
    const form = document.getElementById("playform-j");
    if (form) {
      form.classList.add("is-hidden");
    }

    try {
      sessionStorage.setItem("activePlayform", "");
    } catch (error) {
      console.warn("No se pudo limpiar activePlayform", error);
    }
  }

  function showTableroView() {
    const deckId = window.__currentDeck?.id;
    if (!deckId) return;

    window.location.href = `/mazo.html?id=${deckId}`;
  }

  function userCanEditDeckPhoto(plays, currentUserId) {
    return plays.some((p) => {
      const rank = String(p.rank || "").toUpperCase();
      const suit = String(p.suit || "").toUpperCase();
      const authorId = Number(p.parsed?.userId || 0);

      return (
        rank === "A" &&
        suit === "HEART" &&
        authorId === Number(currentUserId || 0)
      );
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

  function getCurrentPageType() {
    const path = String(window.location.pathname || "").toLowerCase();

    if (path.includes("mazoadministradores.html")) {
      return "administradores";
    }

    return "mazo";
  }

  function buildJokersHTML(plays, currentUserId, deckId) {
    const currentJoker = getCurrentJokerPlay(plays);
    const canOpenJoker = userOwnsHeartAce(plays, currentUserId);

    const jokerSuit = String(currentJoker?.suit || "RED").toUpperCase();

    const jokerSrc =
      jokerSuit === "BLUE"
        ? "/assets/icons/joker_blue.gif"
        : "/assets/icons/Joker120.gif";

    const jokerAlt =
      jokerSuit === "BLUE"
        ? "Joker azul"
        : "Joker rojo";

    if (canOpenJoker) {
      return `
      <button
        type="button"
        id="mazobarJokerBtn"
        class="mazobar__joker-button"
        data-deck-id="${Number(deckId || 0)}"
        title="${jokerAlt}"
        aria-label="${jokerAlt}"
      >
        <img
          src="${jokerSrc}"
          alt="${jokerAlt}"
          class="mazobar__joker is-active"
        />
      </button>
    `;
    }

    return `
    <div class="mazobar__joker-static" aria-label="${jokerAlt}">
      <img
        src="${jokerSrc}"
        alt="${jokerAlt}"
        class="mazobar__joker is-active"
      />
    </div>
  `;
  }

  function buildAdminBadgeHTML() {
    return `
    <div
      class="mazobar__admin-badge"
      title="Administradores"
      aria-label="Administradores"
    >
      <img
        src="/assets/icons/team80.gif"
        alt="Administradores"
        class="mazobar__admin-badge-icon"
      />
    </div>
  `;
  }

  function buildAdminSuitButtonsHTML() {
    const suits = ["HEART", "SPADE", "DIAMOND", "CLUB"];

    return suits.map((suit) => {
      const imgSrc = getSuitButtonImageSrc(suit);
      const symbol = getSuitSymbol(suit);

      if (imgSrc) {
        return `
        <button
          type="button"
          class="mazobar__cmd-btn mazobar__cmd-btn--suit mazobar__cmd-btn--admin-suit"
          data-admin-suit="${suit}"
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
        class="mazobar__cmd-btn mazobar__cmd-btn--suit mazobar__cmd-btn--admin-suit"
        data-admin-suit="${suit}"
        title="${symbol}"
        aria-label="${symbol}"
      >
        ${symbol}
      </button>
    `;
    }).join("");
  }

  function buildDeckPhotoHTML(deck, plays, currentUserId) {
    const avatarSrc = getDeckAvatarSrc(deck);
    const canEditPhoto = userCanEditDeckPhoto(plays, currentUserId);

    if (canEditPhoto) {
      return `
      <div class="mazobar__userbox">
        <button
          type="button"
          class="mazobar__photo-button"
          id="mazobarPhotoBtn"
          title="Editar foto del mazo"
          aria-label="Editar foto del mazo"
        >
          <img
            src="${avatarSrc}"
            alt="Foto del mazo"
            class="mazobar__avatar"
            onerror="this.onerror=null;this.src='/assets/icons/sinPicture.gif';"
          />
        </button>
      </div>
    `;
    }

    return `
    <div class="mazobar__userbox">
      <img
        src="${avatarSrc}"
        alt="Foto del mazo"
        class="mazobar__avatar"
        onerror="this.onerror=null;this.src='/assets/icons/sinPicture.gif';"
      />
    </div>
  `;
  }

  function buildDeckPhotoEditorHTML(deck, plays, currentUserId) {
    const canEditPhoto = userCanEditDeckPhoto(plays, currentUserId);

    if (!canEditPhoto || !mazobarPhotoEditorOpen) {
      return "";
    }

    return `
    <div class="mazobar__photo-editor" id="mazobarPhotoEditor">
      <input
        id="mazobarPhotoUrlInput"
        class="mazobar__photo-input"
        type="text"
        placeholder="URL picture"
        value="${String(mazobarDraftPhotoUrl || deck?.deck_image_url || "").replace(/"/g, "&quot;")}"
        autocomplete="off"
      />

      <button
        id="mazobarPhotoSaveBtn"
        class="mazobar__photo-action"
        type="button"
        title="Guardar"
        aria-label="Guardar"
      >
        <img src="/assets/icons/salvar40.gif" alt="Guardar" />
      </button>

      <button
        id="mazobarPhotoCancelBtn"
        class="mazobar__photo-action"
        type="button"
        title="Salir"
        aria-label="Salir"
      >
        <img src="/assets/icons/exit80.gif" alt="Salir" />
      </button>
    </div>
  `;
  }

  function buildMazobarHTML(deck, plays, currentUserId) {
    const normalizedPlays = Array.isArray(plays)
      ? plays.map(normalizePlay).filter(Boolean)
      : [];

    const enabledCards = getEnabledTopCards(normalizedPlays);
    const deckName = deck?.name || "Mazo";
    const currencyCode = getCurrencyCode(deck);
    const balance = getBalanceValue(deck);
    const isAdminPage = getCurrentPageType() === "administradores";

    return `
    <section class="mazobar">
      <div class="page-container">
        <div class="mazobar__shell">
          <div class="mazobar__row mazobar__row--top">

            <div class="mazobar__top-left">
              <div class="mazobar__topcards">
                ${isAdminPage ? buildTopCardsHTML(enabledCards) : ""}
              </div>

              ${buildDeckPhotoHTML(deck, normalizedPlays, currentUserId)}
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

              ${buildDeckPhotoEditorHTML(deck, normalizedPlays, currentUserId)}
            </div>

            <div class="mazobar__top-right">
              ${buildJokersHTML(normalizedPlays, currentUserId, deck?.id)}
            </div>

          </div>
        </div>
      </div>
    </section>
  `;
  }

  function buildCommandButtonsHTML(plays) {
    const pageType = getCurrentPageType();
    const isMazoPage = pageType === "mazo";
    const isAdminPage = pageType === "administradores";

    // -------------------------
    // BOTONES DE PALOS (mazo)
    // -------------------------
    const suitButtons = isMazoPage
      ? getVisibleCommandSuits()
        .map((suit) => {
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
        })
        .join("")
      : "";

    // -------------------------
    // ALERTAS (mazo)
    // -------------------------
    const alertButtons = isMazoPage
      ? buildAlertButtonsHTML(plays)
      : "";

    // -------------------------
    // ADMIN CONTROLS (admin page)
    // -------------------------
    const adminBadge = isAdminPage
      ? buildAdminBadgeHTML()
      : "";

    const adminSuitButtons = isAdminPage
      ? buildAdminSuitButtonsHTML()
      : "";

    return `
    ${isMazoPage ? `
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
    ` : ""}

    ${isAdminPage ? `
      <button
        id="btnBackToTablero"
        type="button"
        class="mazobar__cmd-btn mazobar__cmd-btn--primary"
        title="Volver al tablero"
        aria-label="Volver al tablero"
      >
        <img
          src="/assets/icons/maquina80.gif"
          alt="Tablero"
          class="mazobar__cmd-icon"
        />
      </button>
    ` : ""}

    ${isMazoPage ? `
      <button
        id="btnFilterA"
        type="button"
        class="mazobar__cmd-btn"
        title="Administradores"
        aria-label="Administradores"
      >
        <img
          src="/assets/icons/team80.gif"
          alt="Administradores"
          class="mazobar__cmd-icon"
        />
      </button>
    ` : ""}

    ${adminBadge}
    ${adminSuitButtons}
    ${suitButtons}
    ${alertButtons}
  `;
  }


  function bindMazobarEvents(deck, plays, currentUserId) {

    document.querySelectorAll("[data-admin-suit]").forEach((button) => {
      button.addEventListener("click", () => {
        const suit = String(button.dataset.adminSuit || "").toUpperCase();

        document.dispatchEvent(
          new CustomEvent("mazobar:filterSuit", {
            detail: { suit }
          })
        );
      });
    });

    const btnAddJ = document.getElementById("btnAddJ");
    if (btnAddJ) {
      btnAddJ.addEventListener("click", () => {
        document.dispatchEvent(new CustomEvent("mazobar:addJ"));
      });
    }

    const btnBackToTablero = document.getElementById("btnBackToTablero");
    if (btnBackToTablero) {
      btnBackToTablero.addEventListener("click", () => {
        goToMazoPage();
      });
    }

    const btnFilterA = document.getElementById("btnFilterA");
    if (btnFilterA) {
      btnFilterA.addEventListener("click", () => {
        goToAdministradoresPage();
      });
    }

    document.getElementById("mazobarPhotoBtn")?.addEventListener("click", () => {
      mazobarPhotoEditorOpen = true;
      mazobarDraftPhotoUrl = String(deck?.deck_image_url || "").trim();
      renderMazobar(deck, plays, currentUserId);
    });

    document.getElementById("mazobarPhotoCancelBtn")?.addEventListener("click", () => {
      mazobarPhotoEditorOpen = false;
      mazobarDraftPhotoUrl = "";
      renderMazobar(deck, plays, currentUserId);
    });

    document.getElementById("mazobarPhotoSaveBtn")?.addEventListener("click", async () => {
      const input = document.getElementById("mazobarPhotoUrlInput");
      const nextUrl = String(input?.value || "").trim();

      const token = localStorage.getItem("cooptrackToken");

      if (!token) {
        alert("No estás logueado");
        return;
      }

      try {
        const response = await fetch(
          `https://cooptrack-backend.onrender.com/decks/${deck.id}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({
              deck_image_url: nextUrl
            })
          }
        );

        const data = await response.json();

        if (!data.ok) {
          alert("Error al guardar foto");
          return;
        }

        mazobarPhotoEditorOpen = false;

        renderMazobar(data.deck, plays, currentUserId);

      } catch (error) {
        console.error(error);
        alert("Error de red");
      }
    });

    document.querySelectorAll(".mazobar__topcard-image, .mazobar__topcard-fallback")
      .forEach((cardEl) => {
        cardEl.addEventListener("dragstart", (event) => {
          const playId = Number(cardEl.dataset.playId || 0);
          const rank = cardEl.dataset.rank || "";
          const suit = cardEl.dataset.suit || "";

          const payload = {
            mode: "new",
            sourcePlayId: playId,
            childRank: rank,
            childSuit: suit
          };

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

        showTableroView();

        document.dispatchEvent(
          new CustomEvent("mazobar:filterSuit", {
            detail: { suit }
          })
        );
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

    document.getElementById("mazobarJokerBtn")?.addEventListener("click", () => {
      if (!deck?.id) {
        console.warn("mazobarJokerBtn: falta deck.id");
        return;
      }

      window.location.href = `/nuevo-mazo.html?mode=jokerblue&deckId=${deck.id}`;
    });
  }

  function renderMazobar(deck, plays, currentUserId) {
    const container = document.getElementById("mazobar-container");
    if (!container) return;

    container.innerHTML = buildMazobarHTML(deck, plays, currentUserId);
    bindMazobarEvents(deck, plays, currentUserId);
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
