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

    function syncQHeartSendButtonVisibility() {
        const sendBtn = document.getElementById("lienzo-send-btn");
        if (!sendBtn) return;

        if (!hasDroppedQHeart()) {
            sendBtn.style.display = "";
            return;
        }

        const amount = String(
            document.querySelector(".lienzo-qheart-box__amount")?.value || ""
        ).trim();

        const payDate = String(
            document.querySelector(".lienzo-qheart-box__paydate")?.value || ""
        ).trim();

        sendBtn.style.display = amount && payDate ? "" : "none";
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

    function getUserHeartPlaysByDate(date) {
        const plays = getAllPlays();
        const currentUser = getCurrentUser();
        const userId = Number(currentUser?.id || 0);

        if (!userId) return [];

        return plays.filter((p) => {
            const rank = normalizeRank(p.card_rank || p.rank);
            const suit = normalizeSuit(p.card_suit || p.suit);

            if (!["J", "Q"].includes(rank)) return false;
            if (suit !== "HEART") return false;

            const ownerId =
                Number(p.created_by_user_id || 0) ||
                Number(p.target_user_id || 0);

            if (ownerId !== userId) return false;

            const playDate = resolveCalendarDateFromPlay(p);
            if (!playDate) return false;

            return isSameDay(playDate, date);
        });
    }

    function renderHeartPlaysBody(plays) {
        if (!plays.length) return "";

        return plays.map((p) => {
            const rank = normalizeRank(p.card_rank || p.rank);
            const suit = normalizeSuit(p.card_suit || p.suit);

            return `
            <span class="dia__item-link dia__item-link--compact">
                ${getSuitSymbol(suit)}
            </span>
        `;
        }).join("");
    }

    function deriveOwnedCorporateCards(plays, userId) {
        if (!Array.isArray(plays) || !userId) return [];

        const activeStatuses = ["ACTIVE", "APPROVED", "SENT", "PENDING"];
        const finalStatuses = ["QUIT", "FIRED", "REJECTED", "CANCELLED"];

        return plays
            .filter((p, index) => {
                // 🔥 CLAVE: ignorar primeras líneas del libro
                if (index < 10) return false;

                const parts = String(p?.play_code || "").split("§");

                const rank = normalizeRank(p?.card_rank || p?.rank || parts[3]);
                const suit = normalizeSuit(p?.card_suit || p?.suit || parts[4]);
                const action = String(parts[5] || "").trim().toLowerCase();
                const flow = String(parts[7] || "").trim().toLowerCase();
                const status = normalizeRank(p?.play_status || p?.status);

                if (!["A", "K"].includes(rank)) return false;
                if (!["HEART", "SPADE", "DIAMOND", "CLUB"].includes(suit)) return false;

                // ❌ excluir estados finales
                if (finalStatuses.includes(status)) return false;

                // ❌ excluir ACL
                if (flow === "acl") return false;
                if (action === "puedejugar") return false;

                // 🎯 ownership correcto
                let ownerId = 0;

                if (rank === "A") {
                    ownerId = Number(p?.target_user_id || p?.created_by_user_id || 0);
                    return flow === "foundation" && ownerId === Number(userId);
                }

                if (rank === "K") {
                    if (status === "APPROVED") {
                        ownerId = Number(p?.target_user_id || p?.created_by_user_id || 0);
                    } else {
                        ownerId = Number(p?.created_by_user_id || 0);
                    }

                    if (!activeStatuses.includes(status)) return false;
                    return ownerId === Number(userId);
                }

                return false;
            })
            .map((p) => ({
                id: p.id,
                card_rank: normalizeRank(p.card_rank || p.rank),
                card_suit: normalizeSuit(p.card_suit || p.suit)
            }))
            .filter((card, index, self) => {
                const key = `${card.card_rank}_${card.card_suit}`;
                return index === self.findIndex(c => `${c.card_rank}_${c.card_suit}` === key);
            })
            .sort(compareCorporateCards);
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

    function renderWeekRow(referenceDate, play) {
        const start = startOfWeek(referenceDate);
        const labels = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const daysHtml = labels
            .map((label, index) => {
                const currentDate = new Date(start);
                currentDate.setDate(start.getDate() + index);

                const heartPlays = getUserHeartPlaysByDate(currentDate);

                let bodyHtml = renderHeartPlaysBody(heartPlays);

                if (isSameDay(currentDate, referenceDate)) {
                    bodyHtml += buildSessionDiaBody(play);
                }

                if (typeof window.renderDia === "function") {
                    return window.renderDia({
                        headerText: `${label} ${currentDate.getDate()}`,
                        bodyHtml,
                        isCurrent: isSameDay(currentDate, referenceDate),
                        isToday: isSameDay(currentDate, today),
                        isOutsideMonth: currentDate.getMonth() !== referenceDate.getMonth(),
                        extraClass: "lienzo-weekday"
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
  <section class="lienzo-week-row-wrap almanaque__weeks">
    <div class="semana">
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

    function buildSessionDiaBody(play) {
        const parentPlay = getPlayById(play?.parent_play_id);
        const sessionPlay = parentPlay || play;

        const suit = normalizeSuit(sessionPlay?.card_suit || sessionPlay?.suit);
        if (suit !== "SPADE") return "";

        const spadeMode = String(sessionPlay?.spade_mode || "").trim().toUpperCase();

        const clockIcon = "/assets/icons/reloj60.gif";
        const bellIcon = "/assets/icons/Campana80.gif";
        const bombIcon = "/assets/icons/bombaRedonda60.gif";

        if (spadeMode === "DEADLINE") {
            const endLabel = formatTimeLabel(sessionPlay?.end_date);

            return `
            <div class="lienzo-session-dia__row">
              <img class="lienzo-session-dia__icon" src="${bombIcon}" alt="Deadline" />
              <span class="lienzo-session-dia__time">${escapeHtml(endLabel || "—")}</span>
            </div>
        `;
        }

        const startLabel = formatTimeLabel(sessionPlay?.start_date);
        const endLabel = formatTimeLabel(sessionPlay?.end_date);
        const location = String(sessionPlay?.location || "").trim();

        return `
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

    function isCurrentUserValidator(play) {
        const currentUser = getCurrentUser();
        const currentUserId = Number(currentUser?.id || 0);

        if (!currentUserId) return false;

        return getValidatorTribunesForPlay(play).some((validator) => {
            return Number(validator?.userId || 0) === currentUserId;
        });
    }

    function renderPlayCardActions(play) {
  const isTarget = isCurrentUserTarget(play);
  const isSource = isCurrentUserSource(play);
  const isValidator = isCurrentUserValidator(play);

  const status = String(play?.play_status || "").trim().toUpperCase();

  const sendIcon = "/assets/icons/buzon60.gif";
  const acceptIcon = "/assets/icons/Sello40.gif";
  const rejectIcon = "/assets/icons/stepback40.gif";

  if (isValidator && status === "PENDING") {
    return `
      <button id="lienzo-validator-send-btn" class="icon-btn" title="Validar y enviar">
        <img src="${sendIcon}" alt="Validar y enviar" />
      </button>

      <button id="lienzo-validator-reject-btn" class="icon-btn" title="Rechazar solicitud">
        <img src="${rejectIcon}" alt="Rechazar solicitud" />
      </button>
    `;
  }

  if (
    isSource &&
    status !== "SENT" &&
    status !== "APPROVED" &&
    status !== "REJECTED" &&
    status !== "CANCELLED"
  ) {
    const qHeartIncomplete =
      hasDroppedQHeart() &&
      (
        !document.querySelector(".lienzo-qheart-box__amount")?.value?.trim() ||
        !document.querySelector(".lienzo-qheart-box__paydate")?.value?.trim()
      );

    return `
      <button
        id="lienzo-send-btn"
        class="icon-btn"
        title="Enviar"
        style="${qHeartIncomplete ? "display:none;" : ""}"
      >
        <img src="${sendIcon}" alt="Enviar" />
      </button>
    `;
  }

  if (isTarget && status === "SENT") {
    return `
      <button id="lienzo-accept-btn" class="icon-btn" title="Aceptar">
        <img src="${acceptIcon}" alt="Aceptar" />
      </button>

      <button id="lienzo-reject-btn" class="icon-btn" title="Rechazar">
        <img src="${rejectIcon}" alt="Rechazar" />
      </button>
    `;
  }

  return "";
}

    function renderPlayCardBox(play) {
        const parentPlay = getPlayById(play?.parent_play_id);

        const rank = normalizeRank(play?.card_rank || play?.rank);
        const suit = normalizeSuit(play?.card_suit || play?.suit);
        const imageSrc = getCardImageSrc(rank, suit);

        const title = getCardLabel(rank, suit);
        const parentText = parentPlay?.play_text || "";

        const spadeMode = String(parentPlay?.spade_mode || "").trim().toUpperCase();

        const isDeadline = spadeMode === "DEADLINE";

        const timeLabel = isDeadline
            ? formatTimeLabel(parentPlay?.end_date)
            : formatTimeLabel(parentPlay?.start_date);

        const location = isDeadline
            ? ""
            : String(parentPlay?.location || "").trim();

        return `
    <div class="lienzo-play-card-box">

      <div class="lienzo-play-card-box__row">
        
        <!-- IZQUIERDA -->
        <div class="lienzo-play-card-box__card">
          <img
            class="lienzo-card-image"
            src="${escapeHtml(imageSrc)}"
            alt="${escapeHtml(title)}"
          />
        </div>

        <!-- DERECHA -->
        <div class="lienzo-play-card-box__info">
          ${parentText ? `<div class="play-text">${escapeHtml(parentText)}</div>` : ""}

         ${timeLabel ? `
  <div class="play-meta">
    <img class="play-meta__icon" src="/assets/icons/${isDeadline ? "bombaRedonda60.gif" : "reloj60.gif"}" alt="" />
    <span>${escapeHtml(timeLabel)}</span>
  </div>
` : ""}

${location ? `
  <div class="play-meta">
    <img class="play-meta__icon" src="/assets/icons/LocGlobito80.gif" alt="" />
    <span>${escapeHtml(location)}</span>
  </div>
` : ""}
        </div>

      </div>

      <!-- ACCIONES ABAJO -->
      <div class="lienzo-play-card-box__actions">
        ${renderPlayCardActions(play)}
      </div>

    </div>
  `;
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
        const sourceUser = resolveSourceUser(play);
        const sourceUserId = Number(sourceUser?.id || play?.created_by_user_id || 0);

        const ownedCards = deriveOwnedCorporateCards(
            getAllPlays(),
            sourceUserId
        );

        const activeRank = normalizeRank(play?.card_rank || play?.rank);
        const activeSuit = normalizeSuit(play?.card_suit || play?.suit);


        const parentPlay = getPlayById(play?.parent_play_id);
        const parentRank = normalizeRank(parentPlay?.card_rank || parentPlay?.rank);
        const parentSuit = normalizeSuit(parentPlay?.card_suit || parentPlay?.suit);

        if (activeRank === "Q" && activeSuit === "SPADE") {
            const stackCards = ownedCards.filter(card => {
                const rank = normalizeRank(card.card_rank);
                const suit = normalizeSuit(card.card_suit);

                // 🔥 para Q♠ solo importa:
                // - K que está jugando
                // - A♣ si la tiene
                return (
                    rank === "K" ||
                    (rank === "A" && suit === "CLUB")
                );
            });

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

    function renderQHeartBudgetBox({
        title,
        currencyCode = "",
        defaultPayDate = ""
    }) {
        const safeTitle = escapeHtml(title || "Paga");
        const safeCurrency = escapeHtml(currencyCode || "");
        const safePayDate = escapeHtml(defaultPayDate || "");

        return `
    <div class="lienzo-qheart-box">

      <div class="lienzo-qheart-box__card">
        <img
          class="lienzo-card-image"
          src="/assets/icons/Qcorazon.gif"
          alt="Q♥"
        />
      </div>

      <div class="lienzo-qheart-box__content">

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
            <span class="lienzo-qheart-box__currency">
              ${safeCurrency}
            </span>

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

          <button
            id="lienzo-save-btn"
            class="icon-btn lienzo-qheart-box__save"
            title="Guardar Q♥"
          >
            <img
              src="/assets/icons/salvar40.gif"
              alt="Guardar Q♥"
            />
          </button>

        </div>
      </div>

    </div>
  `;
    }

    function renderSourceActions(play) {
        const status = String(play?.play_status || "").trim().toUpperCase();
        const rank = normalizeRank(play?.card_rank || play?.rank);
        const suit = normalizeSuit(play?.card_suit || play?.suit);

        const sendIcon = "/assets/icons/buzon60.gif";
        const saveIcon = "/assets/icons/salvar40.gif";

        const canOperate =
            rank === "Q" &&
            suit === "SPADE" &&
            status !== "SENT" &&
            status !== "APPROVED" &&
            status !== "REJECTED" &&
            status !== "CANCELLED";

        if (!canOperate) {
            return `
  <div class="nuevo-mazo-target-actions nuevo-mazo-target-actions--top"></div>
`;
        }

        const qHeartMode = hasDroppedQHeart();

        return `
      <div class="nuevo-mazo-target-actions nuevo-mazo-target-actions--top">
${qHeartMode
                ? ``
                : `
    <button id="lienzo-send-btn" class="icon-btn" title="Enviar">
      <img src="${sendIcon}" alt="Enviar" />
    </button>
  `
            }

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
        const parentJSpadeText = getParentJSpadeText(play);

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
  </div>

${parentJSpadeText
                ? `
    <div class="lienzo-parent-play-box lienzo-parent-play-box--inline">

      <div class="lienzo-play-card-box__info">
        <div class="play-text">
          ${escapeHtml(parentJSpadeText)}
        </div>

        ${parentPlay?.start_date ? `
          <div class="play-meta">
            <img class="play-meta__icon"
                 src="/assets/icons/reloj60.gif"
                 alt="" />
            <span>${escapeHtml(formatTimeLabel(parentPlay.start_date))}</span>
          </div>
        ` : ""}

        ${parentPlay?.location ? `
          <div class="play-meta">
            <img class="play-meta__icon"
                 src="/assets/icons/LocGlobito80.gif"
                 alt="" />
            <span>${escapeHtml(parentPlay.location)}</span>
          </div>
        ` : ""}

      </div>

    </div>
  `
                : ""
            }

  ${qHeartBoxHtml}
</div>

      </section>
    `;
    }

    function renderTargetPlayerPanel(play) {
  const user = resolveTargetUser(play);
  const userPhoto = user?.profile_photo_url || "/assets/icons/singeta120.gif";
  const userName =
    user?.nickname || user?.full_name || user?.name || "Invitado";

  const showQHeartBox = isSelectedQHeartInZone("AMSTERDAM");

  const deck = getCurrentDeck();
  const currencyCode = getCurrencyCode(deck);

  const parentPlay = getPlayById(play?.parent_play_id);
  const defaultPayDate = formatDateForInput(
    String(parentPlay?.spade_mode || "").trim().toUpperCase() === "DEADLINE"
      ? parentPlay?.end_date
      : parentPlay?.start_date || parentPlay?.date || parentPlay?.created_at
  );

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

  const topbar = buildPanelTopbar({
    identityHtml: `
      <div class="lienzo-target-header lienzo-target-header--top">
        <img
          class="lienzo-target-header__photo"
          src="${escapeHtml(userPhoto)}"
          alt="${escapeHtml(userName)}"
        />
        <div class="lienzo-target-header__name">
          ${escapeHtml(userName)}
        </div>
      </div>
    `,
    actionsHtml: ""
  });

  return `
    <section class="lienzo-panel lienzo-panel--target panel--split-top">
      ${topbar}

      <div class="lienzo-target-mainrow">
        <div id="lienzo-target-dropzone" class="lienzo-target-dropzone">
          ${renderPlayCardBox(play)}
        </div>

        ${qHeartBoxHtml}
      </div>
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

    function currentUserHasCorporateCard(rank, suit) {
        const cards = getOwnedCorporateCardsForCurrentUser();

        return cards.some((card) => {
            return (
                normalizeRank(card?.card_rank) === normalizeRank(rank) &&
                normalizeSuit(card?.card_suit) === normalizeSuit(suit)
            );
        });
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

            const nextStatus = isCurrentUserValidator(play)
                ? "SENT"
                : getValidatorTribunesForPlay(play).length > 0
                    ? "PENDING"
                    : "SENT";

            const response = await fetch(`/plays/${playId}`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    play_status: nextStatus
                })
            });

            const data = await response.json();

            if (!response.ok || !data.ok) {
                console.error("Error enviando Q♠:", data);
                alert(data?.error || "No se pudo enviar la jugada");
                return;
            }

            alert(
                nextStatus === "PENDING"
                    ? "Solicitud de validación enviada"
                    : "Invitación enviada"
            );

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

    async function handleSaveQHeartDraft(play) {
        const built = buildQHeartDraftPayload(play);

        if (!built.ok) {
            alert(built.error || "No se pudo preparar la Q de corazón.");
            built.focusEl?.focus?.();
            return;
        }

        const token = localStorage.getItem("cooptrackToken");

        if (!token) {
            alert("No estás logueado");
            return;
        }

        const currentPlayCode = String(play?.play_code || "").trim();
        const parsed = parsePlayCode(currentPlayCode);

        const existingFlowChunks = String(parsed.flow || "")
            .split(";")
            .map((item) => item.trim())
            .filter(Boolean)
            .filter((chunk) => !chunk.toLowerCase().startsWith("pay:qheart"));

        const deck = getCurrentDeck();
        const currency = getCurrencyCode(deck);

        const draft = built.draft;

        const paymentBlock =
            `pay:QHEART` +
            `|side:${draft.side}` +
            `|payer:${draft.side === "AMSTERDAM" ? "guest" : "deck"}` +
            `|concept:${draft.concept}` +
            `|amount:${draft.amount}` +
            `|currency:${currency}` +
            `|payDate:${draft.payDate}`;

        const nextFlow = [...existingFlowChunks, paymentBlock].join(";");

        const nextPlayCode = [
            parsed.deckId || "",
            parsed.userId || "",
            parsed.date || "",
            parsed.rank || "",
            parsed.suit || "",
            parsed.action || "",
            parsed.autorizados || "",
            nextFlow,
            parsed.recipients || ""
        ].join("§");

        const response = await fetch(`/plays/${play.id}`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
                play_code: nextPlayCode,
                play_status: String(play.play_status || "ACTIVE").toUpperCase()
            })
        });

        const data = await response.json();

        if (!response.ok || !data.ok) {
            console.error("No se pudo guardar Q♥", data);
            alert(data?.error || "No se pudo guardar la Q♥");
            return;
        }

        sessionStorage.removeItem("cooptrackQHeartDraft");

        const deckId =
            Number(play?.deck_id || 0) || Number(getCurrentDeck()?.id || 0);

        window.location.href = `/lienzoQQpica.html?deckId=${deckId}&playId=${play.id}`;
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

            // 🔥 CLAVE: distinguir quién está rechazando
            const statusBefore = String(play?.play_status || "").toUpperCase();

            const deckId =
                Number(play?.deck_id || 0) || Number(getCurrentDeck()?.id || 0);

            if (isCurrentUserValidator(play) && statusBefore === "PENDING") {
                // 👉 rechazo del A♣
                window.location.href = `/mazo.html?id=${deckId}`;
            } else {
                // 👉 rechazo del invitado
                window.location.href = "/archivo.html";
            }

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
        const validatorRejectBtn = document.getElementById("lienzo-validator-reject-btn");

        const validatorSendBtn = document.getElementById("lienzo-validator-send-btn");

        document
            .querySelectorAll(
                ".lienzo-qheart-box__amount, .lienzo-qheart-box__paydate"
            )
            .forEach((input) => {
                input.addEventListener("input", syncQHeartSendButtonVisibility);
                input.addEventListener("change", syncQHeartSendButtonVisibility);
            });

        syncQHeartSendButtonVisibility();

        if (validatorSendBtn) {
            validatorSendBtn.addEventListener("click", () => {
                handleSendPlay(play);
            });
        }


        if (validatorSendBtn) {
            validatorSendBtn.addEventListener("click", () => {
                handleSendPlay(play);
            });
        }

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

        if (validatorRejectBtn) {
            validatorRejectBtn.addEventListener("click", () => {
                handleRejectPlay(play);
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

    function getAceOwnerTribune(suit) {
        const plays = getAllPlays();

        const candidates = plays.filter((p) => {
            const rank = normalizeRank(p?.card_rank || p?.rank);
            const cardSuit = normalizeSuit(p?.card_suit || p?.suit);
            const parts = String(p?.play_code || "").split("§");
            const flow = String(parts[7] || "").toLowerCase();

            return (
                rank === "A" &&
                cardSuit === normalizeSuit(suit) &&
                flow === "foundation"
            );
        });

        if (!candidates.length) return null;

        // 🔥 CLAVE: tomar el último (estado actual)
        const ace = candidates[candidates.length - 1];

        const ownerId = Number(ace.target_user_id || ace.created_by_user_id || 0);

        const ownerPlay = plays.find((p) => {
            const matchesUser =
                Number(p?.created_by_user_id || 0) === ownerId ||
                Number(p?.target_user_id || 0) === ownerId;

            if (!matchesUser) return false;

            return Boolean(
                p?.created_by_profile_photo_url ||
                p?.target_user_profile_photo_url
            );
        });

        const state = getCurrentState();

        const ownerUser =
            Array.isArray(state?.users)
                ? state.users.find((u) => Number(u?.id || 0) === ownerId)
                : null;

        return {
            role: `A_${normalizeSuit(suit)}`,
            userId: ownerId,

            nickname:
                ace.target_user_nickname ||
                ace.created_by_nickname ||
                ownerPlay?.target_user_nickname ||
                ownerPlay?.created_by_nickname ||
                ownerUser?.nickname ||
                "Usuario",

            profile_photo_url:
                ace.target_user_profile_photo_url ||
                ace.created_by_profile_photo_url ||
                ownerPlay?.target_user_profile_photo_url ||
                ownerPlay?.created_by_profile_photo_url ||
                ownerUser?.profile_photo_url ||
                ownerUser?.photo_url ||
                "/assets/icons/singeta120.gif"
        };
    }

    function resolveAuthorityTribuneForTarget(play) {
        const aceClubTribune = getAceOwnerTribune("CLUB");
        if (aceClubTribune) return aceClubTribune;

        const validators = getValidatorTribunesForPlay(play);
        if (validators.length) return validators[0];

        return null;
    }

    function getValidatorTribunesForPlay(play) {
        const rank = normalizeRank(play?.card_rank || play?.rank);
        const suit = normalizeSuit(play?.card_suit || play?.suit);

        const validators = [];

        if (rank === "Q" && suit === "SPADE") {
            const sourceUser = resolveSourceUser(play);
            const sourceUserId = Number(sourceUser?.id || 0);
            const sourceCards = deriveOwnedCorporateCards(getAllPlays(), sourceUserId);

            const hasAceClub = sourceCards.some(card =>
                normalizeRank(card.card_rank) === "A" &&
                normalizeSuit(card.card_suit) === "CLUB"
            );

            const hasAceDiamond = sourceCards.some(card =>
                normalizeRank(card.card_rank) === "A" &&
                normalizeSuit(card.card_suit) === "DIAMOND"
            );

            const amount = Number(play?.amount || 0);
            const flow = String(parsePlayCode(play?.play_code)?.flow || "").toLowerCase();

            const qHeartDraft = (() => {
                try {
                    return JSON.parse(sessionStorage.getItem("cooptrackQHeartDraft") || "null");
                } catch {
                    return null;
                }
            })();

            const hasEconomicHeartQ =
                hasDroppedQHeart() ||
                Number(qHeartDraft?.playId || 0) === Number(play?.id || 0) ||
                amount > 0 ||
                flow.includes("settlement") ||
                flow.includes("qheart") ||
                flow.includes("q_heart") ||
                flow.includes("heart");

            if (hasEconomicHeartQ && !hasAceDiamond) {
                validators.push(getAceOwnerTribune("DIAMOND"));
            }

            if (!hasAceClub) {
                validators.push(getAceOwnerTribune("CLUB"));
            }

            console.log("VALIDADORES QPICA", {
                hasAceClub,
                hasAceDiamond,
                hasEconomicHeartQ,
                validators
            });
        }

        return validators
            .filter(Boolean)
            .filter((validator, index, self) =>
                index === self.findIndex(v => Number(v.userId) === Number(validator.userId))
            );
    }

    function getValidatorRoleCards(validator) {
        const role = String(validator?.role || "").trim().toUpperCase();

        if (role === "A_CLUB") return [{ card_rank: "A", card_suit: "CLUB" }];
        if (role === "A_DIAMOND") return [{ card_rank: "A", card_suit: "DIAMOND" }];
        if (role === "A_SPADE") return [{ card_rank: "A", card_suit: "SPADE" }];
        if (role === "A_HEART") return [{ card_rank: "A", card_suit: "HEART" }];

        return [];
    }

    function renderUserTribune(user, cards = []) {
        const plays = getAllPlays();
        const userId = Number(user?.userId || user?.id || 0);

        const ownerPlay = plays.find((p) => {
            const isCreator = Number(p?.created_by_user_id || 0) === userId;
            const isTarget = Number(p?.target_user_id || 0) === userId;

            if (isCreator && p?.created_by_profile_photo_url) return true;
            if (isTarget && p?.target_user_profile_photo_url) return true;

            return false;
        });

        const name =
            user?.nickname ||
            ownerPlay?.target_user_nickname ||
            ownerPlay?.created_by_nickname ||
            "Usuario";

        const photo =
            user?.profile_photo_url ||
            (
                Number(ownerPlay?.created_by_user_id || 0) === userId
                    ? ownerPlay?.created_by_profile_photo_url
                    : ownerPlay?.target_user_profile_photo_url
            ) ||
            "/assets/icons/singeta120.gif";


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

    function renderColombesTribunes(play) {
        const rank = normalizeRank(play?.card_rank || play?.rank);
        const suit = normalizeSuit(play?.card_suit || play?.suit);

        const currentUserIsTarget = isCurrentUserTarget(play);
        const currentUserIsSource = isCurrentUserSource(play);

        const sourceTribune = renderSourcePlayerPanel(play);

        // Invitado: solo ve la Colombes principal del anfitrión.
        // No ve Colombes de validadores.
        if (
            currentUserIsTarget &&
            rank === "Q" &&
            suit === "SPADE"
        ) {
            return `
    <div class="lienzo-tribunes lienzo-tribunes--colombes">
      ${sourceTribune}
    </div>
  `;
        }

        // Solo el anfitrión ve tribunas extra de validación.
        // getValidatorTribunesForPlay ya decide si agrega A♣ o A♦ según corresponda.
        const validatorTribunes = currentUserIsSource
            ? getValidatorTribunesForPlay(play)
                .map((validator) => {
                    const cards = getValidatorRoleCards(validator);
                    return renderUserTribune(validator, cards);
                })
                .join("")
            : "";

        return `
    <div class="lienzo-tribunes lienzo-tribunes--colombes">
      ${sourceTribune}
      ${validatorTribunes}
    </div>
  `;
    }

    function hasPersistedQHeartPayment(play) {
        const parsed = parsePlayCode(play?.play_code || "");
        const flow = String(parsed?.flow || "").toLowerCase();

        return flow.includes("pay:qheart");
    }

    function renderLienzo(play) {
        const container = getLienzoContainer();
        const deck = getCurrentDeck();

        if (!container || !play) return;

        const validatorCount = getValidatorTribunesForPlay(play).length;

        let gridClass = "";

        if (validatorCount === 1) {
            gridClass = "lienzo-grid--3cols";
        }

        if (validatorCount >= 2) {
            gridClass = "lienzo-grid--4cols";
        }

        container.innerHTML = `
  ${renderDeckHeader(deck)}

  <div class="lienzo-grid ${gridClass}">
<div id="colombes" class="lienzo-grid__left">
  ${renderColombesTribunes(play)}
</div>

    <div id="amsterdam" class="lienzo-grid__right">
      ${renderTargetPlayerPanel(play)}
    </div>
  </div>

  ${renderWeekRow(parsePlayReferenceDate(play), play)}
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

        if (hasPersistedQHeartPayment(play)) {
            const deckId =
                Number(play?.deck_id || 0) ||
                Number(getCurrentDeck()?.id || 0) ||
                new URLSearchParams(window.location.search).get("deckId");

            window.location.href = `/lienzoQQpica.html?deckId=${deckId}&playId=${play.id}`;
            return;
        }

        setLienzoDropSelection(null);
        renderLienzo(play);
    }

    window.openLienzoByPlayId = openLienzoByPlayId;
})();