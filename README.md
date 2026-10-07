# muhaimin afif — portfolio

Hand-written semantic HTML + CSS, coastal links theme. No framework, no build
step; one small script, for motion only.

## Deploy

Import this repo into Vercel and deploy with framework preset **Other** — there is no build command and the output directory is the repo root.
`vercel.json` only sets long-lived immutable cache headers for static assets; nothing else is required.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | The entire site, plus the inline SVG `#duotone` filter the portrait is painted through. |
| `styles.css` | Everything visual: tokens, structure, rhythm, type, motion. One sheet, no `@import`. |
| `motion.js` | Hero entrance, scroll reveals (sections and project rows), pointer parallax, and the active-section nav highlight. No dependencies. The marquees are CSS only. |
| `assets/projects/<slug>/` | Three screenshots per featured project (`1.png`, `2.png`, `3.png`). The files there now are transparent placeholders. |
| `assets/icons/` | Stack icons, one SVG per tech (Simple Icons, plus Devicon's AWS mark), each exposing `#icon` for `<use>`. |
| `assets/portrait.jpg` | The portrait, 640×853 (2× the 320px box it is shown in). |
| `assets/favicon.svg` | The monogram as a tab icon — what modern browsers use, and the source the other two are generated from. |
| `favicon.ico` | 16/32/48 bitmaps of the same mark, for older browsers and the bare `/favicon.ico` request. The 16px bitmap is drawn heavier so it survives a tab strip. |
| `assets/apple-touch-icon.png` | 180×180 of the same mark, full-bleed — iOS applies its own rounded mask. |
| `vercel.json` | Cache-Control headers for static assets. |

## The monogram

One emblem — an **"A" inside a hairline ring** — in four places, the same mark
in all of them: the centred nav mark and the footer stamp (both inline SVG in
`index.html`), and the three icon files above.

The ring is the single gold accent and the only gold in the nav. The letter
never carries gold: it is pine on the cream masthead and cream on the pine
footer, which is the only thing that differs between placements. The "A" is
drawn as paths rather than set in Cormorant, so it holds together at 16px
where a serif A with thin strokes and serifs would turn to mush.

The golf flag-pin survives as the small decorative pin on the portrait — it is
a pin on a photograph, not the identity mark, so the two do not compete.

## Tuning

Everything retunes from the token block at the top of `styles.css`. Two of the
knobs there are switches:

| Token | Default | Effect |
| --- | --- | --- |
| `--grain-opacity` | `0.035` | Strength of the paper grain over the cream. `0` turns it off. |
| `--duotone` | `1` | `1` maps the portrait into the palette (pine shadows, cream highlights); `0` shows the untouched photograph. |

`--duotone` is read by a CSS style query, so it can also be flipped per element.
Any other image takes the same treatment by adding `class="duotone"` to it.

## Motion

`motion.js` sets `data-motion="on"` on `<html>` before the first paint, and only
when `prefers-reduced-motion` is not `reduce`. Every animation rule in
`styles.css` is gated on that attribute, so reduced motion, a failed
script and no JavaScript at all each land on the same result: the page renders
in its final state. Only `opacity` and `transform` are animated — nothing in the
theme can shift layout.

The active-section nav underline is deliberately *not* gated on that flag: it is
orientation, not motion, so it runs under `prefers-reduced-motion` too.

Add `data-reveal` to any element to give it a scroll reveal. Nothing indexes or
names them.

## Marquees

The project screenshots and the stack icons share one CSS-only marquee
(`.marquee`, `.marquee--reverse`, `.marquee--shots`, `.marquee--icons` in
`styles.css`). Each one holds its items twice; the second copy is
`aria-hidden` with empty `alt`, and the track slides by exactly one copy.

- **Speed:** `style="--marquee-duration: 46s"` on the `.marquee` element. That
  is one full loop, so a bigger number is slower.
- **Direction:** add or remove `marquee--reverse`.
- **Reduced motion:** the duplicate is hidden. Screenshots become a
  horizontally scrollable row and icons a wrapped grid.

## Screenshots

Each project has 3 images in `assets/projects/<slug>/`, shown cropped to 16:10.
Project Guardian and Solare use real shots (`1.jpg`–`3.jpg`, ~1600px wide);
(The archived `cable-orders/{1,2,3}.png` are still transparent placeholders.)
To ship WebP instead (`brew install webp` first):

```sh
for f in assets/projects/*/[123].png; do cwebp -q 82 "$f" -o "${f%.png}.webp"; done
sed -i '' -E 's#(assets/projects/[a-z-]+/[123])\.png#\1.webp#g' index.html
```

Then rewrite each screenshot's `alt` to say what it shows.

## Adding a project

Archived projects sit in a comment at the end of `#work`, already in the
current format. Move one `<li data-rise>` into `.projects`, fix the numeral,
alternate `marquee--reverse`, and fill its screenshot folder.
