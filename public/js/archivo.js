(() => {
  const API_BASE_URL = "https://cooptrack-backend.onrender.com";

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function normalize(value) {
    return String(value || "").trim().toUpperCase();
  }

  function getSuitSymbol(suit) {
    const s = normalize(suit);
    if (s === "HEART") return "♥";
    if (s === "SPADE") return "♠";
    if (s === "DIAMOND") return "♦";
    if (s === "CLUB") return "♣";
    return "";
  }

  function getCardLabel(play) {
    const rank = normalize(play?.card_rank || play?.rank) || "?";
    const suit = getSuitSymbol(play?.card_suit || play?.suit);
    return `${rank}${suit}`;
  }

  function formatDate(value) {
    if (!value) return "—";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);

    return date.toLocaleString("es-UY", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function getDeckName(play) {
    return String(play?.deck_name || play?.deckName || "").trim();
  }

  function formatShortDateTime(value) {
    if (!value) return "—";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value ?? "");

    try {
      const parts = new Intl.DateTimeFormat("es-UY", {
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }).formatToParts(date);

      const map = {};
      parts.forEach((part) => {
        map[part.type] = part.value;
      });

      const weekday = String(map.weekday || "").replace(".", "");
      const day = map.day || "";
      const month = String(map.month || "").replace(".", "");
      const hour = map.hour || "";
      const minute = map.minute || "";

      const cap = (txt) =>
        txt ? txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase() : "";

      return `${cap(weekday)} ${day} ${cap(month)} ${hour}:${minute}`;
    } catch (error) {
      return String(value ?? "");
    }
  }


  function getHoursBetween(startValue, endValue) {
    if (!startValue || !endValue) return null;

    const start = new Date(startValue);
    const end = new Date(endValue);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;

    const diffMs = end.getTime() - start.getTime();
    if (diffMs <= 0) return null;

    const hours = diffMs / (1000 * 60 * 60);
    if (hours < 1) {
      const minutes = Math.round(diffMs / (1000 * 60));
      return `${minutes} min`;
    }

    const rounded = Math.round(hours * 10) / 10;
    return Number.isInteger(rounded) ? `${rounded} hr` : `${rounded} hr`;
  }

  function getAppointmentReadLabel(startValue, endValue, recurrenceType, weekdays, months) {
    const startLabel = formatShortDateTime(startValue);
    const durationLabel = getHoursBetween(startValue, endValue);

    const baseLabel = durationLabel
      ? `${startLabel} – ${durationLabel}`
      : startLabel;

    if (!recurrenceType) return baseLabel;

    const recurrenceTypeUpper = String(recurrenceType || "").toUpperCase();
    const weekdaysList = Array.isArray(weekdays) ? weekdays : [];
    const monthsList = Array.isArray(months) ? months : [];

    const recurrenceSuffix = [];
    if (recurrenceTypeUpper === "WEEKLY" && weekdaysList.length) {
      const days = {
        MON: "Lun",
        TUE: "Mar",
        WED: "Mié",
        THU: "Jue",
        FRI: "Vie",
        SAT: "Sáb",
        SUN: "Dom",
      };
      recurrenceSuffix.push(
        weekdaysList
          .map((d) => days[String(d).toUpperCase()] || String(d))
          .filter(Boolean)
          .join(", ")
      );
    }

    if (recurrenceTypeUpper === "MONTHLY" && monthsList.length) {
      const monthNames = {
        1: "Ene",
        2: "Feb",
        3: "Mar",
        4: "Abr",
        5: "May",
        6: "Jun",
        7: "Jul",
        8: "Ago",
        9: "Sep",
        10: "Oct",
        11: "Nov",
        12: "Dic",
      };
      recurrenceSuffix.push(
        monthsList
          .map((m) => monthNames[Number(m)] || String(m))
          .filter(Boolean)
          .join(", ")
      );
    }

    return recurrenceSuffix.length ? `${baseLabel} · ${recurrenceSuffix.join(" · ")}` : baseLabel;
  }

  function getArchiveStatusLabel(play) {
    const status = normalize(play?.play_status);
    if (status === "REJECTED") return "Rechazada";
    if (status === "CANCELLED") return "Cancelada";
    return "Archivada";
  }

  function getFormattedAmount(play) {
    const amount = play?.amount;
    if (amount === undefined || amount === null || amount === "") return "";

    const currencySymbol = String(play?.currency_symbol || play?.deck_currency_symbol || "").trim();
    const currencyName = String(play?.currency_name || play?.deck_currency_name || "").trim();
    const amountText = String(amount);

    if (currencySymbol) return `${currencySymbol} ${amountText}`;
    if (currencyName) return `${currencyName} ${amountText}`;
    return amountText;
  }

  function getQArchiveExtraCard(play) {
    const parts = String(play?.play_code || "").split("§");
    const flow = String(parts[7] || "").trim();

    const hasQHeart = flow
      .split(";")
      .map((item) => item.trim())
      .some((item) => item.startsWith("pay:QHEART"));

    if (!hasQHeart) return "";

    const status = normalize(play?.play_status);

    const extraSuit = status === "APPROVED" ? "♦" : "♥";

    return `<span class="archivo-q__extra-card">Q${extraSuit}</span>`;
  }

  function renderArchiveQCardLabel(play) {
    return `
    <div class="archivo-q__card-wrap">
      <span class="archivo-q__card-main">${escapeHtml(getCardLabel(play))}</span>
      ${getQArchiveExtraCard(play)}
    </div>
  `;
  }

  function renderArchivedQ(play) {
    const ICONS = window.ICONS || {};
    const ACTIONS = ICONS.actions || {};
    const startIcon = escapeHtml(ACTIONS.start || "");
    const bombIcon = escapeHtml(ACTIONS.bomb || "");
    const locationIcon = escapeHtml(ACTIONS.location || "");

    const parentText = String(play?.parent_play_text || "Sin J madre").trim();
    const parentMode = normalize(play?.parent_spade_mode);
    const parentDate = parentMode === "DEADLINE"
      ? formatShortDateTime(play?.parent_end_date)
      : getAppointmentReadLabel(play?.parent_start_date, play?.parent_end_date);

    const parentMetaParts = [];
    if (parentDate && parentDate !== "—") {
      const icon = parentMode === "DEADLINE" ? bombIcon : startIcon;
      parentMetaParts.push(`${icon}${icon ? " " : ""}${escapeHtml(parentDate)}`.trim());
    }
    if (play?.parent_location) {
      parentMetaParts.push(`${locationIcon}${locationIcon ? " " : ""}${escapeHtml(String(play.parent_location).trim())}`.trim());
    }

    const relatedUser = String(play?.target_user_nickname || play?.created_by_nickname || "Usuario").trim();
    const statusLabel = getArchiveStatusLabel(play);
    const amountLabel = getFormattedAmount(play);
    const deckName = getDeckName(play);

    return `
      <div class="archivo-q__child">
        <div class="archivo-q__card">
          ${renderArchiveQCardLabel(play)}
        </div>

        <div class="archivo-q__content">
          <div class="archivo-q__title">
            ${deckName
              ? `<strong class="archivo-deck-name">${escapeHtml(deckName)}</strong> · `
              : ""
            }
            ${escapeHtml(parentText)}
            ${parentMetaParts.length ? ` · ${escapeHtml(parentMetaParts.join(" · "))}` : ""}
            · ${escapeHtml(`${relatedUser} · ${statusLabel}`)}
            ${amountLabel ? ` · ${escapeHtml(amountLabel)}` : ""}
          </div>
        </div>
      </div>
    `;
  }

  function getArchiveTitle(play) {
    const rank = normalize(play?.card_rank);
    const status = normalize(play?.play_status);
    const targetName = play?.target_user_nickname || "destinatario";
    const sourceName = play?.created_by_nickname || "anfitrión";

    if (rank === "K") {
      if (status === "REJECTED") return `K rechazada por ${targetName}`;
      if (status === "QUIT") return `${targetName} renunció a una K`;
      if (status === "FIRED") return `${sourceName} despidió a ${targetName}`;
      return "K archivada";
    }

    if (rank === "A") {
      if (status === "REJECTED") return `Transferencia de A rechazada por ${targetName}`;
      if (status === "QUIT") return `Transferencia de A finalizada`;
      if (status === "FIRED") return `Transferencia de A cancelada`;
      return "A archivada";
    }

    if (rank === "Q") {
      if (status === "REJECTED") return `Q rechazada por ${targetName}`;
      if (status === "CANCELLED") return `Q cancelada por ${sourceName}`;
      return "Q archivada";
    }

    return "Jugada archivada";
  }

  function getArchiveMeta(play) {
    const parts = [];

    if (play?.deck_name) parts.push(`Mazo: ${play.deck_name}`);
    if (play?.play_status) parts.push(`Estado: ${play.play_status}`);
    if (play?.updated_at || play?.created_at) {
      parts.push(`Fecha: ${formatDate(play.updated_at || play.created_at)}`);
    }

    return parts.join(" · ");
  }

  function getArchiveHref(play) {
    const rank = normalize(play?.card_rank);
    const deckId = Number(play?.deck_id || 0);
    const playId = Number(play?.id || 0);

    if (!playId) return "#";

    if (rank === "K") {
      return `/lienzoRQF.html?deckId=${deckId}&playId=${playId}`;
    }

    if (rank === "A") {
      return `/lienzo.html?deckId=${deckId}&playId=${playId}`;
    }

    if (rank === "Q") {
      return `/lienzoQpica.html?deckId=${deckId}&playId=${playId}`;
    }

    return "#";
  }

  function renderArchivedK(play) {
    const relatedUser = String(
      play?.target_user_nickname ||
      play?.created_by_nickname ||
      "Usuario"
    ).trim();

    const deckName = getDeckName(play);
    const status = normalize(play?.play_status);

    let statusLabel = "Archivada";

    if (status === "QUIT") {
      statusLabel = "Renunció";
    } else if (status === "FIRED") {
      statusLabel = "Despedido";
    } else if (status === "REJECTED") {
      statusLabel = "Rechazada";
    }

    return `
      <div class="archivo-k__child">
        <div class="archivo-k__card">
          ${escapeHtml(getCardLabel(play))}
        </div>

        <div class="archivo-k__content">
          <div class="archivo-k__title">
            ${deckName
              ? `<strong class="archivo-deck-name">${escapeHtml(deckName)}</strong> · `
              : ""
            }
            ${escapeHtml(`${relatedUser} · ${statusLabel}`)}
          </div>
        </div>
      </div>
    `;
  }

  function renderArchivedA(play) {
    const relatedUser = String(
      play?.target_user_nickname ||
      play?.created_by_nickname ||
      "Usuario"
    ).trim();

    const deckName = getDeckName(play);
    const status = normalize(play?.play_status);

    let statusLabel = "Archivada";

    if (status === "QUIT") {
      statusLabel = "Transferida";
    } else if (status === "FIRED") {
      statusLabel = "Cancelada";
    } else if (status === "REJECTED") {
      statusLabel = "Rechazada";
    }

    return `
      <div class="archivo-a__child">
        <div class="archivo-a__card">
          ${escapeHtml(getCardLabel(play))}
        </div>

        <div class="archivo-a__content">
          <div class="archivo-a__title">
            ${deckName
              ? `<strong class="archivo-deck-name">${escapeHtml(deckName)}</strong> · `
              : ""
            }
            ${escapeHtml(`${relatedUser} · ${statusLabel}`)}
          </div>
        </div>
      </div>
    `;
  }

  function renderArchiveRow(play) {
    const href = getArchiveHref(play);
    const rank = normalize(play?.card_rank || play?.rank);

    if (rank === "Q") {
      return `
      <a class="tablero-row tablero-row--archived tablero-row--archive-q archivo-q" href="${escapeHtml(href)}">
        <div class="tablero-row__left"></div>
        <div class="tablero-row__center">
          ${renderArchivedQ(play)}
        </div>
        <div class="tablero-row__right"></div>
      </a>
    `;
    }

    if (rank === "K") {
      return `
      <a class="tablero-row tablero-row--archived archivo-k" href="${escapeHtml(href)}">
        <div class="tablero-row__left"></div>
        <div class="tablero-row__center">
          ${renderArchivedK(play)}
        </div>
        <div class="tablero-row__right"></div>
      </a>
    `;
    }
    if (rank === "A") {
      return `
      <a class="tablero-row tablero-row--archived archivo-a" href="${escapeHtml(href)}">
        <div class="tablero-row__left"></div>
        <div class="tablero-row__center">
          ${renderArchivedA(play)}
        </div>
        <div class="tablero-row__right"></div>
      </a>
    `;
    }

    return `
      <a class="tablero-row tablero-row--archived" href="${escapeHtml(href)}">
        <div class="tablero-row__left">
          <div class="tablero-row__card">${escapeHtml(getCardLabel(play))}</div>
        </div>

        <div class="tablero-row__center">
          <div class="tablero-row__title">
            ${escapeHtml(String(play?.play_text || getArchiveTitle(play)))}
          </div>

          <div class="tablero-row__meta">
            ${escapeHtml(getArchiveMeta(play))}
          </div>
        </div>

        <div class="tablero-row__right"></div>
      </a>
    `;
  }

  async function loadArchive() {
    const container = document.getElementById("archivo-container");
    if (!container) return;

    const token = localStorage.getItem("cooptrackToken");

    if (!token) {
      container.innerHTML = `
        <p class="tablero-archivado__empty">Tenés que iniciar sesión para ver el archivo.</p>
      `;
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/plays/archive`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.ok) {
        container.innerHTML = `
          <p class="tablero-archivado__empty">
            ${escapeHtml(data?.error || "No se pudo cargar el archivo.")}
          </p>
        `;
        return;
      }

      const plays = Array.isArray(data.plays) ? data.plays : [];

      if (!plays.length) {
        container.innerHTML = `
          <p class="tablero-archivado__empty">No hay jugadas archivadas para mostrar.</p>
        `;
        return;
      }

      container.innerHTML = plays.map(renderArchiveRow).join("");

    } catch (error) {
      console.error("Error cargando archivo:", error);

      container.innerHTML = `
        <p class="tablero-archivado__empty">Error cargando archivo.</p>
      `;
    }
  }

  document.addEventListener("DOMContentLoaded", loadArchive);
})();