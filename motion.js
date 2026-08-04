/* ==========================================================================
   motion.js — hero entrance + scroll reveal. ~1KB, no dependencies.

   Loaded from <head> without defer, on purpose: it needs to set the
   data-motion flag before the first paint, otherwise the page would render
   its final state and then jump back to the resting state. Everything after
   that flag waits for DOMContentLoaded.

   The CSS does the animating. This file only decides what is allowed to
   animate and when to release it:
     - reduced motion  -> the flag is never set, so no CSS motion rule matches
     - no JavaScript   -> the flag is never set, same outcome
     - no IntersectionObserver -> everything is revealed immediately
   In all three cases the page is fully visible and fully readable.
   ========================================================================== */

(function () {
  'use strict';

  var root = document.documentElement;

  /* Asked for less motion? Leave the page in its final state and stop. */
  if (window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return;
  }

  /* Set before first paint — this is what arms every rule in the motion
     block of theme-coastal.css. */
  root.setAttribute('data-motion', 'on');

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  ready(function () {
    var targets = document.querySelectorAll('[data-reveal]');
    var i;

    function revealAll() {
      for (i = 0; i < targets.length; i++) targets[i].classList.add('is-revealed');
    }

    if (!('IntersectionObserver' in window)) { revealAll(); return; }

    var observer = new IntersectionObserver(function (entries, obs) {
      /* Entries that cross in together are one group — the cards in a row,
         a heading and the block under it — so they are staggered against
         each other rather than against a fixed index. An element that comes
         in alone gets no delay at all. */
      var step = 0;

      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        if (step) entry.target.style.transitionDelay = (step * 60) + 'ms';
        step++;
        entry.target.classList.add('is-revealed');
        obs.unobserve(entry.target);   /* fires once, then stops watching */
      });
    }, {
      /* Positive bottom margin grows the root box downwards, so a card
         starts its reveal just before it scrolls into view. */
      rootMargin: '0px 0px 10% 0px',
      threshold: 0.08
    });

    for (i = 0; i < targets.length; i++) observer.observe(targets[i]);
  });
})();
