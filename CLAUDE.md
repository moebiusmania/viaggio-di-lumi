# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

"Il viaggio di Lumi": an Italian interactive picture book for children aged 7–9 (Big Bang → birth of the Earth),
built as a static PWA with Deno + Lume 3 (Vento `.vto` templates), vanilla CSS and vanilla JS web components.
No frameworks, no bundler, no CSS/JS build step. All user-facing text is in Italian; keep it simple and age-appropriate.
README.md is detailed and current — read it for the full file map and the list of platform features used.

## Commands

```sh
deno task serve   # dev server + live reload on http://localhost:3000 (no service worker)
deno task build   # production build into _site/ (also writes _site/sw.js)
deno lint         # uses Lume's lint plugin (configured in deno.json)
deno fmt          # only formats _config.ts and src/assets/js/ (lineWidth 120)
```

There are no tests. Verify changes by running `deno task serve` and viewing the page, or `deno task build` and
checking for errors. CI (`.github/workflows/deploy.yml`) builds on push to `main` with
`--location=<pages base url>/` and deploys to GitHub Pages.

## Architecture

**Pages form one linear book.** Every `.vto` in `src/lezione-N/` inherits `type: slide`, `lesson: N` and
`layout: layouts/page.vto` from that folder's `_data.yml`. The `site.preprocess` hook in `_config.ts` collects all
slides, orders them by lesson then by the numeric filename prefix (`03-…` → 3), and injects `prev`/`next`, `index`,
`total`, `pageNum`, `lessonTotal`, `lessonInfo` and a shared `toc` into each page's data. So adding, removing or
renumbering a file automatically rewires navigation, the TOC, the pager dots and the journey progress bar — no manual
lists. Lesson metadata (title, subtitle, `when`) lives in `src/_data/lessons.yml`; adding a lesson means a new entry
there, a new folder with `_data.yml`, and a `--lN` colour token plus its `[data-lesson="N"]` accent rule in `base.css`.

**Page anatomy.** Frontmatter (`title`, `when`, `text[]`, `task`, `fact`, `kind: cover|quiz|cert`) is rendered by
`page.vto` into Lumi's speech bubble / "Prova tu!" / "Lo sapevi?" boxes; the template body is the stage. Elements
marked `data-speak` (plus `main h1`) are what the read-aloud feature speaks. Scenes are usually inline SVG
(`viewBox="0 0 400 300"` inside `.scene`) with scene-local styles in `<style>@scope { … }</style>`. Reusable cartoon
shapes are `<symbol>`s in `partials/sprite.vto`, referenced via `<use href="#id">`.

**JS modules** (`src/assets/js/`, ES modules, loaded from `base.vto` via `app.js`):
- `core.js` — shared state and helpers: `progress` (localStorage key `lumi-v1`: visited, done, medals, sound),
  `sound()` (Web Audio synth, no audio files), `confetti()`, `toast()`, `shuffle()`, `reduceMotion`.
  `pageDone(el)` is the contract for activities: any interactive component calls it when the child completes the
  page's activity; it awards a star once and dispatches `lumi:progress`.
- `components.js` — all custom elements (registered via an idempotent `define()` helper). Components drive CSS by
  setting custom properties: `<scene-slider>` sets `--t` (0→1), `<tap-scene>`/`<hold-button>` set `--p`, so scenes
  animate purely in CSS.
- `canvas.js` — `<space-canvas mode="…">`, large; dynamically imported by `app.js` only on pages that contain one.
- `app.js` — navigation (arrows/keyboard/swipe/trackpad), TOC dialog, progress UI, read-aloud, SW registration.

**CSS** is layered: `main.css` declares `@layer reset, tokens, base, layout, components, scenes, pages;` and imports
`base.css` (reset/tokens/base/layout), `components.css` and `scenes.css`. Design tokens (colours incl. `--l1…--l4`,
fonts) are in the `tokens` layer of `base.css`. Uses modern CSS freely (nesting, `@scope`, `@property`, `:has()`,
container queries, `oklch()`, cross-document View Transitions) — no need to add fallbacks for old browsers.

**Offline / service worker.** `site.data("offline", !dev)` gates SW code in templates (`data-offline` on `<html>`).
After a production build, the `afterBuild` hook walks `_site/`, hashes every file, and writes `sw.js` from the
`src/_sw.js` template by replacing `"__VERSION__"` and `__FILES__`. Any output change bumps the version. Paths in
the precache list are relative so the site works under a GitHub Pages sub-path.

**Base path.** `basePath()` rewrites internal URLs, so always write root-relative URLs (`/assets/...`, `/lezione-1/...`)
in templates; don't hard-code the repo sub-path.

## Licensing

Code (`_config.ts`, JS, CSS, layouts, partials) is 0BSD; content (lesson texts, quizzes, illustrations in
`src/index.vto`, `src/lezione-*/`, `src/_data/`, `partials/sprite.vto`) is CC0. Bundled fonts are OFL — keep their
`OFL-*.txt` files alongside them.
