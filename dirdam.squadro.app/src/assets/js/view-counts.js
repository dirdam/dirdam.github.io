/* View-count badges for the Apps grid (Exploring page). Ported from the live
   dirdam.squadro.app "My Apps" page: /view-counts.json is written
   server-side by view-counts/update_view_counts.py from nginx's access log
   on a cron schedule, keyed by each app's own request path (e.g. "stocks",
   "solis") — unaffected by this page moving off the domain root. A
   missing/zero count (no cron run yet, unrecognized app, or a failed fetch)
   just leaves that badge hidden rather than showing a stale "0".

   The grid is also re-sorted by that same view count, most-viewed first, so
   ranking always reflects the live numbers rather than whatever fixed order
   the cards happen to be written in — no rebuild/redeploy needed when the
   counts change. Cards with no tracked view count (e.g. externally-hosted
   apps with no view-badge) count as 0 and sort to the bottom, keeping their
   relative order; the "coming soon" placeholder always stays last. */
document.addEventListener('DOMContentLoaded', function () {
  const badges = document.querySelectorAll('.view-badge');
  if (!badges.length) return;

  fetch('/view-counts.json', { cache: 'no-store' })
    .then(function (res) { return res.ok ? res.json() : null; })
    .then(function (data) {
      if (!data || !data.views) return;
      badges.forEach(function (badge) {
        const count = data.views[badge.getAttribute('data-app')];
        if (!count) return;
        badge.querySelector('.view-count').textContent = count.toLocaleString();
        badge.classList.add('visible');
      });
      sortCardsByViews(data.views);
    })
    .catch(function () {});
});

function sortCardsByViews(views) {
  const grid = document.querySelector('.tools-grid');
  if (!grid) return;
  const cards = Array.prototype.slice.call(grid.children);
  const viewsFor = function (card) {
    const badge = card.querySelector('.view-badge');
    const app = badge && badge.getAttribute('data-app');
    return (app && views[app]) || 0;
  };
  const ranked = cards
    .filter(function (card) { return !card.classList.contains('coming-soon'); })
    .map(function (card, i) { return { card: card, i: i, v: viewsFor(card) }; })
    .sort(function (a, b) { return b.v - a.v || a.i - b.i; })
    .map(function (x) { return x.card; });
  const comingSoon = cards.filter(function (card) { return card.classList.contains('coming-soon'); });
  ranked.concat(comingSoon).forEach(function (card) { grid.appendChild(card); });
}
