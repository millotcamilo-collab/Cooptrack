(function () {
    function normalizeRank(value) {
        return String(value || "").trim().toUpperCase();
    }

    function normalizeSuit(value) {
        return String(value || "").trim().toUpperCase();
    }

    function normalizeRank(value) {
        return String(value || "").trim().toUpperCase();
    }

    function normalizeSuit(value) {
        return String(value || "").trim().toUpperCase();
    }

    function getCurrentState() {
        return window.__currentState || {};
    }

    function getAllPlays() {
        const state = getCurrentState();
        return Array.isArray(state.plays) ? state.plays : [];
    }

    function getCurrentUser() {
        return window.__currentUser || window.__currentState?.currentUser || null;
    }

    function getFinalTargetUserIdFromPlayCode(playCode) {
        const parsed = parsePlayCode(playCode);
        const flow = String(parsed?.flow || "");

        const match = flow.match(/finalTarget:U:(\d+)/i);
        return match ? Number(match[1]) : 0;
    }

    function isAceTransferFallbackKing(play) {
        const parsed = parsePlayCode(play?.play_code);
        return (
            normalizeRank(play?.card_rank) === "K" &&
            String(parsed?.action || "").trim() === "ace_transfer_fallback_king"
        );
    }

    function getParentPlay(play) {
        return getPlayById(play?.parent_play_id);
    }

    function resolveFallbackAceNewOwner(play) {
        const parentAce = getParentPlay(play);

        if (!parentAce) return null;

        return {
            id: Number(parentAce.target_user_id || parentAce.created_by_user_id || 0),
            nickname:
                parentAce.target_user_nickname ||
                parentAce.created_by_nickname ||
                "Nuevo propietario",
            profile_photo_url:
                parentAce.target_user_profile_photo_url ||
                parentAce.created_by_profile_photo_url ||
                "/assets/icons/singeta120.gif"
        };
    }

    function resolveFallbackKingOwner(play) {
        return {
            id: Number(play?.created_by_user_id || 0),
            nickname: play?.created_by_nickname || "Propietario anterior",
            profile_photo_url:
                play?.created_by_profile_photo_url || "/assets/icons/singeta120.gif"
        };
    }

    function findUserById(userId) {
        const id = Number(userId || 0);
        if (!id) return null;

        const plays = getAllPlays();

        for (const play of plays) {
            if (Number(play?.created_by_user_id || 0) === id) {
                return {
                    id,
                    nickname: play.created_by_nickname || "Usuario",
                    profile_photo_url: play.created_by_profile_photo_url || "/assets/icons/singeta120.gif"
                };
            }

            if (Number(play?.target_user_id || 0) === id) {
                return {
                    id,
                    nickname: play.target_user_nickname || "Usuario",
                    profile_photo_url: play.target_user_profile_photo_url || "/assets/icons/singeta120.gif"
                };
            }
        }

        return null;
    }

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

    function deriveOwnedCorporateCards(plays, userId) {
        if (!Array.isArray(plays) || !userId) return [];

        return plays
            .filter((p) => {
                const rank = normalizeRank(p?.card_rank || p?.rank);
                const suit = normalizeSuit(p?.card_suit || p?.suit);

                // exactamente el mismo criterio que lienzo-new
                if (rank !== "A") return false;
                if (!["HEART", "SPADE", "DIAMOND", "CLUB"].includes(suit)) return false;

                const ownerId =
                    Number(p?.target_user_id || 0) ||
                    Number(p?.created_by_user_id || 0);

                return ownerId === Number(userId);
            })
            .map((p) => ({
                id: p?.id,
                card_rank: p?.card_rank || p?.rank,
                card_suit: p?.card_suit || p?.suit
            }));
    }


    function getSourceUserCorporateCards(play) {
        const plays = getAllPlays();
        const sourceUser = resolveSourceUser(play);
        const sourceUserId = Number(sourceUser?.id || 0);

        if (!sourceUserId) return [];

        return deriveOwnedCorporateCards(plays, sourceUserId).sort(compareCorporateCards);
    }

    function buildSourceCardsScene(play) {
        const ownedCards = getSourceUserCorporateCards(play);

        const activeRank = normalizeRank(play?.card_rank || play?.rank);
        const activeSuit = normalizeSuit(play?.card_suit || play?.suit);

        const backgroundCards = ownedCards.filter((card) => {
            const rank = normalizeRank(card?.card_rank);
            const suit = normalizeSuit(card?.card_suit);

            return !(rank === activeRank && suit === activeSuit);
        });

        return {
            backgroundCards,
            activeCard: {
                card_rank: activeRank,
                card_suit: activeSuit
            }
        };
    }

function renderBackgroundCard(card, index = 0) {
  const src = getCardImageSrc(card?.card_rank, card?.card_suit);

  return `
    <img
      class="lienzo-tribune__corporate-card"
      src="${escapeHtml(src)}"
      alt=""
      style="left:${index * 18}px;"
    />
  `;
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

    function getCurrentUser() {
        return window.__currentUser || window.__currentState?.currentUser || null;
    }

    function getSuitSymbol(suit) {
        const s = normalizeSuit(suit);
        if (s === "HEART") return "♥";
        if (s === "SPADE") return "♠";
        if (s === "DIAMOND") return "♦";
        if (s === "CLUB") return "♣";
        return "";
    }

    function getCardImageSrc(rank, suit) {
        const r = normalizeRank(rank);
        const s = normalizeSuit(suit);

        const map = {
            A_HEART: "/assets/icons/Acorazon.png",
            A_SPADE: "/assets/icons/Apike.png",
            A_DIAMOND: "/assets/icons/Adiamante.png",
            A_CLUB: "/assets/icons/Atrebol.png",

            K_HEART: "/assets/icons/Kcorazon.png",
            K_SPADE: "/assets/icons/Kpike.png",
            K_DIAMOND: "/assets/icons/Kdiamante.png",
            K_CLUB: "/assets/icons/Ktrebol.png"
        };

        return map[`${r}_${s}`] || "/assets/icons/Dorso70.png";
    }

    function getDeckAvatarSrc(deck) {
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

        const playId = Number(new URLSearchParams(window.location.search).get("playId") || 0);
        const currentPlay = getPlayById(playId);

        window.renderPlacard(placardHost, {
            page: "lienzo-k",
            mode: "K",
            play: currentPlay,
            currentUserId: Number(getCurrentUser()?.id || 0),
            plays: getAllPlays(),

            photoUrl: placardHost.dataset.photoUrl || "",
            rank: placardHost.dataset.rank || "A",
            suit: placardHost.dataset.suit || "HEART",
            title: placardHost.dataset.title || "Mazo",
            currencyCode: placardHost.dataset.currencyCode || "",
            currencyName: placardHost.dataset.currencyName || "",
            showCurrency: false
        });
    }

    function resolveSourceUser(play) {
        if (isAceTransferFallbackKing(play)) {
            return resolveFallbackAceNewOwner(play) || {
                id: 0,
                nickname: "Nuevo propietario",
                profile_photo_url: "/assets/icons/singeta120.gif"
            };
        }

        return {
            id: Number(play?.created_by_user_id || 0),
            nickname: play?.created_by_nickname || "Anfitrión",
            profile_photo_url:
                play?.created_by_profile_photo_url || "/assets/icons/singeta120.gif"
        };
    }

    function resolveTargetUser(play) {
        if (isAceTransferFallbackKing(play)) {
            return resolveFallbackKingOwner(play);
        }

        const finalTargetUserId = getFinalTargetUserIdFromPlayCode(play?.play_code);

        if (finalTargetUserId) {
            return {
                id: finalTargetUserId,
                nickname: play?.final_target_nickname || "Destinatario",
                profile_photo_url:
                    play?.final_target_profile_photo_url || "/assets/icons/singeta120.gif"
            };
        }

        return {
            id: Number(play?.target_user_id || 0),
            nickname: play?.target_user_nickname || "Destinatario",
            profile_photo_url:
                play?.target_user_profile_photo_url || "/assets/icons/singeta120.gif"
        };
    }

    function getPlayStatus(play) {
        return String(play?.play_status || "").trim().toUpperCase();
    }

    function getCurrentUserId() {
        return Number(getCurrentUser()?.id || 0);
    }

    function isSourceViewer(play) {
        return getCurrentUserId() === Number(play?.created_by_user_id || 0);
    }

    function isTargetViewer(play) {
        return getCurrentUserId() === Number(play?.target_user_id || 0);
    }

    function getKUiState(play) {
        const status = getPlayStatus(play);

        if (status === "PENDING") return "PENDING";
        if (status === "SENT") return "SENT";
        if (status === "APPROVED") return "APPROVED";
        if (status === "QUIT") return "QUIT";
        if (status === "FIRED") return "FIRED";

        return "ACTIVE";
    }

    function getPlayOwnerUser(play) {
        return Number(play?.target_user_id || 0)
            ? resolveTargetUser(play)
            : resolveSourceUser(play);
    }

    function getPlayOwnerCards(play) {
        const ownerUser = getPlayOwnerUser(play);
        if (!ownerUser?.id) return [];

        return deriveOwnedCorporateCards(getAllPlays(), Number(ownerUser.id)).sort(compareCorporateCards);
    }

    function getActionIcon(name) {
        return window.ICONS?.actions?.[name] || "";
    }

    function renderIconButton({ id, action, icon, title }) {
        return `
      <button
        ${id ? `id="${escapeHtml(id)}"` : ""}
        class="icon-btn"
        data-action="${escapeHtml(action)}"
        title="${escapeHtml(title)}"
        aria-label="${escapeHtml(title)}"
        type="button"
      >
        <img src="${escapeHtml(icon)}" alt="${escapeHtml(title)}" />
      </button>
    `;
    }

    function getCardOwnerUserId(play) {
        return Number(play?.target_user_id || 0) || Number(play?.created_by_user_id || 0);
    }

    function userOwnsAceClub(userId) {
        return getAllPlays().some((p) => {
            const rank = normalizeRank(p?.card_rank || p?.rank);
            const suit = normalizeSuit(p?.card_suit || p?.suit);
            const ownerId = getCardOwnerUserId(p);
            const flow = String(p?.play_code || "").split("§")[7] || "";

            return (
                rank === "A" &&
                suit === "CLUB" &&
                ownerId === Number(userId) &&
                String(flow).toLowerCase() === "foundation"
            );
        });
    }

    function renderSourceActions(play) {
        const uiState = getKUiState(play);
        const currentUserId = getCurrentUserId();
        const currentUserIsAceClub = userOwnsAceClub(currentUserId);

        const buttons = [];

        if (uiState === "ACTIVE" && isSourceViewer(play)) {
            buttons.push(
                renderIconButton({
                    id: "lienzo-send-btn",
                    action: "send-k",
                    icon: getActionIcon("send") || "/assets/icons/buzon60.gif",
                    title: "Enviar"
                })
            );
        }

        if (uiState === "APPROVED" && isSourceViewer(play)) {
            buttons.push(
                renderIconButton({
                    id: "lienzo-dismiss-btn",
                    action: "dismiss-k",
                    icon: getActionIcon("fired") || "/assets/icons/pistola60.gif",
                    title: "Despedir"
                })
            );
        }

        return `
    <div class="nuevo-mazo-target-actions nuevo-mazo-target-actions--top">
      ${buttons.join("")}
    </div>
  `;
    }


function renderKCardBox(play, actionsHtml = "") {
    const rank = normalizeRank(play?.card_rank || play?.rank || "K");
    const suit = normalizeSuit(play?.card_suit || play?.suit);
    const ownerUser = getPlayOwnerUser(play);

    return window.CartaTipo.renderPlayCardBox({
        rank,
        suit,
        title: "",
        status: play?.play_status || "",
        ownerUser,
        ownerCards: getPlayOwnerCards(play),
        actionsHtml
    });
}

function renderSourcePlayerPanel(play) {
  const sourceUser = resolveSourceUser(play);
  const scene = buildSourceCardsScene(play);
  const backgroundCards = Array.isArray(scene?.backgroundCards)
    ? scene.backgroundCards
    : [];

  return `
    <section class="lienzo-tribune lienzo-tribune--source">

      <div class="lienzo-tribune__corporates">
        ${backgroundCards
          .map((card, index) => renderBackgroundCard(card, index))
          .join("")}
      </div>


      <div class="lienzo-tribune__stage"></div>

    </section>
  `;
}

    function renderTargetActions(play) {
        const uiState = getKUiState(play);

        if (!isTargetViewer(play)) {
            return "";
        }

        const buttons = [];

        if (uiState === "SENT") {
            buttons.push(
                renderIconButton({
                    id: "lienzo-approve-btn",
                    action: "approve-k",
                    icon: getActionIcon("approve") || "/assets/icons/Sello40.gif",
                    title: "Aceptar"
                })
            );

            buttons.push(
                renderIconButton({
                    id: "lienzo-reject-btn",
                    action: "reject-k",
                    icon: getActionIcon("reject") || "/assets/icons/stepback40.gif",
                    title: "Rechazar"
                })
            );
        }

        if (uiState === "APPROVED") {
            buttons.push(
                renderIconButton({
                    id: "lienzo-quit-btn",
                    action: "quit-k",
                    icon: getActionIcon("quit") || "/assets/icons/step60.gif",
                    title: "Renunciar"
                })
            );
        }

        if (uiState === "PENDING") {
            buttons.push(
                renderIconButton({
                    id: "lienzo-approve-btn",
                    action: "validate-k",
                    icon: getActionIcon("send") || "/assets/icons/buzon60.gif",
                    title: "Validar y enviar"
                })
            );

            buttons.push(
                renderIconButton({
                    id: "lienzo-reject-btn",
                    action: "reject-k",
                    icon: getActionIcon("reject") || "/assets/icons/stepback40.gif",
                    title: "Rechazar"
                })
            );
        }

        return `
      <div class="nuevo-mazo-target-actions nuevo-mazo-target-actions--top">
        ${buttons.join("")}
      </div>
    `;
    }

function renderTargetPlayerPanel(play) {


  return `
    <section class="lienzo-tribune lienzo-tribune--target">

      <div class="lienzo-tribune__corporates"></div>

      

      <div class="lienzo-tribune__stage">

<div id="lienzo-target-dropzone" class="lienzo-target-dropzone">
  ${renderKCardBox(play, `
  ${renderSourceActions(play)}
  ${renderTargetActions(play)}
`)}
</div>


      </div>

    </section>
  `;
}

    async function validatePlay(playId) {
        const token = localStorage.getItem("cooptrackToken");

        if (!token) {
            alert("No estás logueado");
            return { ok: false };
        }

        const response = await fetch(`/plays/${playId}/validate`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            }
        });

        const data = await response.json().catch(() => null);

        if (!response.ok || data?.ok === false) {
            alert(data?.error || "No se pudo validar la jugada");
            return { ok: false, data };
        }

        return { ok: true, data };
    }

    async function patchPlay(playId, payload) {
        const token = localStorage.getItem("cooptrackToken");

        if (!token) {
            alert("No estás logueado");
            return { ok: false };
        }

        const response = await fetch(`/plays/${playId}`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify(payload || {})
        });

        let data = null;
        try {
            data = await response.json();
        } catch (_) {
            data = null;
        }

        if (!response.ok || data?.ok === false) {
            alert(data?.error || "No se pudo actualizar la jugada");
            return { ok: false, data };
        }

        return { ok: true, data };
    }

    function goBackToDeck(play) {
        const deckId =
            Number(play?.deck_id || 0) ||
            Number(getCurrentDeck()?.id || 0);

        if (deckId) {
            window.location.href = `/mazoAdministradores.html?id=${deckId}`;
            return;
        }

        window.history.back();
    }

    function getAceClubOwnerUserId() {
        const plays = getAllPlays();

        const aceClub = plays.find((p) => {
            const rank = normalizeRank(p?.card_rank);
            const suit = normalizeSuit(p?.card_suit);
            const flow = String(p?.play_code || "").split("§")[7] || "";

            return (
                rank === "A" &&
                suit === "CLUB" &&
                String(flow).toLowerCase() === "foundation"
            );
        });

        if (!aceClub) return 0;

        return Number(
            aceClub.target_user_id ||
            aceClub.created_by_user_id ||
            0
        );
    }

    function appendFlowChunkToPlayCode(playCode, chunk) {
        const parts = String(playCode || "").split("§");

        while (parts.length < 9) {
            parts.push("");
        }

        const flow = String(parts[7] || "").trim();

        if (flow.includes(chunk)) {
            return parts.join("§");
        }

        parts[7] = flow
            ? `${flow};${chunk}`
            : chunk;

        return parts.join("§");
    }

    function buildPendingAceClubPlayCode(play) {
        const finalTargetId = Number(play?.target_user_id || 0);

        if (!finalTargetId) {
            return play?.play_code || "";
        }

        return appendFlowChunkToPlayCode(
            play?.play_code || "",
            `finalTarget:U:${finalTargetId}`
        );
    }

    function bindLienzoActions(play) {
        const sendBtn = document.getElementById("lienzo-send-btn");
        const dismissBtn = document.getElementById("lienzo-dismiss-btn");
        const approveBtn = document.getElementById("lienzo-approve-btn");
        const rejectBtn = document.getElementById("lienzo-reject-btn");
        const quitBtn = document.getElementById("lienzo-quit-btn");


        if (sendBtn) {
            sendBtn.addEventListener("click", async () => {
                const currentUserId = getCurrentUserId();
                const isAceClub = userOwnsAceClub(currentUserId);

                let payload;

                if (isAceClub) {
                    payload = {
                        play_status: "SENT"
                    };
                } else {
                    const aceClubOwnerId = getAceClubOwnerUserId();

                    payload = {
                        play_status: "PENDING",
                        target_user_id: aceClubOwnerId,
                        play_code: buildPendingAceClubPlayCode(play)
                    };
                }

                const result = await patchPlay(play.id, payload);

                if (result.ok) {
                    const deckId =
                        Number(play?.deck_id || 0) ||
                        Number(getCurrentDeck()?.id || 0);

                    window.location.href = deckId
                        ? `/mazoAdministradores.html?id=${deckId}`
                        : "/mazoAdministradores.html";
                }
            });
        }

        if (dismissBtn) {
            dismissBtn.addEventListener("click", async () => {
                const confirmed = window.confirm("¿Despedir esta K?");
                if (!confirmed) return;

                const result = await patchPlay(play.id, {
                    play_status: "FIRED"
                });

                if (result.ok) {
                    goBackToDeck(play);
                }
            });
        }

        if (approveBtn) {
            approveBtn.addEventListener("click", async () => {
                const status = getPlayStatus(play);
                const hasFinalTarget = !!getFinalTargetUserIdFromPlayCode(play?.play_code);

                const result =
                    status === "PENDING" && hasFinalTarget
                        ? await validatePlay(play.id)
                        : await patchPlay(play.id, { play_status: "APPROVED" });

                if (result.ok) {
                    const deckId =
                        Number(play?.deck_id || 0) ||
                        Number(getCurrentDeck()?.id || 0);

                    if (deckId) {
                        window.location.href = `/mazoAdministradores.html?id=${deckId}`;
                        return;
                    }

                    window.history.back();
                }
            });
        }

        if (rejectBtn) {
            rejectBtn.addEventListener("click", async () => {
                const confirmed = window.confirm("¿Querés rechazar esta K?");
                if (!confirmed) return;

                const result = await patchPlay(play.id, {
                    play_status: "REJECTED"
                });

                if (result.ok) {
                    window.location.href = "/archivo.html";
                }
            });
        }

        if (quitBtn) {
            quitBtn.addEventListener("click", async () => {
                const confirmed = window.confirm("¿Querés renunciar a esta K?");
                if (!confirmed) return;

                const result = await patchPlay(play.id, {
                    play_status: "QUIT"
                });

                if (result.ok) {
                    window.location.href = "/archivo.html";
                }
            });
        }
    }

    function getAceClubOwnerTribune() {
        const plays = getAllPlays();

        const aceClub = plays.find((p) => {
            const rank = normalizeRank(p?.card_rank || p?.rank);
            const suit = normalizeSuit(p?.card_suit || p?.suit);
            const flow = String(p?.play_code || "").split("§")[7] || "";

            return (
                rank === "A" &&
                suit === "CLUB" &&
                String(flow).toLowerCase() === "foundation"
            );
        });

        if (!aceClub) return null;

        const userId = Number(aceClub.target_user_id || aceClub.created_by_user_id || 0);
        if (!userId) return null;

        const user = findUserById(userId) || {};

        return {
            id: userId,
            userId,
            nickname:
                aceClub.target_user_nickname ||
                aceClub.created_by_nickname ||
                user.nickname ||
                "Validador A♣",
            profile_photo_url:
                aceClub.target_user_profile_photo_url ||
                aceClub.created_by_profile_photo_url ||
                user.profile_photo_url ||
                "/assets/icons/singeta120.gif"
        };
    }

