const Store = (() => {
  const KEY = "cooptrack_mvp_v1";

  function uid(prefix="") {
    return prefix + Math.random().toString(16).slice(2, 10) + Date.now().toString(16).slice(-6);
  }

  function load() {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  }

  function save(db) {
    localStorage.setItem(KEY, JSON.stringify(db));
  }

  function reset() {
    localStorage.removeItem(KEY);
  }

  function get() {
    const db = load();
    if (!db) return null;
    return db;
  }

  function set(db) {
    save(db);
  }

  return { uid, load, save, reset, get, set, KEY };
})();
