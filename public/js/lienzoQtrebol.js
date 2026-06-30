(function () {
  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
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

  function getCurrentDeck() {
    const state = getCurrentState();
    return state.deck || state.mazo || window.__currentDeck || {};
  }

  function getAllPlays() {
    const state = getCurrentState();
    return Array.isArray(state.plays) ? state.plays : [];
  }

  function getPlayById(playId) {
    const id = Number(playId || 0);
    if (!id) return null;
    return getAllPlays().find((play) => Number(play?.id || 0) === id) || null;
  }

  function getCurrentUserId() {
    return Number(window.__currentUser?.id || getCurrentState()?.userId || 0);
  }

  function isCurrentUserSource(play) {
    return Number(play?.created_by_user_id || 0) === getCurrentUserId();
  }

  function parsePlayCode(playCode) {
    const parts = String(playCode || "").split("§");
    while (parts.length < 9) parts.push("");
    return parts;
  }

  function parseQHeartPaymentFromPlay(play) {
    const parts = parsePlayCode(play?.play_code || "");
    const flow = String(parts[7] || "");

    const chunk = flow
      .split(";")
      .map((item) => item.trim())
      .find((item) => item.toLowerCase().startsWith("pay:qheart"));

    if (!chunk) return null;

    const data = {};
    chunk.split("|").forEach((part, index) => {
      if (index === 0) return;
      const separator = part.indexOf(":");
      if (separator === -1) return;

      const key = part.slice(0, separator).trim();
      const value = part.slice(separator + 1).trim();
      if (key) data[key] = value;
    });

    return data;
  }

  function formatDateForInput(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");

    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  function getQHeartDefaults(play) {
    const payment = parseQHeartPaymentFromPlay(play) || {};
    const parentPlay = getPlayById(play?.parent_play_id);

    return {
      concept: String(payment.concept || "").trim() || "Ticket",
      amount: String(payment.amount || "").trim(),
      payDate:
        formatDateForInput(payment.payDate) ||
        formatDateForInput(parentPlay?.start_date || play?.start_date)
    };
  }

  function hasPersistedQHeartOffer(play) {
    const payment = parseQHeartPaymentFromPlay(play);
    if (!payment) return false;

    return Boolean(
      String(payment.concept || "").trim() &&
      String(payment.amount || "").trim() &&
      String(payment.payDate || "").trim()
    );
  }

  function canOperateSource(play) {
    const status = String(play?.play_status || play?.status || "").trim().toUpperCase();
    return !["SENT", "APPROVED", "REJECTED", "CANCELLED", "DONE", "QUIT"].includes(status);
  }

  function formatTime(value) {
    if (!value) return "";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";

    return date.toLocaleString("es-UY", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function getPlayOwnerUser(play) {
    const targetUserId = Number(play?.target_user_id || 0);

    if (targetUserId) {
      return {
        id: targetUserId,
        nickname: play?.target_user_nickname || `Usuario ${targetUserId}`,
        profile_photo_url:
          play?.target_user_profile_photo_url ||
          "/assets/icons/singeta120.gif"
      };
    }

    const sourceUserId = Number(play?.created_by_user_id || 0);

    return {
      id: sourceUserId || null,
      nickname: play?.created_by_nickname || (sourceUserId ? `Usuario ${sourceUserId}` : "Usuario"),
      profile_photo_url:
        play?.created_by_profile_photo_url ||
        "/assets/icons/singeta120.gif"
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

  function getCardsOwnedByUser(userId) {
    const ownerId = Number(userId || 0);
    if (!ownerId) return [];

    const finalStatuses = ["QUIT", "FIRED", "REJECTED", "CANCELLED"];

    return getAllPlays()
      .filter((play) => {
        const rank = normalizeRank(play?.card_rank || play?.rank);
        const suit = normalizeSuit(play?.card_suit || play?.suit);
        const status = normalizeRank(play?.play_status || play?.status);

        if (!["A", "K"].includes(rank)) return false;
        if (!["HEART", "SPADE", "DIAMOND", "CLUB"].includes(suit)) return false;
        if (finalStatuses.includes(status)) return false;

        const cardOwnerId =
          Number(play?.target_user_id || 0) ||
          Number(play?.created_by_user_id || 0);

        return cardOwnerId === ownerId;
      })
      .map((play) => ({
        card_rank: normalizeRank(play?.card_rank || play?.rank),
        card_suit: normalizeSuit(play?.card_suit || play?.suit)
      }))
      .filter((card, index, self) => {
        const key = `${card.card_rank}_${card.card_suit}`;
        return index === self.findIndex((c) => `${c.card_rank}_${c.card_suit}` === key);
      })
      .sort(compareCorporateCards);
  }

  function getLienzoContainer() {
    return document.getElementById("lienzo-container");
  }

  function renderDeckHeader(deck) {
    return `
      <div
        id="lienzo-placard"
        data-photo-url="${escapeHtml(deck.deck_image_url || "/assets/icons/sinPicture.gif")}"
        data-title="${escapeHtml(deck.name || "Mazo")}" 
      ></div>
    `;
  }

  function renderQHeartBudgetCard(play) {
    const deck = getCurrentDeck();
    const defaults = getQHeartDefaults(play);
    const canEdit = isCurrentUserSource(play);
    const canOperate = canOperateSource(play);
    const hasSavedOffer = hasPersistedQHeartOffer(play);
    const figureSrc = window.CartaTipo?.getFigureImageSrc
      ? window.CartaTipo.getFigureImageSrc("Q", "HEART")
      : "/assets/icons/QC.png";

    const actionsHtml = canEdit && canOperate
      ? `
        <div class="lienzo-qheart-box__title">Oferta económica</div>

        ${hasSavedOffer
          ? `
            <button id="qtrebol-qheart-send-btn" class="icon-btn" title="Enviar oferta">
              <img src="/assets/icons/buzon60.gif" alt="Enviar" />
            </button>
          `
          : `
            <button id="qtrebol-qheart-save-btn" class="icon-btn" title="Salvar oferta Q♥">
              <img src="/assets/icons/salvar40.gif" alt="Salvar" />
            </button>
          `
        }

        <button id="qtrebol-delete-btn" class="icon-btn" title="Borrar invitación">
          <img src="/assets/icons/papelera80.gif" alt="Borrar" />
        </button>
      `
      : "";

    return `
      <div class="lv2-play-card lv2-play-card--qheart">
        ${window.CartaTipo.renderCardCorners("Q", "HEART")}

        <div
          class="lv2-play-card__figure"
          style="--lv2-figure-url: url('${escapeHtml(figureSrc)}');"
        ></div>

        <div class="lv2-play-card__inner lv2-play-card__inner--figure">
          <div class="lienzo-qheart-box__body">
            <input
              id="qtrebol-qheart-concept"
              type="text"
              class="lienzo-qheart-box__concept"
              placeholder="Descripción"
              value="${escapeHtml(defaults.concept)}"
              ${canEdit ? "" : "disabled"}
            />

            <div class="lienzo-qheart-box__amount-row">
              <span class="lienzo-qheart-box__currency">${escapeHtml(String(deck?.currency_symbol || "").trim().toUpperCase())}</span>
              <input
                id="qtrebol-qheart-amount"
                type="text"
                class="lienzo-qheart-box__amount"
                placeholder="0"
                inputmode="decimal"
                value="${escapeHtml(defaults.amount)}"
                ${canEdit ? "" : "disabled"}
              />
            </div>

            <input
              id="qtrebol-qheart-paydate"
              type="datetime-local"
              class="lienzo-qheart-box__paydate"
              value="${escapeHtml(defaults.payDate)}"
              ${canEdit ? "" : "disabled"}
            />
          </div>
        </div>

        <div class="lv2-play-card__actions">
          ${actionsHtml}
        </div>
      </div>
    `;
  }

  function mountPlacard(play) {
    const host = document.getElementById("lienzo-placard");
    if (!host || typeof window.renderPlacard !== "function") return;

    window.renderPlacard(host, {
      page: "lienzo-qtrebol",
      play,
      photoUrl: host.dataset.photoUrl,
      title: host.dataset.title,
      rank: "Q",
      suit: "CLUB",
      showCurrency: false,
      leftCards: [],
      plays: getAllPlays()
    });
  }

  function renderQtrebol(play) {
    const ownerUser = getPlayOwnerUser(play);

    const cardHtml = typeof window.CartaTipo?.renderPlayCardBox === "function"
      ? window.CartaTipo.renderPlayCardBox({
          rank: "Q",
          suit: "CLUB",
          title: play?.play_text || "Q♣",
          play_text: play?.play_text || "",
          status: play?.play_status || play?.status || "",
          start_date: play?.start_date,
          end_date: play?.end_date,
          location: play?.location,
          ownerUser,
          ownerCards: getCardsOwnedByUser(ownerUser?.id),
          metas: [
            play?.start_date
              ? {
                  icon: "/assets/icons/reloj60.gif",
                  text: formatTime(play.start_date)
                }
              : null,
            play?.location
              ? {
                  icon: "/assets/icons/LocGlobito80.gif",
                  text: play.location
                }
              : null
          ].filter(Boolean),
          actionsHtml: "",
          showActions: false
        })
      : `
        <article class="lv2-play-card">
          <div class="lv2-play-card__body">
            <div class="lv2-play-card__title">Q♣</div>
            <div class="lv2-play-card__text">${escapeHtml(play?.play_text || "Sin texto")}</div>
          </div>
        </article>
      `;

    return `
      <section class="lienzo-tribune lienzo-tribune--source">
        <div class="lienzo-tribune__corporates"></div>

        <div class="lienzo-tribune__stage lienzo-tribune__stage--column">
          <div class="amsterdam-card-stack lienzo-qtrebol-main-stack">
            <div class="amsterdam-card-stack__primary lienzo-qtrebol-main-primary">
              ${cardHtml}
            </div>
          </div>

          <div class="lienzo-qtrebol-second-layer">
            <div class="lienzo-qtrebol-qheart-wrap">
              ${renderQHeartBudgetCard(play)}
            </div>
          </div>
        </div>
      </section>
    `;
  }

  async function patchPlay(playId, payload) {
    const token = localStorage.getItem("cooptrackToken");
    if (!token) {
      alert("No estás logueado");
      return false;
    }

    const response = await fetch(`/plays/${playId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      alert(data?.error || "No se pudo guardar la oferta Q♥.");
      return false;
    }

    return true;
  }

  async function deletePlay(playId) {
    const token = localStorage.getItem("cooptrackToken");
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
      alert(data?.error || "No se pudo borrar la Q♣.");
      return false;
    }

    return true;
  }

  function buildQHeartPayload(play) {
    const concept = String(document.getElementById("qtrebol-qheart-concept")?.value || "").trim();
    const amount = String(document.getElementById("qtrebol-qheart-amount")?.value || "").trim();
    const payDate = String(document.getElementById("qtrebol-qheart-paydate")?.value || "").trim();

    if (!concept || !amount || !payDate) {
      return { ok: false, error: "Completá concepto, importe y fecha." };
    }

    const parts = parsePlayCode(play?.play_code || "");
    const flowChunks = String(parts[7] || "")
      .split(";")
      .map((item) => item.trim())
      .filter(Boolean)
      .filter((chunk) => !chunk.toLowerCase().startsWith("pay:qheart"));

    const qHeartChunk =
      `pay:QHEART|concept:${concept}|amount:${amount}|currency:${String(getCurrentDeck()?.currency_symbol || "").trim().toUpperCase()}|payDate:${payDate}`;

    flowChunks.push(qHeartChunk);
    parts[7] = flowChunks.join(";");

    return {
      ok: true,
      payload: {
        play_code: parts.slice(0, 9).join("§")
      }
    };
  }

  function bindActions(play) {
    const saveBtn = document.getElementById("qtrebol-qheart-save-btn");
    const sendBtn = document.getElementById("qtrebol-qheart-send-btn");
    const deleteBtn = document.getElementById("qtrebol-delete-btn");

    saveBtn?.addEventListener("click", async () => {
      const built = buildQHeartPayload(play);
      if (!built.ok) {
        alert(built.error || "Datos inválidos");
        return;
      }

      const ok = await patchPlay(play.id, built.payload);
      if (!ok) return;

      alert("Oferta Q♥ guardada.");
      window.location.reload();
    });

    sendBtn?.addEventListener("click", async () => {
      if (!hasPersistedQHeartOffer(play)) {
        alert("Primero guardá la oferta Q♥.");
        return;
      }

      const ok = await patchPlay(play.id, {
        play_status: "SENT"
      });

      if (!ok) return;

      const deckId = Number(play?.deck_id || getCurrentDeck()?.id || 0);
      const parentId = Number(play?.parent_play_id || 0);

      if (deckId && parentId) {
        window.location.href = `/lienzoJtrebol.html?deckId=${deckId}&playId=${parentId}`;
        return;
      }

      window.location.reload();
    });

    deleteBtn?.addEventListener("click", async () => {
      const confirmed = window.confirm("¿Querés borrar esta Q♣?");
      if (!confirmed) return;

      const ok = await deletePlay(play.id);
      if (!ok) return;

      const deckId = Number(play?.deck_id || getCurrentDeck()?.id || 0);
      const parentId = Number(play?.parent_play_id || 0);

      if (parentId && deckId) {
        window.location.href = `/lienzoJtrebol.html?deckId=${deckId}&playId=${parentId}`;
        return;
      }

      if (deckId) {
        window.location.href = `/tablero.html?id=${deckId}`;
        return;
      }

      window.history.back();
    });
  }

  function openLienzoByPlayId(playId) {
    const play = getPlayById(playId);
    const container = getLienzoContainer();

    if (!container) return;

    if (!play) {
      container.innerHTML = '<div class="lienzo-error">No se encontró la jugada Q♣ solicitada.</div>';
      return;
    }

    container.innerHTML = `
      ${renderDeckHeader(getCurrentDeck())}
      ${renderQtrebol(play)}
    `;

    mountPlacard(play);
    bindActions(play);
  }

  window.openLienzoByPlayId = openLienzoByPlayId;
})();
