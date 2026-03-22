(function () {

  function parsePlayCode(code) {
    const parts = String(code || "").split("§");

    return {
      deckId: parts[0],
      userId: parts[1],
      date: parts[2],
      rank: parts[3],
      suit: parts[4],
      action: parts[5] || null,
      autorizados: parts[6] || null
    };
  }

  function parseAutorizados(value) {
    if (!value) return [];

    if (value === "ALL") return ["ALL"];
    if (value === "CORP") return ["CORP"];

    return value.split(",").map(v => v.trim());
  }

  function isUserAuthorized(rule, userId) {
    const list = parseAutorizados(rule.autorizados);

    if (list.includes("ALL")) return true;

    return list.includes(`U:${userId}`);
  }

  function deriveDeckState(plays, currentUserId) {
    const parsed = plays.map(parsePlayCode);

    const state = {
      hasBlueJoker: false,
      hasRedJoker: false,
      corporateCards: [],
      qRules: {},
      visibleFilters: ["HEART"],
    };

    parsed.forEach(p => {
      if (p.rank === "JOKER" && p.suit === "BLUE") state.hasBlueJoker = true;
      if (p.rank === "JOKER" && p.suit === "RED") state.hasRedJoker = true;

      if (p.rank === "A" || p.rank === "K") {
        if (p.autorizados && isUserAuthorized(p, currentUserId)) {
          state.corporateCards.push(`${p.rank}_${p.suit}`);
        }
      }

      if (p.rank === "Q" && p.action === "puedeJugar") {
        state.qRules[p.suit] = p;
      }
    });

    state.visibleFilters = ["HEART", "SPADE", "DIAMOND"];

    if (state.corporateCards.length > 0) {
      state.visibleFilters.push("CLUB");
    }

    return state;
  }

  function canPlayQ(state, suit, userId) {
    const rule = state.qRules[suit];
    if (!rule) return false;
    return isUserAuthorized(rule, userId);
  }

  function renderMazobar(deck, plays, currentUserId) {
    const container = document.getElementById("mazobar-container");
    if (!container) return;

    const state = deriveDeckState(plays, currentUserId);

    const filtersHTML = state.visibleFilters.map(f => {
      const symbol = {
        HEART: "♥",
        SPADE: "♠",
        DIAMOND: "♦",
        CLUB: "♣"
      }[f];

      return `<button class="mazobar__btn">${symbol}</button>`;
    }).join("");

    const corporateHTML = state.corporateCards.map(c => {
      const map = {
        A_HEART: "A♥",
        A_SPADE: "A♠",
        A_DIAMOND: "A♦",
        A_CLUB: "A♣",
        K_HEART: "K♥",
        K_SPADE: "K♠",
        K_DIAMOND: "K♦",
        K_CLUB: "K♣"
      };

      return `<span>${map[c] || c}</span>`;
    }).join("");

    const jokersHTML = `
      ${state.hasRedJoker ? "<span>🃏R</span>" : ""}
      ${state.hasBlueJoker ? "<span>🃏B</span>" : ""}
    `;

    container.innerHTML = `
      <section class="mazobar">
        <div class="page-container">

          <div class="mazobar__card">

            <div class="mazobar__header">
              <h1 class="mazobar__title">
                A♥ ${deck.name}
              </h1>
            </div>

            <div class="mazobar__form">

              <div class="mazobar__field">
                <span class="mazobar__label">Balance</span>
                <span>♦ ${deck.viewer_balance || 0}</span>
              </div>

              <div class="mazobar__field">
                ${corporateHTML}
                ${jokersHTML}
              </div>

              <div class="mazobar__actions">
                <button id="btnAddJ" class="mazobar__btn mazobar__btn--primary">
                  +J
                </button>

                ${filtersHTML}

                <button id="btnExit" class="mazobar__btn mazobar__btn--secondary">
                  EXIT
                </button>
              </div>

            </div>

          </div>

        </div>
      </section>
    `;

    bindMazobarEvents(state, currentUserId);
  }

  function bindMazobarEvents(state, userId) {

    document.getElementById("btnAddJ")?.addEventListener("click", () => {
      document.dispatchEvent(new CustomEvent("mazobar:addJ"));
    });

    document.getElementById("btnExit")?.addEventListener("click", () => {
      window.location.href = "/mazos.html";
    });

    document.querySelectorAll(".play-row").forEach(row => {
      const suit = row.dataset.suit;

      if (canPlayQ(state, suit, userId)) {
        const btn = document.createElement("button");
        btn.innerText = "+Q";

        btn.addEventListener("click", () => {
          document.dispatchEvent(new CustomEvent("mazobar:addQ", {
            detail: { suit }
          }));
        });

        row.appendChild(btn);
      }
    });
  }

  window.renderMazobar = renderMazobar;

  // ================= 🔥 ESTE ES EL BLOQUE NUEVO =================

  document.addEventListener("playform:createPlay", async (event) => {
    try {
      const { deck, state, suit, text } = event.detail;

      const token = localStorage.getItem("cooptrackToken");
      if (!token) {
        alert("No estás logueado");
        return;
      }

      const payload = JSON.parse(atob(token.split('.')[1]));
      const userId = payload.userId;
      const deckId = deck.id;

      const playCode =
        `${deckId}§${userId}§${new Date().toISOString()}§J§${suit}§write_play§U:${userId}§manual§U:${userId}`;

      const response = await fetch("/plays", {
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
        console.error(data);
        alert("Error al guardar jugada");
        return;
      }

      console.log("Play creada:", data.play);

      window.location.reload();

    } catch (error) {
      console.error("Error creando play", error);
    }
  });

})();
