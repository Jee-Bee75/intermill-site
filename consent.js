/*!
 * InterMill cookie-consent banner (self-contained, no dependencies)
 * Stores choice 12 months in localStorage. Fires 'intermill:consent-granted'
 * event when user accepts — subscribe to it to lazy-load GA4 or similar.
 *
 * Public API:
 *   window.intermillConsent.show()       // re-open banner (revoke)
 *   window.intermillConsent.getChoice()  // 'accept' | 'decline' | null
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'intermill_consent';
  var EXPIRY_DAYS = 365;

  // Inject CSS once
  var css = '' +
    '.imc-banner{position:fixed;bottom:0;left:0;right:0;z-index:9999;' +
    'background:#0F0F0F;color:#FFFFFF;border-top:3px solid #FFDD00;' +
    'padding:18px 24px;box-shadow:0 -8px 24px rgba(0,0,0,0.2);' +
    'transform:translateY(100%);transition:transform .25s ease-out;' +
    'font-family:\'Manrope\',-apple-system,Segoe UI,Roboto,Arial,sans-serif}' +
    '.imc-banner.imc-show{transform:translateY(0)}' +
    '.imc-inner{max-width:1200px;margin:0 auto;display:grid;' +
    'grid-template-columns:1fr auto;gap:24px;align-items:center}' +
    '.imc-text{font-size:14px;line-height:1.5;color:#D4D4D4;max-width:64ch}' +
    '.imc-text strong{color:#FFFFFF;font-weight:700}' +
    '.imc-text a{color:#FFDD00;text-decoration:underline}' +
    '.imc-actions{display:flex;gap:10px;flex-shrink:0}' +
    '.imc-btn{font-family:inherit;font-size:13px;font-weight:700;' +
    'padding:11px 20px;border:2px solid;cursor:pointer;transition:opacity .15s;' +
    'letter-spacing:0.02em;white-space:nowrap}' +
    '.imc-btn:hover{opacity:0.85}' +
    '.imc-btn-accept{background:#FFDD00;border-color:#FFDD00;color:#0F0F0F}' +
    '.imc-btn-decline{background:transparent;border-color:#FFFFFF;color:#FFFFFF}' +
    '@media (max-width:700px){' +
    '.imc-banner{padding:14px 18px;padding-bottom:80px}' +
    '.imc-inner{grid-template-columns:1fr;gap:14px}' +
    '.imc-text{font-size:13px}' +
    '.imc-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}' +
    '.imc-btn{padding:12px 10px;font-size:12px;text-align:center;width:100%}' +
    '}';
  var style = document.createElement('style');
  style.setAttribute('data-imc', 'consent');
  style.textContent = css;
  document.head.appendChild(style);

  function getChoice() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (parsed.expires && Date.now() > parsed.expires) {
        localStorage.removeItem(STORAGE_KEY);
        return null;
      }
      return parsed.choice;
    } catch (e) {
      return null;
    }
  }

  function setChoice(choice) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        choice: choice,
        timestamp: Date.now(),
        expires: Date.now() + EXPIRY_DAYS * 24 * 60 * 60 * 1000
      }));
    } catch (e) { /* localStorage unavailable, choice not persisted */ }
    try {
      window.dispatchEvent(new CustomEvent('intermill:consent', { detail: { choice: choice } }));
      if (choice === 'accept') {
        window.dispatchEvent(new CustomEvent('intermill:consent-granted'));
      }
    } catch (e) { /* CustomEvent not supported, skip */ }
  }

  var bannerEl = null;

  function buildBanner() {
    var b = document.createElement('div');
    b.className = 'imc-banner';
    b.setAttribute('role', 'dialog');
    b.setAttribute('aria-label', 'Cookie-instellingen');
    b.innerHTML =
      '<div class="imc-inner">' +
        '<div class="imc-text">' +
          '<strong>Cookies op deze site.</strong> We gebruiken functionele cookies (altijd) en, alleen met jouw toestemming, analytische cookies van Google Analytics om de site te verbeteren. Geen advertenties, geen profilering, geen verkoop van gegevens. ' +
          '<a href="/intermill-site/cookies.html">Lees details</a>.' +
        '</div>' +
        '<div class="imc-actions">' +
          '<button type="button" class="imc-btn imc-btn-decline" data-choice="decline">Alleen functioneel</button>' +
          '<button type="button" class="imc-btn imc-btn-accept" data-choice="accept">Alle accepteren</button>' +
        '</div>' +
      '</div>';
    b.querySelectorAll('button[data-choice]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        setChoice(btn.getAttribute('data-choice'));
        hideBanner();
      });
    });
    document.body.appendChild(b);
    return b;
  }

  function showBanner() {
    if (!bannerEl) bannerEl = buildBanner();
    // setTimeout is more reliable than rAF across edge cases (background tabs,
    // headless browsers). Tiny delay so the transition has something to animate from.
    setTimeout(function () {
      if (bannerEl) bannerEl.classList.add('imc-show');
    }, 50);
  }

  function hideBanner() {
    if (!bannerEl) return;
    bannerEl.classList.remove('imc-show');
    setTimeout(function () {
      if (bannerEl && bannerEl.parentNode) bannerEl.parentNode.removeChild(bannerEl);
      bannerEl = null;
    }, 260);
  }

  // Public API for footer "Cookies beheren" link
  window.intermillConsent = {
    show: function () {
      try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
      showBanner();
    },
    getChoice: getChoice
  };

  function init() {
    var choice = getChoice();
    if (choice === null) {
      showBanner();
    } else if (choice === 'accept') {
      try { window.dispatchEvent(new CustomEvent('intermill:consent-granted')); } catch (e) {}
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
