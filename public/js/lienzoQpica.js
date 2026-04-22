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

    function getCurrentUser() {
        return window.__currentUser || null;
    }

    function getLienzoContainer() {
        return document.getElementById("lienzo-container");
    }

    function getPlayById(playId) {
        const id = Number(playId || 0);
        if (!id) return null;
        return getAllPlays().find((play) => Number(play?.id || 0) === id) || null;
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

    function normalizePlayForTopCards(play) {
        if (!play) return null;

        const parsed = parsePlayCode(play.play_code);

        return {
            id: play.id || null,
            rank: parsed.rank || play.card_rank || play.rank || "",
            suit: parsed.suit || play.card_suit || play.suit || "",
            action: parsed.action || play.action || "",
            status: play.play_status || play.status || "",
            createdByUserId:
                Number(play.created_by_user_id || 0) ||
                Number(parsed.userId || 0)
        };
    }

    function compareEnabledTopCards(a, b) {
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

    function hasBlueJokerActive() {
        const plays = getAllPlays();

        if (!Array.isArray(plays)) return false;

        return plays.some((p) => {
            const parsed = parsePlayCode(p.play_code);
            const rank = normalizeRank(parsed.rank || p.card_rank || p.rank);
            const suit = normalizeSuit(parsed.suit || p.card_suit || p.suit);
            const status = String(p.play_status || p.status || "").toUpperCase();

            return rank === "JOKER" && suit === "BLUE" && status === "ACTIVE";
        });
    }

    function getEnabledTopCardsForCurrentUser() {
        const plays = getAllPlays();
        const currentUser = getCurrentUser();
        const currentUserId = Number(currentUser?.id || 0);

        if (!currentUserId || !Array.isArray(plays)) return [];

        const cards = plays
            .map(normalizePlayForTopCards)
            .filter(Boolean)
            .filter((play) => {
                const rank = normalizeRank(play.rank);
                const suit = normalizeSuit(play.suit);
                const action = String(play.action || "").trim();
                const status = String(play.status || "").trim().toUpperCase();

                if (!["A", "K"].includes(rank)) return false;
                if (!["HEART", "SPADE", "DIAMOND", "CLUB"].includes(suit)) return false;
                if (status !== "ACTIVE") return false;
                if (action !== "puedeJugar") return false;

                return Number(play.createdByUserId || 0) === currentUserId;
            })
            .sort(compareEnabledTopCards);

        if (hasBlueJokerActive()) {
            cards.push({
                id: "virtual-Q-HEART",
                rank: "Q",
                suit: "HEART",
                isVirtual: true
            });
        }

        return cards;
    }

    function deriveOwnedCorporateCards(plays, currentUserId) {
        if (!Array.isArray(plays) || !currentUserId) return [];

        return plays
            .filter((p) => {
                const rank = normalizeRank(p.card_rank || p.rank);
                const suit = normalizeSuit(p.card_suit || p.suit);

                if (rank !== "A") return false;
                if (!["HEART", "SPADE", "DIAMOND", "CLUB"].includes(suit)) return false;

                const ownerId =
                    Number(p.target_user_id || 0) ||
                    Number(p.created_by_user_id || 0);

                return ownerId === Number(currentUserId);
            })
            .map((p) => ({
                id: p.id,
                card_rank: p.card_rank || p.rank,
                card_suit: p.card_suit || p.suit
            }));
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

    function getOwnedCorporateCardsForCurrentUser() {
        const plays = getAllPlays();
        const currentUser = getCurrentUser();
        const userId = Number(currentUser?.id || 0);

        if (!userId) return [];

        return deriveOwnedCorporateCards(plays, userId).sort(compareCorporateCards);
    }

    function resolveSourceUser(play) {
        const plays = getAllPlays();
        const sourceUserId =
            Number(play?.created_by_user_id || 0) ||
            Number(play?.target_user_id || 0);

        if (!sourceUserId) return null;

        const relatedPlay = plays.find((p) => {
            const candidateId =
                Number(p?.created_by_user_id || 0) ||
                Number(p?.target_user_id || 0);
            return candidateId === sourceUserId;
        });

        return {
            id: sourceUserId,
            nickname:
                play?.created_by_nickname ||
                relatedPlay?.created_by_nickname ||
                `Usuario ${sourceUserId}`,
            profile_photo_url:
                play?.created_by_profile_photo_url ||
                relatedPlay?.created_by_profile_photo_url ||
                "/assets/icons/singeta120.gif"
        };
    }

    function resolveTargetUser(play) {
        const targetUserId = Number(play?.target_user_id || 0);

        if (!targetUserId) return null;

        return {
            id: targetUserId,
            nickname: play?.target_user_nickname || `Usuario ${targetUserId}`,
            profile_photo_url:
                play?.target_user_profile_photo_url || "/assets/icons/singeta120.gif"
        };
    }

    function isCurrentUserSource(play) {
        const currentUser = getCurrentUser();
        const currentUserId = Number(currentUser?.id || 0);
        const sourceUserId = Number(play?.created_by_user_id || 0);

        return currentUserId && sourceUserId && currentUserId === sourceUserId;
    }

    function isCurrentUserTarget(play) {
        const currentUser = getCurrentUser();
        const currentUserId = Number(currentUser?.id || 0);
        const targetUserId = Number(play?.target_user_id || 0);

        return currentUserId && targetUserId && currentUserId === targetUserId;
    }

    function parseLocalReferenceDate(value) {
        if (!value) return null;

        if (typeof value === "string") {
            const trimmed = value.trim();

            const onlyDateMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
            if (onlyDateMatch) {
                const year = Number(onlyDateMatch[1]);
                const month = Number(onlyDateMatch[2]) - 1;
                const day = Number(onlyDateMatch[3]);
                return new Date(year, month, day);
            }

            const localDateTimeMatch = trimmed.match(
                /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/
            );
            if (localDateTimeMatch) {
                const year = Number(localDateTimeMatch[1]);
                const month = Number(localDateTimeMatch[2]) - 1;
                const day = Number(localDateTimeMatch[3]);
                const hour = Number(localDateTimeMatch[4]);
                const minute = Number(localDateTimeMatch[5]);
                return new Date(year, month, day, hour, minute, 0, 0);
            }
        }

        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) return null;

        return parsed;
    }

    function resolveCalendarDateFromPlay(play) {
        if (!play) return null;

        const suit = normalizeSuit(play?.card_suit || play?.suit);
        const spadeMode = String(play?.spade_mode || "").trim().toUpperCase();

        let candidates = [];

        if (suit === "SPADE") {
            if (spadeMode === "APPOINTMENT") {
                candidates = [
                    play?.start_date,
                    play?.scheduled_for,
                    play?.play_date,
                    play?.date,
                    play?.created_at
                ];
            } else if (spadeMode === "DEADLINE") {
                candidates = [
                    play?.end_date,
                    play?.scheduled_for,
                    play?.play_date,
                    play?.date,
                    play?.created_at
                ];
            } else {
                candidates = [
                    play?.start_date,
                    play?.end_date,
                    play?.scheduled_for,
                    play?.play_date,
                    play?.date,
                    play?.created_at
                ];
            }
        } else {
            candidates = [
                play?.scheduled_for,
                play?.play_date,
                play?.date,
                play?.created_at
            ];
        }

        for (const value of candidates) {
            const parsed = parseLocalReferenceDate(value);
            if (parsed) return parsed;
        }

        return null;
    }

    function parsePlayReferenceDate(play) {
        const parentPlay = getPlayById(play?.parent_play_id);

        return (
            resolveCalendarDateFromPlay(parentPlay) ||
            resolveCalendarDateFromPlay(play) ||
            new Date()
        );
    }

    function startOfWeek(date) {
        const base = new Date(date);
        const day = base.getDay();
        const diff = (day + 6) % 7;
        base.setHours(0, 0, 0, 0);
        base.setDate(base.getDate() - diff);
        return base;
    }

    function isSameDay(a, b) {
        return (
            a.getFullYear() === b.getFullYear() &&
            a.getMonth() === b.getMonth() &&
            a.getDate() === b.getDate()
        );
    }

    function renderWeekRow(referenceDate) {
        const start = startOfWeek(referenceDate);
        const labels = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const daysHtml = labels
            .map((label, index) => {
                const currentDate = new Date(start);
                currentDate.setDate(start.getDate() + index);

                const bodyHtml = "";

                if (typeof window.renderDia === "function") {
                    return window.renderDia({
                        headerText: `${label} ${currentDate.getDate()}`,
                        bodyHtml,
                        isCurrent: isSameDay(currentDate, referenceDate),
                        isToday: isSameDay(currentDate, today),
                        isOutsideMonth: currentDate.getMonth() !== referenceDate.getMonth(),
                        extraClass: "lienzo-weekday lienzo-weekday--compact"
                    });
                }

                return `
          <article class="dia lienzo-weekday">
            <div class="dia__header">${label}</div>
            <div class="dia__body">${bodyHtml}</div>
          </article>
        `;
            })
            .join("");

        return `
      <section class="lienzo-week-row-wrap">
        <div class="lienzo-week-row">
          ${daysHtml}
        </div>
      </section>
    `;
    }

    function formatDateForInput(value) {
        const date = parseLocalDateTime(value);
        if (!date) return "";

        const year = date.getFullYear();
        const month = pad2(date.getMonth() + 1);
        const day = pad2(date.getDate());

        return `${year}-${month}-${day}`;
    }

    function pad2(value) {
        return String(value).padStart(2, "0");
    }

    function parseLocalDateTime(value) {
        if (!value) return null;

        if (value instanceof Date && !Number.isNaN(value.getTime())) {
            return value;
        }

        if (typeof value === "string") {
            const trimmed = value.trim();

            const onlyDateMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
            if (onlyDateMatch) {
                const year = Number(onlyDateMatch[1]);
                const month = Number(onlyDateMatch[2]) - 1;
                const day = Number(onlyDateMatch[3]);
                return new Date(year, month, day);
            }

            const localDateTimeMatch = trimmed.match(
                /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/
            );
            if (localDateTimeMatch) {
                const year = Number(localDateTimeMatch[1]);
                const month = Number(localDateTimeMatch[2]) - 1;
                const day = Number(localDateTimeMatch[3]);
                const hour = Number(localDateTimeMatch[4]);
                const minute = Number(localDateTimeMatch[5]);
                return new Date(year, month, day, hour, minute, 0, 0);
            }
        }

        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) return null;
        return parsed;
    }

    function getSessionDateFromPlay(play) {
        if (!play) return null;

        const suit = normalizeSuit(play?.card_suit || play?.suit);
        const spadeMode = String(play?.spade_mode || "").trim().toUpperCase();

        if (suit === "SPADE" && spadeMode === "DEADLINE") {
            return parseLocalDateTime(play?.end_date || play?.date || play?.created_at);
        }

        if (suit === "SPADE") {
            return parseLocalDateTime(
                play?.start_date ||
                play?.scheduled_for ||
                play?.play_date ||
                play?.date ||
                play?.created_at
            );
        }

        return parseLocalDateTime(
            play?.scheduled_for ||
            play?.play_date ||
            play?.date ||
            play?.created_at
        );
    }

    function formatSessionDayHeader(date) {
        if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "—";

        const weekdayMap = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
        const monthMap = [
            "Ene",
            "Feb",
            "Mar",
            "Abr",
            "May",
            "Jun",
            "Jul",
            "Ago",
            "Sep",
            "Oct",
            "Nov",
            "Dic"
        ];

        return `${weekdayMap[date.getDay()]} ${date.getDate()} ${monthMap[date.getMonth()]
            } ${date.getFullYear()}`;
    }

    function formatTimeLabel(value) {
        const date = parseLocalDateTime(value);
        if (!date) return "";
        return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
    }

    function getParentJSpadeText(play) {
        if (!play) return "";

        const parentPlay = getPlayById(play?.parent_play_id);
        if (!parentPlay) return "";

        const rank = String(parentPlay?.card_rank || "").toUpperCase();
        const suit = String(parentPlay?.card_suit || "").toUpperCase();

        if (rank === "J" && suit === "SPADE") {
            return parentPlay?.play_text || "";
        }

        return "";
    }

    function renderSourceSessionDia(play) {
        if (!play || typeof window.renderDia !== "function") return "";

        const parentPlay = getPlayById(play?.parent_play_id);
        const sessionPlay = parentPlay || play;

        const suit = normalizeSuit(sessionPlay?.card_suit || sessionPlay?.suit);
        if (suit !== "SPADE") return "";

        const spadeMode = String(sessionPlay?.spade_mode || "").trim().toUpperCase();
        const sessionDate = getSessionDateFromPlay(sessionPlay);

        if (!sessionDate) return "";

        const clockIcon = "/assets/icons/reloj60.gif";
        const bellIcon = "/assets/icons/Campana80.gif";
        const bombIcon = "/assets/icons/bombaRedonda60.gif";

        let bodyHtml = "";

        if (spadeMode === "DEADLINE") {
            const endLabel = formatTimeLabel(sessionPlay?.end_date);

            bodyHtml = `
        <div class="lienzo-session-dia__row">
          <img class="lienzo-session-dia__icon" src="${bombIcon}" alt="Deadline" />
          <span class="lienzo-session-dia__time">${escapeHtml(endLabel || "—")}</span>
        </div>
      `;
        } else {
            const startLabel = formatTimeLabel(sessionPlay?.start_date);
            const endLabel = formatTimeLabel(sessionPlay?.end_date);
            const location = String(sessionPlay?.location || "").trim();

            bodyHtml = `
        <div class="lienzo-session-dia__row">
          <img class="lienzo-session-dia__icon" src="${clockIcon}" alt="Inicio" />
          <span class="lienzo-session-dia__time">${escapeHtml(startLabel || "—")}</span>

          ${endLabel
                    ? `
            <img class="lienzo-session-dia__icon" src="${bellIcon}" alt="Fin" />
            <span class="lienzo-session-dia__time">${escapeHtml(endLabel)}</span>
          `
                    : ""
                }
        </div>

        ${location
                    ? `
          <div class="lienzo-session-dia__row">
            <img class="lienzo-session-dia__icon" src="/assets/icons/LocGlobito.gif" alt="Lugar" />
            <span class="lienzo-session-dia__location">${escapeHtml(location)}</span>
          </div>
        `
                    : ""
                }
      `;
        }

        const jSpadeText = getParentJSpadeText(play);

        const headerText = jSpadeText
            ? `${formatSessionDayHeader(sessionDate)} — ${jSpadeText}`
            : formatSessionDayHeader(sessionDate);

        return `
  <div class="lienzo-session-dia-wrap">
    ${window.renderDia({
            headerText: headerText,
            bodyHtml,
            extraClass: "lienzo-session-dia"
        })}
  </div>
`;
    }

    function buildPanelTopbar({ identityHtml, actionsHtml = "", single = false }) {
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
          </div>
        `
            }
      </div>
    `;
    }

    function setLienzoDropSelection(selection) {
        window.__lienzoDropSelection = selection || null;
    }

    function getLienzoDropSelection() {
        return window.__lienzoDropSelection || null;
    }

    function hasDroppedQHeart() {
        const selection = getLienzoDropSelection();

        return Boolean(
            selection &&
            normalizeRank(selection.rank) === "Q" &&
            normalizeSuit(selection.suit) === "HEART"
        );
    }

    function isSelectedQHeartInZone(zoneName) {
        const selection = getLienzoDropSelection();

        if (!selection) return false;

        return (
            normalizeRank(selection.rank) === "Q" &&
            normalizeSuit(selection.suit) === "HEART" &&
            String(selection.targetZone || "").toUpperCase() ===
            String(zoneName || "").toUpperCase()
        );
    }

    function parseDraggedCardPayload(event) {
        const globalCard = window.__draggingPlacardCard;
        if (globalCard) {
            return {
                source: String(globalCard.source || "").trim(),
                rank: normalizeRank(globalCard.rank),
                suit: normalizeSuit(globalCard.suit),
                cardId: globalCard.cardId || null,
                isVirtual: Boolean(globalCard.isVirtual)
            };
        }

        try {
            const json = event.dataTransfer?.getData("application/json");
            if (json) {
                const payload = JSON.parse(json);

                return {
                    source: String(payload?.source || "").trim(),
                    rank: normalizeRank(payload?.rank),
                    suit: normalizeSuit(payload?.suit),
                    cardId: payload?.cardId || null,
                    isVirtual: Boolean(payload?.isVirtual)
                };
            }

            const plain = String(event.dataTransfer?.getData("text/plain") || "").trim();
            if (!plain) return null;

            const [rank, suit] = plain.split("|");

            return {
                source: "placard",
                rank: normalizeRank(rank),
                suit: normalizeSuit(suit),
                cardId: null,
                isVirtual: false
            };
        } catch (error) {
            console.warn("No se pudo parsear drag payload", error);
            return null;
        }
    }

    function canDropCardOnZone(card, zoneName) {
        const rank = normalizeRank(card?.rank);
        const suit = normalizeSuit(card?.suit);
        const zone = String(zoneName || "").trim().toUpperCase();

        if (rank === "Q" && suit === "HEART") {
            return zone === "COLOMBES" || zone === "AMSTERDAM";
        }

        return false;
    }

    function isCardCurrentlyDropped(card, selection) {
        if (!card || !selection) return false;

        const cardRank = normalizeRank(card.rank || card.card_rank);
        const cardSuit = normalizeSuit(card.suit || card.card_suit);
        const selectionRank = normalizeRank(selection.rank);
        const selectionSuit = normalizeSuit(selection.suit);

        if (cardRank !== selectionRank) return false;
        if (cardSuit !== selectionSuit) return false;

        if (selection.cardId && card.id) {
            return String(card.id) === String(selection.cardId);
        }

        return true;
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

        const selection = getLienzoDropSelection();

        const currentPlayId =
            Number(selection?.playId || 0) ||
            Number(new URLSearchParams(window.location.search).get("playId") || 0);

        const currentPlay = getPlayById(currentPlayId);
        const userIsSource = currentPlay ? isCurrentUserSource(currentPlay) : false;

        const qHeartCard = {
            id: "virtual-Q-HEART",
            rank: "Q",
            suit: "HEART",
            isVirtual: true
        };

        const playStatus = String(currentPlay?.play_status || "").trim().toUpperCase();

        const canShowQHeartInPlacard =
            userIsSource &&
            playStatus !== "SENT" &&
            playStatus !== "APPROVED" &&
            playStatus !== "REJECTED" &&
            playStatus !== "CANCELLED" &&
            playStatus !== "ACKNOWLEDGED" &&
            !isCardCurrentlyDropped(qHeartCard, selection);

        const visibleCards = canShowQHeartInPlacard ? [qHeartCard] : [];

        const currentUser = getCurrentUser();
        const parentPlay = currentPlay ? getPlayById(currentPlay.parent_play_id) : null;
        const referenceDate = parentPlay
            ? getSessionDateFromPlay(parentPlay)
            : currentPlay
                ? getSessionDateFromPlay(currentPlay)
                : null;

        window.renderPlacard(placardHost, {
            page: "lienzo-qpica",
            mode: "QPICA",
            play: currentPlay,
            currentUserId: Number(currentUser?.id || 0),
            referenceDate,
            now: new Date(),

            photoUrl: placardHost.dataset.photoUrl || "",
            rank: placardHost.dataset.rank || "A",
            suit: placardHost.dataset.suit || "HEART",
            title: placardHost.dataset.title || "Mazo",
            currencyCode: placardHost.dataset.currencyCode || "",
            currencyName: placardHost.dataset.currencyName || "",
            showCurrency: false,
            leftCards: visibleCards,
            plays: getAllPlays()
        });
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

    function buildSourceCardsScene(play) {
        const ownedCards = getOwnedCorporateCardsForCurrentUser();

        const activeRank = normalizeRank(play?.card_rank || play?.rank);
        const activeSuit = normalizeSuit(play?.card_suit || play?.suit);

        const parentPlay = getPlayById(play?.parent_play_id);
        const parentRank = normalizeRank(parentPlay?.card_rank || parentPlay?.rank);
        const parentSuit = normalizeSuit(parentPlay?.card_suit || parentPlay?.suit);

        if (activeRank === "Q" && activeSuit === "SPADE") {
            const stackCards = [];

            const clubAce = ownedCards.find((card) => {
                return (
                    normalizeRank(card?.card_rank) === "A" &&
                    normalizeSuit(card?.card_suit) === "CLUB"
                );
            });

            if (clubAce) {
                stackCards.push({
                    id: clubAce.id,
                    card_rank: clubAce.card_rank,
                    card_suit: clubAce.card_suit
                });
            }

            if (parentPlay && parentRank === "J" && parentSuit === "SPADE") {
                stackCards.push({
                    id: parentPlay.id,
                    card_rank: parentPlay.card_rank || parentPlay.rank,
                    card_suit: parentPlay.card_suit || parentPlay.suit
                });
            }

            return {
                backgroundCards: stackCards,
                activeCard: {
                    card_rank: activeRank,
                    card_suit: activeSuit
                }
            };
        }

        return {
            backgroundCards: ownedCards,
            activeCard: {
                card_rank: activeRank,
                card_suit: activeSuit
            }
        };
    }

    function renderQHeartBudgetBox({ title, currencyCode = "", defaultPayDate = "" }) {
        const safeTitle = escapeHtml(title || "Paga");
        const safeCurrency = escapeHtml(currencyCode || "");
        const safePayDate = escapeHtml(defaultPayDate || "");

        return `
      <div class="lienzo-qheart-box">
        <div class="lienzo-qheart-box__title">
          ${safeTitle}
        </div>

        <div class="lienzo-qheart-box__body">
          <input
            type="text"
            class="lienzo-qheart-box__concept"
            placeholder="Ticket"
            value="Ticket"
          />

          <div class="lienzo-qheart-box__amount-row">
            <span class="lienzo-qheart-box__currency">${safeCurrency}</span>
            <input
              type="text"
              class="lienzo-qheart-box__amount"
              placeholder="0"
              inputmode="decimal"
            />
          </div>

          <input
            type="date"
            class="lienzo-qheart-box__paydate"
            value="${safePayDate}"
          />
        </div>
      </div>
    `;
    }

    function renderSourceActions(play) {
        const status = String(play?.play_status || "").trim().toUpperCase();
        const rank = normalizeRank(play?.card_rank || play?.rank);
        const suit = normalizeSuit(play?.card_suit || play?.suit);

        const exitIcon = window.ICONS?.actions?.exit || "/assets/icons/exit40.gif";
        const sendIcon = "/assets/icons/buzon60.gif";
        const saveIcon = "/assets/icons/salvar40.gif";

        const canOperate =
            rank === "Q" &&
            suit === "SPADE" &&
            status !== "SENT" &&
            status !== "APPROVED" &&
            status !== "REJECTED" &&
            status !== "CANCELLED" &&
            status !== "ACKNOWLEDGED";

        if (!canOperate) {
            return `
        <div class="nuevo-mazo-target-actions nuevo-mazo-target-actions--top">
          <button id="lienzo-exit-btn" class="icon-btn" title="Salir">
            <img src="${exitIcon}" alt="Salir" />
          </button>
        </div>
      `;
        }

        const qHeartMode = hasDroppedQHeart();

        return `
      <div class="nuevo-mazo-target-actions nuevo-mazo-target-actions--top">
        ${qHeartMode
                ? `
          <button id="lienzo-save-btn" class="icon-btn" title="Guardar">
            <img src="${saveIcon}" alt="Guardar" />
          </button>
        `
                : `
          <button id="lienzo-send-btn" class="icon-btn" title="Enviar">
            <img src="${sendIcon}" alt="Enviar" />
          </button>
        `
            }

        <button id="lienzo-exit-btn" class="icon-btn" title="Salir">
          <img src="${exitIcon}" alt="Salir" />
        </button>
      </div>
    `;
    }


    function canCancelTargetPlay(play) {
        const status = String(play?.play_status || "").trim().toUpperCase();

        if (!["APPROVED", "REJECTED"].includes(status)) return false;

        const referenceDate = getSessionDateFromPlay(play);
        if (!referenceDate) return false;

        return referenceDate.getTime() >= Date.now();
    }

    function shouldShowTargetDecisionButtons(play) {
        const status = String(play?.play_status || "").trim().toUpperCase();
        return status === "SENT" || status === "PENDING";
    }

    function renderTargetActions(play) {
        const acceptIcon = "/assets/icons/Sello40.gif";
        const rejectIcon = "/assets/icons/stepback40.gif";
        const cancelIcon = "/assets/icons/stop60.gif";
        const exitIcon = window.ICONS?.actions?.exit || "/assets/icons/exit40.gif";

        const showDecisionButtons = shouldShowTargetDecisionButtons(play);
        const showCancel = canCancelTargetPlay(play);

        return `
      <div class="nuevo-mazo-target-actions nuevo-mazo-target-actions--top">
        ${showDecisionButtons
                ? `
          <button id="lienzo-accept-btn" class="icon-btn" title="Aceptar">
            <img src="${acceptIcon}" alt="Aceptar" />
          </button>

          <button id="lienzo-reject-btn" class="icon-btn" title="Rechazar">
            <img src="${rejectIcon}" alt="Rechazar" />
          </button>
        `
                : ""
            }

        ${showCancel
                ? `
          <button id="lienzo-cancel-btn" class="icon-btn" title="Cancelar">
            <img src="${cancelIcon}" alt="Cancelar" />
          </button>
        `
                : ""
            }

        <button id="lienzo-exit-btn" class="icon-btn" title="Salir">
          <img src="${exitIcon}" alt="Salir" />
        </button>
      </div>
    `;
    }

    function renderSourcePlayerPanel(play) {
        const user = resolveSourceUser(play);
        const userPhoto = user?.profile_photo_url || "/assets/icons/singeta120.gif";
        const userName =
            user?.nickname || user?.full_name || user?.name || "Anfitrión";

        const scene = buildSourceCardsScene(play);
        const showActionsHere = isCurrentUserSource(play);

        const sessionDiaHtml = renderSourceSessionDia(play);

        const selection = getLienzoDropSelection();
        const droppedInColombes = selection?.targetZone === "COLOMBES";
        const showQHeartBox = isSelectedQHeartInZone("COLOMBES");

        const deck = getCurrentDeck();
        const deckName = String(deck?.name || "Mazo").trim();
        const currencyCode = getCurrencyCode(deck);

        const parentPlay = getPlayById(play?.parent_play_id);
        const defaultPayDate = formatDateForInput(
            parentPlay?.spade_mode === "DEADLINE"
                ? parentPlay?.end_date
                : parentPlay?.start_date || parentPlay?.date || parentPlay?.created_at
        );

        const droppedCardHtml = droppedInColombes
            ? `
        <div class="lienzo-dropped-card-slot">
          <img
            class="lienzo-card-image lienzo-card-image--dropped"
            src="${escapeHtml(getCardImageSrc(selection.rank, selection.suit))}"
            alt="${escapeHtml(getCardLabel(selection.rank, selection.suit))}"
            title="${escapeHtml(getCardLabel(selection.rank, selection.suit))}"
          />
        </div>
      `
            : "";

        const qHeartBoxHtml = showQHeartBox
            ? `
        <div class="lienzo-dropped-extra-slot">
          ${renderQHeartBudgetBox({
                title: `Paga ${deckName}`,
                currencyCode,
                defaultPayDate
            })}
        </div>
      `
            : "";

        const topbar = buildPanelTopbar({
            identityHtml: `
        <div class="lienzo-source-header lienzo-source-header--top">
          <div class="lienzo-source-header__name">
            ${escapeHtml(userName)}
          </div>
          <img
            class="lienzo-source-header__photo"
            src="${escapeHtml(userPhoto)}"
            alt="${escapeHtml(userName)}"
          />
        </div>
      `,
            actionsHtml: showActionsHere ? renderSourceActions(play) : ""
        });

        return `
      <section class="lienzo-panel lienzo-panel--source panel--split-top">
        ${topbar}

        <div class="lienzo-source-cards">
          <div class="lienzo-source-stack">
            ${scene.backgroundCards.map(renderBackgroundCard).join("")}
          </div>

          ${droppedCardHtml}
          ${qHeartBoxHtml}
        </div>

        ${sessionDiaHtml}
      </section>
    `;
    }

    function renderTargetPlayerPanel(play) {
        const user = resolveTargetUser(play);
        const userPhoto = user?.profile_photo_url || "/assets/icons/singeta120.gif";
        const userName =
            user?.nickname || user?.full_name || user?.name || "Invitado";

        const selection = getLienzoDropSelection();
        const droppedInAmsterdam = selection?.targetZone === "AMSTERDAM";
        const showQHeartBox = isSelectedQHeartInZone("AMSTERDAM");

        const baseRank = normalizeRank(play?.card_rank || play?.rank);
        const baseSuit = normalizeSuit(play?.card_suit || play?.suit);
        const baseImageSrc = getCardImageSrc(baseRank, baseSuit);

        const deck = getCurrentDeck();
        const currencyCode = getCurrencyCode(deck);

        const parentPlay = getPlayById(play?.parent_play_id);
        const defaultPayDate = formatDateForInput(
            String(parentPlay?.spade_mode || "").trim().toUpperCase() === "DEADLINE"
                ? parentPlay?.end_date
                : parentPlay?.start_date || parentPlay?.date || parentPlay?.created_at
        );

        const droppedCardHtml = droppedInAmsterdam
            ? `
        <img
          class="lienzo-card-image lienzo-card-image--overlay"
          src="${escapeHtml(getCardImageSrc(selection.rank, selection.suit))}"
          alt="${escapeHtml(getCardLabel(selection.rank, selection.suit))}"
          title="${escapeHtml(getCardLabel(selection.rank, selection.suit))}"
        />
      `
            : "";

        const qHeartBoxHtml = showQHeartBox
            ? `
        <div class="lienzo-target-extra-slot">
          ${renderQHeartBudgetBox({
                title: `Paga ${userName}`,
                currencyCode,
                defaultPayDate
            })}
        </div>
      `
            : "";

        const showActionsHere = isCurrentUserTarget(play);
        const showWeekHere = isCurrentUserTarget(play);

        const topbar = buildPanelTopbar({
            identityHtml: `
        <div class="lienzo-target-header lienzo-target-header--top">
          <div class="lienzo-target-header__name">
            ${escapeHtml(userName)}
          </div>
          <img
            class="lienzo-target-header__photo"
            src="${escapeHtml(userPhoto)}"
            alt="${escapeHtml(userName)}"
          />
        </div>
      `,
            actionsHtml: showActionsHere ? renderTargetActions(play) : ""
        });

        return `
      <section class="lienzo-panel lienzo-panel--target panel--split-top">
        ${topbar}

        <div class="lienzo-target-mainrow">
          <div id="lienzo-target-dropzone" class="lienzo-target-dropzone">
            <img
              class="lienzo-card-image lienzo-card-image--base"
              src="${escapeHtml(baseImageSrc)}"
              alt="${escapeHtml(getCardLabel(baseRank, baseSuit))}"
              title="${escapeHtml(getCardLabel(baseRank, baseSuit))}"
            />

            ${droppedCardHtml}
          </div>

          ${qHeartBoxHtml}
        </div>

        ${showWeekHere ? renderWeekRow(parsePlayReferenceDate(play)) : ""}
      </section>
    `;
    }

    function buildQHeartDraftPayload(play) {
        const selection = getLienzoDropSelection();

        if (
            !selection ||
            normalizeRank(selection.rank) !== "Q" ||
            normalizeSuit(selection.suit) !== "HEART"
        ) {
            return {
                ok: false,
                error: "Primero tenés que bajar una Q de corazón."
            };
        }

        const conceptInput = document.querySelector(".lienzo-qheart-box__concept");
        const amountInput = document.querySelector(".lienzo-qheart-box__amount");
        const payDateInput = document.querySelector(".lienzo-qheart-box__paydate");

        const concept = String(conceptInput?.value || "").trim() || "Ticket";
        const amount = String(amountInput?.value || "").trim();
        const payDate = String(payDateInput?.value || "").trim();
        const side = String(selection.targetZone || "").toUpperCase();

        if (!amount) {
            return {
                ok: false,
                error: "Falta el monto.",
                focusEl: amountInput || null
            };
        }

        if (!payDate) {
            return {
                ok: false,
                error: "Falta la fecha de pago.",
                focusEl: payDateInput || null
            };
        }

        return {
            ok: true,
            draft: {
                playId: Number(play?.id || 0),
                deckId: Number(play?.deck_id || getCurrentDeck()?.id || 0),
                side,
                concept,
                amount,
                payDate
            }
        };
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
                console.error("Error enviando Q♠:", data);
                alert(data?.error || "No se pudo enviar la jugada");
                return;
            }

            alert("Invitación enviada");

            const deckId =
                Number(play?.deck_id || 0) || Number(getCurrentDeck()?.id || 0);

            if (deckId) {
                window.location.href = `/mazo.html?id=${deckId}`;
                return;
            }

            window.history.back();
        } catch (error) {
            console.error("Error en handleSendPlay", error);
            alert("No se pudo enviar la jugada");
        }
    }

    function handleSaveQHeartDraft(play) {
        const built = buildQHeartDraftPayload(play);

        if (!built.ok) {
            alert(built.error || "No se pudo preparar la Q de corazón.");
            built.focusEl?.focus?.();
            return;
        }

        sessionStorage.setItem(
            "cooptrackQHeartDraft",
            JSON.stringify(built.draft)
        );

        const deckId =
            Number(play?.deck_id || 0) || Number(getCurrentDeck()?.id || 0);

        const playId = Number(play?.id || 0);

        window.location.href = `/lienzoQQpica.html?deckId=${deckId}&playId=${playId}`;
    }

    async function acknowledgePlayIfNeeded(play) {
        return true;
    }

    async function handleExitPlay(play) {
        const deckId =
            Number(play?.deck_id || 0) || Number(getCurrentDeck()?.id || 0);

        if (deckId) {
            window.location.href = `/mazo.html?id=${deckId}`;
            return;
        }

        window.history.back();
    }

    async function handleMarkAsRead(play) {
        await acknowledgePlayIfNeeded(play);

        const deckId =
            Number(play?.deck_id || 0) || Number(getCurrentDeck()?.id || 0);

        if (deckId) {
            window.location.href = `/mazo.html?id=${deckId}`;
            return;
        }

        window.history.back();
    }

    async function handleAcceptPlay(play) {
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
                    play_status: "APPROVED"
                })
            });

            const data = await response.json();

            if (!response.ok || !data.ok) {
                console.error("Error aprobando jugada:", data);
                alert(data?.error || "No se pudo aprobar la jugada");
                return;
            }

            alert("Invitación aceptada");

            const deckId =
                Number(play?.deck_id || 0) || Number(getCurrentDeck()?.id || 0);

            if (deckId) {
                window.location.href = `/mazo.html?id=${deckId}`;
                return;
            }

            window.history.back();
        } catch (error) {
            console.error("Error en handleAcceptPlay", error);
            alert("No se pudo aprobar la jugada");
        }
    }

    async function handleRejectPlay(play) {
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

            const confirmed = window.confirm("¿Querés rechazar esta invitación?");
            if (!confirmed) return;

            const response = await fetch(`/plays/${playId}`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    play_status: "REJECTED"
                })
            });

            const data = await response.json();

            if (!response.ok || !data.ok) {
                console.error("Error rechazando jugada:", data);
                alert(data?.error || "No se pudo rechazar la invitación");
                return;
            }

            alert("Invitación rechazada");
            window.location.href = "/archivo.html";
        } catch (error) {
            console.error("Error en handleRejectPlay", error);
            alert("No se pudo rechazar la invitación");
        }
    }

    async function handleCancelPlay(play) {
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

            if (!canCancelTargetPlay(play)) {
                alert("Esta jugada ya no puede cancelarse.");
                return;
            }

            const confirmed = window.confirm("¿Querés cancelar tu respuesta?");
            if (!confirmed) return;

            const response = await fetch(`/plays/${playId}`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    play_status: "CANCELLED"
                })
            });

            const data = await response.json();

            if (!response.ok || !data.ok) {
                console.error("Error cancelando respuesta:", data);
                alert(data?.error || "No se pudo cancelar la respuesta");
                return;
            }

            play.play_status = "CANCELLED";
            renderLienzo(play);
        } catch (error) {
            console.error("Error en handleCancelPlay", error);
            alert("No se pudo cancelar la respuesta");
        }
    }

    function handleExitLienzo() {
        const deckId = Number(getCurrentDeck()?.id || 0);

        if (deckId) {
            window.location.href = `/mazo.html?id=${deckId}`;
            return;
        }

        window.history.back();
    }

    function bindLienzoActions(play) {
        const saveBtn = document.getElementById("lienzo-save-btn");
        const sendBtn = document.getElementById("lienzo-send-btn");
        const acceptBtn = document.getElementById("lienzo-accept-btn");
        const rejectBtn = document.getElementById("lienzo-reject-btn");
        const cancelBtn = document.getElementById("lienzo-cancel-btn");
        const exitBtn = document.getElementById("lienzo-exit-btn");

        if (saveBtn) {
            saveBtn.addEventListener("click", () => {
                handleSaveQHeartDraft(play);
            });
        }

        if (sendBtn) {
            sendBtn.addEventListener("click", () => {
                handleSendPlay(play);
            });
        }

        if (acceptBtn) {
            acceptBtn.addEventListener("click", () => {
                handleAcceptPlay(play);
            });
        }

        if (rejectBtn) {
            rejectBtn.addEventListener("click", () => {
                handleRejectPlay(play);
            });
        }

        if (cancelBtn) {
            cancelBtn.addEventListener("click", () => {
                handleCancelPlay(play);
            });
        }

        if (exitBtn) {
            exitBtn.addEventListener("click", async () => {
                await handleExitPlay(play);
            });
        }
    }

    function bindLienzoDropzones(play) {
        const colombesZone = document.querySelector(".lienzo-source-cards");
        const amsterdamZone = document.getElementById("lienzo-target-dropzone");

        const zones = [
            { el: colombesZone, zoneName: "COLOMBES" },
            { el: amsterdamZone, zoneName: "AMSTERDAM" }
        ];

        zones.forEach(({ el, zoneName }) => {
            if (!el) return;

            el.dataset.dropzone = zoneName;

            el.addEventListener("dragenter", (event) => {
                event.preventDefault();
            });

            el.addEventListener("dragover", (event) => {
                event.preventDefault();

                const card =
                    window.__draggingPlacardCard || parseDraggedCardPayload(event);

                if (card && canDropCardOnZone(card, zoneName)) {
                    event.dataTransfer.dropEffect = "copy";
                    el.classList.add("is-drag-valid");
                    el.classList.remove("is-drag-invalid");
                } else {
                    event.dataTransfer.dropEffect = "none";
                    el.classList.add("is-drag-invalid");
                    el.classList.remove("is-drag-valid");
                }
            });

            el.addEventListener("dragleave", () => {
                el.classList.remove("is-drag-valid");
                el.classList.remove("is-drag-invalid");
            });

            el.addEventListener("drop", (event) => {
                event.preventDefault();

                el.classList.remove("is-drag-valid");
                el.classList.remove("is-drag-invalid");

                const card =
                    window.__draggingPlacardCard || parseDraggedCardPayload(event);

                if (!card) {
                    console.warn("DROP sin card payload");
                    return;
                }

                if (!canDropCardOnZone(card, zoneName)) {
                    console.warn("DROP inválido para", zoneName, card);
                    return;
                }

                const selection = {
                    targetZone: zoneName,
                    rank: card.rank,
                    suit: card.suit,
                    cardId: card.cardId,
                    isVirtual: card.isVirtual,
                    playId: Number(play?.id || 0)
                };

                setLienzoDropSelection(selection);
                window.__draggingPlacardCard = null;
                renderLienzo(play);
            });
        });
    }

    function renderLienzo(play) {
        const container = getLienzoContainer();
        const deck = getCurrentDeck();

        if (!container || !play) return;

        container.innerHTML = `
      ${renderDeckHeader(deck)}

      <div class="lienzo-grid">
        <div id="colombes" class="lienzo-grid__left">
          ${renderSourcePlayerPanel(play)}
        </div>

        <div id="amsterdam" class="lienzo-grid__right">
          ${renderTargetPlayerPanel(play)}
        </div>
      </div>
    `;

        mountPlacardFromDataset();
        bindLienzoActions(play);
        bindLienzoDropzones(play);
    }

    async function openLienzoByPlayId(playId) {
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

        setLienzoDropSelection(null);
        renderLienzo(play);
    }

    window.openLienzoByPlayId = openLienzoByPlayId;
})();