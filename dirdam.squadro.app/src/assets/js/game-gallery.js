/* Image gallery for the Squadro / Marco Polo pages: clicking a thumbnail
   swaps it into the large view (and updates its caption). */
document.addEventListener('DOMContentLoaded', function () {
  var main = document.getElementById('galleryMain');
  var caption = document.getElementById('galleryCaption');
  var thumbs = document.querySelectorAll('.gallery-thumb');
  if (!main || !thumbs.length) return;

  thumbs.forEach(function (thumb) {
    thumb.addEventListener('click', function () {
      main.src = thumb.getAttribute('data-src');
      if (caption) caption.textContent = thumb.getAttribute('data-caption') || '';
      thumbs.forEach(function (t) { t.setAttribute('aria-pressed', String(t === thumb)); });
    });
  });
});
