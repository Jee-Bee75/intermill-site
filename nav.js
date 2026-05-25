/*!
 * InterMill nav-interacties (mobile dropdown tap-toggle)
 * Vervangt hover-only gedrag dat op iOS niet werkt.
 */
(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    var dropdowns = document.querySelectorAll('.nav-dropdown');
    if (!dropdowns.length) return;

    dropdowns.forEach(function (dd) {
      var trigger = dd.querySelector('.nav-trigger');
      if (!trigger) return;
      trigger.setAttribute('aria-expanded', 'false');

      trigger.addEventListener('click', function (e) {
        e.stopPropagation();
        // Sluit andere open dropdowns
        dropdowns.forEach(function (other) {
          if (other !== dd) {
            other.classList.remove('open');
            var t = other.querySelector('.nav-trigger');
            if (t) t.setAttribute('aria-expanded', 'false');
          }
        });
        var isOpen = dd.classList.toggle('open');
        trigger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      });

      // Toetsenbord: Escape sluit
      dd.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
          dd.classList.remove('open');
          trigger.setAttribute('aria-expanded', 'false');
          trigger.focus();
        }
      });
    });

    // Klik buiten dropdown → sluit alle
    document.addEventListener('click', function (e) {
      dropdowns.forEach(function (dd) {
        if (!dd.contains(e.target)) {
          dd.classList.remove('open');
          var t = dd.querySelector('.nav-trigger');
          if (t) t.setAttribute('aria-expanded', 'false');
        }
      });
    });
  });
})();
