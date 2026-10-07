/* ==========================================================================
   motion.js — hero entrance, scroll reveals, pointer parallax, active-
   section nav. No dependencies, no build step. The marquees in Work and
   Stack are not in here at all: they are CSS only.

   Loaded from <head> without defer, on purpose: it has to set the
   data-motion flag before the first paint, otherwise the page renders its
   final state and then jumps back to the resting state.

   The CSS does all the animating. This file only decides what is allowed to
   animate and when to release it:
     - reduced motion          -> the flag is never set, no CSS motion matches
     - no JavaScript           -> the flag is never set, same outcome
     - no IntersectionObserver -> everything is released immediately
     - coarse pointer          -> pointer parallax is never bound
   In all four cases the page is fully visible and fully readable.

   One thing here is not motion and is not gated on it: the active-section
   nav highlight (6). It is an orientation cue, so it runs for everyone who
   has IntersectionObserver, reduced motion or not.

   The 3D is a collaboration, and the split is strict: the stylesheet owns
   the shape of every transform and every cap, this file owns nothing but
   the numbers that flow into them. It reads --parallax-depth, --hero-rot
   and --portrait-rot off :root with getComputedStyle, so the
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

  /* Pointer parallax needs a pointer that can hover and can
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
       2 · Scroll reveals. One observer for every [data-reveal] section and
       every [data-rise] project; the stylesheet gives each its own shape.
       ---------------------------------------------------------------------- */

    var reveals = document.querySelectorAll('[data-reveal], [data-rise]');
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
       3 · Contour scroll drift. The back plane travels slower than the page
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
       4 · Hero — pointer parallax across the three depth planes.

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
       5 · Portrait — the raised frame leans towards the cursor.

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
       6 · Active-section nav highlight.

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
