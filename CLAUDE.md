# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

"Il viaggio di Lumi": an Italian interactive picture book for children aged 7–9 (Big Bang → birth of the Earth),
built as a static PWA with Deno + Lume 3 (Vento `.vto` templates), vanilla CSS and vanilla JS web components.
No frameworks, no bundler, no CSS/JS build step. User-facing text is in Italian (the build is ready for more
languages); keep it simple and age-appropriate. README.md is detailed and current — read it for the full file map and
the list of platform features used. AUTHORING.md is the guide for non-developers who edit the texts.

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

**Texts and code are strictly separate.** Authors must be able to edit every word without touching code:

```
src/content/<lang>/            TEXT ONLY: index.md, lezione-N/NN-*.md, _data/lessons.yml, _data/ui.yml
src/_includes/layouts/         base.vto (shell) · page.vto (book page) · home.vto (cover markup)
src/_includes/scenes/          one code-only scene per page (lezione-N/NN-*.vto) + shared quiz.vto
src/_includes/partials/, src/assets/   code, no literal text
```

Nothing under `src/_includes/` or `src/assets/` may contain literal user-facing text; symbols like `H`, `+`,
emoji or SVG art are fine. When adding UI, put the words in `ui.yml` (templates: `{{ ui.x.y }}`; JS: `t("key")`
from `core.js`, which reads `ui.yml`'s `js:` block) or in the page's frontmatter. Page-specific JS text goes under
the page's `strings:` and overrides `ui.yml`'s `js:` keys with the same name, e.g. `tapCounter`. `{name}` placeholders
are filled by the `fill` filter in templates and by `t(key, vars)` in JS; a YAML list given to `t()` yields a random
item. Keep AUTHORING.md in sync when frontmatter conventions change.

**Pages form one linear book per language.** `LANGS` in `_config.ts` lists the content folders. The first one is
served at `/`, the others at `/<lang>/`. The `site.preprocess` hook derives `lang`, `home`, `url`, `lesson` and
`order` from each file's path (`content/it/lezione-N/NN-*.md`, the folder only needs to end in `-N`), sets the
layout, and matches the page to its scene: `src/_includes/scenes/lezione-N/NN-*.vto` with the same lesson and
number (`kind: quiz` pages use the shared `scenes/quiz.vto`). It throws if a scene is missing. It then orders the
slides per language and injects `prev`/`next`, `index`, `total`, `pageNum`, `lessonTotal`, `lessonInfo`,
`lastLesson`, a shared `toc`, and `jsText` (the JSON of texts for the JS). A `site.process` hook writes one
`manifest.webmanifest` per language from `ui.yml`'s `app:` block. Adding a page means a `.md` in every content
language plus a scene with the same number. Content files can be renamed or translated because scenes are matched
by number, but a rename changes the URL, and saved progress is keyed by URL. Adding a lesson means an entry in
`lessons.yml`, a content folder, a scenes folder, and a `--lN` colour token plus its `[data-lesson="N"]` accent rule
in `base.css`. Adding a language means copying `src/content/it/` to `src/content/<lang>/` and adding it to `LANGS`.

**Page anatomy.** The `.md` body is Lumi's speech bubble (or the intro on a `kind: cover` page and the diploma
bubble on `kind: cert`). Frontmatter holds `title`, `when`, `task`, `fact`, `kind`, and the scene's own texts,
named descriptively: `slider`, `steps`, `cards`, `spots`, `chips`, `bins`, `labels`, `button(s)`, `caption`,
`canvas` (aria-label), `strings` (read by JS). `page.vto` renders the bubble, the boxes and the cover text, then
`{{ include scene }}`. The scene holds only markup/SVG/`@scope` CSS and reads those keys (index-based for lists, so
list order in the `.md` must match the markup). Pass texts through `|> md(true)` where inline Markdown is allowed
and `|> escape` inside attributes. Elements marked `data-speak` (plus `main h1`) are what the read-aloud feature
speaks. Scenes are usually inline SVG (`viewBox="0 0 400 300"` inside `.scene`). Reusable cartoon shapes are
`<symbol>`s in `partials/sprite.vto`, referenced via `<use href="#id">`. Longer structured texts a component needs
at runtime are rendered by the scene into markup the component reads, e.g. `<template data-nucleus="2-2">` for
`<nucleus-builder>`, rather than being hard-coded in JS.

Gotchas:
- `.md` pages are Markdown only, not Vento, so `{{ }}` in content is literal.
- Markdown bold renders as `<strong>`, not `<b>`, so CSS must not rely on `b` for authored text.
- Frontmatter keys become Vento variables, so avoid JS reserved words as key names (e.g. `continue`).
- Put `data-steps` and other JSON attributes through `|> JSON.stringify |> escape`.

**JS modules** (`src/assets/js/`, ES modules, loaded from `base.vto` via `app.js`):
- `core.js` — shared state and helpers: `t(key, vars)` and `locale` (from the `#lumi-text` JSON that `base.vto`
  writes from `jsText`), `progress` (localStorage key `lumi-v1`: visited, done, medals, sound), `sound()` (Web
  Audio synth, no audio files), `confetti()`, `toast()`, `shuffle()`, `reduceMotion`.
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

**Base path.** `basePath()` rewrites internal URLs, so always write root-relative URLs (`/assets/...`, `{{ home }}`)
in templates; don't hard-code the repo sub-path or the language prefix.

## Licensing

Code (`_config.ts`, JS, CSS, `base.vto`, `page.vto`, partials) is 0BSD; content (`src/content/`, `home.vto`,
`src/_includes/scenes/`, `partials/sprite.vto`) is CC0. Bundled fonts are OFL — keep their `OFL-*.txt` files
alongside them.
