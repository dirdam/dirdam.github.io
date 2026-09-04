/* Category filter for the Apps grid (Exploring page). Ported from the live
   dirdam.squadro.app "My Apps" page. Chips toggle independently (OR logic —
   a card shows if it matches ANY active chip); no chips active shows
   everything. No-op if the page has no #filterBar (e.g. any page other than
   Exploring). */
document.addEventListener('DOMContentLoaded', function () {
  const filterBar = document.getElementById('filterBar');
  if (!filterBar) return;

  const activeBadges = new Set();
  const toolCards = document.querySelectorAll('.tool-card');

  function updateCardVisibility() {
    toolCards.forEach(function (card) {
      const badges = (card.getAttribute('data-badges') || '').split(/\s+/).filter(Boolean);
      const visible = activeBadges.size === 0 || badges.some(function (b) { return activeBadges.has(b); });
      card.style.display = visible ? '' : 'none';
    });
  }

  filterBar.querySelectorAll('.filter-chip').forEach(function (chip) {
    chip.addEventListener('click', function () {
      const badge = chip.getAttribute('data-badge');
      const wasActive = chip.getAttribute('aria-pressed') === 'true';
      chip.setAttribute('aria-pressed', String(!wasActive));
      wasActive ? activeBadges.delete(badge) : activeBadges.add(badge);
      updateCardVisibility();
    });
  });
});
