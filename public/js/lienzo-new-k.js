(function () {
    function normalizeRank(value) {
        return String(value || "").trim().toUpperCase();
    }

    window.__lienzoAnimationState = window.__lienzoAnimationState || {
        sourceCardDelivered: false
    };

    function bindActionButtons() {
        const saveBtn = document.getElementById("lienzo-save-btn");

        if (saveBtn) {
            saveBtn.addEventListener("click", handleSavePlay);
        }

    }


    function getAceOwnerTribune(suit) {
        const plays = getAllPlays();

        const ace = plays.find((p) => {
            const rank = normalizeRank(p?.card_rank || p?.rank);
            const cardSuit = normalizeSuit(p?.card_suit || p?.suit);
            const flow = String(p?.play_code || "").split("§")[7] || "";

            return (
                rank === "A" &&
                cardSuit === suit &&
                String(flow).toLowerCase() === "foundation"
            );
        });

        if (!ace) return null;

        return {
            role: `A_${suit}`,
            userId: Number(ace.target_user_id || ace.created_by_user_id || 0),
            nickname: ace.target_user_nickname || ace.created_by_nickname || "Usuario",
            profile_photo_url:
                ace.target_user_profile_photo_url ||
                ace.created_by_profile_photo_url ||
                "/assets/icons/singeta120.gif"
        };
    }



    function getValidatorTribunesForDraft(draft) {
        const rank = normalizeRank(draft?.card_rank);
        const suit = normalizeSuit(draft?.card_suit);

        const validators = [];

        // K enviada por usuario que no es A♣
        if (rank === "K") {
            validators.push(getAceOwnerTribune("CLUB"));
        }

        // QQpica / Q con monto: más adelante A♦ + A♣
        if (rank === "Q" && suit === "SPADE") {
            validators.push(getAceOwnerTribune("CLUB"));
        }

        return validators.filter(Boolean);
    }

    function getValidatorRoleCards(validator) {
        const role = String(validator?.role || "").trim().toUpperCase();

        if (role === "A_CLUB") {
            return [{ card_rank: "A", card_suit: "CLUB" }];
        }

        if (role === "A_DIAMOND") {
            return [{ card_rank: "A", card_suit: "DIAMOND" }];
        }

        if (role === "A_SPADE") {
            return [{ card_rank: "A", card_suit: "SPADE" }];
        }

        if (role === "A_HEART") {
            return [{ card_rank: "A", card_suit: "HEART" }];
        }

        return [];
    }

    function renderColombesTribunes(draft) {
        const currentUser = getCurrentUser();

        const authorTribune = renderSourcePlayerPanel(draft);

        const validatorTribunes = getValidatorTribunesForDraft(draft)
            .filter((validator) => Number(validator.userId) !== Number(currentUser?.id || 0))
            .map((validator) => {
                const cards = getValidatorRoleCards(validator);
                return renderUserTribune(validator, cards);
            })
            .join("");

        return `
    <div class="lienzo-tribunes lienzo-tribunes--colombes">
      ${authorTribune}
      ${validatorTribunes}
    </div>
  `;
    }

    function renderUserTribune(user, cards = []) {
        const name = user?.nickname || "Usuario";
        const photo = user?.profile_photo_url || "/assets/icons/singeta120.gif";

        return `
    <section class="lienzo-panel lienzo-panel--source panel--split-top">
      <div class="panel-topbar panel-topbar--single">
        <div class="panel-topbar__col panel-topbar__col--identity">
          <div class="lienzo-source-header lienzo-source-header--top">
            <img
              class="lienzo-source-header__photo"
              src="${escapeHtml(photo)}"
              alt="${escapeHtml(name)}"
            />
            <div class="lienzo-source-header__name">${escapeHtml(name)}</div>
          </div>
        </div>
      </div>

      <div class="lienzo-source-cards">
        <div class="lienzo-source-stack">
          ${cards.map(renderBackgroundCard).join("")}
        </div>
      </div>
    </section>
  `;
    }


    async function handleSavePlay() {
        try {
            const draft = window.__lienzoNewDraft;
            const token = localStorage.getItem("cooptrackToken");

            if (!draft?.deckId) {
                alert("Deck inválido");
                return;
            }

            if (!draft?.parentPlayId) {
                alert("Falta la jugada madre");
                return;
            }

            if (!draft?.card_rank || !draft?.card_suit) {
                alert("Falta la carta a crear");
                return;
            }

            if (!draft?.target_user_id) {
                alert("Seleccioná un destinatario");
                return;
            }

            if (!token) {
                alert("No estás logueado");
                return;
            }

            const userId =
                window.__currentState?.userId ||
                window.__currentUser?.id ||
                null;

            if (!userId) {
                alert("No se pudo identificar el usuario");
                return;
            }

            const when = new Date().toISOString();

            const playCode = [
                draft.deckId,
                userId,
                when,
                String(draft.card_rank).toUpperCase(),
                String(draft.card_suit).toUpperCase(),
                "create_from_lienzo",
                `U:${userId}`,
                `child_of:${draft.parentPlayId}`,
                `U:${draft.target_user_id}`
            ].join("§");

            const response = await fetch("/plays", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    deck_id: draft.deckId,
                    parent_play_id: draft.parentPlayId,
                    target_user_id: draft.target_user_id,
                    play_code: playCode,
                    text: draft.play_text || "",
                    play_status: "ACTIVE"
                })
            });

            const data = await response.json();

            if (!response.ok || !data.ok) {
                console.error("Error guardando jugada:", data);
                alert(data?.error || "No se pudo guardar la jugada");
                return;
            }

            const newPlay = data.play || null;
            const playId = Number(newPlay?.id || 0);

            if (!playId) {
                alert("La jugada se guardó, pero no volvió el id");
                return;
            }

            const nextPage = resolveLienzoPageForCard(
                draft.card_rank,
                draft.card_suit
            );

            let extraParams = "";

            if (normalizeRank(draft.card_rank) === "A") {
                extraParams = "&action=transfer";
            }

            window.location.href = `${nextPage}?deckId=${draft.deckId}&playId=${playId}${extraParams}`;

        } catch (error) {
            console.error("Error en SAVE", error);
            alert("No se pudo guardar la jugada");
        }
    }

    function getCurrentUserCorporateCards() {
        const state = getCurrentState();
        const plays = Array.isArray(state?.plays) ? state.plays : [];

        const currentUser = getCurrentUser();
        const userId = Number(currentUser?.id || 0);

        if (!userId) return [];

        const cards = deriveOwnedCorporateCards(plays, userId);

        return cards.sort(compareCorporateCards);
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

        const aKey = `${normalizeRank(a?.card_rank)}_${normalizeSuit(a?.card_suit)}`;
        const bKey = `${normalizeRank(b?.card_rank)}_${normalizeSuit(b?.card_suit)}`;

        return (order[aKey] || 999) - (order[bKey] || 999);
    }

    function buildSourceCardsScene(draft) {
        const ownedCards = getCurrentUserCorporateCards();

        return {
            backgroundCards: ownedCards,
            activeCard: {
                card_rank: normalizeRank(draft?.card_rank),
                card_suit: normalizeSuit(draft?.card_suit)
            }
        };
    }

    function renderBackgroundCard(card, index) {
        const src = getCardImageSrc(card?.card_rank, card?.card_suit);

        return `
    <img
      class="lienzo-source-stack__card"
      src="${escapeHtml(src)}"
      alt=""
      style="left:${index * 18}px;"
    />
  `;
    }


    function animateCardToUser(user) {
        const source = document.getElementById("lienzo-source-card");
        if (!source) {
            console.warn("No hay carta origen");
            return;
        }

        const rect = source.getBoundingClientRect();

        // 👻 crear recuadro fantasma
        const ghostWrap = document.createElement("div");
        const draft = window.__lienzoNewDraft;

        ghostWrap.innerHTML = `
  <img
    class="lienzo-card-image"
    src="${escapeHtml(getCardImageSrc(draft?.card_rank, draft?.card_suit))}"
    alt=""
  />
`;

        const ghostNode = ghostWrap.firstElementChild;
        if (!ghostNode) return;

        ghostNode.style.position = "fixed";
        ghostNode.style.left = rect.left + "px";
        ghostNode.style.top = rect.top + "px";
        ghostNode.style.width = "360px";
        ghostNode.style.margin = "0";
        ghostNode.style.zIndex = "9999";
        ghostNode.style.transition = "all 450ms ease";
        ghostNode.style.pointerEvents = "none";

        document.body.appendChild(ghostNode);

        source.style.visibility = "hidden";
        source.style.pointerEvents = "none";

        const container = document.querySelector(".lienzo-grid__right");
        if (!container) return;

        const targetRect = container.getBoundingClientRect();

        const targetX = targetRect.left + targetRect.width / 2 - 180;
        const targetY = targetRect.top + targetRect.height / 3;

        requestAnimationFrame(() => {
            ghostNode.style.left = targetX + "px";
            ghostNode.style.top = targetY + "px";
            ghostNode.style.transform = "scale(1.05)";
        });

        ghostNode.addEventListener("transitionend", () => {
            if (!ghostNode.parentNode) return;

            ghostNode.remove();

            window.__lienzoAnimationState = {
                ...(window.__lienzoAnimationState || {}),
                sourceCardDelivered: true
            };

            const leftContainer = document.querySelector(".lienzo-grid__left");
            if (leftContainer) {
                leftContainer.innerHTML = renderColombesTribunes(window.__lienzoNewDraft);
            }

            renderAssignedTargetPanel(user);

            bindActionButtons();

            setTimeout(() => {
                mountCardInTarget();
            }, 50);
        });
    }

    function mountCardInTarget() {
        const dropzone = document.getElementById("lienzo-target-dropzone");
        if (!dropzone) return;

        const draft = window.__lienzoNewDraft;

        dropzone.innerHTML = `
    <img
      class="lienzo-card-image"
      src="${escapeHtml(getCardImageSrc(draft?.card_rank, draft?.card_suit))}"
      alt=""
    />

    <div class="lienzo-actions">
      ${renderActionButtons()}
    </div>
  `;

        bindActionButtons();
    }

    function renderAssignedTargetPanel(user) {
        const container = document.querySelector(".lienzo-grid__right");
        if (!container) return;

        const photo = user?.profile_photo_url || "/assets/icons/singeta120.gif";
        const name =
            user?.nickname ||
            user?.full_name ||
            user?.name ||
            `Usuario ${user?.id || ""}`;

        container.innerHTML = `
    <section class="lienzo-panel lienzo-panel--target panel--split-top">
      <div class="panel-topbar panel-topbar--single">
        <div class="panel-topbar__col panel-topbar__col--identity">
          <div class="lienzo-target-header lienzo-target-header--top">
            <img
              class="lienzo-target-header__photo"
              src="${escapeHtml(photo)}"
              alt="${escapeHtml(name)}"
            />
            <div class="lienzo-target-header__name">
              ${escapeHtml(name)}
            </div>
          </div>
        </div>
      </div>

      <div class="lienzo-target-mainrow">
        <div id="lienzo-target-dropzone" class="lienzo-target-dropzone">
          <!-- acá aterriza la carta -->
        </div>
      </div>
    </section>
  `;
    }

    function renderActionButtons() {
        const saveIcon = window.ICONS?.actions?.save || "/assets/icons/salvar40.gif";

        return `
    <div class="lienzo-actions">
      <button id="lienzo-save-btn" class="icon-btn" title="Salvar">
        <img src="${saveIcon}" alt="Salvar" />
      </button>

    </div>
  `;
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

    function deriveOwnedCorporateCards(plays, userId) {
        if (!Array.isArray(plays) || !userId) return [];

        const activeStatuses = ["ACTIVE", "APPROVED", "SENT", "PENDING"];
        const finalStatuses = ["QUIT", "FIRED", "REJECTED", "CANCELLED"];

        const cards = plays
            .filter((p, index) => {
                if (index < 10) return false;

                const parts = String(p?.play_code || "").split("§");
                const rank = normalizeRank(p?.card_rank || p?.rank || parts[3]);
                const suit = normalizeSuit(p?.card_suit || p?.suit || parts[4]);
                const action = String(parts[5] || "").trim().toLowerCase();
                const flow = String(parts[7] || "").trim().toLowerCase();
                const status = normalizeRank(p?.play_status || p?.status);

                if (!["A", "K"].includes(rank)) return false;
                if (!["HEART", "SPADE", "DIAMOND", "CLUB"].includes(suit)) return false;

                if (finalStatuses.includes(status)) return false;
                if (flow === "acl") return false;
                if (action === "puedejugar") return false;

                let ownerId = 0;

                if (rank === "A") {
                    ownerId = Number(p?.target_user_id || p?.created_by_user_id || 0);
                }

                if (rank === "K") {
                    if (status === "APPROVED") {
                        ownerId = Number(p?.target_user_id || p?.created_by_user_id || 0);
                    } else {
                        ownerId = Number(p?.created_by_user_id || 0);
                    }
                }

                if (ownerId !== Number(userId)) return false;

                if (rank === "A") {
                    return flow === "foundation";
                }

                if (rank === "K") {
                    return activeStatuses.includes(status);
                }

                return false;
            })
            .map((p) => ({
                id: p.id,
                card_rank: normalizeRank(p.card_rank || p.rank),
                card_suit: normalizeSuit(p.card_suit || p.suit)
            }));

        const seen = new Set();

        return cards
            .filter((card) => {
                const key = `${card.card_rank}_${card.card_suit}`;
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            })
            .sort(compareCorporateCards);
    }

    function getCurrentDeck() {
        const state = getCurrentState();

        return (
            state?.deck ||
            state?.mazo ||
            window.__currentDeck ||
            {}
        );
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

    function getDeckAvatarSrc(deck) {
        console.log("deck completo =", deck);
        console.log("posibles campos imagen =", {
            deck_image_url: deck?.deck_image_url,
            image_url: deck?.image_url,
            photo_url: deck?.photo_url,
            avatar: deck?.avatar
        });

        const raw =
            deck?.deck_image_url ||
            deck?.image_url ||
            deck?.photo_url ||
            deck?.avatar ||
            "";

        return String(raw).trim() || "/assets/icons/sinPicture.gif";
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

    function getLienzoContainer() {
        return document.getElementById("lienzo-container");
    }

    function getLienzoNewParams() {
        const params = new URLSearchParams(window.location.search);

        return {
            deckId: Number(params.get("deckId") || 0),
            parentPlayId: Number(params.get("parentPlayId") || 0),
            childRank: normalizeRank(params.get("childRank")),
            childSuit: normalizeSuit(params.get("childSuit"))
        };
    }

    function buildDraftFromParams() {
        const { deckId, parentPlayId, childRank, childSuit } = getLienzoNewParams();
        const parentPlay = getPlayById(parentPlayId);
        const deck = getCurrentDeck();
        const currentUser = getCurrentUser();

        return {
            mode: "new",
            deckId: deckId || Number(deck?.id || 0),
            parentPlayId,
            parentPlay,
            card_rank: childRank,
            card_suit: childSuit,
            target_user_id: currentUser?.id || null,
            target_user: currentUser || null,
            play_text: "",
            status: "DRAFT"
        };
    }

    function renderDeckHeader(deck) {
        const avatarSrc = getDeckAvatarSrc(deck);
        const deckName = deck?.name || "Mazo";
        const currencyCode = getCurrencyCode(deck);
        const currencyName =
            String(deck?.currency_name || "").trim() ||
            String(deck?.currency_label || "").trim() ||
            "";

        return `
    <div
      id="lienzo-placard"
      data-photo-url="${escapeHtml(avatarSrc)}"
      data-rank="A"
      data-suit="HEART"
      data-title="${escapeHtml(deckName)}"
      data-currency-code="${escapeHtml(currencyCode)}"
      data-currency-name="${escapeHtml(currencyName)}"
    ></div>
  `;
    }

    function mountPlacardFromDataset() {
        const placardHost = document.getElementById("lienzo-placard");
        if (!placardHost) return;
        if (typeof window.renderPlacard !== "function") return;

        window.renderPlacard(placardHost, {
            page: "lienzo-new",
            photoUrl: placardHost.dataset.photoUrl || "",
            rank: placardHost.dataset.rank || "A",
            suit: placardHost.dataset.suit || "HEART",
            title: placardHost.dataset.title || "Mazo",
            currencyCode: placardHost.dataset.currencyCode || "",
            currencyName: placardHost.dataset.currencyName || "",
            showCurrency: false
        });
    }

    function buildPanelTopbar({ identityHtml, actionsHtml, single = false }) {
        return `
    <div class="panel-topbar ${single ? "panel-topbar--single" : ""}">
      <div class="panel-topbar__col panel-topbar__col--identity">
        ${identityHtml}
      </div>
      ${single
                ? ""
                : `
      <div class="panel-topbar__col panel-topbar__col--actions">
        ${actionsHtml}
      </div>`
            }
    </div>
  `;
    }

    function renderUsersPanel() {
        return `
    <section class="lienzo-panel lienzo-panel--target lienzo-panel--target-empty panel--split-top">

      <div class="lienzo-target-empty">
        <img
          class="lienzo-target-empty__photo"
          src="/assets/icons/singeta120.gif"
          alt="Destinatario"
        />

        <div class="lienzo-target-empty__label">
          Destinatario
        </div>
      </div>

      <div id="lienzo-users-picker" class="lienzo-users-picker"></div>

    </section>
  `;
    }

    async function refreshCurrentUser() {
        try {
            const token = localStorage.getItem("cooptrackToken");
            if (!token) return getCurrentUser();

            const response = await fetch("/me", {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });

            if (!response.ok) {
                return getCurrentUser();
            }

            const data = await response.json();
            const freshUser = data?.user || null;

            if (freshUser) {
                window.__currentUser = freshUser;

                window.__currentState = {
                    ...(window.__currentState || {}),
                    currentUser: freshUser
                };
            }

            return freshUser || getCurrentUser();
        } catch (error) {
            console.error("No se pudo refrescar el usuario actual", error);
            return getCurrentUser();
        }
    }

    function getCurrentUser() {
        return window.__currentUser || window.__currentState?.currentUser || null;
    }


    function renderSourcePlayerPanel(draft) {
        const user = getCurrentUser();
        const userPhoto = user?.profile_photo_url || "/assets/icons/singeta120.gif";
        const userName =
            user?.nickname ||
            user?.full_name ||
            user?.name ||
            "Creador";

        const scene = buildSourceCardsScene(draft);
        const delivered =
            window.__lienzoAnimationState?.sourceCardDelivered === true;


        const topbar = buildPanelTopbar({
            identityHtml: `
      <div class="lienzo-source-header lienzo-source-header--top">
        <img
          class="lienzo-source-header__photo"
          src="${escapeHtml(userPhoto)}"
          alt="${escapeHtml(userName)}"
        />
        <div class="lienzo-source-header__name">
          ${escapeHtml(userName)}
        </div>
      </div>
    `,
            actionsHtml: ""
        });

        return `
    <section class="lienzo-panel lienzo-panel--source panel--split-top">
      ${topbar}

      <div class="lienzo-source-cards">
        <div class="lienzo-source-stack">
  ${scene.backgroundCards.map(renderBackgroundCard).join("")}

  ${delivered
    ? ""
    : `
      <img
        id="lienzo-source-card"
        class="lienzo-card-image lienzo-source-active"
        src="${escapeHtml(getCardImageSrc(draft?.card_rank, draft?.card_suit))}"
        alt=""
      />
    `
  }
</div>
      </div>

    </section>
  `;
    }


    function bindUsersPicker(draft) {
        const selectedBox = document.getElementById("lienzo-user-selected");

        if (typeof window.renderUsersPicker !== "function") {
            const picker = document.getElementById("lienzo-users-picker");
            if (picker) {
                picker.innerHTML = `
        <div class="lienzo-error">
          No se pudo cargar users.js
        </div>
      `;
            }
            return;
        }

        window.renderUsersPicker("lienzo-users-picker", {
            currentUserId: Number(getCurrentUser()?.id || 0),
            deckId: Number(draft.deckId || 0),
            parentPlayId: Number(draft.parentPlayId || 0),
            childRank: normalizeRank(draft.card_rank),
            childSuit: normalizeSuit(draft.card_suit),
            plays: getAllPlays(),

            onSelect(user) {
                window.__lienzoNewDraft = {
                    ...window.__lienzoNewDraft,
                    target_user_id: Number(user?.id || 0) || null,
                    target_user: user || null
                };

                if (!selectedBox) return;

                if (!user) {
                    selectedBox.textContent = "Nadie seleccionado";
                    return;
                }

                selectedBox.textContent =
                    "Seleccionado: " +
                    (user.nickname ||
                        user.full_name ||
                        user.name ||
                        `Usuario ${user.id}`);
            },

            onAnimateSelect(user) {
                window.__lienzoNewDraft = {
                    ...window.__lienzoNewDraft,
                    target_user_id: Number(user?.id || 0) || null,
                    target_user: user || null
                };

                if (selectedBox && user) {
                    selectedBox.textContent =
                        "Seleccionado: " +
                        (user.nickname ||
                            user.full_name ||
                            user.name ||
                            `Usuario ${user.id}`);
                }

                document.dispatchEvent(
                    new CustomEvent("lienzo:animate-card-to-user", {
                        detail: { user }
                    })
                );
            }
        });
    }
    function bindCreateButton() {
        const btn = document.getElementById("lienzo-new-save-btn");
        if (!btn) return;

        btn.addEventListener("click", () => {
            const draft = window.__lienzoNewDraft || null;

            if (!draft) {
                alert("No se pudo armar el borrador.");
                return;
            }

            if (!draft.parentPlayId) {
                alert("Falta la jugada madre.");
                return;
            }

            if (!draft.card_rank || !draft.card_suit) {
                alert("Falta la carta a crear.");
                return;
            }

            if (!draft.target_user_id) {
                alert("Seleccioná un destinatario.");
                return;
            }

            document.dispatchEvent(
                new CustomEvent("lienzo:new-play", {
                    detail: {
                        deckId: draft.deckId,
                        parentPlayId: draft.parentPlayId,
                        childRank: draft.card_rank,
                        childSuit: draft.card_suit,
                        targetUserId: draft.target_user_id
                    }
                })
            );
        });
    }

    async function renderNewLienzo() {
        await refreshCurrentUser();

        const container = getLienzoContainer();
        const deck = getCurrentDeck();
        const draft = buildDraftFromParams();

        if (!container) return;

        if (!draft.parentPlayId) {
            container.innerHTML = `
        <div class="lienzo-error">
          Falta parentPlayId en la URL.
        </div>
      `;
            return;
        }

        if (!draft.card_rank || !draft.card_suit) {
            container.innerHTML = `
        <div class="lienzo-error">
          Faltan childRank o childSuit en la URL.
        </div>
      `;
            return;
        }

        if (!draft.parentPlay) {
            container.innerHTML = `
        <div class="lienzo-error">
          No se encontró la jugada madre ${escapeHtml(draft.parentPlayId)}.
        </div>
      `;
            return;
        }

        window.__lienzoNewDraft = draft;

        container.innerHTML = `
  ${renderDeckHeader(deck)}

  <div class="lienzo-grid">
    <div id="colombes" class="lienzo-grid__left">
      ${renderColombesTribunes(draft)}
    </div>

    <div id="amsterdam" class="lienzo-grid__right">
      ${renderUsersPanel()}
    </div>
  </div>
`;
        mountPlacardFromDataset();
        bindUsersPicker(draft);
    }
    document.addEventListener("lienzo:animate-card-to-user", (event) => {
        const user = event.detail?.user;
        if (!user) return;

        animateCardToUser(user);
    });



    window.openNewLienzo = renderNewLienzo;
    bindActionButtons();
})();
