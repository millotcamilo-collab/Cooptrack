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
            A_HEART: "/assets/icons/Acorazon.png",
            A_SPADE: "/assets/icons/Apike.png",
            A_DIAMOND: "/assets/icons/Adiamante.png",
            A_CLUB: "/assets/icons/Atrebol.png",

            K_HEART: "/assets/icons/Kcorazon.png",
            K_SPADE: "/assets/icons/Kpike.png",
            K_DIAMOND: "/assets/icons/Kdiamante.png",
            K_CLUB: "/assets/icons/Ktrebol.png",

            Q_HEART: "/assets/icons/Qcorazon.png",
            Q_SPADE: "/assets/icons/Qpike.png",
            Q_DIAMOND: "/assets/icons/Qdiamante.png",
            Q_CLUB: "/assets/icons/Qtrebol.png",

            J_HEART: "/assets/icons/Jcorazon.png",
            J_SPADE: "/assets/icons/Jpike.png",
            J_DIAMOND: "/assets/icons/Jdiamante.png",
            J_CLUB: "/assets/icons/Jtrebol.png"
        };

        return map[`${r}_${s}`] || "/assets/icons/DorsoAzul.png";
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

    function getActionIconSrc(actionKey, fallback) {
        return String(window?.ICONS?.actions?.[actionKey] || fallback || "");
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

    function getCurrentUserId() {
        const state = getCurrentState();
        return Number(
            state?.currentUser?.id ||
            state?.user?.id ||
            state?.me?.id ||
            window.__currentUser?.id ||
            0
        );
    }

    function isCurrentUserHeartAceHolder() {
        const aceHolder = resolveHeartAceHolder() || {
            id: 0,
            nickname: "A♥ no encontrado",
            profile_photo_url: "/assets/icons/singeta120.gif"
        };
        return Number(aceHolder?.id || 0) === getCurrentUserId();
    }

    function normalizeReaders(value) {
        if (!Array.isArray(value)) return [];
        return value
            .map((item) => String(item || "").trim())
            .filter(Boolean);
    }

    function isPrivateForCurrentUser(readers, userId) {
        if (!userId || readers.length !== 1) return false;
        return readers[0] === `U:${userId}`;
    }

    function hasMultipleReaders(readers) {
        return readers.length > 1 || readers.includes("TODOS");
    }

    function formatReadersLabel(readers) {
        if (!Array.isArray(readers) || readers.length === 0) {
            return "Sin lectores";
        }

        if (readers.includes("TODOS")) {
            return "TODOS";
        }

        return readers.join(", ");
    }

    function getIssuedWithForHeartAction(play) {
        const currentUserId = getCurrentUserId();
        const creatorUserId = Number(play?.created_by_user_id || 0);
        const userIsCreator = creatorUserId > 0 && creatorUserId === currentUserId;
        const userIsHeartAceHolder = isCurrentUserHeartAceHolder();

        const credentials = [];
        if (userIsCreator) credentials.push("K_HEART");
        if (userIsHeartAceHolder) credentials.push("A_HEART");
        return [...new Set(credentials)];
    }

    function getJHeartUiState(play) {
        const playId = Number(play?.id || 0);

        if (!window.__jheartLienzoUiState) {
            window.__jheartLienzoUiState = {};
        }

        if (!window.__jheartLienzoUiState[playId]) {
            window.__jheartLienzoUiState[playId] = {
                mode: "read",
                draftText: String(play?.play_text || "").trim()
            };
        }

        return window.__jheartLienzoUiState[playId];
    }

    function setJHeartUiState(play, patch = {}) {
        const state = getJHeartUiState(play);
        Object.assign(state, patch);
    }

    function getPlayOwnerUser(play) {
        if (Number(play?.target_user_id || 0)) {
            return resolveUser(play.target_user_id, `Usuario ${play.target_user_id || ""}`);
        }

        return resolveSourceUser(play);
    }

    function isNonChildJHeart(play) {
        const parentPlayId = Number(play?.parent_play_id || 0);
        if (parentPlayId > 0) return false;

        const parsed = parsePlayCode(play?.play_code || "");
        const flow = String(parsed.flow || "").toLowerCase();
        if (flow.includes("child_of:")) return false;

        return true;
    }

    function renderJHeartPlayCard(play, {
        actionsHtml = "",
        editableTitle = false,
        draftText = ""
    } = {}) {
        const ownerUser = getPlayOwnerUser(play);
        const titleValue = editableTitle
            ? String(draftText || "")
            : String(play?.play_text || "").trim();

        const titleHtml = editableTitle
            ? `<input id="jheart-title-input" class="lv2-play-card__title-input" type="text" value="${escapeHtml(titleValue)}" />`
            : "";

        return window.CartaTipo.renderPlayCardBox({
            rank: "J",
            suit: "HEART",
            title: editableTitle ? "" : titleValue,
            titleHtml,
            status: play?.play_status || "",
            ownerUser,
            ownerCards: getCardsOwnedByUser(ownerUser.id),
            actionsHtml
        });
    }

    function renderApprovalActions(play) {
        const status = normalizeRank(play?.play_status || play?.status);

        if (status !== "SENT") return "";
        if (!isCurrentUserHeartAceHolder()) return "";

        return `
      <div class="nuevo-mazo-target-actions nuevo-mazo-target-actions--top">
        <button id="jheart-approve-btn" class="icon-btn" title="Aprobar propuesta">
          <img src="/assets/icons/Sello40.gif" alt="Aprobar" />
        </button>

        <button id="jheart-reject-btn" class="icon-btn" title="Rechazar propuesta">
          <img src="/assets/icons/stepback40.gif" alt="Rechazar" />
        </button>
      </div>
    `;
    }

        function renderSourceActions(play) {
                const status = normalizeRank(play?.play_status || play?.status || "ACTIVE");
                const isApproved = status === "APPROVED";
                const isSent = status === "SENT";
                const isArchived = status === "CANCELLED" || status === "REJECTED";

                const currentUserId = getCurrentUserId();
                const creatorUserId = Number(play?.created_by_user_id || 0);
                const userIsCreator = creatorUserId > 0 && creatorUserId === currentUserId;
                const userIsHeartAceHolder = isCurrentUserHeartAceHolder();
                const userCanEdit = userIsCreator || userIsHeartAceHolder;
                const allowSourceValidationButtons = userIsHeartAceHolder && userIsCreator;

                const readers = normalizeReaders(play?.reader_user_ids);
                const showPrivedButton = isPrivateForCurrentUser(readers, currentUserId);
                const showReadersButton = hasMultipleReaders(readers);

                const uiState = getJHeartUiState(play);
                const isEditMode = uiState.mode === "edit";

                if (isArchived) {
                        return "";
                }

                const buttons = [];

                buttons.push(`
                    <button id="jheart-help-btn" class="icon-btn" title="Ayuda">
                        <img src="${escapeHtml(getActionIconSrc("help", "/assets/icons/help40.gif"))}" alt="Ayuda" />
                    </button>
                `);

                if (!isApproved && !isSent && !isEditMode && userCanEdit) {
                        buttons.push(`
                            <button id="jheart-edit-btn" class="icon-btn" title="Editar">
                                <img src="${escapeHtml(getActionIconSrc("edit", "/assets/icons/lapiz40.gif"))}" alt="Editar" />
                            </button>
                        `);
                }

                if (isEditMode) {
                        buttons.push(`
                            <button id="jheart-save-btn" class="icon-btn" title="Salvar">
                                <img src="${escapeHtml(getActionIconSrc("save", "/assets/icons/salvar40.gif"))}" alt="Salvar" />
                            </button>
                            <button id="jheart-exit-btn" class="icon-btn" title="Salir edición">
                                <img src="${escapeHtml(getActionIconSrc("exit", "/assets/icons/salida40.gif"))}" alt="Salir edición" />
                            </button>
                        `);
                }

                if (!isApproved && !isEditMode && allowSourceValidationButtons) {
                        buttons.push(`
                            <button id="jheart-approve-btn" class="icon-btn" title="Aprobar">
                                <img src="${escapeHtml(getActionIconSrc("approve", "/assets/icons/Sello40.gif"))}" alt="Aprobar" />
                            </button>
                        `);
                }

                if (isSent && allowSourceValidationButtons && !isEditMode) {
                        buttons.push(`
                            <button id="jheart-reject-btn" class="icon-btn" title="Rechazar">
                                <img src="${escapeHtml(getActionIconSrc("cancel", "/assets/icons/stepback40.gif"))}" alt="Rechazar" />
                            </button>
                        `);
                }

                if (!isApproved && !isSent && !isEditMode) {
                        buttons.push(`
                            <button id="jheart-delete-btn" class="icon-btn" title="Borrar">
                                <img src="${escapeHtml(getActionIconSrc("delete", "/assets/icons/tacho40.gif"))}" alt="Borrar" />
                            </button>
                        `);
                }

                if (isApproved && userIsHeartAceHolder && !isEditMode) {
                        buttons.push(`
                            <button id="jheart-cancel-btn" class="icon-btn" title="Cancelar">
                                <img src="${escapeHtml(getActionIconSrc("cancel", "/assets/icons/stepback40.gif"))}" alt="Cancelar" />
                            </button>
                        `);
                }

                if (!isEditMode && showPrivedButton) {
                        buttons.push(`
                            <button id="jheart-private-btn" class="icon-btn" title="Lectura privada">
                                <img src="/assets/icons/ojo2.gif" alt="Lectura privada" />
                            </button>
                        `);
                }

                if (!isEditMode && showReadersButton) {
                        buttons.push(`
                            <button id="jheart-readers-btn" class="icon-btn" title="Lectores">
                                <img src="/assets/icons/ojitos40.gif" alt="Lectores" />
                            </button>
                        `);
                }

                return buttons.join("");
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

    function renderSourcePlayerPanel(play) {
        const sourceUser = resolveSourceUser(play);
        const sourceCards = getCardsOwnedByUser(sourceUser.id);
                const uiState = getJHeartUiState(play);
                const status = normalizeRank(play?.play_status || play?.status || "ACTIVE");
                const canEditInline = uiState.mode === "edit" && status !== "SENT" && status !== "APPROVED";

        return `
      <section class="lienzo-tribune">

        <div class="lienzo-tribune__corporates">
          ${sourceCards.map((card, index) => `
            <img
              class="lienzo-tribune__corporate-card"
              src="${escapeHtml(getCardImageSrc(card.rank, card.suit))}"
              style="left:${index * 18}px;"
            />
          `).join("")}
        </div>


        <div class="lienzo-tribune__stage">
                    <div>
                        ${renderJHeartPlayCard(play, {
                        actionsHtml: renderSourceActions(play),
                        editableTitle: canEditInline,
                        draftText: uiState.draftText
                })}
                    </div>
        </div>

      </section>
    `;
    }

    function renderTargetPlayerPanel(play) {
        const aceHolder = resolveHeartAceHolder();
                const status = normalizeRank(play?.play_status || play?.status);
                const currentUserId = getCurrentUserId();
                const creatorUserId = Number(play?.created_by_user_id || 0);

                if (!aceHolder) {
                        return `
            <section class="lienzo-tribune">
                <div class="lienzo-tribune__corporates"></div>
                <div class="lienzo-tribune__stage">
                    <div class="lienzo-drop-hint">No se encontró propietario de A♥ en este mazo.</div>
                </div>
            </section>
        `;
                }

                const userIsHeartAceHolder = Number(aceHolder.id || 0) === currentUserId;
                const userIsCreator = creatorUserId > 0 && creatorUserId === currentUserId;
                const canSendRequest = userIsCreator && !userIsHeartAceHolder && status === "ACTIVE";
                const canApproveReject = userIsHeartAceHolder && status === "SENT";

                const actionsHtml = canSendRequest
                        ? `
                    <button id="jheart-send-btn" class="icon-btn" title="Enviar solicitud a A♥">
                        <img src="/assets/icons/buzon60.gif" alt="Enviar solicitud" />
                    </button>
                `
                        : canApproveReject
                                ? renderApprovalActions(play)
                                : "";

        return `
      <section class="lienzo-tribune">

        <div class="lienzo-tribune__corporates"></div>


        <div class="lienzo-tribune__stage">
                    <div class="lienzo-target-dropzone">
                        ${window.CartaTipo.renderPlayCardBox({
                        rank: "J",
                        suit: "HEART",
                        title: String(play?.play_text || "").trim(),
                        status: play?.play_status || "",
                        ownerUser: aceHolder,
                        ownerCards: getCardsOwnedByUser(aceHolder.id),
                        actionsHtml
                })}
          </div>
        </div>

      </section>
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

    async function handleSendPlay(play) {
        try {
            const data = await patchPlay(play, {
                play_status: "SENT",
                issued_with: getIssuedWithForHeartAction(play)
            });

            if (!data) {
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

    async function patchPlay(play, payload) {
        const playId = Number(play?.id || 0);
        const token = localStorage.getItem("cooptrackToken");

        if (!playId) {
            alert("playId inválido");
            return null;
        }

        if (!token) {
            alert("No estás logueado");
            return null;
        }

        const response = await fetch(`/plays/${playId}`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify(payload || {})
        });

        const data = await response.json();

        if (!response.ok || !data.ok) {
            console.error("Error actualizando J♥:", data);
            alert(data?.error || "No se pudo actualizar la J♥");
            return null;
        }

        return data;
    }

    async function deletePlay(play) {
        const playId = Number(play?.id || 0);
        const token = localStorage.getItem("cooptrackToken");

        if (!playId) {
            alert("playId inválido");
            return false;
        }

        if (!token) {
            alert("No estás logueado");
            return false;
        }

        const response = await fetch(`/plays/${playId}`, {
            method: "DELETE",
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        const data = await response.json();

        if (!response.ok || !data.ok) {
            console.error("Error borrando J♥:", data);
            alert(data?.error || "No se pudo borrar la J♥");
            return false;
        }

        return true;
    }

    async function handleApproveRejectPlay(play, nextStatus) {
        try {
            const data = await patchPlay(play, {
                play_status: nextStatus
            });

            if (!data) {
                return;
            }

            const msg = nextStatus === "APPROVED"
                ? "J♥ aprobada"
                : "J♥ rechazada";

            alert(msg);

            const deckId =
                Number(play?.deck_id || 0) ||
                Number(getCurrentDeck()?.id || 0);

            if (deckId) {
                window.location.href = `/mazo.html?id=${deckId}`;
                return;
            }

            window.history.back();
        } catch (error) {
            console.error("Error en handleApproveRejectPlay J♥", error);
            alert("No se pudo resolver la J♥");
        }
    }

    function bindActions(play) {
        const helpBtn = document.getElementById("jheart-help-btn");
        const editBtn = document.getElementById("jheart-edit-btn");
        const saveBtn = document.getElementById("jheart-save-btn");
        const exitBtn = document.getElementById("jheart-exit-btn");
        const deleteBtn = document.getElementById("jheart-delete-btn");
        const cancelBtn = document.getElementById("jheart-cancel-btn");
        const readersBtn = document.getElementById("jheart-readers-btn");
        const privateBtn = document.getElementById("jheart-private-btn");

        const sendBtn = document.getElementById("jheart-send-btn");
        const approveBtn = document.getElementById("jheart-approve-btn");
        const rejectBtn = document.getElementById("jheart-reject-btn");

        helpBtn?.addEventListener("click", (event) => {
            event.stopPropagation();
            if (typeof window.openPlayHelp === "function") {
                window.openPlayHelp("J_HEART");
                return;
            }

            const playId = Number(play?.id || 0);
            window.location.href = `/help.html?rank=J&suit=HEART&playId=${playId}`;
        });

        editBtn?.addEventListener("click", (event) => {
            event.stopPropagation();
            setJHeartUiState(play, {
                mode: "edit",
                draftText: String(play?.play_text || "").trim()
            });
            renderLienzo(play);
        });

        exitBtn?.addEventListener("click", (event) => {
            event.stopPropagation();
            setJHeartUiState(play, {
                mode: "read",
                draftText: String(play?.play_text || "").trim()
            });
            renderLienzo(play);
        });

        saveBtn?.addEventListener("click", async (event) => {
            event.stopPropagation();
            const input = document.getElementById("jheart-title-input");
            const nextText = String(input?.value || "").trim();

            const data = await patchPlay(play, {
                text: nextText,
                play_status: "ACTIVE",
                issued_with: getIssuedWithForHeartAction(play)
            });

            if (!data) return;

            play.play_text = nextText;
            play.play_status = "ACTIVE";
            setJHeartUiState(play, {
                mode: "read",
                draftText: nextText
            });
            renderLienzo(play);
        });

        deleteBtn?.addEventListener("click", async (event) => {
            event.stopPropagation();
            const confirmed = window.confirm("¿Seguro que querés borrar esta jugada?");
            if (!confirmed) return;

            const ok = await deletePlay(play);
            if (!ok) return;

            const deckId = Number(play?.deck_id || 0) || Number(getCurrentDeck()?.id || 0);
            if (deckId) {
                window.location.href = `/mazo.html?id=${deckId}`;
                return;
            }

            window.history.back();
        });

        cancelBtn?.addEventListener("click", async (event) => {
            event.stopPropagation();
            const data = await patchPlay(play, {
                play_status: "CANCELLED"
            });

            if (!data) return;
            play.play_status = "CANCELLED";
            renderLienzo(play);
        });

        readersBtn?.addEventListener("click", (event) => {
            event.stopPropagation();
            const readers = normalizeReaders(play?.reader_user_ids);
            window.alert(`Pueden leer esta jugada:\n\n${formatReadersLabel(readers)}`);
        });

        privateBtn?.addEventListener("click", (event) => {
            event.stopPropagation();
            const readers = normalizeReaders(play?.reader_user_ids);
            window.alert(`Lectura privada:\n\n${formatReadersLabel(readers)}`);
        });

        if (sendBtn) {
            sendBtn.addEventListener("click", (event) => {
                event.stopPropagation();
                handleSendPlay(play);
            });
        }

        if (approveBtn) {
            approveBtn.addEventListener("click", async (event) => {
                event.stopPropagation();
                await handleApproveRejectPlay(play, "APPROVED");
            });
        }

        if (rejectBtn) {
            rejectBtn.addEventListener("click", async (event) => {
                event.stopPropagation();
                await handleApproveRejectPlay(play, "REJECTED");
            });
        }
    }

    function renderLienzo(play) {
        const container = getLienzoContainer();
        const deck = getCurrentDeck();
                const aceHolder = resolveHeartAceHolder();
                const creatorUserId = Number(play?.created_by_user_id || 0);
                const showValidatorPanel =
                        Number(aceHolder?.id || 0) > 0 &&
                        creatorUserId > 0 &&
                        Number(aceHolder.id) !== creatorUserId;

        if (!container || !play) return;

        container.innerHTML = `
      <div class="lienzo-v2-page">
        ${renderDeckHeader(deck)}

        <div class="lienzo-v2-shell">
          <div class="lienzo-v2-main">

                        <div class="lienzo-v2-grid ${showValidatorPanel ? "lienzo-v2-grid--2" : "lienzo-v2-grid--single"}">
              <div id="colombes">
                ${renderSourcePlayerPanel(play)}
              </div>

                            ${showValidatorPanel
                                ? `
                            <div id="amsterdam">
                                ${renderTargetPlayerPanel(play)}
                            </div>
                            `
                                : ""
                        }
            </div>

          </div>
        </div>
      </div>
    `;

        mountPlacardFromDataset(play);
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

                if (!isNonChildJHeart(play)) {
                        const container = getLienzoContainer();
                        if (container) {
                                container.innerHTML = `
                    <div class="lienzo-error">
                        lienzoJcorazon.html solo aplica a jugadas J♥ que no son hijas.
          </div>
        `;
            }
            return;
        }

        renderLienzo(play);
    }

    window.openLienzoByPlayId = openLienzoByPlayId;
})();