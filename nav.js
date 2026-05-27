/*!
 * InterMill nav-interacties — close-on-outside-click + Escape voor <details>/<summary> dropdown.
 * Toggle zelf is native (geen JS nodig).
 */
(function () {
  'use strict';

  function init() {
    var dropdowns = document.querySelectorAll('details.nav-dropdown');
    if (!dropdowns.length) return;

    // Klik buiten dropdown → sluit alle open <details>
    document.addEventListener('click', function (e) {
      dropdowns.forEach(function (dd) {
        if (dd.open && !dd.contains(e.target)) {
          dd.removeAttribute('open');
        }
      });
    });

    // Escape sluit + focus terug op summary
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      dropdowns.forEach(function (dd) {
        if (dd.open) {
          dd.removeAttribute('open');
          var s = dd.querySelector('summary');
          if (s) s.focus();
        }
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
