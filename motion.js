/* ==========================================================================
   motion.js — hero entrance, scroll reveals, contour parallax, project
   filter. No dependencies, no build step.

   Loaded from <head> without defer, on purpose: it has to set the
   data-motion flag before the first paint, otherwise the page renders its
   final state and then jumps back to the resting state.

   The CSS does all the animating. This file only decides what is allowed to
   animate and when to release it:
     - reduced motion          -> the flag is never set, no CSS motion matches
     - no JavaScript           -> the flag is never set, same outcome
     - no IntersectionObserver -> everything is released immediately
   In all three cases the page is fully visible and fully readable, and the
   filter still works — it just switches instantly instead of cross-fading.
   ========================================================================== */

(function () {
  'use strict';

  var root = document.documentElement;

  var MOTION = !(window.matchMedia &&
                 window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  /* Set before first paint — this arms every rule in the motion block of
     styles.css. Nothing below depends on it having been set. */
  if (MOTION) root.setAttribute('data-motion', 'on');

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  /* Run fn after the browser has had a frame to paint the resting state —
     but never later than `bail` ms, because a background tab throttles
     requestAnimationFrame and the page must not be left mid-transition. */
  function nextFrame(fn, bail) {
    var done = false;
    function once() { if (done) return; done = true; fn(); }
    requestAnimationFrame(function () { requestAnimationFrame(once); });
    window.setTimeout(once, bail || 80);
  }

  ready(function () {

    /* ----------------------------------------------------------------------
       1 · Hero entrance. One class on <body> releases the whole staggered
       sequence; the order and the delays are the --i values in the markup.
       ---------------------------------------------------------------------- */

    if (MOTION) {
      nextFrame(function () { document.body.classList.add('is-loaded'); }, 120);
    } else {
      document.body.classList.add('is-loaded');
    }

    /* ----------------------------------------------------------------------
       2 · Scroll reveals. One observer for every [data-reveal] section.
       ---------------------------------------------------------------------- */

    var reveals = document.querySelectorAll('[data-reveal]');
    var i;

    function releaseAll() {
      for (var k = 0; k < reveals.length; k++) reveals[k].classList.add('is-revealed');
    }

    var hasIO = 'IntersectionObserver' in window;

    if (!MOTION || !hasIO) {
      releaseAll();
    } else {
      var sectionObserver = new IntersectionObserver(function (entries, obs) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-revealed');
          obs.unobserve(entry.target);          /* fires once, never again */
        });
      }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });

      for (i = 0; i < reveals.length; i++) sectionObserver.observe(reveals[i]);
    }

    /* ----------------------------------------------------------------------
       3 · Project grid — staggered entrance, then the filter.
       ---------------------------------------------------------------------- */

    var grid = document.querySelector('[data-projects]');
    var bar  = document.querySelector('[data-filters]');
    var out  = document.querySelector('[data-count]');

    if (grid) {
      var items = Array.prototype.slice.call(grid.children);
      var CARD_STEP = 55;                       /* mirrors --stagger-card */
      var FADE      = 190;                      /* out-phase, under --dur-card */
      var current   = 'all';

      function matches(li, cat) {
        if (cat === 'all') return true;
        var own = (li.getAttribute('data-category') || '').split(/\s+/);
        return own.indexOf(cat) !== -1;
      }

      /* Stagger the cards that are currently showing. The delay is cleared
         again once it has been used, so a later filter change starts clean. */
      function stagger() {
        var n = 0;
        items.forEach(function (li) {
          if (li.hidden) { li.style.transitionDelay = ''; return; }
          li.style.transitionDelay = (n * CARD_STEP) + 'ms';
          n++;
        });
        window.setTimeout(function () {
          items.forEach(function (li) { li.style.transitionDelay = ''; });
        }, n * CARD_STEP + 700);
      }

      function setCount(n) {
        if (!out) return;
        if (!MOTION) { out.textContent = n; return; }
        out.classList.add('is-ticking');
        window.setTimeout(function () {
          out.textContent = n;
          out.classList.remove('is-ticking');
        }, 190);
      }

      function commit(cat) {
        var shown = 0;
        items.forEach(function (li) {
          var on = matches(li, cat);
          li.hidden = !on;
          if (on) shown++;
        });
        setCount(shown);
      }

      /* The entrance. Cards sit in their resting-out state (CSS, via
         .projects:not(.is-in)) until the grid scrolls into view. */
      function release() {
        stagger();
        grid.classList.add('is-in');
      }

      if (!MOTION || !hasIO) {
        grid.classList.add('is-in');
      } else {
        var gridObserver = new IntersectionObserver(function (entries, obs) {
          entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            release();
            obs.unobserve(entry.target);
          });
        }, { rootMargin: '0px 0px -5% 0px', threshold: 0.05 });

        gridObserver.observe(grid);
      }

      /* -- the filter ---------------------------------------------------- */

      if (bar) {
        var buttons = Array.prototype.slice.call(bar.querySelectorAll('button[data-filter]'));

        bar.addEventListener('click', function (event) {
          var btn = event.target.closest('button[data-filter]');
          if (!btn) return;

          var cat = btn.getAttribute('data-filter');
          if (cat === current) return;
          current = cat;

          buttons.forEach(function (b) {
            b.setAttribute('aria-pressed', String(b === btn));
          });

          if (!MOTION) { commit(cat); return; }

          /* Fade the grid out as one gesture, swap, then stagger back in.
             Nothing reflows while anything is visible. */
          grid.classList.remove('is-in');
          window.setTimeout(function () {
            commit(cat);
            stagger();
            /* One painted frame in the out state, so the cards that were
               display:none actually transition in rather than snapping. */
            nextFrame(function () { grid.classList.add('is-in'); });
          }, FADE);
        });
      }
    }

    /* ----------------------------------------------------------------------
       4 · Contour parallax — a few pixels, rAF-throttled, transform only.
       ---------------------------------------------------------------------- */

    var contours = document.querySelector('[data-contours]');

    if (MOTION && contours) {
      var ticking = false;
      var DEPTH   = 0.06;      /* px of drift per px of scroll */
      var MAX     = 14;

      function paint() {
        ticking = false;
        var y = window.pageYOffset || 0;
        if (y > window.innerHeight) return;    /* off screen: stop writing */
        var offset = Math.min(y * DEPTH, MAX);
        contours.style.setProperty('--parallax', offset.toFixed(2) + 'px');
      }

      window.addEventListener('scroll', function () {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(paint);
      }, { passive: true });
    }

  });
})();
