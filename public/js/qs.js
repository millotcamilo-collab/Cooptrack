(function () {
    const API_BASE_URL = "https://cooptrack-backend.onrender.com";

    let allQs = [];
    let activeSuitFilters = [];
    let activeSearchQuery = "";

    function escapeHtml(value) {
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function normalizeRank(value) {
        return String(value || "").trim().toUpperCase();
    }

    function normalizeSuit(value) {
        return String(value || "").trim().toUpperCase();
    }

    function getCurrentUserIdFromToken() {
        try {
            const token = localStorage.getItem("cooptrackToken");
            if (!token) return null;

            const payload = JSON.parse(atob(token.split(".")[1]));
            return Number(payload.userId || 0) || null;
        } catch (error) {
            console.error("No se pudo leer userId del token:", error);
            return null;
        }
    }

    function getAllowedQSuits() {
        const config = window.transversalBarConfig || {};
        if (Array.isArray(config.allowedSuits) && config.allowedSuits.length) {
            return config.allowedSuits.map((suit) => String(suit || "").toUpperCase());
        }

        return ["SPADE", "DIAMOND", "CLUB"];
    }

    async function fetchQs() {
        try {
            const token = localStorage.getItem("cooptrackToken");
            if (!token) return [];

            const currentUserId = getCurrentUserIdFromToken();
            if (!currentUserId) return [];

            const response = await fetch(`${API_BASE_URL}/plays/bitacora`, {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error(`Error HTTP ${response.status}`);
            }

            const data = await response.json();
            const plays = Array.isArray(data?.plays) ? data.plays : [];
            const allowedSuits = getAllowedQSuits();

            return plays.filter((play) => {
                const rank = normalizeRank(play.card_rank || play.rank);
                const suit = normalizeSuit(play.card_suit || play.suit);
                const targetId = Number(play.target_user_id || 0);

                return (
                    rank === "Q" &&
                    allowedSuits.includes(suit) &&
                    targetId === currentUserId
                );
            });

        } catch (error) {
            console.error("Error cargando Qs:", error);
            return [];
        }
    }

    function getCardLabel(play) {
        const suit = normalizeSuit(play.card_suit || play.suit);

        if (suit === "SPADE") return "Q♠";
        if (suit === "DIAMOND") return "Q♦";
        if (suit === "HEART") return "Q♥";
        if (suit === "CLUB") return "Q♣";

        return "Q";
    }

    function getDescription(play) {
        return String(play.play_text || play.text || "").trim() || "Sin descripción";
    }

    function getDeckId(play) {
        return play.deck_id || play.deckId || null;
    }

    function getPlayId(play) {
        return Number(play.id || 0) || null;
    }

    function getQCssClass(play) {
        const suit = normalizeSuit(play.card_suit || play.suit);

        if (suit === "SPADE") return "tablero-row--qpike";
        if (suit === "DIAMOND") return "tablero-row--qdiamante";
        if (suit === "CLUB") return "tablero-row--qtrebol";

        return "";
    }

    function canActOnQClub(play) {
        const currentUserId = getCurrentUserIdFromToken();
        const targetId = Number(play?.target_user_id || 0);
        const status = String(play?.play_status || play?.status || "").trim().toUpperCase();
        const suit = normalizeSuit(play?.card_suit || play?.suit);

        return (
            suit === "CLUB" &&
            currentUserId &&
            targetId === currentUserId &&
            ["SENT", "PENDING"].includes(status)
        );
    }

    function buildQClubActionsHTML(play) {
        if (!canActOnQClub(play)) return "";

        return `
            <div class="tablero-row__actions">
                <button type="button" data-action="approve-qclub" title="Aprobar Q♣">Aprobar</button>
                <button type="button" data-action="reject-qclub" title="Rechazar Q♣">Rechazar</button>
            </div>
        `;
    }

    async function patchPlayStatus(playId, nextStatus) {
        try {
            const token = localStorage.getItem("cooptrackToken");
            if (!token) {
                alert("No estás logueado");
                return false;
            }

            const response = await fetch(`${API_BASE_URL}/plays/${playId}`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ play_status: nextStatus })
            });

            const data = await response.json();
            if (!response.ok || !data.ok) {
                throw new Error(data?.error || "No se pudo actualizar la jugada");
            }

            return true;
        } catch (error) {
            console.error("Error actualizando Q♣:", error);
            alert(error?.message || "No se pudo actualizar la jugada");
            return false;
        }
    }

    function getQQPicaEconomicLabel(play) {
        const suit = normalizeSuit(play?.card_suit || play?.suit);
        if (suit !== "SPADE") return "";
        if (!playHasQHeartAttachment(play)) return "";

        const status = String(play?.play_status || play?.status || "").trim().toUpperCase();
        return status === "APPROVED" ? "Q♦" : "Q♥";
    }

    function buildRowStampsHTML(play) {
        const actions = window.ICONS?.actions || {};
        const flow = String(play?.play_code || "").toUpperCase();
        const status = String(play?.play_status || play?.status || "").trim().toUpperCase();

        const stamps = [];

        if (status === "APPROVED") {
            stamps.push({
                src: actions.approve || "/assets/icons/Sello40.gif",
                alt: "Aprobada",
                title: "Aprobada"
            });
        }

        if (status === "REJECTED") {
            stamps.push({
                src: actions.reject || "/assets/icons/stepback40.gif",
                alt: "Rechazada",
                title: "Rechazada"
            });
        }

        if (flow.includes("SETTLEMENT:PAID")) {
            stamps.push({
                src: "/assets/icons/award60oro.gif",
                alt: "Pago confirmado",
                title: "Pago confirmado"
            });
        }

        if (flow.includes("SETTLEMENT:COMPLAINED")) {
            stamps.push({
                src: "/assets/icons/ticket80g.gif",
                alt: "Queja registrada",
                title: "Queja registrada"
            });
        }

        if (flow.includes("BOMB:EXPLODED")) {
            stamps.push({
                src: actions.boom || "/assets/icons/Boom80.gif",
                alt: "Boom",
                title: "Boom"
            });
        }

        if (flow.includes("BOMB:DONE") || flow.includes("BOMB:DISABLED")) {
            stamps.push({
                src: actions.deadline || "/assets/icons/META60.gif",
                alt: "Meta",
                title: "Meta"
            });
        }

        if (!stamps.length) return "";

        return stamps
            .map((stamp) => `
                <span class="tablero-row__stamp" title="${escapeHtml(stamp.title)}">
                  <img src="${escapeHtml(stamp.src)}" alt="${escapeHtml(stamp.alt)}" />
                </span>
              `)
            .join("");
    }

    function buildQRowHTML(play) {
        const playId = getPlayId(play);
        const cardLabel = getCardLabel(play);
        const qqpicaEconomicLabel = getQQPicaEconomicLabel(play);
        const rowStampsHtml = buildRowStampsHTML(play);
        const description = getDescription(play);
        const deckId = getDeckId(play);
        const deckName = String(play.deck_name || play.deckName || "").trim();
        const status = String(play.play_status || play.status || "").trim().toUpperCase();
        const qClubActionsHtml = buildQClubActionsHTML(play);
        const rowOpenAttr = normalizeSuit(play.card_suit || play.suit) === "CLUB" ? "" : 'data-open-lienzo="true"';

        return `
            <article
        class="tablero-row tablero-row--bitacora ${getQCssClass(play)}"
        data-play-id="${playId || ""}"
        data-deck-id="${deckId || ""}"
        data-rank="${escapeHtml(normalizeRank(play.card_rank || play.rank))}"
        data-suit="${escapeHtml(normalizeSuit(play.card_suit || play.suit))}"
        data-has-qheart="${playHasQHeartAttachment(play) ? "1" : "0"}"
        data-status="${escapeHtml(status)}"
        ${rowOpenAttr}
      >
        <div class="tablero-row__left">
                    <div class="tablero-row__card">
                        <span>${escapeHtml(cardLabel)}</span>
                        ${qqpicaEconomicLabel
                                ? `<span class="tablero-row__card-secondary tablero-row__card-secondary--economic">${escapeHtml(qqpicaEconomicLabel)}</span>`
                                : ""
                        }
                    </div>
        </div>

        <div class="tablero-row__center">
          ${deckName
                ? `<div class="tablero-row__deck"><strong>${escapeHtml(deckName)}</strong></div>`
                : ""
            }

          <div class="tablero-row__title" style="font-weight: 400;">
            ${escapeHtml(description)}
          </div>
        </div>

                    <div class="tablero-row__right">
                      ${rowStampsHtml}
                      ${qClubActionsHtml}
                    </div>
            </article>
    `;
    }

    function playHasQHeartAttachment(play) {
        const flow = String(play?.play_code || "").toUpperCase();
        return flow.includes("PAY:QHEART");
    }

function applyFilters(plays) {
    return plays.filter((play) => {
        const suit = normalizeSuit(play.card_suit || play.suit);
        const description = getDescription(play).toLowerCase();
        const deckName = String(play.deck_name || play.deckName || "").trim().toLowerCase();
        const hasQHeart = playHasQHeartAttachment(play);

        let suitOk = true;

        if (Array.isArray(activeSuitFilters) && activeSuitFilters.length) {
            const wantsSpade = activeSuitFilters.includes("SPADE");
            const wantsDiamond = activeSuitFilters.includes("DIAMOND");

            suitOk = false;

            // ♠ = solo Q♠ simples
            if (wantsSpade && suit === "SPADE" && !hasQHeart) {
                suitOk = true;
            }

            // ♦ = solo QQ♠ (Q♠ con adjunto económico)
            if (wantsDiamond && suit === "SPADE" && hasQHeart) {
                suitOk = true;
            }
        }

        const searchOk =
            !activeSearchQuery ||
            description.includes(activeSearchQuery.toLowerCase()) ||
            deckName.includes(activeSearchQuery.toLowerCase());

        return suitOk && searchOk;
    });
}

    function resolveQHref(row) {
        const deckId = row.dataset.deckId;
        const playId = row.dataset.playId;
        const suit = String(row.dataset.suit || "").toUpperCase();
        const hasQHeart = row.dataset.hasQheart === "1" || row.dataset.hasQHeart === "1";
        const status = String(row.dataset.status || "").toUpperCase();

        if (!deckId || !playId) return null;

        if (suit === "SPADE") {
            if (!hasQHeart) {
                return `/amsterdam.html?situacion=QPICA_ENTRA&deckId=${deckId}&playId=${playId}`;
            }

            const unansweredStatuses = ["SENT", "PENDING", "ACTIVE"];
            const isUnanswered = unansweredStatuses.includes(status);

            return isUnanswered
                ? `/amsterdam.html?situacion=QQPICA_ENTRA&deckId=${deckId}&playId=${playId}`
                : `/payNow.html?deckId=${deckId}&playId=${playId}`;
        }

        if (suit === "CLUB") {
            return null;
        }

        if (suit === "DIAMOND") {
            return `/lienzo.html?deckId=${deckId}&playId=${playId}`;
        }

        return `/lienzo.html?deckId=${deckId}&playId=${playId}`;
    }

    function bindRowEvents() {
        document.querySelectorAll(".tablero-row--bitacora").forEach((row) => {
            row.addEventListener("click", async (event) => {
                const actionBtn = event.target.closest("button[data-action]");
                const playId = Number(row.dataset.playId || 0);

                if (actionBtn && playId) {
                    event.preventDefault();
                    event.stopPropagation();

                    const action = String(actionBtn.dataset.action || "");

                    if (action === "approve-qclub") {
                        const ok = await patchPlayStatus(playId, "APPROVED");
                        if (ok) window.location.href = "/qs.html";
                        return;
                    }

                    if (action === "reject-qclub") {
                        const ok = await patchPlayStatus(playId, "REJECTED");
                        if (ok) window.location.href = "/qs.html";
                        return;
                    }
                }

                if (String(row.dataset.suit || "").toUpperCase() === "CLUB") {
                    return;
                }

                const href = resolveQHref(row);
                if (href) window.location.href = href;
            });
        });
    }

    function renderQs() {
        const container = document.getElementById("qs-container");
        if (!container) return;

        const visibleQs = applyFilters(allQs);

        if (!visibleQs.length) {
            container.innerHTML = `
        <div class="tablero-empty-state">
          No hay invitaciones para mostrar.
        </div>
      `;
            return;
        }

        container.innerHTML = visibleQs.map(buildQRowHTML).join("");
        bindRowEvents();
    }

    async function initQs() {
        allQs = await fetchQs();
        renderQs();
    }

document.addEventListener("qs:filterSuit", (event) => {
    activeSuitFilters = Array.isArray(event.detail?.suits)
        ? event.detail.suits.map((suit) => String(suit || "").toUpperCase())
        : [];

    renderQs();
});

    document.addEventListener("qs:search", (event) => {
        activeSearchQuery = String(event.detail?.query || "").trim();
        renderQs();
    });

    document.addEventListener("DOMContentLoaded", initQs);
})();