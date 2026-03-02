const UI = (() => {
  let selectedDeckId = null;
  let selectedTxId = null;

  function el(id){ return document.getElementById(id); }

  function suitGlyph(s){
    return ({H:"♥", S:"♠", D:"♦", C:"♣"})[s] || s;
  }

  function badgeForStatus(status){
    if (status === "completed") return `<span class="badge ok">completed</span>`;
    if (status === "conflict") return `<span class="badge warn">conflict</span>`;
    if (status === "accepted") return `<span class="badge">accepted</span>`;
    return `<span class="badge">pending</span>`;
  }

  function render() {
    const db = Store.get();
    if (!db) return;

    // deck select
    const decks = Object.values(db.decks);
    if (!selectedDeckId && decks.length) selectedDeckId = decks[0].id;

    el("deckSelect").innerHTML = decks.map(d => `
      <option value="${d.id}" ${d.id===selectedDeckId ? "selected":""}>${d.name}</option>
    `).join("");

    // users
    el("users").innerHTML = Object.values(db.users).map(u => `
      <div class="item">
        <div class="row">
          <div><strong>${u.name}</strong> <span class="muted">${u.id}</span></div>
        </div>
        <div class="row" style="margin-top:6px">
          <div class="muted">Awards</div>
          <div class="muted">
            ♠ ${u.awards?.spades ?? 0} &nbsp; ♦ ${u.awards?.diamonds ?? 0} &nbsp; ♣ ${u.awards?.clubs ?? 0}
          </div>
        </div>
        <div class="row" style="margin-top:4px">
          <div class="muted">Stats</div>
          <div class="muted">completed ${u.stats?.completed ?? 0} • conflicts ${u.stats?.conflicts ?? 0}</div>
        </div>
      </div>
    `).join("");

    // tx list for deck
    const txs = Object.values(db.transactions).filter(t => t.deckId === selectedDeckId)
      .sort((a,b) => (b.createdAt||"").localeCompare(a.createdAt||""));

    el("txList").innerHTML = txs.length ? txs.map(tx => {
      const [a,b] = tx.participants.map(id => db.users[id]?.name || id);
      const suits = [...new Set(tx.cards.map(cid => db.cards[cid]?.suit).filter(Boolean))].map(suitGlyph).join(" ");
      return `
        <div class="item ${tx.id===selectedTxId ? "active":""}" data-tx="${tx.id}">
          <div class="row">
            <div><strong>${a}</strong> ↔ <strong>${b}</strong></div>
            ${badgeForStatus(tx.status)}
          </div>
          <div class="row" style="margin-top:6px">
            <div class="muted">${tx.id}</div>
            <div class="muted">${suits || "—"}</div>
          </div>
        </div>
      `;
    }).join("") : `<div class="muted">No hay transacciones en este mazo.</div>`;

    // detail
    renderDetail();
  }

  function renderDetail() {
    const db = Store.get();
    if (!db) return;

    if (!selectedTxId) {
      el("detail").innerHTML = `<div class="muted">Seleccioná una transacción…</div>`;
      return;
    }
    const tx = db.transactions[selectedTxId];
    if (!tx) { selectedTxId = null; render(); return; }

    const [u1,u2] = tx.participants;
    const name1 = db.users[u1]?.name || u1;
    const name2 = db.users[u2]?.name || u2;

    const cardsHtml = tx.cards.map(cid => {
      const c = db.cards[cid];
      if (!c) return "";
      return `
        <div class="item">
          <div class="row">
            <div><strong>${c.rank}${suitGlyph(c.suit)}</strong> <span class="muted">${c.id}</span></div>
            <span class="badge">${c.status}</span>
          </div>
          <div class="row" style="margin-top:6px">
            <div class="muted">owner</div>
            <div class="muted">${db.users[c.ownerId]?.name || c.ownerId}</div>
          </div>
          ${c.note ? `<div class="muted" style="margin-top:6px">${c.note}</div>` : ""}
        </div>
      `;
    }).join("");

    const actions = buildActions(tx);

    el("detail").innerHTML = `
      <div class="row">
        <div><strong>${name1}</strong> ↔ <strong>${name2}</strong></div>
        ${badgeForStatus(tx.status)}
      </div>
      <div class="muted" style="margin-top:6px">txId: <code>${tx.id}</code></div>
      <div class="muted">created: ${tx.createdAt || "—"}</div>

      <div class="actions">
        ${actions}
      </div>

      <h3 style="margin:14px 0 8px; font-size:14px; color:var(--muted)">Cartas</h3>
      <div class="list">${cardsHtml || `<div class="muted">—</div>`}</div>
    `;
  }

  function buildActions(tx) {
    // MVP: acciones “válidas” por estado (tu principio)
    const buttons = [];
    if (tx.status === "pending") {
      buttons.push(`<button class="btn" data-act="accept">Aceptar</button>`);
      buttons.push(`<button class="btn" data-act="addcard">Agregar Q</button>`);
      buttons.push(`<button class="btn danger" data-act="conflict">Conflicto</button>`);
    } else if (tx.status === "accepted") {
      buttons.push(`<button class="btn" data-act="complete">Completar</button>`);
      buttons.push(`<button class="btn danger" data-act="conflict">Conflicto</button>`);
    } else if (tx.status === "conflict") {
      buttons.push(`<div class="muted">Conflicto declarado. (MVP: sin resolución automática)</div>`);
    } else if (tx.status === "completed") {
      buttons.push(`<div class="muted">Liquidada ✅</div>`);
    }
    return buttons.join("");
  }

  function wire() {
    // deck change
    el("deckSelect").addEventListener("change", (e) => {
      selectedDeckId = e.target.value;
      selectedTxId = null;
      render();
    });

    // click tx item
    el("txList").addEventListener("click", (e) => {
      const item = e.target.closest(".item[data-tx]");
      if (!item) return;
      selectedTxId = item.getAttribute("data-tx");
      render();
    });

    // actions in detail
    el("detail").addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-act]");
      if (!btn) return;
      const act = btn.getAttribute("data-act");
      handleAction(act);
    });
  }

  function handleAction(act) {
    const db = Store.get();
    const tx = db.transactions[selectedTxId];
    if (!tx) return;

    try {
      if (act === "accept") {
        // MVP: acepta el “otro” (simulamos el segundo participante)
        Engine.acceptTransaction(db, { txId: tx.id, byUserId: tx.participants[1] });
      }

      if (act === "addcard") {
        const suit = prompt("Palo para la nueva Q (H/S/D/C):", "D");
        if (!suit) return;
        const note = prompt("Nota:", "monto/entrega/etc");
        Engine.addCardToTransaction(db, { txId: tx.id, ownerId: tx.participants[0], suit: suit.toUpperCase(), note });
      }

      if (act === "complete") {
        Engine.completeTransaction(db, { txId: tx.id, confirmA: tx.participants[0], confirmB: tx.participants[1] });
      }

      if (act === "conflict") {
        const reason = prompt("Motivo del conflicto:", "No cumplido / desacuerdo");
        Engine.declareConflict(db, { txId: tx.id, byUserId: tx.participants[0], reason });
      }

      Store.set(db);
      render();
    } catch (err) {
      alert(err.message || String(err));
    }
  }

  function newOffer() {
    const db = Store.get();
    const deckId = selectedDeckId;

    const users = Object.values(db.users);
    const from = users[0]?.id;
    const to = users[1]?.id;

    const suit = prompt("Palo de la oferta Q (H/S/D/C):", "H");
    if (!suit) return;
    const note = prompt("Nota:", "Propuesta…");

    const { txId } = Engine.createOffer(db, {
      deckId,
      fromUserId: from,
      toUserId: to,
      suit: suit.toUpperCase(),
      note
    });

    Store.set(db);
    selectedTxId = txId;
    render();
  }

  return { render, wire, newOffer, setSelectedTx: (id)=>{selectedTxId=id;} };
})();
