/* Games page: one highlighted game card whose content is swapped by
   clicking a thumbnail in the picker row below it. Ported from the
   hex-grid/highlight-container pattern on dirdam.github.io's games page.
   No-op if the page has no #gamePicker (e.g. any page other than Games). */
document.addEventListener('DOMContentLoaded', function () {
  const picker = document.getElementById('gamePicker');
  if (!picker) return;

  const buttons = Array.from(picker.querySelectorAll('.game-picker-item'));
  const highlightCard = document.getElementById('gameHighlight');
  const highlightLink = document.getElementById('gameHighlightLink');
  const highlightImg = document.getElementById('gameHighlightImg');
  const highlightTitle = document.getElementById('gameHighlightTitle');
  const highlightDesc = document.getElementById('gameHighlightDesc');
  const highlightNote = document.getElementById('gameHighlightNote');
  const highlightNoteText = document.getElementById('gameHighlightNoteText');

  // Per-game background: main/accent colors are hand-picked per game
  // (sampled directly off each thumbnail's own background and logo text)
  // rather than auto-detected — see the data-main-color/data-accent-color
  // attributes on each button in games.html. Only the text color (dark
  // ink vs. off-white, for contrast against whatever the main color is)
  // gets computed here, from the main color's luminance.
  function hexToRgb(hex) {
    const value = parseInt(hex.replace('#', ''), 16);
    return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
  }

  function applyPalette(btn) {
    const main = btn.getAttribute('data-main-color');
    const accent = btn.getAttribute('data-accent-color');
    if (main) {
      const rgb = hexToRgb(main);
      const luminance = 0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b;
      highlightCard.style.setProperty('--game-main', main);
      highlightCard.style.setProperty('--game-text', luminance > 150 ? '#241a08' : '#faf6ee');
    } else {
      highlightCard.style.removeProperty('--game-main');
      highlightCard.style.removeProperty('--game-text');
    }
    if (accent) highlightCard.style.setProperty('--game-accent', accent);
    else highlightCard.style.removeProperty('--game-accent');
  }

  function applyButton(btn) {
    const titleKey = btn.getAttribute('data-title-key');
    const title = titleKey ? window.I18N.t(titleKey) : btn.getAttribute('data-title');
    const descKey = btn.getAttribute('data-desc-key');
    const noteKey = btn.getAttribute('data-note-key');

    highlightLink.href = btn.getAttribute('data-link');
    highlightLink.setAttribute('aria-label', title);
    highlightImg.src = btn.getAttribute('data-img');
    applyPalette(btn);

    if (titleKey) highlightTitle.setAttribute('data-i18n', titleKey);
    else highlightTitle.removeAttribute('data-i18n');
    highlightTitle.textContent = title;

    highlightDesc.setAttribute('data-i18n', descKey);
    highlightDesc.textContent = window.I18N.t(descKey);

    if (noteKey) {
      highlightNote.hidden = false;
      highlightNoteText.setAttribute('data-i18n-html', noteKey);
      highlightNoteText.innerHTML = window.I18N.t(noteKey);
    } else {
      highlightNote.hidden = true;
      highlightNoteText.removeAttribute('data-i18n-html');
      highlightNoteText.innerHTML = '';
    }
  }

  function selectButton(btn) {
    buttons.forEach(function (b) { b.setAttribute('aria-pressed', String(b === btn)); });
    applyButton(btn);
  }

  buttons.forEach(function (btn) {
    btn.addEventListener('click', function () { selectButton(btn); });
  });

  // The initially-highlighted game's content is already correct in the
  // static HTML (no need to re-render it), but its themed colors only
  // exist once this script samples them, so kick that off for whichever
  // button starts pressed.
  const initialActive = buttons.find(function (b) { return b.getAttribute('aria-pressed') === 'true'; });
  if (initialActive) applyPalette(initialActive);

  // Re-render whichever game is currently shown when the language changes,
  // since its data-i18n/data-i18n-html keys live on the highlight card and
  // I18N's own applyStaticDict() pass already re-renders those in place —
  // this only needs to refresh the plain-JS title/aria-label, and the note's
  // hidden/visible + href/img state, which aren't driven by data-i18n.
  window.I18N.onLangChange(function () {
    const active = buttons.find(function (b) { return b.getAttribute('aria-pressed') === 'true'; });
    if (active) applyButton(active);
  });
});
