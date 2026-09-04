/* Small glue script, loaded on every page after i18n.js and sticker.min.js. */
document.addEventListener('DOMContentLoaded', function () {
  // Bottom-right home-link widget (unchanged from the old site).
  if (window.Sticker) Sticker.init('.sticker');

  // Highlight the current page in the nav (including inside a dropdown
  // menu, in which case the group's trigger pill gets highlighted too so
  // a visitor can tell which group they're in without opening it).
  var here = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.site-nav a[href]').forEach(function (a) {
    var target = a.getAttribute('href').split('/').pop().split('#')[0];
    if (target !== here) return;
    a.setAttribute('aria-current', 'page');
    var group = a.closest('.nav-dropdown');
    if (group) {
      var trigger = group.querySelector('.nav-dropdown-trigger');
      if (trigger) trigger.classList.add('is-current-group');
    }
  });

  // Footer year.
  var yearEl = document.getElementById('footerYear');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // Nav group dropdowns — open on hover via CSS alone, but also toggle on
  // click/tap (for touch devices and keyboard users) with outside-click
  // and Escape to close, and only one open at a time.
  var dropdowns = document.querySelectorAll('.nav-dropdown');
  if (!dropdowns.length) return;

  function closeAll(except) {
    dropdowns.forEach(function (d) {
      if (d === except) return;
      d.classList.remove('is-open');
      var t = d.querySelector('.nav-dropdown-trigger');
      if (t) t.setAttribute('aria-expanded', 'false');
    });
  }

  dropdowns.forEach(function (dropdown) {
    var trigger = dropdown.querySelector('.nav-dropdown-trigger');
    if (!trigger) return;
    trigger.addEventListener('click', function (e) {
      e.stopPropagation();
      var willOpen = !dropdown.classList.contains('is-open');
      closeAll(dropdown);
      dropdown.classList.toggle('is-open', willOpen);
      trigger.setAttribute('aria-expanded', String(willOpen));
    });
  });

  document.addEventListener('click', function () { closeAll(); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeAll();
  });
});
