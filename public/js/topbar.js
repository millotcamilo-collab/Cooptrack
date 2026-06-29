(() => {
  const API_BASE_URL = "https://cooptrack-backend.onrender.com";
  const PAYNOW_WINDOW_MINUTES = 180;

  // es ahora
  function isPicaConActividad(play) {
    const rank = String(play.card_rank || "").toUpperCase();
    const suit = String(play.card_suit || "").toUpperCase();
    const status = String(play.play_status || play.status || "").toUpperCase();

    if (suit !== "SPADE") return false;

    // J♠: la bomba del anfitrión sí puede aparecer como actividad propia.
    if (rank === "J") {
      return !!(play.start_date || play.end_date);
    }

    // Q♠: al invitado sólo le aparece bomba si aceptó.
    if (rank === "Q") {
      if (status !== "APPROVED") return false;

      return !!(
        play.start_date ||
        play.end_date ||
        play.parent_start_date ||
        play.parent_end_date
      );
    }

    return false;
  }

  const ES_AHORA_SNOOZE_KEY = "cooptrack.esAhora.snoozeUntil.v1";

  function getEsAhoraSnoozeUntil() {
    return Number(localStorage.getItem(ES_AHORA_SNOOZE_KEY) || 0);
  }

  function isEsAhoraSnoozed() {
    const until = getEsAhoraSnoozeUntil();

    if (!until) return false;

    if (Date.now() >= until) {
      localStorage.removeItem(ES_AHORA_SNOOZE_KEY);
      return false;
    }

    return true;
  }

  function clearEsAhoraSnooze() {
    localStorage.removeItem(ES_AHORA_SNOOZE_KEY);
  }

  function snoozeEsAhora(minutes = 5) {
    const until = Date.now() + minutes * 60 * 1000;
    localStorage.setItem(ES_AHORA_SNOOZE_KEY, String(until));
    return until;
  }

  function getMinutesUntilAhora(play) {
    if (isDentroDeVentanaPayNow(play, PAYNOW_WINDOW_MINUTES)) {
      const payDate = getPayNowDate(play);
      if (!payDate) return null;

      const windowMs = PAYNOW_WINDOW_MINUTES * 60 * 1000;
      const endsAt = payDate.getTime() + windowMs;
      const remaining = endsAt - Date.now();

      if (remaining <= 0) return 0;
      return Math.ceil(remaining / 60000);
    }

    if (!isDentroDeVentanaBomb(play, 30)) {
      return null;
    }

    const date = getAhoraDate(play);
    if (!date) return null;

    const diff = date.getTime() - Date.now();
    if (diff <= 0) return 0;

    return Math.ceil(diff / 60000);
  }

  function isQDiamanteConFecha(play) {
    const rank = String(play.card_rank || "").toUpperCase();
    const suit = String(play.card_suit || "").toUpperCase();

    return (
      rank === "Q" &&
      suit === "DIAMOND" &&
      (
        play.start_date ||
        play.end_date ||
        play.due_date ||
        play.parent_start_date ||
        play.parent_end_date
      )
    );
  }

  function isAlgoAhoraCandidate(play) {
    return isPicaConActividad(play) || isQDiamanteConFecha(play) || isPayNowCandidate(play);
  }

  function getPayNowDate(play) {
    const parsed = parsePlayCode(play?.play_code || "");
    const meta = parseFlowMetadata(parsed.flow);
    const payment = meta?.payment || null;

    if (!payment) return null;

    const value = String(payment.payAt || payment.payDate || "").trim();
    if (!value) return null;

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function isPayNowCandidate(play) {
    const rank = String(play.card_rank || play.rank || "").toUpperCase();
    const suit = String(play.card_suit || play.suit || "").toUpperCase();
    const status = String(play.play_status || play.status || "").toUpperCase();

    if (rank !== "Q" || suit !== "SPADE") return false;
    if (status !== "APPROVED") return false;
    if (playHasSettlement(play)) return false;

    return !!getPayNowDate(play);
  }

  function getAhoraDate(play) {
    const value =
      play.end_date ||
      play.due_date ||
      play.parent_end_date ||
      play.start_date ||
      play.parent_start_date;

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function isDentroDeVentanaPayNow(play, minutes = PAYNOW_WINDOW_MINUTES) {
    if (!isPayNowCandidate(play)) return false;

    const payDate = getPayNowDate(play);
    if (!payDate) return false;

    const now = Date.now();
    const start = payDate.getTime();
    const end = start + minutes * 60 * 1000;

    return now >= start && now <= end;
  }

  function isDentroDeVentanaBomb(play, minutes = 30) {
    const date = getAhoraDate(play);
    if (!date) return false;

    const diff = date.getTime() - Date.now();
    return diff >= 0 && diff <= minutes * 60 * 1000;
  }

  function isDentroDeVentanaAhora(play, minutes = 30) {
    return isDentroDeVentanaPayNow(play, PAYNOW_WINDOW_MINUTES) || isDentroDeVentanaBomb(play, minutes);
  }

  function findAlgoAhora(items = []) {
    return (
      items.find((play) => {
        return (
          isAlgoAhoraCandidate(play) &&
          isDentroDeVentanaAhora(play, 30)
        );
      }) || null
    );
  }

  async function checkAlgoAhora() {
    const token = localStorage.getItem("cooptrackToken");
    if (!token) return null;

    try {
      const res = await fetch(`${API_BASE_URL}/plays/ahora`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });

      if (!res.ok) return null;

      const data = await res.json();

      const items = [
        ...(data.esAhora || []),
        ...(data.teMandanAhora || []),
      ];

      console.log("ESAHORA RAW ITEMS", items);

      return findAlgoAhora(items);
    } catch (err) {
      console.warn("No se pudo revisar algo ahora:", err);
      return null;
    }
  }

  function resolveAlgoAhoraHref(play) {
    if (!play) return null;

    const deckId = Number(play.deck_id || 0);
    const playId = Number(play.id || 0);
    const rank = String(play.card_rank || "").toUpperCase();
    const suit = String(play.card_suit || "").toUpperCase();
    const spadeMode = String(play.spade_mode || play.parent_spade_mode || "").toUpperCase();

    if (!deckId || !playId) return null;

    if (rank === "Q" && suit === "SPADE" && isDentroDeVentanaPayNow(play, PAYNOW_WINDOW_MINUTES)) {
      return `/payNow.html?deckId=${deckId}&playId=${playId}`;
    }

    if (
      suit === "SPADE" &&
      ["J", "Q"].includes(rank) &&
      spadeMode === "DEADLINE"
    ) {
      return `/bomba.html?deckId=${deckId}&playId=${playId}`;
    }

    return null;
  }

  //fin del esahora

  function userHasAorKInDeck(deck) {
    const cards = Array.isArray(deck?.current_user_cards)
      ? deck.current_user_cards
      : [];

    return cards.some((card) => {
      const value = String(card || "").toUpperCase();
      return value.startsWith("A_") || value.startsWith("K_");
    });
  }

  function userHasQInDeck(deck) {
    const cards = Array.isArray(deck?.current_user_cards)
      ? deck.current_user_cards
      : [];

    return cards.some((card) => {
      const value = String(card || "").toUpperCase();
      return value.startsWith("Q_");
    });
  }

  async function getTopbarDeckAccess() {
    try {
      const token = localStorage.getItem("cooptrackToken");
      if (!token) return { hasAuthorDecks: false, hasQInbox: false };

      const response = await fetch(`${API_BASE_URL}/decks`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) return { hasAuthorDecks: false, hasQInbox: false };

      const data = await response.json();
      const mazos = Array.isArray(data?.mazos)
        ? data.mazos
        : Array.isArray(data?.decks)
          ? data.decks
          : [];

      return {
        hasAuthorDecks: mazos.some(userHasAorKInDeck),
        hasQInbox: mazos.some(userHasQInDeck)
      };
    } catch (error) {
      console.error("Error leyendo acceso topbar:", error);
      return { hasAuthorDecks: false, hasQInbox: false };
    }
  }
  async function getLoggedUser() {
    try {
      const token = localStorage.getItem("cooptrackToken");
      if (!token) return null;

      const response = await fetch(`${API_BASE_URL}/me`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          return null;
        }
        throw new Error(`Error HTTP ${response.status}`);
      }

      const data = await response.json();
      return data?.user || null;
    } catch (error) {
      console.error("Error obteniendo usuario autenticado:", error);
      return null;
    }
  }

  function normalizeText(value) {
    return String(value || "").trim().toUpperCase();
  }

  function isCorporateIncomingPlay(play) {
    const rank = normalizeText(play?.card_rank || play?.rank);
    const suit = normalizeText(play?.card_suit || play?.suit);

    if (rank === "J" && suit === "HEART") return true;

    return rank === "Q" || rank === "K" || rank === "A";
  }

  function getPendingKindForUser(play, currentUserId) {
    if (!play || !currentUserId) return null;

    const status = normalizeText(play?.play_status || play?.status);
    const rank = normalizeText(play?.card_rank || play?.rank);
    const suit = normalizeText(play?.card_suit || play?.suit);

    const validatorUserId = Number(play?.validator_user_id || 0);
    const isValidator = validatorUserId === Number(currentUserId);

    const sourceUserId = Number(play?.created_by_user_id || 0);
    const targetUserId = Number(play?.target_user_id || 0);

    const isTarget = targetUserId === Number(currentUserId);
    const isReceiver = isTarget || isValidator;

    if (!isReceiver) return null;

    // Dorso azul: hay respuesta pendiente del receptor.
    if (
      (isTarget && (status === "SENT" || status === "PENDING")) ||
      (isValidator && status === "PENDING")
    ) {
      return "ACTION_REQUIRED";
    }

    // =========================
    // K — receptor (invitado)
    // =========================
    if (rank === "K" && isTarget && status === "FIRED") {
      return "READ_ONLY";
    }

    // =========================
    // Q — target con settlement
    // =========================
    if (isTarget && status === "APPROVED" && playHasSettlement(play)) {
      return "READ_ONLY";
    }

    // =========================
    // Q — target cancelada
    // =========================
    // Q♠ simple cancelada: avisar por dorso rojo.
    // QQ♠ (con Q♥ adjunta) cancelada sin respuesta: solo quitar pendiente azul.
    if (rank === "Q" && isTarget && status === "CANCELLED") {
      return playHasQHeartAttachment(play) ? null : "READ_ONLY";
    }

    // =========================
    // Q — receptor con resultado final
    // =========================
    if (rank === "Q" && ["APPROVED", "REJECTED"].includes(status)) {
      return "READ_ONLY";
    }

    // =========================
    // A/K — receptor con resultado final
    // =========================
    if (
      (rank === "A" || rank === "K") &&
      ["APPROVED", "REJECTED", "CANCELLED", "QUIT", "FIRED"].includes(status)
    ) {
      return "READ_ONLY";
    }

    // J♥ — receptor solo lectura en resultado final.
    if (rank === "J" && suit === "HEART" && ["APPROVED", "REJECTED", "CANCELLED"].includes(status)) {
      return "READ_ONLY";
    }

    return null;
  }

  async function getTopbarNotifications(currentUserId) {
    try {
      const token = localStorage.getItem("cooptrackToken");
      if (!token) {
        return {
          latestActionRequired: null,
          latestReadOnly: null
        };
      }

      const response = await fetch(`${API_BASE_URL}/plays/pending`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) {
        return {
          latestActionRequired: null,
          latestReadOnly: null
        };
      }

      const data = await response.json();
      const plays = Array.isArray(data?.plays) ? data.plays : [];

      console.log("PENDING RAW PLAYS", plays);

      console.log("TOPBAR pending response", {
        ok: response.ok,
        status: response.status,
        data,
        plays
      });

      const candidates = plays
        .filter(isCorporateIncomingPlay)

        .filter((play) => {
          const playId = Number(play?.id || 0);
          return !!playId;
        })

        .map((play) => {
          const pendingKind = getPendingKindForUser(play, currentUserId);
          return pendingKind ? { ...play, pendingKind } : null;
        })
        .filter(Boolean);

      console.log("TOPBAR candidates", candidates);

      const actionRequired = candidates
        .filter((play) => play.pendingKind === "ACTION_REQUIRED")
        .sort((a, b) => Number(b.id || 0) - Number(a.id || 0));

      const readOnlyRaw = candidates
        .filter((play) => play.pendingKind === "READ_ONLY")
        .sort((a, b) => Number(b.id || 0) - Number(a.id || 0));

      const seenQpicaParents = new Set();

      const readOnly = readOnlyRaw.filter((play) => {
        const rank = normalizeText(play?.card_rank || play?.rank);
        const suit = normalizeText(play?.card_suit || play?.suit);
        const parentId = Number(play?.parent_play_id || 0);

        if (rank === "Q" && suit === "SPADE" && parentId) {
          const key = `QSPADE_PARENT_${parentId}`;

          if (seenQpicaParents.has(key)) {
            return false;
          }

          seenQpicaParents.add(key);
          return true;
        }

        return true;
      });

      return {
        latestActionRequired: actionRequired[0] || null,
        latestReadOnly: readOnly[0] || null
      };
    } catch (error) {
      console.error("Error leyendo pendientes para topbar:", error);
      return {
        latestActionRequired: null,
        latestReadOnly: null
      };
    }
  }

  async function getTopbarTaludUnread() {
    const token = localStorage.getItem("cooptrackToken");
    if (!token) return null;

    try {
      const response = await fetch(`${API_BASE_URL}/plays/messages/unread-first`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json"
        }
      });

      console.log("TOPBAR talud unread status", response.status);

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        console.log("TOPBAR talud unread error body", errorText);
        return null;
      }

      const data = await response.json();
      console.log("TOPBAR talud unread response", data);

      if (!data?.ok || !data?.hasUnread || !data?.unread) {
        return null;
      }

      return data.unread;
    } catch (error) {
      console.warn("No se pudo obtener talud no leido:", error);
      return null;
    }
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

  function parseFlowMetadata(flowValue) {
    const raw = String(flowValue || "").trim();
    if (!raw) return { baseFlow: "", payment: null };

    const chunks = raw
      .split(";")
      .map((item) => item.trim())
      .filter(Boolean);

    let baseFlow = "";
    let payment = null;

    chunks.forEach((chunk) => {
      if (chunk.startsWith("pay:QHEART")) {
        const parts = chunk.split("|");
        const paymentData = {
          attachedRank: "Q",
          attachedSuit: "HEART"
        };

        parts.forEach((part, index) => {
          if (index === 0) return;

          const separatorIndex = part.indexOf(":");
          if (separatorIndex === -1) return;

          const key = part.slice(0, separatorIndex).trim();
          const value = part.slice(separatorIndex + 1).trim();

          if (!key) return;
          paymentData[key] = value;
        });

        payment = paymentData;
      } else if (!baseFlow) {
        baseFlow = chunk;
      }
    });

    return { baseFlow, payment };
  }

  function playHasSettlement(play) {
    const playCode = String(play?.play_code || "").toUpperCase();
    return (
      playCode.includes("SETTLEMENT:PAID") ||
      playCode.includes("SETTLEMENT:COMPLAINED")
    );
  }

  function playHasQHeartAttachment(play) {
    const parsed = parsePlayCode(play?.play_code || "");
    const meta = parseFlowMetadata(parsed.flow);

    if (!meta?.payment) return false;

    const amount = String(meta.payment.amount || "").trim();
    const payDate = String(meta.payment.payDate || "").trim();
    const concept = String(meta.payment.concept || "").trim();

    return !!(amount && payDate && concept);
  }

  function resolveLienzoPageForPlay(play) {
    const rank = normalizeText(play?.card_rank || play?.rank);
    const suit = normalizeText(play?.card_suit || play?.suit);
    const status = normalizeText(play?.play_status || play?.status);

    if (rank === "J" && suit === "HEART") {
      return "/lienzoJcorazon.html";
    }

    if (rank === "Q" && suit === "SPADE") {
      return playHasQHeartAttachment(play)
        ? "/lienzoQQpica.html"
        : "/lienzoQpica.html";
    }

    if (rank === "K") {
      if (status === "QUIT" || status === "FIRED") {
        return "/lienzoRQF.html";
      }
      return "/lienzoK.html";
    }

    if (rank === "A") {
      return "/lienzo.html";
    }

    return "/lienzo.html";
  }

  function resolveResponsePageForPlay(play, currentUserId) {
    if (!play || !currentUserId) return null;

    const targetUserId = Number(play?.target_user_id || 0);
    const validatorUserId = Number(play?.validator_user_id || 0);
    const createdByUserId = Number(play?.created_by_user_id || 0);

    const isTarget = targetUserId === Number(currentUserId);
    const isValidator = validatorUserId === Number(currentUserId);
    const isSource = createdByUserId === Number(currentUserId);

    const status = normalizeText(play?.play_status || play?.status);

    const rank = normalizeText(play?.card_rank || play?.rank);
    const suit = normalizeText(play?.card_suit || play?.suit);

    if (
      rank === "J" &&
      suit === "HEART" &&
      (status === "SENT" || status === "PENDING")
    ) {
      return "/lienzoJcorazon.html";
    }

    if (
      (rank === "K" || rank === "A") &&
      isTarget &&
      (status === "SENT" || status === "PENDING")
    ) {
      return "/america.html";
    }

    if (isTarget && (status === "SENT" || status === "PENDING")) {
      return "/amsterdam.html";
    }

    if (rank === "Q" && suit === "SPADE" && isTarget && status === "CANCELLED") {
      return "/amsterdam.html";
    }

    // 2) VALIDATOR with A_DIAMOND: Si es validador con rol A_DIAMOND
    if (isValidator) {
      const validatorRole = String(play?.validator_role || "").toUpperCase().trim();
      if (validatorRole === "A_DIAMOND") {
        return "/olimpica.html";
      }
      if (validatorRole === "A_CLUB") {
        return "/america.html";
      }
    }

    // 3) CREATOR: Si es creador y hay acción pendiente real
    if (isSource && status === "PENDING") {
      return "/colombes.html";
    }

    // 4) Sin acción pendiente real
    return null;
  }

  function resolveReadOnlyPageForPlay(play, currentUserId) {
    if (!play || !currentUserId) return null;

    const rank = normalizeText(play?.card_rank || play?.rank);
    const suit = normalizeText(play?.card_suit || play?.suit);
    const status = normalizeText(play?.play_status || play?.status);

    const isSource =
      Number(play?.created_by_user_id || 0) === Number(currentUserId);

    if (!isSource) return null;

    const finalStates = [
      "APPROVED",
      "REJECTED",
      "CANCELLED",
      "QUIT",
      "FIRED"
    ];

    if (rank === "Q" && suit === "SPADE" && finalStates.includes(status)) {
      return "/amsterdam.html";
    }

    if ((rank === "K" || rank === "A") && finalStates.includes(status)) {
      return "/america.html";
    }


    return null;
  }

  async function hasUserJPlays(userId) {
    try {
      const token = localStorage.getItem("cooptrackToken");

      const response = await fetch(`${API_BASE_URL}/plays/my-jotas`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) return false;

      const data = await response.json();
      return !!data.hasJ;
    } catch (error) {
      console.error(error);
      return false;
    }
  }

  function logout() {
    localStorage.removeItem("User");
    localStorage.removeItem("Token");
    window.location.href = "/index.html";
  }

  function getProfileImage(user) {
    if (user && user.profile_photo_url && user.profile_photo_url.trim() !== "") {
      return user.profile_photo_url;
    }
    return "/assets/icons/singeta120.gif";
  }

  async function hasDecks() {
    try {
      const token = localStorage.getItem("cooptrackToken");
      if (!token) return false;

      const response = await fetch(`${API_BASE_URL}/decks`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) {
        if (response.status === 401) return false;
        throw new Error(`Error HTTP ${response.status}`);
      }

      const data = await response.json();

      const mazos = Array.isArray(data?.mazos)
        ? data.mazos
        : Array.isArray(data?.decks)
          ? data.decks
          : [];

      return mazos.length > 0;
    } catch (error) {
      console.error("Error leyendo mazos desde servidor:", error);
      return false;
    }
  }

  function isMazosPage() {
    return (
      window.location.pathname.endsWith("/mazos.html") ||
      window.location.pathname === "/mazos.html"
    );
  }

  function goToCreateDeckPage() {
    window.location.href = "/acorazon.html";
  }

  async function hasArchivedDecks() {
    try {
      const token = localStorage.getItem("cooptrackToken");
      if (!token) return false;

      const response = await fetch(`${API_BASE_URL}/decks?archived=true`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) return false;

      const data = await response.json();
      const mazos = data?.mazos || data?.decks || [];

      return mazos.length > 0;
    } catch (error) {
      console.error(error);
      return false;
    }
  }

  async function goToPlayNotification(play) {
    if (!play) return;

    const deckId = play.deck_id;
    const playId = play.id;
    const token = localStorage.getItem("cooptrackToken");

    try {
      let playForRouting = play;

      if (token && playId) {
        const response = await fetch(`${API_BASE_URL}/plays/${playId}`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        const data = await response.json().catch(() => null);

        if (response.ok && data?.ok && data.play) {
          playForRouting = data.play;
        }
      }
      const rank = normalizeText(playForRouting?.card_rank || playForRouting?.rank);
      const suit = normalizeText(playForRouting?.card_suit || playForRouting?.suit);
      const status = normalizeText(playForRouting?.play_status || playForRouting?.status);
      // Get current user to check tribuna eligibility
      const currentUser = await getLoggedUser();
      const currentUserId = currentUser?.id;

      const isSource =
        Number(playForRouting?.created_by_user_id || 0) === Number(currentUserId);

      const finalStates = ["APPROVED", "REJECTED"];

      if (
        rank === "Q" &&
        suit === "SPADE" &&
        isSource &&
        finalStates.includes(status) &&
        Number(playForRouting?.parent_play_id || 0)
      ) {
        await acknowledgePlay(playForRouting.id);
        window.location.href =
          `/lienzoJpica.html?deckId=${playForRouting.deck_id}&playId=${playForRouting.parent_play_id}`;
        return;
      }


      // Try tribuna route first
      let nextPage = null;

      if (currentUserId) {
        nextPage =
          resolveResponsePageForPlay(playForRouting, currentUserId) ||
          resolveReadOnlyPageForPlay(playForRouting, currentUserId);
      }

      // Fallback to full lienzo if no tribuna
      if (!nextPage) {
        nextPage = resolveLienzoPageForPlay(playForRouting);
      }

      window.location.href = `${nextPage}?deckId=${deckId}&playId=${playId}`;
    } catch (error) {
      console.error("Error resolviendo notificación:", error);
      const nextPage = resolveLienzoPageForPlay(play);
      window.location.href = `${nextPage}?deckId=${deckId}&playId=${playId}`;
    }
  }

  async function acknowledgePlay(playId) {
    const token = localStorage.getItem("cooptrackToken");
    if (!token || !playId) return false;

    sessionStorage.setItem(`cooptrack_seen_play_${playId}`, "1");

    try {
      const response = await fetch(`${API_BASE_URL}/plays/${playId}/read`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          reason: "READ_ONLY_NOTIFICATION"
        })
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.ok) {
        console.error("No se pudo marcar como leída:", data || response.status);
        return false;
      }

      return true;
    } catch (error) {
      console.error("Error marcando notificación como leída:", error);
      return false;
    }
  }

  async function renderTopbar() {
    const user = await getLoggedUser();
    const { hasAuthorDecks, hasQInbox } = await getTopbarDeckAccess();
    const userHasJPlays = user ? await hasUserJPlays(user.id) : false;

    const onMazosPage = isMazosPage();
    const userHasArchivedDecks = await hasArchivedDecks();

    const notifications = user
      ? await getTopbarNotifications(user.id)
      : { latestActionRequired: null, latestReadOnly: null };
    const taludUnread = user ? await getTopbarTaludUnread() : null;

    const latestActionRequired = notifications.latestActionRequired || null;
    const latestReadOnly = notifications.latestReadOnly || null;

    const latestAhoraPlay = user ? await checkAlgoAhora() : null;
    const esAhoraSnoozed = isEsAhoraSnoozed();

    const userHasPendingApprovals = !!latestActionRequired;
    const userHasReadNotifications = !!latestReadOnly;

    console.log("TOPBAR talud render state", {
      userId: user?.id || null,
      taludUnread,
      userHasPendingApprovals,
      userHasReadNotifications,
      pathname: window.location.pathname,
    });

    let topbarHTML = "";

    if (user) {
      topbarHTML = `
        <header class="topbar" id="topbarRoot">
          <div class="page-container topbar__inner">

            <div class="topbar__left">
            ${latestAhoraPlay ? `
  <button
    type="button"
    id="esAhoraCounterBtn"
    class="topbar__esahora-counter ${esAhoraSnoozed ? "is-snoozed" : ""}"
    title="${esAhoraSnoozed
      ? "Es ahora pausado. Clic para reactivarlo"
      : "Es ahora activo. Clic para pausarlo 5 minutos"}"
  >
    ${getMinutesUntilAhora(latestAhoraPlay)} min
  </button>
` : ""}
              <a href="/index.html" class="topbar__logo" title="home">
                <img src="/assets/icons/cooptrack3.png" class="topbar__logo-img" />
              </a>
            </div>

            <nav class="topbar__right">

              <a href="/profile.html" class="topbar__profile topbar__desktop-only">
                <span class="topbar__nickname">${user.nickname || ""}</span>
                <img src="${getProfileImage(user)}" class="topbar__icon-img topbar__icon-img--profile" />
              </a>

              <a href="/profile.html" class="topbar__profile-mobile" title="Perfil">
                <img src="${getProfileImage(user)}" class="topbar__icon-img topbar__icon-img--profile" />
              </a>

              <button
                class="topbar__icon-btn topbar__mobile-secondary-item"
                id="newDeckBtn"
                title="El as de corazon constituye la primer jugada de un mazo. Comprende el nombre, la imagen y la moneda de referencia y solo se juega una vez"
              >
                <img src="/assets/icons/Acorazon.png" class="topbar__icon-img" />
              </button>

              <button
                class="topbar__icon-btn ${userHasPendingApprovals ? "" : "topbar__icon-btn--disabled"}"
                id="pendingBtn"
                title="Pendientes"
                ${userHasPendingApprovals ? "" : "aria-disabled=\"true\""}
              >
                <img src="/assets/icons/DorsoAzul.png" class="topbar__icon-img" />
              </button>

              <button
                class="topbar__icon-btn ${userHasReadNotifications ? "" : "topbar__icon-btn--disabled"}"
                id="reedBtn"
                title="Lecturas pendientes"
                ${userHasReadNotifications ? "" : "aria-disabled=\"true\""}
              >
                <img src="/assets/icons/DorsoRojo.png" class="topbar__icon-img" />
              </button>

${hasAuthorDecks
          ? `
    <a
      href="${onMazosPage ? "/index.html" : "/mazos.html"}"
      class="topbar__icon-btn topbar__mobile-secondary-item"
      title="Aquí están los mazos"
    >
      <img
        src="${onMazosPage
            ? "/assets/icons/portafolioAbierto.png"
            : "/assets/icons/portafolios80.gif"
          }"
        class="topbar__icon-img"
      />
    </a>
  `
          : ""
        }



              ${userHasArchivedDecks
          ? `
                    <button
                      class="topbar__icon-btn topbar__mobile-secondary-item"
                      id="archivoBtn"
                      title="archivo"
                    >
                      <img src="/assets/icons/archivo80.gif" class="topbar__icon-img" />
                    </button>
                  `
          : ""
        }

              ${userHasJPlays
          ? `
                    <button
                      class="topbar__icon-btn topbar__mobile-secondary-item"
                      id="bitacoraBtn"
                      title="Bitácora"
                    >
                      <img src="/assets/icons/maquina80.gif" class="topbar__icon-img" />
                    </button>
                    
                    <button
                      class="topbar__icon-btn topbar__mobile-secondary-item"
                      id="contabilidadBtn"
                      title="contabilidad"
                    >
                      <img src="/assets/icons/calculadora80.gif" class="topbar__icon-img" />
                    </button>
                  `
          : ""
        }

        ${hasQInbox
          ? `
    <a
      href="/qs.html"
      class="topbar__icon-btn topbar__mobile-secondary-item"
      title="Invitaciones"
    >
      <img src="/assets/icons/BUZONCASA120.gif" class="topbar__icon-img" />
    </a>
  `
          : ""
        }

              ${taludUnread
          ? `
                <button
                  class="topbar__icon-btn topbar__mobile-secondary-item"
                  id="taludUnreadBtn"
                  title="Comentario no leido"
                  aria-label="Comentario no leido"
                >
                  <img src="/assets/icons/sellopostal60.gif" class="topbar__icon-img" alt="Comentario no leido" />
                </button>
              `
          : ""
        }

              <a
                href="/almanaque.html"
                class="topbar__icon-btn topbar__mobile-secondary-item"
                title="Almanaque"
              >
                <img src="/assets/icons/Schedule80.gif" class="topbar__icon-img" />
              </a>

              <a
                href="/noticias.html"
                class="topbar__icon-btn topbar__mobile-secondary-item"
                title="Noticias"
              >
                <img src="/assets/icons/Extra120.gif" class="topbar__icon-img" />
              </a>

              <a
                href="/help.html"
                class="topbar__icon-btn topbar__mobile-secondary-item"
                title="help"
              >
                <img src="/assets/icons/bastonRecortado80.gif" class="topbar__icon-img" />
              </a>

              ${user.is_admin
          ? `
                  <a
                    href="/protected-pages/administradores.html"
                    class="topbar__icon-btn topbar__mobile-secondary-item"
                    title="Administración de usuarios"
                  >
                    <img src="/assets/icons/Tools120.gif" class="topbar__icon-img" />
                  </a>
                `
          : ""
        }

              <button class="topbar__icon-btn topbar__mobile-secondary-item" id="logoutBtn">
                <img src="/assets/icons/exit80.gif" class="topbar__icon-img topbar__icon-img--exit" />
              </button>

              <button
                class="topbar__mobile-toggle"
                id="topbarMobileToggle"
                aria-label="Mostrar menu"
                aria-expanded="false"
                title="Más"
                type="button"
              >
                +
              </button>

            </nav>
          </div>
        </header>
      `;
    } else {


      topbarHTML = `
        <header class="topbar">
          <div class="page-container topbar__inner">

            <div class="topbar__left">
              <a href="/index.html" class="topbar__logo">
                <img src="/assets/icons/cooptrack3.png" class="topbar__logo-img" />
              </a>
            </div>

            <nav class="topbar__right">
              <a
                href="/almanaque.html"
                class="topbar__icon-btn topbar__desktop-only"
                title="Aqui esta el calendario aun no te programe"
              >
                <img src="/assets/icons/Schedule80.gif" class="topbar__icon-img" />
              </a>

              <a
                href="/help.html"
                class="topbar__icon-btn topbar__desktop-only"
                title="help"
              >
                <img src="/assets/icons/bastonRecortado80.gif" class="topbar__icon-img" />
              </a>

              <a href="/login.html" class="topbar__login-link">
                Login
              </a>
            </nav>
          </div>
        </header>
      `;
    }

    const container = document.getElementById("topbar-container");

    if (!container) {
      console.warn("topbar-container no encontrado");
      return;
    }

    container.innerHTML = topbarHTML;

    const esAhoraCounterBtn = document.getElementById("esAhoraCounterBtn");

    if (esAhoraCounterBtn) {
      esAhoraCounterBtn.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();

        if (esAhoraSnoozed) {
          clearEsAhoraSnooze();
        } else {
          snoozeEsAhora(5);
        }

        renderTopbar();
      });
    }

    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", logout);
    }

    const newDeckBtn = document.getElementById("newDeckBtn");
    if (newDeckBtn) {
      newDeckBtn.addEventListener("click", goToCreateDeckPage);
    }

    const bitacoraBtn = document.getElementById("bitacoraBtn");
    const archivoBtn = document.getElementById("archivoBtn");

    if (archivoBtn) {
      archivoBtn.addEventListener("click", () => {
        window.location.href = "/archivo.html";
      });
    }

    if (bitacoraBtn) {
      bitacoraBtn.addEventListener("click", () => {
        window.location.href = "/bitacora.html";
      });
    }

    const contabilidadBtn = document.getElementById("contabilidadBtn");
    if (contabilidadBtn) {
      contabilidadBtn.addEventListener("click", () => {
        window.location.href = "/contabilidad.html";
      });
    }

    const taludUnreadBtn = document.getElementById("taludUnreadBtn");
    if (taludUnreadBtn && taludUnread) {
      taludUnreadBtn.addEventListener("click", (event) => {
        event.preventDefault();
        const deckId = Number(taludUnread.deck_id || 0);
        const playId = Number(taludUnread.play_id || 0);
        const messageId = Number(taludUnread.message_id || 0);

        if (!deckId || !playId) return;

        const messageQuery = messageId ? `&messageId=${messageId}` : "";
        window.location.href = `/payNow.html?deckId=${deckId}&playId=${playId}&openTalud=1${messageQuery}`;
      });
    }

    const pendingBtn = document.getElementById("pendingBtn");
    if (pendingBtn && latestActionRequired) {
      pendingBtn.addEventListener("click", async () => {
        goToPlayNotification(latestActionRequired);
      });
    }

    const reedBtn = document.getElementById("reedBtn");
    if (reedBtn && latestReadOnly) {
      reedBtn.addEventListener("click", async () => {
        const play = latestReadOnly;

        await acknowledgePlay(play?.id);
        await renderTopbar();
        goToPlayNotification(play);
      });
    }

    const topbarMobileToggle = document.getElementById("topbarMobileToggle");
    const topbarRoot = document.getElementById("topbarRoot");
    if (topbarMobileToggle && topbarRoot) {
      topbarMobileToggle.addEventListener("click", () => {
        const expanded = topbarRoot.classList.toggle("topbar--mobile-expanded");
        topbarMobileToggle.setAttribute("aria-expanded", expanded ? "true" : "false");
        topbarMobileToggle.setAttribute("aria-label", expanded ? "Ocultar menu" : "Mostrar menu");
        topbarMobileToggle.textContent = expanded ? "−" : "+";
      });
    }

    if (latestAhoraPlay && !esAhoraSnoozed) {
      const href = resolveAlgoAhoraHref(latestAhoraPlay);

      if (
        href &&
        window.location.pathname !== new URL(href, window.location.origin).pathname
      ) {
        window.location.href = href;
      }
    }
  }

  document.addEventListener("DOMContentLoaded", renderTopbar);
})();