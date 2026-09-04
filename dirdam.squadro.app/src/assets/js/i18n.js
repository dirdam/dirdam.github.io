/* Shared i18n module. This site is one cohesive multi-page build (single
   build.py, single atomic deploy) rather than a federation of independently
   deployed apps, so — unlike the per-app-duplicated snippet documented in
   all-my-games/.claude/skills/i18n-subpath-app.md (written to avoid version
   skew between independently deployed apps with no shared build step) — one
   shared file here carries no skew risk: every page is regenerated from it
   on every build. The public API, storage key, attribute conventions, and
   detection order intentionally match that skill exactly, so the pattern
   reads the same way across every dirdam.squadro.app property and could be
   inlined back into a single app's own <script> with no behavior change.

   Usage per page:
     <script src="/assets/js/i18n.js"></script>
     <script>const STRINGS = {...}; I18N.init(STRINGS);</script>
   Markup:
     data-i18n="key"                       -> element.textContent
     data-i18n="key" data-i18n-attr="href" -> element.setAttribute('href', ...)
     data-i18n-html="key"                  -> element.innerHTML
*/
window.I18N = (function () {
  const STORAGE_KEY = 'dirdam-lang';
  const SUPPORTED_LANGS = ['en', 'es', 'ja'];
  const LANG_LABELS = { en: 'EN', es: 'ES', ja: '日本語' };

  let currentLang = detectInitialLang();
  let dict = {};
  const listeners = [];

  function detectInitialLang() {
    const urlLang = new URLSearchParams(location.search).get('lang');
    if (SUPPORTED_LANGS.includes(urlLang)) return urlLang;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (SUPPORTED_LANGS.includes(stored)) return stored;
    const browserLang = (navigator.language || 'en').slice(0, 2);
    return SUPPORTED_LANGS.includes(browserLang) ? browserLang : 'en';
  }

  function t(key) {
    return (dict[currentLang] && dict[currentLang][key]) ?? (dict.en && dict.en[key]) ?? key;
  }

  function applyStaticDict() {
    // Elements needing inline HTML (e.g. <strong>/<em> emphasis inside a
    // translated sentence) carry the key on data-i18n-html instead of
    // data-i18n, so they get their own selector/pass.
    document.querySelectorAll('[data-i18n-html]').forEach((el) => {
      el.innerHTML = t(el.getAttribute('data-i18n-html'));
    });
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const val = t(el.getAttribute('data-i18n'));
      const attr = el.getAttribute('data-i18n-attr');
      if (attr) el.setAttribute(attr, val);
      else el.textContent = val;
    });
  }

  function setLang(lang) {
    if (!SUPPORTED_LANGS.includes(lang) || lang === currentLang) return;
    currentLang = lang;
    localStorage.setItem(STORAGE_KEY, lang);
    document.documentElement.lang = lang;
    applyStaticDict();
    listeners.forEach((fn) => fn(lang));
  }

  function onLangChange(fn) {
    listeners.push(fn);
  }

  function renderToggle() {
    // Rendered into every `.lang-toggle` on the page at once — there are
    // normally two (one in the sticky nav bar, one in the footer), with
    // CSS media queries deciding which is actually visible at a given
    // viewport width, so both must always stay in sync.
    document.querySelectorAll('.lang-toggle').forEach((el) => {
      el.innerHTML = '';
      SUPPORTED_LANGS.forEach((lang) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = LANG_LABELS[lang];
        btn.setAttribute('aria-pressed', String(lang === currentLang));
        btn.addEventListener('click', () => setLang(lang));
        el.appendChild(btn);
      });
    });
  }

  function init(pageDict) {
    dict = pageDict || {};
    document.documentElement.lang = currentLang;
    applyStaticDict();
    renderToggle();
    onLangChange(() => renderToggle());
  }

  return {
    init: init,
    t: t,
    setLang: setLang,
    getLang: function () { return currentLang; },
    onLangChange: onLangChange,
    SUPPORTED_LANGS: SUPPORTED_LANGS,
  };
})();
