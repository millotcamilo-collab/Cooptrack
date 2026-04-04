(function () {
  const PLAY_HELP = {
    A_HEART: {
      title: "A♥ · Fundación del mazo",
      body: `
        La jugada A♥ comprende el origen institucional de un mazo y se juega una sola vez.

        La jugada puede ser salvada si tiene un título, pero para ser aprobada, debe contener imagen y moneda.

        Una vez aprobada, solo será editable la imagen del mazo. Y se le otorgarán al autor los 3 ases restantes que definen las autoridades máximas del mazo.

        A su creador se le otorgará la propiedad instransferible del A♥, que le otorga el titulo "Editor" del mazo. Se le entregará además A♠, A♦ y A♣ que le otorgará los roles adicionales de Gerente, Tesorero y Anfitrión respectivamente
      `
    },

    A_SPADE: {
      title: "A♠ · Autoridad máxima en actividades",
      body: `
        El As de picas representa la autoridad máxima en materia de actividades.

        Será el responsable de la planificación y ejecución de las actividades del mazo. O sea, de las J♠.
      `
    },

    A_DIAMOND: {
      title: "A♦ · Autoridad económica",
      body: `
        El As de diamante representa la autoridad económica del mazo.

        Su titular puede aprobar las jugadas representadas en la J♦ y en las Q♥ o Q♦.
      `
    },

    A_CLUB: {
      title: "A♣ · Relaciones públicas",
      body: `
        El As de trébol es el único autorizado a aprobar jugadas que impliquen comunicaciones entre miembros del mazo o con terceros.
      `
    },

    J_HEART: {
      title: "J♥ · Anotación",
      body: `
        La J♥ representa una anotación.

        Se crea escribiendo un texto en el formulario +J y haciendo clic en corazón.

        Mientras no esté aprobada:
        - puede editarse,
        - puede transformarse a otros palos,
        - puede borrarse.

        La aprobación solo la puede ejecutar el titular del As de corazón.

        Una vez aprobada, queda fijada como anotación del mazo y será visible a todos sus miembros sin distinción.
      `
    },

    J_SPADE: {
      title: "J♠ · Actividad",
      body: `
        La J♠ representa una actividad.

        Se crea escribiendo un texto en el formulario +J y haciendo clic en pica.

        Puede tomar dos formas:
        - Cita: requiere fecha de inicio y locación. Puede además llevar fecha fin.
        - Deadline: requiere fecha fin.

        Mientras no esté aprobada:
        - puede definirse su tipo,
        - puede editarse,
        - puede borrarse.

        La aprobación corresponde al titular del As de picas.
      `
    },

    J_CLUB: {
      title: "J♣ · Concepto de una factura",
      body: `
        La J♣ representa la definición de un bien o servicio.

        Puede ser una jugada suelta o hija de una J♠.

        Cuando es hija de una J♠, queda asociada a esa actividad.

        Si la jugada J♣ tiene una J♦ que contenga el monto, entonces puede aprobarse y queda registrada como una salida de caja del cash flow del mazo.
      `
    },

    J_DIAMOND: {
      title: "J♦ · Monto de una factura",
      body: `
        La J♣ que contiene la definición de un bien o servicio solo puede ser aprobada por el propietario del As de diamante si se ha completado el campo monto correspondiente en la J♦.

        La J♦ solo puede aparecer como complemento de una J♣.

        Es decir, la J♦ no puede ser origen de una jugada, sino más bien el cierre de la jugada J♣.
      `
    }
  };

  function getPlayHelp(helpKey) {
    return PLAY_HELP[helpKey] || {
      title: "Ayuda no disponible",
      body: "Todavía no hay una explicación registrada para esta jugada."
    };
  }

  function ensureHelpModal() {
    let modal = document.getElementById("play-help-modal");
    if (modal) return modal;

    modal = document.createElement("div");
    modal.id = "play-help-modal";
    modal.className = "play-help-modal is-hidden";
    modal.innerHTML = `
      <div class="play-help-modal__backdrop" data-action="close-help"></div>
      <div class="play-help-modal__dialog">
        <button
          type="button"
          class="play-help-modal__close"
          data-action="close-help"
          aria-label="Cerrar ayuda"
          title="Cerrar"
        >
          ×
        </button>

        <h3 class="play-help-modal__title" id="play-help-title"></h3>
        <div class="play-help-modal__body" id="play-help-body"></div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelectorAll('[data-action="close-help"]').forEach((el) => {
      el.addEventListener("click", closePlayHelp);
    });

    return modal;
  }

  function openPlayHelp(helpKey) {
    const modal = ensureHelpModal();
    const help = getPlayHelp(helpKey);

    const titleEl = modal.querySelector("#play-help-title");
    const bodyEl = modal.querySelector("#play-help-body");

    if (titleEl) titleEl.textContent = help.title || "Ayuda";
    if (bodyEl) {
      bodyEl.innerHTML = String(help.body || "")
        .trim()
        .split("\n")
        .map((line) => `<p>${line.trim()}</p>`)
        .join("");
    }

    modal.classList.remove("is-hidden");
  }

  function closePlayHelp() {
    const modal = document.getElementById("play-help-modal");
    if (!modal) return;
    modal.classList.add("is-hidden");
  }

  window.PLAY_HELP = PLAY_HELP;
  window.getPlayHelp = getPlayHelp;
  window.openPlayHelp = openPlayHelp;
  window.closePlayHelp = closePlayHelp;
})();
