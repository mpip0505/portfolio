/* ==========================================================================
   motion.js — hero entrance, scroll reveals, pointer tilt and parallax,
   project filter, active-section nav. No dependencies, no build step.

   Loaded from <head> without defer, on purpose: it has to set the
   data-motion flag before the first paint, otherwise the page renders its
   final state and then jumps back to the resting state.

   The CSS does all the animating. This file only decides what is allowed to
   animate and when to release it:
     - reduced motion          -> the flag is never set, no CSS motion matches
     - no JavaScript           -> the flag is never set, same outcome
     - no IntersectionObserver -> everything is released immediately
     - coarse pointer          -> tilt and pointer parallax are never bound
   In all four cases the page is fully visible and fully readable, and the
   filter still works — it just switches instantly instead of cross-fading.

   One thing here is not motion and is not gated on it: the active-section
   nav highlight (8). It is an orientation cue, so it runs for everyone who
   has IntersectionObserver, reduced motion or not.

   The 3D is a collaboration, and the split is strict: the stylesheet owns
   the shape of every transform and every cap, this file owns nothing but
   the numbers that flow into them. It reads --tilt-max, --tilt-lift,
   --parallax-depth and --hero-rot off :root with getComputedStyle, so the
   whole feel retunes from the token block in styles.css and no intensity
   is ever hard-coded here.
   ========================================================================== */

