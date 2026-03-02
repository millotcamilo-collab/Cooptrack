(() => {
  Seed.ensure();
  UI.wire();
  UI.render();

  document.getElementById("btnNewOffer").addEventListener("click", () => UI.newOffer());

  document.getElementById("btnReset").addEventListener("click", () => {
    if (!confirm("Resetear DB local?")) return;
    Store.reset();
    Seed.ensure();
    UI.setSelectedTx(null);
    UI.render();
  });
})();