function renderUserTribune(user, cards = []) {
  return `
    <section class="lienzo-tribune">

      <div class="lienzo-tribune__corporates">
        ${cards.map((card, index) =>
          renderBackgroundCard(card, index)
        ).join("")}
      </div>

      <div class="lienzo-tribune__stage"></div>

    </section>
  `;
}

    function renderColombesTribunes(play) {
        const sourceTribune = renderSourcePlayerPanel(play);

        const creatorId = Number(play?.created_by_user_id || 0);
        const aceClubOwnerId = getAceClubOwnerUserId();
        const currentUserId = getCurrentUserId();

        const isCreator = currentUserId === creatorId;
        const isAceClubValidator = currentUserId === aceClubOwnerId;

        const shouldShowValidatorTribune =
            aceClubOwnerId &&
            creatorId &&
            aceClubOwnerId !== creatorId &&
            (isCreator || isAceClubValidator);

        if (!shouldShowValidatorTribune) {
            return sourceTribune;
        }

        const validator = getAceClubOwnerTribune();

        return `
      <div class="lienzo-tribunes lienzo-tribunes--colombes">
        ${sourceTribune}
        ${validator
                ? renderUserTribune(validator, [{ card_rank: "A", card_suit: "CLUB" }])
                : ""}
      </div>
    `;
    }

    function renderLienzo(play) {
        console.count("renderLienzo");

        const container = getLienzoContainer();
        const deck = getCurrentDeck();

        if (!container || !play) return;

        container.innerHTML = `
      ${renderDeckHeader(deck)}

      <div class="lienzo-v2-grid lienzo-v2-grid--2">
        <div id="colombes" class="lienzo-grid__left">
          ${renderColombesTribunes(play)}
        </div>

        <div id="amsterdam" class="lienzo-grid__right">
          ${renderTargetPlayerPanel(play)}
        </div>
      </div>
    `;

        mountPlacardFromDataset();
        bindLienzoActions(play);
    }

    function openLienzoByPlayId(playId) {
        const play = getPlayById(playId);

        if (!play) {
            const container = getLienzoContainer();
            if (container) {
                container.innerHTML = `
          <div class="lienzo-error">
            No se encontró la jugada ${escapeHtml(playId)}.
          </div>
        `;
            }
            return;
        }

        const rank = normalizeRank(play?.card_rank || play?.rank);
        if (rank !== "K") {
            const container = getLienzoContainer();
            if (container) {
                container.innerHTML = `
          <div class="lienzo-error">
            La jugada ${escapeHtml(playId)} no es una K.
          </div>
        `;
            }
            return;
        }

        renderLienzo(play);
    }

    window.openLienzoByPlayId = openLienzoByPlayId;
})();