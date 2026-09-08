/* Games page: one highlighted game card whose content is swapped by
   clicking a thumbnail in the picker row below it. Ported from the
   hex-grid/highlight-container pattern on dirdam.github.io's games page.
   No-op if the page has no #gamePicker (e.g. any page other than Games). */
document.addEventListener('DOMContentLoaded', function () {
  const picker = document.getElementById('gamePicker');
  if (!picker) return;

  const buttons = Array.from(picker.querySelectorAll('.game-picker-item'));
  const highlightLink = document.getElementById('gameHighlightLink');
  const highlightImg = document.getElementById('gameHighlightImg');
  const highlightTitle = document.getElementById('gameHighlightTitle');
  const highlightDesc = document.getElementById('gameHighlightDesc');
  const highlightNote = document.getElementById('gameHighlightNote');

  function applyButton(btn) {
    const titleKey = btn.getAttribute('data-title-key');
    const title = titleKey ? window.I18N.t(titleKey) : btn.getAttribute('data-title');
    const descKey = btn.getAttribute('data-desc-key');
    const noteKey = btn.getAttribute('data-note-key');

    highlightLink.href = btn.getAttribute('data-link');
    highlightLink.setAttribute('aria-label', title);
    highlightImg.src = btn.getAttribute('data-img');

    if (titleKey) highlightTitle.setAttribute('data-i18n', titleKey);
    else highlightTitle.removeAttribute('data-i18n');
    highlightTitle.textContent = title;

    highlightDesc.setAttribute('data-i18n', descKey);
    highlightDesc.textContent = window.I18N.t(descKey);

    if (noteKey) {
      highlightNote.hidden = false;
      highlightNote.setAttribute('data-i18n-html', noteKey);
      highlightNote.innerHTML = window.I18N.t(noteKey);
    } else {
      highlightNote.hidden = true;
      highlightNote.removeAttribute('data-i18n-html');
      highlightNote.innerHTML = '';
    }
  }

  function selectButton(btn) {
    buttons.forEach(function (b) { b.setAttribute('aria-pressed', String(b === btn)); });
    applyButton(btn);
  }

  buttons.forEach(function (btn) {
    btn.addEventListener('click', function () { selectButton(btn); });
  });

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
