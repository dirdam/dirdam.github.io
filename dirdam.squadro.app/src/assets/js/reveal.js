/* Scroll-reveal: fades/rises each landing-page block (and each content
   section on inner pages) into place as it enters the viewport, instead of
   the whole page just appearing at once. Progressive enhancement — see the
   `.has-reveal` rules in components.css for the no-JS fallback. */
(function () {
  var targets = document.querySelectorAll('.card-block, .content-card');
  if (!targets.length) return;

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  document.documentElement.classList.add('has-reveal');

  if (reduceMotion || !('IntersectionObserver' in window)) {
    targets.forEach(function (el) { el.classList.add('is-visible'); });
    return;
  }

  var io = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -60px 0px' }
  );

  targets.forEach(function (el) { io.observe(el); });
})();