(function () {
  'use strict';

  var root = document.documentElement;

  function media(q) {
    return !!(window.matchMedia && window.matchMedia(q).matches);
  }

  var MOTION = !media('(prefers-reduced-motion: reduce)');

  /* Pointer tilt and pointer parallax need a pointer that can hover and can
     leave. A touchscreen has neither, so on coarse pointers they are never
     bound at all — touch stays flat, and the CSS carries a second guard. */
  var FINE = MOTION && !media('(pointer: coarse)');

  /* Set before first paint — this arms every rule in the motion block of
     styles.css. Nothing below depends on it having been set. */
  if (MOTION) root.setAttribute('data-motion', 'on');

  /* Read a tuning knob off :root. Deg, px, ms — the unit is stripped and the
     caller knows which one it asked for. The fallback only ever applies if
     the stylesheet failed to load, in which case there is nothing to move. */
  function knob(name, fallback) {
    var raw = window.getComputedStyle(root).getPropertyValue(name);
    var n = parseFloat(raw);
    return isNaN(n) ? fallback : n;
  }

  var TILT_MAX = knob('--tilt-max', 5);         /* deg */
  var TILT_Z   = knob('--tilt-lift', 8);        /* px  */
  var DEPTH    = knob('--parallax-depth', 12);  /* px  */
  var HERO_ROT = knob('--hero-rot', 1.5);       /* deg */
  var PORT_ROT = knob('--portrait-rot', 3.5);   /* deg */

  /* ------------------------------------------------------------------------
     One shared rAF loop for every smoothed value on the page.

     Pointer events fire far more often than the screen refreshes, so no
     handler below ever writes to the DOM. Each one only records where it
     wants to end up; the loop eases towards that target and does the single
     write, once per frame. When everything has arrived the loop stops
     entirely, so an idle page schedules no frames at all.
     ------------------------------------------------------------------------ */

  var movers = [];
  var frame  = 0;

  var GLIDE = 0.18;    /* fraction of the remaining distance, per frame */
  var EPS   = 0.008;   /* close enough to call it arrived               */

  function tick() {
    frame = 0;
    var busy = false;
    for (var i = 0; i < movers.length; i++) if (movers[i]()) busy = true;
    if (busy) frame = requestAnimationFrame(tick);
  }

  function wake() {
    if (!frame) frame = requestAnimationFrame(tick);
  }

  /* keys  — the channels this mover eases, all starting at 0
     write — called at most once a frame with the current values
     rest  — called once, on the frame the mover finishes arriving         */
  function mover(keys, write, rest) {
    var state = {}, goal = {}, awake = false, k;

    for (k = 0; k < keys.length; k++) { state[keys[k]] = 0; goal[keys[k]] = 0; }

    function step() {
      if (!awake) return false;

      var moving = false, name, gap, j;

      for (j = 0; j < keys.length; j++) {
        name = keys[j];
        gap  = goal[name] - state[name];
        if (Math.abs(gap) < EPS) state[name] = goal[name];
        else { state[name] += gap * GLIDE; moving = true; }
      }

      write(state);

      if (!moving) { awake = false; if (rest) rest(state); }
      return moving;
    }

    movers.push(step);

    return function (next) {
      for (var n in next) if (goal.hasOwnProperty(n)) goal[n] = next[n];
      awake = true;
      wake();
    };
  }

  /* Viewport-relative rects go stale the moment the page scrolls or resizes.
     Rather than measure on every pointer move — a layout read per event —
     each effect caches its box and this flag tells it when to remeasure. */
  var stale = false;

  if (FINE) {
    window.addEventListener('scroll', function () { stale = true; }, { passive: true });
    window.addEventListener('resize', function () { stale = true; }, { passive: true });
  }

  /* Cursor position inside a box, as -1 .. 1 on each axis, clamped. */
  function nx(value, start, size) {
    var n = size ? ((value - start) / size) * 2 - 1 : 0;
    return n < -1 ? -1 : n > 1 ? 1 : n;
  }

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
      var CARD_STEP = knob('--stagger-card', 55);   /* project card step   */
      var FADE      = knob('--dur-fast', 200) * 0.95; /* filter out-phase, a
                          hair under the micro duration so the swap happens
                          while the cards are at their most transparent    */
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
        }, FADE);
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
       4 · Contour scroll drift. The back plane travels slower than the page
       it sits behind, which is the whole of the effect. Transform only,
       rAF-throttled, and it stops writing once the hero is off screen.
       ---------------------------------------------------------------------- */

    var contours = document.querySelector('[data-contours]');

    if (MOTION && contours) {
      var ticking = false;
      var RATE    = 0.06;      /* px of drift per px of scroll */

      function paint() {
        ticking = false;
        var y = window.pageYOffset || 0;
        if (y > window.innerHeight) return;    /* off screen: stop writing */
        var offset = Math.min(y * RATE, DEPTH);
        contours.style.setProperty('--parallax', offset.toFixed(2) + 'px');
      }

      window.addEventListener('scroll', function () {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(paint);
      }, { passive: true });
    }

    /* ----------------------------------------------------------------------
       5 · Project cards — pointer-tracked tilt.

       The card leans towards the cursor, rises by --tilt-lift, and carries a
       faint cream highlight under the pointer. Every angle is a fraction of
       --tilt-max, so the cap is the token, not a clamp written here.
       ---------------------------------------------------------------------- */

    if (FINE) {
      var cards = document.querySelectorAll('.projects > li > .card');

      Array.prototype.forEach.call(cards, function (card) {
        var box   = null;   /* measured on the <li>, which never tilts, so
                               reading it can never chase its own output   */
        var sheen = { x: 50, y: 0 };

        var push = mover(['rx', 'ry', 'z'], function (v) {
          card.style.setProperty('--tx', v.rx.toFixed(3) + 'deg');
          card.style.setProperty('--ty', v.ry.toFixed(3) + 'deg');
          card.style.setProperty('--tz', v.z.toFixed(2) + 'px');
          card.style.setProperty('--sheen-x', sheen.x.toFixed(1) + '%');
          card.style.setProperty('--sheen-y', sheen.y.toFixed(1) + '%');
        }, function (v) {
          /* Back at rest: hand the card back to the stylesheet, so a later
             keyboard focus still gets the hover lift from CSS. */
          if (v.rx || v.ry || v.z) return;
          card.style.removeProperty('--tx');
          card.style.removeProperty('--ty');
          card.style.removeProperty('--tz');
        });

        card.addEventListener('pointerenter', function (event) {
          if (event.pointerType === 'touch') return;
          box = card.parentNode.getBoundingClientRect();
          stale = false;
          card.classList.add('is-tilting');
        });

        card.addEventListener('pointermove', function (event) {
          if (event.pointerType === 'touch') return;
          if (!box || stale) {
            box = card.parentNode.getBoundingClientRect();
            stale = false;
          }

          /* Towards the cursor: the edge nearest it is the edge that rises.
             Nothing is written to the DOM here — only the target moves. */
          var px = nx(event.clientX, box.left, box.width);
          var py = nx(event.clientY, box.top,  box.height);

          sheen.x = (px + 1) * 50;
          sheen.y = (py + 1) * 50;

          push({ rx: py * TILT_MAX, ry: -px * TILT_MAX, z: TILT_Z });
        });

        card.addEventListener('pointerleave', function () {
          box = null;
          card.classList.remove('is-tilting');
          push({ rx: 0, ry: 0, z: 0 });
        });
      });
    }

    /* ----------------------------------------------------------------------
       6 · Hero — pointer parallax across the three depth planes.

       One pair of offsets and one pair of angles, written on the hero and
       multiplied by each layer's own --plane in CSS: contours 0.35, the
       masthead 1, and the gold diamond 0.8 on top of the masthead's 1,
       which is what makes it the nearest thing on the page.
       ---------------------------------------------------------------------- */

    var hero = document.querySelector('[data-parallax]');

    if (FINE && hero) {
      var heroBox = null;

      var lean = mover(['x', 'y', 'rx', 'ry'], function (v) {
        hero.style.setProperty('--px',  v.x.toFixed(2)  + 'px');
        hero.style.setProperty('--py',  v.y.toFixed(2)  + 'px');
        hero.style.setProperty('--hrx', v.rx.toFixed(3) + 'deg');
        hero.style.setProperty('--hry', v.ry.toFixed(3) + 'deg');
      });

      hero.addEventListener('pointermove', function (event) {
        if (event.pointerType === 'touch') return;
        if (!heroBox || stale) {
          heroBox = hero.getBoundingClientRect();
          stale = false;
        }

        var px = nx(event.clientX, heroBox.left, heroBox.width);
        var py = nx(event.clientY, heroBox.top,  heroBox.height);

        lean({
          x:  px * DEPTH,
          y:  py * DEPTH,
          rx: py * HERO_ROT,
          ry: -px * HERO_ROT
        });
      });

      hero.addEventListener('pointerleave', function () {
        heroBox = null;
        lean({ x: 0, y: 0, rx: 0, ry: 0 });
      });
    }

    /* ----------------------------------------------------------------------
       7 · Portrait — the raised frame leans towards the cursor.

       Only the two angles come from here. The lift, the scale and the
       stepped shadow are the stylesheet's :hover rule, so the photograph
       still rises for a keyboard user who never moves a pointer at all.
       ---------------------------------------------------------------------- */

    var portrait = document.querySelector('[data-portrait]');
    var pFrame   = portrait && portrait.querySelector('.portrait-frame');

    if (FINE && pFrame) {
      var pBox = null;

      var lift = mover(['rx', 'ry'], function (v) {
        pFrame.style.setProperty('--prx', v.rx.toFixed(3) + 'deg');
        pFrame.style.setProperty('--pry', v.ry.toFixed(3) + 'deg');
      }, function (v) {
        if (v.rx || v.ry) return;
        pFrame.style.removeProperty('--prx');
        pFrame.style.removeProperty('--pry');
      });

      portrait.addEventListener('pointermove', function (event) {
        if (event.pointerType === 'touch') return;
        if (!pBox || stale) {
          pBox = pFrame.getBoundingClientRect();
          stale = false;
        }

        var px = nx(event.clientX, pBox.left, pBox.width);
        var py = nx(event.clientY, pBox.top,  pBox.height);

        lift({ rx: py * PORT_ROT, ry: -px * PORT_ROT });
      });

      portrait.addEventListener('pointerleave', function () {
        pBox = null;
        lift({ rx: 0, ry: 0 });
      });
    }

    /* ----------------------------------------------------------------------
       8 · Active-section nav highlight.

       Not motion: this is orientation, so it is deliberately NOT gated on
       MOTION. It runs wherever IntersectionObserver exists, and where it
       does not, the nav is simply a nav — nothing is broken and nothing is
       missing but the underline.

       One observer, one attribute. The rootMargin narrows the viewport to a
       band running from 40% to 80% of its height; a section is a candidate
       while it overlaps that band, and the topmost candidate wins. The
       effect of the two together is that the incoming section takes over
       once the outgoing one has climbed past the 40% line — late enough
       that the underline never flickers between two links at a boundary,
       early enough that it names what you are actually reading.

       The observer only reports changes, so it keeps its own record of who
       is in the band and re-reads the tops on each callback; getBoundingClientRect
       is called at most once per observed section per crossing, never per scroll.
       ---------------------------------------------------------------------- */

    var navLinks = document.querySelectorAll('.nav-list a[href^="#"]');

    if (hasIO && navLinks.length) {
      var watched = [];      /* the sections a nav link actually points at */
      var inBand  = {};      /* id -> currently overlapping the band       */

      Array.prototype.forEach.call(navLinks, function (link) {
        var id = link.getAttribute('href').slice(1);
        var section = document.getElementById(id);
        if (section && watched.indexOf(section) === -1) watched.push(section);
      });

      var markCurrent = function (id) {
        Array.prototype.forEach.call(navLinks, function (link) {
          if (link.getAttribute('href') === '#' + id) {
            link.setAttribute('aria-current', 'true');
          } else {
            link.removeAttribute('aria-current');
          }
        });
      };

      if (watched.length) {
        var navObserver = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            inBand[entry.target.id] = entry.isIntersecting;
          });

          var winner = null;
          var highest = Infinity;

          watched.forEach(function (section) {
            if (!inBand[section.id]) return;
            var top = section.getBoundingClientRect().top;
            if (top < highest) { highest = top; winner = section.id; }
          });

          /* No winner means the band is over the hero, or over a section
             with no nav link of its own. Nothing is current, and no link
             is marked — which is the honest answer, not a stale one. */
          markCurrent(winner);
        }, { rootMargin: '-40% 0px -20% 0px', threshold: 0 });

        watched.forEach(function (section) { navObserver.observe(section); });
      }
    }

  });
})();
