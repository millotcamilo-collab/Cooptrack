(function () {
    function normalizeRank(value) {
        return String(value || "").trim().toUpperCase();
    }

    function normalizeSuit(value) {
        return String(value || "").trim().toUpperCase();
    }

    function normalizeStatus(value) {
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

    function getCurrentPlay() {
        return window.__currentPlay || null;
    }

    function getCurrentUser() {
        return window.__currentUser || null;
    }

    function getLienzoContainer() {
        return document.getElementById("lienzo-container");
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
            A_HEART: "/assets/icons/Acorazon.gif",
            A_SPADE: "/assets/icons/Apike.gif",
            A_DIAMOND: "/assets/icons/Adiamante.gif",
            A_CLUB: "/assets/icons/Atrebol.gif",

            K_HEART: "/assets/icons/Kcorazon.gif",
            K_SPADE: "/assets/icons/Kpike.gif",
            K_DIAMOND: "/assets/icons/Kdiamante.gif",
            K_CLUB: "/assets/icons/Ktrebol.gif"
        };

        return map[`${r}_${s}`] || "/assets/icons/Dorso70.gif";
    }

    function getDeckAvatarSrc(play) {
        const raw =
            play?.deck_image_url ||
            play?.deck_photo_url ||
            play?.deck_avatar_url ||
            "";

        return String(raw).trim() || "/assets/icons/sinPicture.gif";
    }

    function getDeckName(play) {
        return String(play?.deck_name || "Mazo").trim() || "Mazo";
    }

    function getCurrencyCode(play) {
        return String(play?.currency_symbol || "").trim().toUpperCase();
    }

    function getCurrencyName(play) {
        return (
            String(play?.currency_name || "").trim() ||
            String(play?.currency_label || "").trim() ||
            ""
        );
    }

    function resolveSourceUser(play) {
        return {
            id: Number(play?.created_by_user_id || 0),
            nickname: play?.created_by_nickname || "Anfitrión",
            profile_photo_url:
                play?.created_by_profile_photo_url || "/assets/icons/singeta120.gif"
        };
    }

    function resolveTargetUser(play) {
        return {
            id: Number(play?.target_user_id || 0),
            nickname: play?.target_user_nickname || "Destinatario",
            profile_photo_url:
                play?.target_user_profile_photo_url || "/assets/icons/singeta120.gif"
        };
    }

    function isSourceViewer(play) {
        return Number(getCurrentUser()?.id || 0) === Number(play?.created_by_user_id || 0);
    }

    function isTargetViewer(play) {
        return Number(getCurrentUser()?.id || 0) === Number(play?.target_user_id || 0);
    }

    function renderDeckHeader(play) {
        const avatarSrc = getDeckAvatarSrc(play);
        const deckName = getDeckName(play);
        const currencyCode = getCurrencyCode(play);
        const currencyName = getCurrencyName(play);

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

    function mountPlacardFromDataset(play) {
        const placardHost = document.getElementById("lienzo-placard");
        if (!placardHost) return;
        if (typeof window.renderPlacard !== "function") return;

        window.renderPlacard(placardHost, {
            page: "lienzo-rqf",
            mode: "RQF",
            play,
            currentUserId: Number(getCurrentUser()?.id || 0),
            plays: [play],

            photoUrl: placardHost.dataset.photoUrl || "",
            rank: placardHost.dataset.rank || "A",
            suit: placardHost.dataset.suit || "HEART",
            title: placardHost.dataset.title || "Mazo",
            currencyCode: placardHost.dataset.currencyCode || "",
            currencyName: placardHost.dataset.currencyName || "",
            showCurrency: false
        });
    }

    function getRQFMessage(play) {
        const status = normalizeStatus(play?.play_status);
        const sourceUser = resolveSourceUser(play);
        const targetUser = resolveTargetUser(play);

        if (status === "FIRED") {
            if (isTargetViewer(play)) {
                return {
                    title: "Fuiste despedido",
                    body: `${sourceUser.nickname} te despidió de esta K.`
                };
            }

            if (isSourceViewer(play)) {
                return {
                    title: "Despediste al destinatario",
                    body: `La K de ${targetUser.nickname} quedó finalizada por despido.`
                };
            }

            return {
                title: "K finalizada por despido",
                body: "Esta K fue finalizada por despido."
            };
        }

        if (status === "QUIT") {
            if (isTargetViewer(play)) {
                return {
                    title: "Renunciaste a esta K",
                    body: `Tu vínculo con ${getDeckName(play)} quedó finalizado.`
                };
            }

            if (isSourceViewer(play)) {
                return {
                    title: "El destinatario renunció",
                    body: `${targetUser.nickname} renunció a esta K.`
                };
            }

            return {
                title: "K finalizada por renuncia",
                body: "Esta K fue finalizada por renuncia."
            };
        }

        return {
            title: "Jugada finalizada",
            body: "Esta K ya no está activa."
        };
    }

    function renderUserCard(user, label) {
        return `
      <div class="lienzo-target-header lienzo-target-header--top">
        <div>
          <div class="lienzo-target-header__name">${escapeHtml(user.nickname)}</div>
          <div style="font-size: 13px; opacity: 0.8;">${escapeHtml(label)}</div>
        </div>
        <img
          class="lienzo-target-header__photo"
          src="${escapeHtml(user.profile_photo_url)}"
          alt="${escapeHtml(user.nickname)}"
        />
      </div>
    `;
    }

    function renderRQFPanel(play) {
        const sourceUser = resolveSourceUser(play);
        const targetUser = resolveTargetUser(play);
        const message = getRQFMessage(play);

        return `
      <section class="lienzo-panel panel--split-top">
        <div class="panel-topbar">
          <div class="panel-topbar__col panel-topbar__col--identity">
            <div class="lienzo-target-header__name">
              ${escapeHtml(message.title)}
            </div>
          </div>

          <div class="panel-topbar__col panel-topbar__col--actions">
            <button
              id="lienzo-rqf-exit-btn"
              class="icon-btn"
              type="button"
              title="Salir"
              aria-label="Salir"
            >
              <img src="/assets/icons/exit80.gif" alt="Salir" />
            </button>
          </div>
        </div>

        <div style="padding: 20px;">
          <div class="lienzo-grid">
            <div class="lienzo-grid__left">
              ${renderUserCard(sourceUser, "Anfitrión")}
            </div>

            <div class="lienzo-grid__right">
              ${renderUserCard(targetUser, "Destinatario")}
            </div>
          </div>

          <div style="margin: 28px auto 20px; text-align: center;">
            <img
              class="lienzo-card-image"
              src="${escapeHtml(getCardImageSrc(play?.card_rank, play?.card_suit))}"
              alt="${escapeHtml(`K${getSuitSymbol(play?.card_suit)}`)}"
            />
          </div>

          <div style="text-align: center; font-size: 18px; line-height: 1.5; padding: 8px 12px;">
            ${escapeHtml(message.body)}
          </div>
        </div>
      </section>
    `;
    }

    function bindRQFActions(play) {
        const exitBtn = document.getElementById("lienzo-rqf-exit-btn");
        if (!exitBtn) return;

        exitBtn.addEventListener("click", () => {
            if (isSourceViewer(play)) {
                const deckId = Number(play?.deck_id || 0);
                if (deckId) {
                    window.location.href = `/mazoAdministradores.html?id=${deckId}`;
                    return;
                }
            }

            window.location.href = "/archivo.html";
        });
    }

    function renderRQFSourcePanel(play) {
        const sourceUser = resolveSourceUser(play);

        return `
    <section class="lienzo-panel lienzo-panel--source panel--split-top">
      <div class="panel-topbar">
        <div class="panel-topbar__col panel-topbar__col--identity">
          <div class="lienzo-target-header lienzo-target-header--top">
            <div class="lienzo-target-header__name">${escapeHtml(sourceUser.nickname)}</div>
            <img
              class="lienzo-target-header__photo"
              src="${escapeHtml(sourceUser.profile_photo_url)}"
              alt="${escapeHtml(sourceUser.nickname)}"
            />
          </div>
        </div>
        <div class="panel-topbar__col panel-topbar__col--actions"></div>
      </div>

      <div class="lienzo-source-cards">
        <div class="lienzo-source-stack"></div>
      </div>
    </section>
  `;
    }

    function renderRQFTargetPanel(play) {
        const targetUser = resolveTargetUser(play);

        return `
    <section class="lienzo-panel lienzo-panel--target panel--split-top">
      <div class="panel-topbar">
        <div class="panel-topbar__col panel-topbar__col--identity">
          <div class="lienzo-target-header lienzo-target-header--top">
            <div class="lienzo-target-header__name">${escapeHtml(targetUser.nickname)}</div>
            <img
              class="lienzo-target-header__photo"
              src="${escapeHtml(targetUser.profile_photo_url)}"
              alt="${escapeHtml(targetUser.nickname)}"
            />
          </div>
        </div>
        <div class="panel-topbar__col panel-topbar__col--actions"></div>
      </div>

      <div id="lienzo-target-dropzone" class="lienzo-target-dropzone">
        <img
          class="lienzo-card-image"
          src="${escapeHtml(getCardImageSrc(play?.card_rank, play?.card_suit))}"
          alt="${escapeHtml(`K${getSuitSymbol(play?.card_suit)}`)}"
        />
      </div>
    </section>
  `;
    }

    function renderRQFBanner(play) {
        const message = getRQFMessage(play);

        return `
    <section class="lienzo-panel panel--split-top">
      <div class="panel-topbar">
        <div class="panel-topbar__col panel-topbar__col--identity">
          <div class="lienzo-target-header__name">
            ${escapeHtml(message.title)}
          </div>
        </div>

        <div class="panel-topbar__col panel-topbar__col--actions">
          <button
            id="lienzo-rqf-exit-btn"
            class="icon-btn"
            type="button"
            title="Salir"
            aria-label="Salir"
          >
            <img src="/assets/icons/exit80.gif" alt="Salir" />
          </button>
        </div>
      </div>

      <div style="padding: 14px 20px; text-align: center; font-size: 18px; line-height: 1.5;">
        ${escapeHtml(message.body)}
      </div>
    </section>
  `;
    }

    function renderLienzoRQF(play) {
        const container = getLienzoContainer();
        if (!container || !play) return;

        const rank = normalizeRank(play?.card_rank || play?.rank);
        if (rank !== "K") {
            container.innerHTML = `
      <div class="lienzo-error">
        La jugada ${escapeHtml(play?.id)} no es una K.
      </div>
    `;
            return;
        }

        container.innerHTML = `
    ${renderDeckHeader(play)}

    <div style="margin-bottom: 18px;">
      ${renderRQFBanner(play)}
    </div>

    <div class="lienzo-grid">
      <div id="colombes" class="lienzo-grid__left">
        ${renderRQFSourcePanel(play)}
      </div>

      <div id="amsterdam" class="lienzo-grid__right">
        ${renderRQFTargetPanel(play)}
      </div>
    </div>
  `;

        mountPlacardFromDataset(play);
        bindRQFActions(play);
    }

    window.renderLienzoRQF = renderLienzoRQF;
})();