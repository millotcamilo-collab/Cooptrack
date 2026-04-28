(function () {
    function normalizeRank(value) {
        return String(value || "").trim().toUpperCase();
    }

    function normalizeSuit(value) {
        return String(value || "").trim().toUpperCase();
    }

    function escapeHtml(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function getCurrentState() {
        return window.__currentState || {};
    }

    function getAllPlays() {
        const state = getCurrentState();
        return Array.isArray(state.plays) ? state.plays : [];
    }

    function getCurrentDeck() {
        const state = getCurrentState();
        return state?.deck || state?.mazo || window.__currentDeck || {};
    }

    function getLienzoContainer() {
        return document.getElementById("lienzo-container");
    }

    function getPlayById(playId) {
        const id = Number(playId || 0);
        if (!id) return null;
        return getAllPlays().find((play) => Number(play?.id || 0) === id) || null;
    }

    function getCardImageSrc(rank, suit) {
        const r = normalizeRank(rank);
        const s = normalizeSuit(suit);

        const map = {
            A_HEART: "/assets/icons/Acorazon.gif",
            A_SPADE: "/assets/icons/Apike.gif",
            A_DIAMOND: "/assets/icons/Adiamante.gif",
            A_CLUB: "/assets/icons/Atrebol.gif",

            K_HEART: "/assets/icons/Kcorazon.gif",
            K_SPADE: "/assets/icons/Kpike.gif",
            K_DIAMOND: "/assets/icons/Kdiamante.gif",
            K_CLUB: "/assets/icons/Ktrebol.gif",

            Q_HEART: "/assets/icons/Qcorazon.gif",
            Q_SPADE: "/assets/icons/Qpike.gif",
            Q_DIAMOND: "/assets/icons/Qdiamante.gif",
            Q_CLUB: "/assets/icons/Qtrebol.gif",

            J_HEART: "/assets/icons/Jcorazon.gif",
            J_SPADE: "/assets/icons/Jpike.gif",
            J_DIAMOND: "/assets/icons/Jdiamante.gif",
            J_CLUB: "/assets/icons/Jtrebol.gif"
        };

        return map[`${r}_${s}`] || "/assets/icons/Dorso70.gif";
    }

    function getSuitSymbol(suit) {
        const s = normalizeSuit(suit);
        if (s === "HEART") return "♥";
        if (s === "SPADE") return "♠";
        if (s === "DIAMOND") return "♦";
        if (s === "CLUB") return "♣";
        return "";
    }

    function getCardLabel(rank, suit) {
        return `${normalizeRank(rank)}${getSuitSymbol(suit)}`;
    }

    function parsePlayCode(code) {
        const parts = String(code || "").split("§");

        return {
            deckId: parts[0] || "",
            userId: parts[1] || "",
            date: parts[2] || "",
            rank: parts[3] || "",
            suit: parts[4] || "",
            action: parts[5] || "",
            authorized: parts[6] || "",
            flow: parts[7] || "",
            recipients: parts[8] || ""
        };
    }

    function normalizePlayCard(play) {
        const parsed = parsePlayCode(play?.play_code || "");

        return {
            id: play?.id || null,
            rank: parsed.rank || play?.card_rank || play?.rank || "",
            suit: parsed.suit || play?.card_suit || play?.suit || "",
            action: parsed.action || "",
            flow: parsed.flow || "",
            status: play?.play_status || play?.status || "",
            createdByUserId:
                Number(play?.created_by_user_id || 0) ||
                Number(parsed.userId || 0),
            targetUserId: Number(play?.target_user_id || 0),
            play
        };
    }

    function compareCorporateCards(a, b) {
        const order = {
            A_HEART: 1,
            A_SPADE: 2,
            A_DIAMOND: 3,
            A_CLUB: 4,
            K_HEART: 5,
            K_SPADE: 6,
            K_DIAMOND: 7,
            K_CLUB: 8
        };

        const aKey = `${normalizeRank(a?.rank)}_${normalizeSuit(a?.suit)}`;
        const bKey = `${normalizeRank(b?.rank)}_${normalizeSuit(b?.suit)}`;

        return (order[aKey] || 999) - (order[bKey] || 999);
    }

    function getCardsOwnedByUser(userId) {
        const ownerId = Number(userId || 0);
        if (!ownerId) return [];

        return getAllPlays()
            .map(normalizePlayCard)
            .filter((card) => {
                const rank = normalizeRank(card.rank);
                const suit = normalizeSuit(card.suit);
                const status = normalizeRank(card.status);
                const action = String(card.action || "").trim().toLowerCase();
                const flow = String(card.flow || "").trim().toLowerCase();

                if (!["A", "K"].includes(rank)) return false;
                if (!["HEART", "SPADE", "DIAMOND", "CLUB"].includes(suit)) return false;

                if (["REJECTED", "CANCELLED", "QUIT", "FIRED"].includes(status)) {
                    return false;
                }

                const actualOwner =
                    Number(card.targetUserId || 0) ||
                    Number(card.createdByUserId || 0);

                if (actualOwner !== ownerId) return false;

                // A reales: solo desde línea 10 del libro, flow foundation
                if (rank === "A") {
                    return flow === "foundation";
                }

                // K reales: nunca mostrar las ACL iniciales puedeJugar
                if (rank === "K") {
                    if (flow === "acl") return false;
                    if (action === "puedejugar") return false;
                    return status === "ACTIVE" || status === "APPROVED";
                }

                return false;
            })
            .sort(compareCorporateCards);
    }

    function resolveUser(userId, fallbackName) {
        const id = Number(userId || 0);
        const plays = getAllPlays();

        const related = plays.find((play) => {
            return (
                Number(play?.created_by_user_id || 0) === id ||
                Number(play?.target_user_id || 0) === id
            );
        });

        const isCreator = Number(related?.created_by_user_id || 0) === id;
        const isTarget = Number(related?.target_user_id || 0) === id;

        return {
            id,
            nickname:
                isCreator
                    ? related?.created_by_nickname || fallbackName
                    : isTarget
                        ? related?.target_user_nickname || fallbackName
                        : fallbackName,
            profile_photo_url:
                isCreator
                    ? related?.created_by_profile_photo_url || "/assets/icons/singeta120.gif"
                    : isTarget
                        ? related?.target_user_profile_photo_url || "/assets/icons/singeta120.gif"
                        : "/assets/icons/singeta120.gif"
        };
    }

    function resolveHeartAceHolder() {
        const aceHeart = getAllPlays()
            .filter((play) => {
                const rank = normalizeRank(play?.card_rank || play?.rank);
                const suit = normalizeSuit(play?.card_suit || play?.suit);
                const status = normalizeRank(play?.play_status || play?.status);

                return (
                    rank === "A" &&
                    suit === "HEART" &&
                    !["REJECTED", "CANCELLED", "DELETED"].includes(status)
                );
            })
            .sort((a, b) => Number(b?.id || 0) - Number(a?.id || 0))[0];

        if (!aceHeart) return null;

        const userId =
            Number(aceHeart.target_user_id || 0) ||
            Number(aceHeart.created_by_user_id || 0);

        if (!userId) return null;

        return resolveUser(userId, `A♥ ${userId}`);
    }

    function resolveSourceUser(play) {
        const userId = Number(play?.created_by_user_id || 0);
        return resolveUser(userId, `Usuario ${userId || ""}`);
    }

    function renderDeckHeader(deck) {
        const avatarSrc =
            String(deck?.deck_image_url || deck?.image_url || "").trim() ||
            "/assets/icons/sinPicture.gif";

        const deckName = deck?.name || "Mazo";

        return `
      <div
        id="lienzo-placard"
        data-photo-url="${escapeHtml(avatarSrc)}"
        data-rank="A"
        data-suit="HEART"
        data-title="${escapeHtml(deckName)}"
      ></div>
    `;
    }

    function mountPlacardFromDataset(play) {
        const placardHost = document.getElementById("lienzo-placard");
        if (!placardHost) return;
        if (typeof window.renderPlacard !== "function") return;

        window.renderPlacard(placardHost, {
            page: "lienzo-jcorazon",
            mode: "J_HEART",
            play,
            photoUrl: placardHost.dataset.photoUrl || "",
            rank: "A",
            suit: "HEART",
            title: placardHost.dataset.title || "Mazo",
            leftCards: [],
            plays: getAllPlays()
        });
    }

    function renderCardStack(cards) {
        if (!cards.length) return "";

        return `
      <div class="lienzo-source-stack">
        ${cards.map((card, index) => `
          <img
            class="lienzo-source-stack__card"
            src="${escapeHtml(getCardImageSrc(card.rank, card.suit))}"
            alt="${escapeHtml(getCardLabel(card.rank, card.suit))}"
            title="${escapeHtml(getCardLabel(card.rank, card.suit))}"
            style="left:${index * 18}px;"
          />
        `).join("")}
      </div>
    `;
    }

    function buildPanelTopbar({ user, actionsHtml = "" }) {
        return `
      <div class="panel-topbar">
        <div class="panel-topbar__col panel-topbar__col--identity">
          <div class="lienzo-source-header lienzo-source-header--top">
            <div class="lienzo-source-header__name">
              ${escapeHtml(user?.nickname || "Usuario")}
            </div>
            <img
              class="lienzo-source-header__photo"
              src="${escapeHtml(user?.profile_photo_url || "/assets/icons/singeta120.gif")}"
              alt="${escapeHtml(user?.nickname || "Usuario")}"
            />
          </div>
        </div>

        <div class="panel-topbar__col panel-topbar__col--actions">
          ${actionsHtml}
        </div>
      </div>
    `;
    }

    function hasDroppedJHeart(play) {
        const status = normalizeRank(play?.play_status || play?.status);

        if (status === "SENT") return true;

        const selection = window.__jheartDropSelection || null;
        return selection && selection.rank === "J" && selection.suit === "HEART";
    }

    function renderSourceActions(play) {
        const status = normalizeRank(play?.play_status || play?.status);

        if (status === "SENT" || status === "APPROVED" || status === "REJECTED" || status === "CANCELLED") {
            return "";
        }

        if (!hasDroppedJHeart()) return "";

        return `
      <div class="nuevo-mazo-target-actions nuevo-mazo-target-actions--top">
       
      </div>
    `;
    }

    function renderSourcePanel(play) {
        const sourceUser = resolveSourceUser(play);
        const sourceCards = getCardsOwnedByUser(sourceUser.id);

        const jHeartImage = getCardImageSrc("J", "HEART");
        const jText = String(play?.play_text || "").trim();

        return `
    <section class="lienzo-panel lienzo-panel--source panel--split-top">
      ${buildPanelTopbar({
            user: sourceUser,
            actionsHtml: renderSourceActions(play)
        })}

      <div class="lienzo-source-cards">
        ${renderCardStack(sourceCards)}

        ${!hasDroppedJHeart(play) ? `
          <div
            id="jheart-draggable-card"
            class="lienzo-jheart-envelope"
            draggable="true"
            data-rank="J"
            data-suit="HEART"
            data-play-id="${Number(play?.id || 0)}"
            title="Arrastrar J♥ hacia A♥"
          >
            <img
              class="lienzo-jheart-envelope__card"
              src="${escapeHtml(jHeartImage)}"
              alt="J♥"
            />

            <div class="lienzo-jheart-envelope__text">
              ${escapeHtml(jText || "Sin texto")}
            </div>
          </div>
        ` : ""}
      </div>
    </section>
  `;
    }

    function renderTargetPanel(play) {
        const aceHolder = resolveHeartAceHolder();
        const targetUser = aceHolder || {
            id: 0,
            nickname: "A♥ no encontrado",
            profile_photo_url: "/assets/icons/singeta120.gif"
        };

        const targetCards = getCardsOwnedByUser(targetUser.id);
        const dropped = hasDroppedJHeart(play);

        return `
      <section class="lienzo-panel lienzo-panel--target panel--split-top">
        ${buildPanelTopbar({
            user: targetUser,
            actionsHtml: ""
        })}

        <div class="lienzo-target-mainrow">
          <div
            id="lienzo-jheart-target-dropzone"
            class="lienzo-target-dropzone ${dropped ? "is-drop-complete" : ""}"
          >
            ${renderCardStack(targetCards)}

            ${dropped ? `
  <div class="lienzo-jheart-envelope lienzo-jheart-envelope--received">
    <img
      class="lienzo-jheart-envelope__card"
      src="${escapeHtml(getCardImageSrc("J", "HEART"))}"
      alt="J♥"
      title="J♥ enviada a revisión"
    />

    <div class="lienzo-jheart-envelope__text">
      ${escapeHtml(String(play?.play_text || "").trim() || "Sin texto")}
    </div>

    <button id="jheart-send-btn" class="lienzo-jheart-envelope__send" title="Enviar a A♥">
      <img src="/assets/icons/buzon60.gif" alt="Enviar" />
    </button>
  </div>
` : `
  <div class="lienzo-drop-hint">
    Soltar J♥ aquí
  </div>
`}
          </div>
        </div>
      </section>
    `;
    }

    async function handleSendPlay(play) {
        try {
            const playId = Number(play?.id || 0);
            const token = localStorage.getItem("cooptrackToken");

            if (!playId) {
                alert("playId inválido");
                return;
            }

            if (!token) {
                alert("No estás logueado");
                return;
            }

            const response = await fetch(`/plays/${playId}`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    play_status: "SENT"
                })
            });

            const data = await response.json();

            if (!response.ok || !data.ok) {
                console.error("Error enviando J♥:", data);
                alert(data?.error || "No se pudo enviar la J♥");
                return;
            }

            alert("J♥ enviada a A♥");

            const deckId =
                Number(play?.deck_id || 0) ||
                Number(getCurrentDeck()?.id || 0);

            if (deckId) {
                window.location.href = `/mazo.html?id=${deckId}`;
                return;
            }

            window.history.back();
        } catch (error) {
            console.error("Error en handleSendPlay J♥", error);
            alert("No se pudo enviar la J♥");
        }
    }

    function bindSourceDrag(play) {
        const card = document.getElementById("jheart-draggable-card");
        if (!card) return;

        card.addEventListener("dragstart", (event) => {
            const payload = {
                rank: "J",
                suit: "HEART",
                playId: Number(play?.id || 0)
            };

            event.dataTransfer.setData("application/json", JSON.stringify(payload));
            event.dataTransfer.setData("text/plain", "J|HEART");
            event.dataTransfer.effectAllowed = "copy";
        });
    }

    function bindTargetDropzone(play) {
        const dropzone = document.getElementById("lienzo-jheart-target-dropzone");
        if (!dropzone) return;

        dropzone.addEventListener("dragenter", (event) => {
            event.preventDefault();
        });

        dropzone.addEventListener("dragover", (event) => {
            event.preventDefault();
            dropzone.classList.add("is-drag-valid");
            event.dataTransfer.dropEffect = "copy";
        });

        dropzone.addEventListener("dragleave", () => {
            dropzone.classList.remove("is-drag-valid");
        });

        dropzone.addEventListener("drop", (event) => {
            event.preventDefault();
            dropzone.classList.remove("is-drag-valid");

            let payload = null;

            try {
                payload = JSON.parse(event.dataTransfer.getData("application/json") || "{}");
            } catch (error) {
                payload = null;
            }

            const rank = normalizeRank(payload?.rank);
            const suit = normalizeSuit(payload?.suit);
            const playId = Number(payload?.playId || 0);

            if (rank !== "J" || suit !== "HEART" || playId !== Number(play?.id || 0)) {
                alert("Solo podés soltar esta J♥.");
                return;
            }

            window.__jheartDropSelection = {
                rank: "J",
                suit: "HEART",
                playId
            };

            renderLienzo(play);
        });
    }

    function bindActions(play) {
        const sendBtn = document.getElementById("jheart-send-btn");

        if (sendBtn) {
            sendBtn.addEventListener("click", (event) => {
                event.stopPropagation();
                handleSendPlay(play);
            });
        }
    }

    function renderLienzo(play) {
        const container = getLienzoContainer();
        const deck = getCurrentDeck();

        if (!container || !play) return;

        container.innerHTML = `
      ${renderDeckHeader(deck)}

      <div class="lienzo-grid">
        <div id="colombes" class="lienzo-grid__left">
          ${renderSourcePanel(play)}
        </div>

        <div id="amsterdam" class="lienzo-grid__right">
          ${renderTargetPanel(play)}
        </div>
      </div>
    `;

        mountPlacardFromDataset(play);
        bindSourceDrag(play);
        bindTargetDropzone(play);
        bindActions(play);
    }

    async function openLienzoByPlayId(playId) {
        const play = getPlayById(playId);

        if (!play) {
            const container = getLienzoContainer();
            if (container) {
                container.innerHTML = `
          <div class="lienzo-error">
            No se encontró la J♥ ${escapeHtml(playId)}.
          </div>
        `;
            }
            return;
        }

        const rank = normalizeRank(play?.card_rank || play?.rank);
        const suit = normalizeSuit(play?.card_suit || play?.suit);

        if (rank !== "J" || suit !== "HEART") {
            const container = getLienzoContainer();
            if (container) {
                container.innerHTML = `
          <div class="lienzo-error">
            Esta página solo acepta J♥.
          </div>
        `;
            }
            return;
        }

        window.__jheartDropSelection = null;
        renderLienzo(play);
    }

    window.openLienzoByPlayId = openLienzoByPlayId;
})();