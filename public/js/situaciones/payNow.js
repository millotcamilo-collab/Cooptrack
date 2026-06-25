(function () {
  const API_BASE_URL = "";
  const TALUD_TOGGLE_BUTTON_ID = "paynow-talud-toggle-btn";
  const TALUD_HOST_ID = "paynow-talud-host";

  let taludController = null;
  let taludMountedPlayId = 0;
  let taludOpen = false;

  function getParams() {
    return new URLSearchParams(window.location.search);
  }

  function normalizeRank(value) {
    return String(value || "").trim().toUpperCase();
  }

  function normalizeSuit(value) {
    return String(value || "").trim().toUpperCase();
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function parsePlayCode(code) {
    const parts = String(code || "").split("§");

    while (parts.length < 9) {
      parts.push("");
    }

    return {
      parts,
      deckId: parts[0] || "",
      userId: parts[1] || "",
      date: parts[2] || "",
      rank: parts[3] || "",
      suit: parts[4] || "",
      action: parts[5] || "",
      autorizados: parts[6] || "",
      flow: parts[7] || "",
      recipients: parts[8] || ""
    };
  }

  function parseFlowChunks(flowValue) {
    return String(flowValue || "")
      .split(";")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function getCurrentUserId() {
    return Number(
      window.__currentUser?.id ||
      window.__currentState?.currentUser?.id ||
      window.__currentState?.userId ||
      0
    );
  }

  function getCurrentUser() {
    return window.__currentUser || window.__currentState?.currentUser || null;
  }

  function isQSpade(play) {
    return (
      normalizeRank(play?.card_rank || play?.rank) === "Q" &&
      normalizeSuit(play?.card_suit || play?.suit) === "SPADE"
    );
  }

  function getPlayOwnerUser(play, fallbackUserId) {
    const userId = Number(fallbackUserId || play?.created_by_user_id || 0);

    return {
      id: userId,
      nickname:
        play?.created_by_nickname ||
        play?.target_user_nickname ||
        (userId ? `Usuario ${userId}` : "Usuario"),
      profile_photo_url:
        play?.created_by_profile_photo_url ||
        play?.target_user_profile_photo_url ||
        "/assets/icons/singeta120.gif"
    };
  }

  async function fetchDeckState(deckId) {
    const token = localStorage.getItem("cooptrackToken");

    const response = await fetch(`${API_BASE_URL}/mazo/${deckId}/state`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json"
      }
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data?.error || "No se pudo cargar el estado del mazo.");
    }

    window.__currentState = data;
    window.__currentDeck = data.deck || data.mazo || null;

    if (data.currentUser) {
      window.__currentUser = data.currentUser;
    }

    return data;
  }

  function findQQPicaPlay(plays, playId) {
    const selected = plays.find((play) => Number(play?.id || 0) === Number(playId)) || null;

    if (!selected) return null;

    if (isQSpade(selected)) return selected;

    const childQSpade = plays.find((play) => {
      return isQSpade(play) && Number(play?.parent_play_id || 0) === Number(selected?.id || 0);
    });

    return childQSpade || null;
  }

  function attachParentPlay(play, plays) {
    if (!play) return play;

    const parent = plays.find((item) => Number(item?.id || 0) === Number(play?.parent_play_id || 0)) || null;

    if (parent) {
      play.parent_play = parent;
      play.parent = parent;
    }

    return play;
  }

  // Parsea el bloque "pay:QHEART|..." para disparar y mostrar la experiencia payNow.
  function parseQQHeartPayment(play) {
    const parsed = parsePlayCode(play?.play_code || "");
    const chunks = parseFlowChunks(parsed.flow);

    let payment = null;

    chunks.forEach((chunk) => {
      if (!chunk.startsWith("pay:QHEART")) return;

      const [head, ...parts] = chunk.split("|");
      const type = String(head.split(":")[1] || "").trim().toUpperCase();
      const data = { type };

      parts.forEach((part) => {
        const idx = part.indexOf(":");
        if (idx === -1) return;
        const key = part.slice(0, idx).trim();
        const value = part.slice(idx + 1).trim();
        if (!key) return;
        data[key] = value;
      });

      payment = data;
    });

    if (!payment) return null;

    return {
      ...payment,
      side: String(payment.side || "").trim().toUpperCase(),
      amount: String(payment.amount || "").trim(),
      concept: String(payment.concept || "").trim(),
      currency: String(payment.currency || "").trim().toUpperCase(),
      payDate: String(payment.payDate || "").trim(),
      payAt: String(payment.payAt || "").trim()
    };
  }

  // Parsea el bloque "payment:PAYER_CLAIMED|..." para saber si el pagador ya declaro pago.
  function getPayerClaimState(play) {
    const parsed = parsePlayCode(play?.play_code || "");
    const chunks = parseFlowChunks(parsed.flow);

    let claim = null;

    chunks.forEach((chunk) => {
      if (!chunk.startsWith("payment:PAYER_CLAIMED")) return;

      const [head, ...parts] = chunk.split("|");
      const status = String(head.split(":")[1] || "").trim().toUpperCase();
      const data = { status };

      parts.forEach((part) => {
        const idx = part.indexOf(":");
        if (idx === -1) return;
        const key = part.slice(0, idx).trim();
        const value = part.slice(idx + 1).trim();
        if (!key) return;
        data[key] = value;
      });

      claim = data;
    });

    return claim;
  }

  // Parsea settlement final: "settlement:PAID|..." o "settlement:COMPLAINED|...".
  function getSettlementState(play) {
    const parsed = parsePlayCode(play?.play_code || "");
    const chunks = parseFlowChunks(parsed.flow);

    let settlement = null;

    chunks.forEach((chunk) => {
      if (!chunk.startsWith("settlement:")) return;

      const [head, ...parts] = chunk.split("|");
      const status = String(head.split(":")[1] || "").trim().toUpperCase();
      const data = { status };

      parts.forEach((part) => {
        const idx = part.indexOf(":");
        if (idx === -1) return;
        const key = part.slice(0, idx).trim();
        const value = part.slice(idx + 1).trim();
        if (!key) return;
        data[key] = value;
      });

      settlement = data;
    });

    return settlement;
  }

  function getPayerSide(play) {
    const payment = parseQQHeartPayment(play);
    const side = String(payment?.side || "").trim().toUpperCase();

    if (side !== "AMSTERDAM" && side !== "COLOMBES") return null;

    return side;
  }

  function getCollectorSide(play) {
    const payerSide = getPayerSide(play);
    if (!payerSide) return null;

    return payerSide === "AMSTERDAM" ? "COLOMBES" : "AMSTERDAM";
  }

  function isCurrentUserPayer(play) {
    const currentUserId = getCurrentUserId();
    if (!currentUserId) return false;

    const payerSide = getPayerSide(play);
    if (!payerSide) return false;

    const sourceUserId = Number(play?.created_by_user_id || 0);
    const targetUserId = Number(play?.target_user_id || 0);

    if (payerSide === "AMSTERDAM") {
      return targetUserId && currentUserId === targetUserId;
    }

    return sourceUserId && currentUserId === sourceUserId;
  }

  function isCurrentUserCollector(play) {
    const currentUserId = getCurrentUserId();
    if (!currentUserId) return false;

    const collectorSide = getCollectorSide(play);
    if (!collectorSide) return false;

    const sourceUserId = Number(play?.created_by_user_id || 0);
    const targetUserId = Number(play?.target_user_id || 0);

    if (collectorSide === "AMSTERDAM") {
      return targetUserId && currentUserId === targetUserId;
    }

    return sourceUserId && currentUserId === sourceUserId;
  }

  function formatDateOrDash(value) {
    const raw = String(value || "").trim();
    if (!raw) return "-";

    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return raw;

    return date.toLocaleString("es-AR");
  }

  function toFlowChunks(play) {
    const parsed = parsePlayCode(play?.play_code || "");
    return {
      parsed,
      chunks: parseFlowChunks(parsed.flow)
    };
  }

  function buildPlayCodeWithPayerClaim(play) {
    const { parsed, chunks } = toFlowChunks(play);

    const cleaned = chunks.filter((chunk) => !chunk.startsWith("payment:PAYER_CLAIMED"));

    const claimBlock =
      "payment:PAYER_CLAIMED" +
      `|by:${getCurrentUserId() || ""}` +
      `|at:${new Date().toISOString()}` +
      "|notified:false";

    const nextFlow = [...cleaned, claimBlock].join(";");

    return [
      parsed.deckId,
      parsed.userId,
      parsed.date,
      parsed.rank,
      parsed.suit,
      parsed.action,
      parsed.autorizados,
      nextFlow,
      parsed.recipients
    ].join("§");
  }

  function buildPlayCodeWithSettlement(play, status) {
    const { parsed, chunks } = toFlowChunks(play);

    const cleaned = chunks.filter((chunk) => !chunk.startsWith("settlement:"));

    const settlementBlock =
      `settlement:${String(status || "").trim().toUpperCase()}` +
      `|by:${getCurrentUserId() || ""}` +
      `|at:${new Date().toISOString()}` +
      "|notified:false";

    const nextFlow = [...cleaned, settlementBlock].join(";");

    return [
      parsed.deckId,
      parsed.userId,
      parsed.date,
      parsed.rank,
      parsed.suit,
      parsed.action,
      parsed.autorizados,
      nextFlow,
      parsed.recipients
    ].join("§");
  }

  async function patchPlayCode(playId, playCode) {
    const token = localStorage.getItem("cooptrackToken");

    if (!token) {
      alert("No estas logueado.");
      return false;
    }

    const response = await fetch(`${API_BASE_URL}/plays/${playId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        play_code: playCode
      })
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      console.error("No se pudo actualizar payNow", data);
      alert(data?.error || "No se pudo actualizar la jugada.");
      return false;
    }

    return true;
  }

  function buildActionButtons(play) {
    const settlement = getSettlementState(play);

    if (settlement) return "";

    if (isCurrentUserPayer(play)) {
      return `
      <button type="button" id="paynow-claimed-btn" class="icon-btn" title="Ya pague">
        <img src="/assets/icons/META60.gif" alt="Ya pague" />
      </button>
    `;
    }

    if (isCurrentUserCollector(play)) {
      return `
      <button type="button" id="paynow-confirm-btn" class="icon-btn" title="Confirmar pago">
        <img src="/assets/icons/award60oro.gif" alt="Confirmar pago" />
      </button>
      <button type="button" id="paynow-complain-btn" class="icon-btn" title="Registrar queja">
        <img src="/assets/icons/ticket80g.gif" alt="Registrar queja" />
      </button>
    `;
    }

    return "";
  }

  function getStatusMessage(play) {
    const settlement = getSettlementState(play);
    const payerClaim = getPayerClaimState(play);

    if (settlement?.status === "PAID") {
      return "Pago confirmado";
    }

    if (settlement?.status === "COMPLAINED") {
      return "Incumplimiento registrado";
    }

    if (payerClaim?.status === "PAYER_CLAIMED") {
      return "Pago declarado, esperando confirmacion del cobrador";
    }

    if (isCurrentUserPayer(play)) {
      return "Confirma cuando ya realizaste el pago";
    }

    if (isCurrentUserCollector(play)) {
      return "Puedes confirmar el pago recibido o registrar una queja";
    }

    return "Seguimiento de pago economico";
  }

  function renderMotherCard(play) {
    const parent = play?.parent_play || play?.parent || null;
    if (!parent) return "";

    const ownerUser = getPlayOwnerUser(parent, parent?.created_by_user_id);

    return window.CartaTipo.renderPlayCardBox({
      ...parent,
      rank: "J",
      card_rank: "J",
      suit: "SPADE",
      card_suit: "SPADE",
      play_text: parent.play_text,
      start_date: parent.start_date,
      end_date: parent.end_date,
      location: parent.location,
      spade_mode: parent.spade_mode || play.spade_mode,
      ownerUser,
      showOwner: true,
      showActions: false,
      actionsHtml: ""
    });
  }

  function renderQSpadeCard(play) {
    const parent = play?.parent_play || play?.parent || null;
    const targetUserId = Number(play?.target_user_id || 0);
    const ownerUser = targetUserId
      ? {
          id: targetUserId,
          nickname: play?.target_user_nickname || `Usuario ${targetUserId}`,
          profile_photo_url:
            play?.target_user_profile_photo_url ||
            "/assets/icons/singeta120.gif"
        }
      : getPlayOwnerUser(play, play?.created_by_user_id);

    return window.CartaTipo.renderPlayCardBox({
      ...play,
      rank: "Q",
      card_rank: "Q",
      suit: "SPADE",
      card_suit: "SPADE",
      play_text: parent?.play_text || play.play_text,
      start_date: parent?.start_date || play.start_date,
      end_date: parent?.end_date || play.end_date,
      location: parent?.location || play.location,
      spade_mode: parent?.spade_mode || play.spade_mode,
      ownerUser,
      showOwner: true,
      showActions: false,
      actionsHtml: ""
    });
  }

  function renderQDiamondEconomicCard(play) {
    const payment = parseQQHeartPayment(play);
    const dueAt = payment?.payAt || payment?.payDate || "";

    const settlement = getSettlementState(play);
    const payerClaim = getPayerClaimState(play);

    let stateText = "Pendiente";
    if (settlement?.status === "PAID") {
      stateText = "Pago confirmado";
    } else if (settlement?.status === "COMPLAINED") {
      stateText = "Incumplimiento registrado";
    } else if (payerClaim?.status === "PAYER_CLAIMED") {
      stateText = "Pago declarado, esperando confirmacion";
    }

    const metas = [
      { text: `Estado: ${stateText}` },
      { text: `Concepto: ${payment?.concept || "-"}` },
      { text: `Monto: ${payment?.amount || "-"}` },
      { text: `Moneda: ${payment?.currency || "-"}` },
      { text: `Pago para: ${formatDateOrDash(dueAt)}` }
    ];

    return window.CartaTipo.renderPlayCardBox({
      ...play,
      rank: "Q",
      card_rank: "Q",
      suit: "DIAMOND",
      card_suit: "DIAMOND",
      title: "Q\u2666 econ\u00f3mica",
      metas,
      play_text: "",
      showOwner: false,
      showActions: true,
      actionsHtml: buildActionButtons(play)
    });
  }

  function buildTaludPlacardButtonHtml() {
    return `
      <button
        type="button"
        id="${TALUD_TOGGLE_BUTTON_ID}"
        class="placard__talud-trigger"
        title="Abrir talud"
        aria-label="Abrir talud"
      >
        <img
          class="placard__talud-trigger-icon"
          src="/assets/icons/sellopostal60.gif"
          alt="Talud"
        />
      </button>
    `;
  }

  function ensureTaludHost() {
    const zone = document.getElementById("tribuna-actions");
    if (!zone) return null;

    zone.classList.add("tribuna__talud-zone");

    let host = document.getElementById(TALUD_HOST_ID);

    if (!host) {
      host = document.createElement("div");
      host.id = TALUD_HOST_ID;
      host.className = "paynow-talud-host";
      zone.innerHTML = "";
      zone.appendChild(host);
    }

    host.style.display = taludOpen ? "block" : "none";
    return host;
  }

  async function toggleTalud(play) {
    const host = ensureTaludHost();
    if (!host) return;

    taludOpen = !taludOpen;
    host.style.display = taludOpen ? "block" : "none";

    if (!taludOpen) return;

    if (!window.Talud || typeof window.Talud.mount !== "function") {
      alert("Talud no disponible");
      return;
    }

    const playId = Number(play?.id || 0);
    if (!playId) return;

    host.innerHTML = "<div class=\"paynow-talud-loading\">Cargando talud...</div>";

    try {
      if (taludController && taludMountedPlayId === playId && typeof taludController.refresh === "function") {
        await taludController.refresh();
        return;
      }

      taludController = await window.Talud.mount(host, { playId });
      taludMountedPlayId = playId;
    } catch (error) {
      console.error("Error montando talud en payNow", error);
      host.innerHTML = `<div class=\"paynow-talud-error\">${escapeHtml(error?.message || "No se pudo abrir el talud")}</div>`;
    }
  }

  function renderPlacard(play) {
    const placardHost = document.getElementById("tribuna-placard");
    if (!placardHost) return;
    if (typeof window.renderPlacard !== "function") return;

    const deck = window.__currentDeck || {};
    const parent = play?.parent_play || play?.parent || play;

    placardHost.innerHTML = "";

    window.renderPlacard(placardHost, {
      page: "pay-now",
      play: parent,
      photoUrl: deck.deck_image_url || "/assets/icons/sinPicture.gif",
      title: deck.name || "Mazo",
      rank: "A",
      suit: "HEART",
      showCurrency: false,
      leftCardsHtml: buildTaludPlacardButtonHtml(),
      plays: window.__currentState?.plays || []
    });

    const taludBtn = document.getElementById(TALUD_TOGGLE_BUTTON_ID);
    if (taludBtn) {
      taludBtn.onclick = () => {
        toggleTalud(play);
      };
    }
  }

  function renderPayNow(play) {
    const content = document.getElementById("tribuna-content");

    if (!content) return;

    const statusMessage = getStatusMessage(play);

    content.innerHTML = `
      <section class="lienzo-tribune lienzo-tribune--target tribuna-single tribuna-single--amsterdam">
        <div class="lienzo-tribune__corporates"></div>

        <div id="lienzo-target-dropzone" class="lienzo-target-dropzone">
          <div class="amsterdam-card-stack">
            <div class="amsterdam-card-stack__primary">
              <div class="paynow-layer paynow-layer--j">
                ${renderMotherCard(play)}
              </div>

              <div class="qpica-q-wrapper qpica-q-wrapper--open paynow-layer paynow-layer--q">
                ${renderQSpadeCard(play)}
              </div>

              <div class="qpica-q-wrapper qpica-q-wrapper--open qqpica-qheart-wrapper paynow-layer paynow-layer--economic">
                ${renderQDiamondEconomicCard(play)}
              </div>
            </div>
          </div>
        </div>

        <div class="paynow-status-note">${escapeHtml(statusMessage)}</div>
      </section>
    `;

    ensureTaludHost();
    bindActions(play);
  }

  function bindActions(play) {
    const content = document.getElementById("tribuna-content");
    if (!content) return;

    content.onclick = async (event) => {
      const claimedBtn = event.target.closest("#paynow-claimed-btn");
      const confirmBtn = event.target.closest("#paynow-confirm-btn");
      const complainBtn = event.target.closest("#paynow-complain-btn");

      if (!claimedBtn && !confirmBtn && !complainBtn) return;

      event.preventDefault();
      event.stopPropagation();

      const settlement = getSettlementState(play);
      if (settlement) return;

      const playId = Number(play?.id || 0);
      if (!playId) {
        alert("playId invalido");
        return;
      }

      if (claimedBtn) {
        claimedBtn.disabled = true;

        const nextPlayCode = buildPlayCodeWithPayerClaim(play);
        const ok = await patchPlayCode(playId, nextPlayCode);

        if (!ok) {
          claimedBtn.disabled = false;
          return;
        }

        window.location.reload();
        return;
      }

      if (confirmBtn) {
        confirmBtn.disabled = true;

        const nextPlayCode = buildPlayCodeWithSettlement(play, "PAID");
        const ok = await patchPlayCode(playId, nextPlayCode);

        if (!ok) {
          confirmBtn.disabled = false;
          return;
        }

        window.location.href = "/almanaque.html";
        return;
      }

      if (complainBtn) {
        complainBtn.disabled = true;

        const confirmed = window.confirm("\u00bfQuer\u00e9s registrar una queja por incumplimiento?");
        if (!confirmed) {
          complainBtn.disabled = false;
          return;
        }

        const nextPlayCode = buildPlayCodeWithSettlement(play, "COMPLAINED");
        const ok = await patchPlayCode(playId, nextPlayCode);

        if (!ok) {
          complainBtn.disabled = false;
          return;
        }

        window.location.href = "/almanaque.html";
      }
    };
  }

  async function initPayNow() {
    const params = getParams();
    const deckId = Number(params.get("deckId") || 0);
    const playId = Number(params.get("playId") || 0);

    const content = document.getElementById("tribuna-content");

    if (!deckId || !playId) {
      if (content) {
        content.innerHTML = "<div class=\"lienzo-error\">Falta deckId o playId.</div>";
      }
      return;
    }

    try {
      const data = await fetchDeckState(deckId);
      const plays = Array.isArray(data?.plays) ? data.plays : [];

      let play = findQQPicaPlay(plays, playId);
      play = attachParentPlay(play, plays);

      if (!play) {
        if (content) {
          content.innerHTML = "<div class=\"lienzo-error\">No se encontro la Q de pica para payNow.</div>";
        }
        return;
      }

      const payment = parseQQHeartPayment(play);
      if (!payment) {
        if (content) {
          content.innerHTML = "<div class=\"lienzo-error\">La Q de pica no tiene bloque pay:QHEART en play_code.</div>";
        }
        return;
      }

      renderPlacard(play);
      renderPayNow(play);
    } catch (error) {
      console.error("Error cargando payNow", error);
      if (content) {
        content.innerHTML = `<div class=\"lienzo-error\">${escapeHtml(error?.message || "Error inesperado")}</div>`;
      }
    }
  }

  document.addEventListener("DOMContentLoaded", initPayNow);
})();
