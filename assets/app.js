// Small bits of "dynamic": the feed below the top story and every ad box reshuffle on each load,
// so the front page looks fresh between rebuilds. Share uses the Web Share API with a copy fallback.
(function () {
  function shuffle(container) {
    var kids = Array.prototype.slice.call(container.children);
    for (var i = kids.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = kids[i]; kids[i] = kids[j]; kids[j] = t;
    }
    kids.forEach(function (k) { container.appendChild(k); });
  }
  document.querySelectorAll('[data-shuffle="feed"]').forEach(shuffle);
  document.querySelectorAll('[data-shuffle="ads"] .chum-grid').forEach(shuffle);

  document.querySelectorAll('[data-share]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var data = { title: btn.getAttribute('data-title'), url: location.href };
      if (navigator.share) { navigator.share(data).catch(function () {}); return; }
      if (navigator.clipboard) {
        navigator.clipboard.writeText(location.href).then(function () {
          var old = btn.textContent; btn.textContent = 'Link copied';
          setTimeout(function () { btn.textContent = old; }, 1500);
        });
      }
    });
  });
})();
