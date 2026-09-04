/* View-count badges for the Apps grid (Exploring page). Ported from the live
   dirdam.squadro.app "My Apps" page: /view-counts.json is written
   server-side by view-counts/update_view_counts.py from nginx's access log
   on a cron schedule, keyed by each app's own request path (e.g. "stocks",
   "solis") — unaffected by this page moving off the domain root. A
   missing/zero count (no cron run yet, unrecognized app, or a failed fetch)
   just leaves that badge hidden rather than showing a stale "0". */
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
    })
    .catch(function () {});
});
