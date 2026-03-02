const Engine = (() => {

  // DB shape:
  // db = { users: {}, decks:{}, cards:{}, transactions:{} }

  function ensureUser(db, userId) {
    const u = db.users[userId];
    if (!u) throw new Error("Usuario inexistente: " + userId);
    if (!u.awards) u.awards = { spades:0, diamonds:0, clubs:0 };
    if (!u.stats) u.stats = { completed:0, conflicts:0 };
    return u;
  }

  function ensureDeck(db, deckId) {
    const d = db.decks[deckId];
    if (!d) throw new Error("Mazo inexistente: " + deckId);
    return d;
  }

  function txStatus(tx) { return tx.status; }

  function createOffer(db, { deckId, fromUserId, toUserId, suit, note }) {
    ensureDeck(db, deckId);
    ensureUser(db, fromUserId);
    ensureUser(db, toUserId);

    if (!["H","S","D","C"].includes(suit)) throw new Error("Palo inválido");
    // Para transacción: rank Q siempre
    const txId = Store.uid("T");
    const cardId = Store.uid("C");

    db.transactions[txId] = {
      id: txId,
      deckId,
      participants: [fromUserId, toUserId],
      status: "pending", // pending -> accepted -> completed | conflict
      cards: [cardId],
      createdAt: new Date().toISOString(),
      completedAt: null
    };

    db.cards[cardId] = {
      id: cardId,
      deckId,
      ownerId: fromUserId,
      rank: "Q",
      suit,                  // Q♥ Q♠ Q♦ Q♣ según palo
      transactionId: txId,
      status: "sent",
      note: note || ""
    };

    return { txId, cardId };
  }

  function acceptTransaction(db, { txId, byUserId }) {
    const tx = db.transactions[txId];
    if (!tx) throw new Error("Transacción inexistente");

    if (!tx.participants.includes(byUserId)) throw new Error("No participante");

    if (tx.status !== "pending") throw new Error("No aceptable en estado: " + tx.status);

    tx.status = "accepted";
    tx.acceptedAt = new Date().toISOString();
    tx.acceptedBy = byUserId;

    // todas las cartas Q pasan a accepted
    tx.cards.forEach(cid => {
      db.cards[cid].status = "accepted";
    });

    return tx;
  }

  function completeTransaction(db, { txId, confirmA, confirmB }) {
    // confirmA / confirmB: userId que confirman (simplificado)
    const tx = db.transactions[txId];
    if (!tx) throw new Error("Transacción inexistente");
    if (tx.status !== "accepted") throw new Error("Solo se completa si está accepted");

    const [u1, u2] = tx.participants;

    if (!((confirmA === u1 && confirmB === u2) || (confirmA === u2 && confirmB === u1))) {
      throw new Error("Confirmaciones inválidas (deben ser los 2 participantes)");
    }

    tx.status = "completed";
    tx.completedAt = new Date().toISOString();

    // Cambios de propiedad (MVP):
    // - Si hay una carta Q♦ (dinero) o Q♣ (bien), asumimos que “pasa” del owner al otro participante.
    // - Para no mutar el palo, solo cambiamos ownerId si corresponde.
    tx.cards.forEach(cid => {
      const c = db.cards[cid];
      c.status = "completed";
      if (c.suit === "D" || c.suit === "C") {
        const other = (c.ownerId === u1) ? u2 : u1;
        c.ownerId = other;
      }
    });

    // Awards: 1 por transacción cumplida, nunca por ♥
    // Regla: el award depende del “contenido transaccional”; si hay al menos una carta de S/D/C se premia ese tipo.
    const suitsInTx = new Set(tx.cards.map(cid => db.cards[cid].suit));
    const awardSuit = (suitsInTx.has("D") ? "diamonds" : (suitsInTx.has("C") ? "clubs" : (suitsInTx.has("S") ? "spades" : null)));

    if (awardSuit) {
      const ua = ensureUser(db, u1);
      const ub = ensureUser(db, u2);
      ua.awards[awardSuit] += 1;
      ub.awards[awardSuit] += 1;
      ua.stats.completed += 1;
      ub.stats.completed += 1;
    } else {
      // era solo ♥ (intención/texto): no award
      const ua = ensureUser(db, u1);
      const ub = ensureUser(db, u2);
      ua.stats.completed += 1;
      ub.stats.completed += 1;
    }

    return tx;
  }

  function declareConflict(db, { txId, byUserId, reason }) {
    const tx = db.transactions[txId];
    if (!tx) throw new Error("Transacción inexistente");
    if (!tx.participants.includes(byUserId)) throw new Error("No participante");

    if (tx.status === "completed") throw new Error("No podés poner conflicto a una completed");

    tx.status = "conflict";
    tx.conflictAt = new Date().toISOString();
    tx.conflictBy = byUserId;
    tx.conflictReason = reason || "";

    tx.cards.forEach(cid => db.cards[cid].status = "conflict");

    // conflictos no restan, pero cuentan
    tx.participants.forEach(uid => {
      const u = ensureUser(db, uid);
      u.stats.conflicts += 1;
    });

    return tx;
  }

  function addCardToTransaction(db, { txId, ownerId, suit, note }) {
    const tx = db.transactions[txId];
    if (!tx) throw new Error("Transacción inexistente");
    ensureUser(db, ownerId);
    if (!tx.participants.includes(ownerId)) throw new Error("El owner debe ser participante");
    if (tx.status !== "pending") throw new Error("Solo se agregan cartas en pending (MVP)");

    const cardId = Store.uid("C");
    db.cards[cardId] = {
      id: cardId,
      deckId: tx.deckId,
      ownerId,
      rank: "Q",
      suit,
      transactionId: txId,
      status: "sent",
      note: note || ""
    };
    tx.cards.push(cardId);
    return cardId;
  }

  return {
    createOffer,
    acceptTransaction,
    completeTransaction,
    declareConflict,
    addCardToTransaction,
    txStatus
  };
})();
