const Seed = (() => {
  function freshDB() {
    const u1 = Store.uid("U");
    const u2 = Store.uid("U");
    const u3 = Store.uid("U");
    const d1 = Store.uid("D");

    return {
      users: {
        [u1]: { id:u1, name:"Camilo", awards:{spades:0, diamonds:0, clubs:0}, stats:{completed:0, conflicts:0} },
        [u2]: { id:u2, name:"Ana",    awards:{spades:0, diamonds:0, clubs:0}, stats:{completed:0, conflicts:0} },
        [u3]: { id:u3, name:"Beto",   awards:{spades:0, diamonds:0, clubs:0}, stats:{completed:0, conflicts:0} }
      },
      decks: {
        [d1]: { id:d1, name:"Asado generación 83", ownerId:u1, createdAt:new Date().toISOString() }
      },
      cards: {},
      transactions: {}
    };
  }

  function ensure() {
    let db = Store.get();
    if (!db) {
      db = freshDB();
      Store.set(db);
    }
    return db;
  }

  return { ensure, freshDB };
})();
