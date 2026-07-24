# muhaimin afif — portfolio

Hand-written semantic HTML + CSS. No framework, no build step, no JavaScript.

## Deploy

Import this repo into Vercel and deploy with framework preset **Other** — there is no build command and the output directory is the repo root.
`vercel.json` only sets long-lived immutable cache headers for static assets; nothing else is required.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | The entire site. Zero `<div>`, zero `<span>`. |
| `styles.css` | Single render-blocking stylesheet. No `@import`, no web fonts. |
| `vercel.json` | Cache-Control headers for static assets. |

## Adding a project

Copy any `<article>` inside `#work` and change the text. Nothing in `styles.css`
counts, indexes or names projects. Add `data-emphasis="lead"` for the heavier
treatment; omit it for the compact treatment.
