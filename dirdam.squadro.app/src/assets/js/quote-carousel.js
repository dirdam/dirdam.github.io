/* Rotating press quotes on the Squadro / Marco Polo pages. Texts come from
   the page's STRINGS (quote0, quote1, ...) so they follow the language
   toggle; authors and per-quote display times are plain data attributes on
   .quote-carousel. */
document.addEventListener('DOMContentLoaded', function () {
  var box = document.querySelector('.quote-carousel');
  if (!box || !window.I18N) return;

  var count = parseInt(box.getAttribute('data-count'), 10);
  var authors = (box.getAttribute('data-authors') || '').split('|');
  var times = (box.getAttribute('data-times') || '').split(',').map(Number);
  var text = box.querySelector('.quote-text');
  var author = box.querySelector('.quote-author');
  var index = 0;
  var timer = null;

  function show() {
    text.innerHTML = I18N.t('quote' + index);
    author.textContent = authors[index] || '';
  }

  function next() {
    show();
    timer = setTimeout(function () {
      index = (index + 1) % count;
      next();
    }, (times[index] || 5) * 1000);
  }

  I18N.onLangChange(show);
  next();
});
