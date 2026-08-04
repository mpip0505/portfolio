# muhaimin afif — portfolio

Hand-written semantic HTML + CSS, coastal links theme. No framework, no build
step; one small script, for motion only.

## Deploy

Import this repo into Vercel and deploy with framework preset **Other** — there is no build command and the output directory is the repo root.
`vercel.json` only sets long-lived immutable cache headers for static assets; nothing else is required.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | The entire site. |
| `styles.css` | Structure, rhythm, layout. Token-driven; no `@import`. |
| `theme-coastal.css` | Colour, type, motifs and all motion. Loaded second — it re-points the tokens `styles.css` reads, so removing this one `<link>` restores the original palette. |
| `motion.js` | Hero entrance and IntersectionObserver scroll reveals. ~1KB, no dependencies. |
| `vercel.json` | Cache-Control headers for static assets. |

## Motion

`motion.js` sets `data-motion="on"` on `<html>` before the first paint, and only
when `prefers-reduced-motion` is not `reduce`. Every animation rule in
`theme-coastal.css` is gated on that attribute, so reduced motion, a failed
script and no JavaScript at all each land on the same result: the page renders
in its final state. Only `opacity` and `transform` are animated — nothing in the
theme can shift layout.

Add `data-reveal` to any element to give it a scroll reveal. Nothing indexes or
names them.

## Adding a project

Copy any `<article>` inside `#work` and change the text. Nothing in `styles.css`
counts, indexes or names projects. Add `data-emphasis="lead"` for the heavier
treatment; omit it for the compact treatment.
