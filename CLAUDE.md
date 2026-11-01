# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

"Il viaggio di Lumi": an Italian interactive picture book for children aged 7–9 (Big Bang → birth of the Earth),
built as a fully static PWA with Bun + Astro. Styling is vanilla CSS. The games are vanilla JS web components, and
Alpine.js drives the app shell around them. There are no UI framework integrations and no Astro islands. User-facing
text is in Italian (the build is ready for more languages); keep it simple and age-appropriate. README.md is detailed
and current — read it for the full file map and the list of platform features used. AUTHORING.md is the guide for
non-developers who edit the texts.

## Commands

```sh
bun run dev       # dev server + live reload on http://localhost:3000 (no service worker)
bun run build     # production build into dist/ (also writes dist/sw.js)
bun run preview   # serve dist/
```

There are no tests and no linter or formatter. Verify changes by running `bun run dev` and viewing the page, or
`bun run build` and checking for errors. CI (`.github/workflows/deploy.yml`) builds on push to `main` with
`--site` and `--base` from the Pages settings and deploys to GitHub Pages.

## Architecture

**Texts and code are strictly separate.** Authors must be able to edit every word without touching code:

```
src/content/<book>/            TEXT ONLY: index.md, lezione-N/NN-*.md, _data/lessons.yml, _data/ui.yml
src/layouts/                   Base.astro (shell) · Slide.astro (book page) · Home.astro (cover markup)
src/scenes/                    one code-only scene per page (lezione-N/NN-*.astro) + shared quiz.astro
src/components/, src/assets/   code, no literal text
```

Nothing under `src/layouts/`, `src/scenes/`, `src/components/` or `src/assets/` may contain literal user-facing text; symbols like `H`, `+`,
emoji or SVG art are fine. When adding UI, put the words in `ui.yml` (templates: `{ui.x.y}`; JS: `t("key")`
from `core.js`, which reads `ui.yml`'s `js:` block) or in the page's frontmatter. Page-specific JS text goes under
the page's `strings:` and overrides `ui.yml`'s `js:` keys with the same name, e.g. `tapCounter`. `{name}` placeholders
are filled by `fill()` in templates and by `t(key, vars)` in JS; a YAML list given to `t()` yields a random
item. Keep AUTHORING.md in sync when frontmatter conventions change.

**Pages form one linear book per content folder.** `BOOKS` in `src/lib/book.ts` lists the folders, each with its language,
address and progress key: `it` is served at `/`, and `lessons` is a shorter edition at `/lessons/` that nothing in the
main book may link to. Books share the scenes and can skip pages: files keep their numbers, so gaps are fine. `src/lib/book.ts` derives `lang`, `home`, `url`, `lesson` and
`order` from each file's path (`content/it/lezione-N/NN-*.md`, the folder only needs to end in `-N`), and
matches the page to its scene: `src/scenes/lezione-N/NN-*.astro` with the same lesson and
number (`kind: quiz` pages use the shared `scenes/quiz.astro`). It throws if a scene is missing. It then orders the
slides per book and injects `prev`/`next`, `index`, `total`, `pageNum`, `lessonTotal`, `lessonInfo`,
`lastLesson`, a shared `toc`, and `jsText` (the JSON of texts for the JS). `src/pages/[...lang]/manifest.webmanifest.ts` writes one
manifest per book from `ui.yml`'s `app:` block. Adding a page means a `.md` in the content
folders that want it plus a scene with the same number. Content files can be renamed or translated because scenes are matched
by number, but a rename changes the URL, and saved progress is keyed by URL. Adding a lesson means an entry in
`lessons.yml`, a content folder, a scenes folder, and a `--lN` colour token plus its `[data-lesson="N"]` accent rule
in `base.css`. Adding a language means copying `src/content/it/` to a new folder and adding it to `BOOKS`. A book not at `/` also needs an entry in `books` in `astro.config.mjs`.

**Page anatomy.** The `.md` body is Lumi's speech bubble (or the intro on a `kind: cover` page and the diploma
bubble on `kind: cert`). Frontmatter holds `title`, `when`, `task`, `fact`, `kind`, and the scene's own texts,
named descriptively: `slider`, `steps`, `cards`, `spots`, `chips`, `bins`, `labels`, `button(s)`, `caption`,
`canvas` (aria-label), `strings` (read by JS). `Slide.astro` renders the bubble, the boxes and the cover text, then
the scene, passing the whole page as props. The scene holds only markup/SVG/`@scope` CSS and reads those keys from
`Astro.props` (index-based for lists, so
list order in the `.md` must match the markup). Render texts with `<Fragment set:html={md(text)} />` where inline Markdown is allowed;
Astro escapes plain `{text}` and attributes itself. Elements marked `data-speak` (plus `main h1`) are what the read-aloud feature
speaks. Scenes are usually inline SVG (`viewBox="0 0 400 300"` inside `.scene`). Reusable cut-out shapes are
`<symbol>`s in `components/Sprite.astro`, referenced via `<use href="#id">`. Longer structured texts a component needs
at runtime are rendered by the scene into markup the component reads, e.g. `<template data-nucleus="2-2">` for
`<nucleus-builder>`, rather than being hard-coded in JS.

Gotchas:
- `.md` pages are plain Markdown, so `{ }` in content is literal.
- Scene styles must be `<style is:inline>`: Astro would otherwise move them, and `@scope` needs them in place.
- `compressHTML` stays off: compression drops line breaks next to `{expressions}` and joins words.
- Internal links go through `link()` from `src/lib/text.ts`, which adds the base path.
- Markdown bold renders as `<strong>`, not `<b>`, so CSS must not rely on `b` for authored text.
- Scenes destructure frontmatter keys from `Astro.props`, so avoid JS reserved words as key names (e.g. `continue`).
- Pass `data-steps` and other JSON attributes as `{JSON.stringify(steps)}`.
- Don't use `var(--tx-*)` inside a scene's inline `<style>`: relative `url()`s in custom properties resolve against the
  page there. Put material rules in a stylesheet (the diploma's `.cert` is an example).
- Symbols in `Sprite.astro` aren't reached by the `.scene` outline rule, so they must not have outlines of their own.

**JS modules** (`src/assets/js/`, bundled by Astro from `Base.astro` via `app.js`):
- `core.js` — shared state and helpers: `t(key, vars)` and `locale` (from the `#lumi-text` JSON that `Base.astro`
  writes from `jsText`), `progress` (localStorage key `lumi-v1`: visited, done, medals, sound), `sound()` (Web
  Audio synth, no audio files), `confetti()`, `toast()`, `shuffle()`, `reduceMotion`.
  `pageDone(el)` is the contract for activities: any interactive component calls it when the child completes the
  page's activity; it awards a star once and dispatches `lumi:progress`.
- `components.js` — all custom elements (registered via an idempotent `define()` helper). Components drive CSS by
  setting custom properties: `<scene-slider>` sets `--t` (0→1), `<tap-scene>`/`<hold-button>` set `--p`, so scenes
  animate purely in CSS.
- `canvas.js` — `<space-canvas mode="…">`, large; dynamically imported by `app.js` only on pages that contain one.
- `lamp.js` — desk light and diorama parallax from pointer/device tilt; switches to `[data-lite]` on slow devices.
- `store.js` — the Alpine store `book`: stars, medals, visited marks, sound, read-aloud, index. The `x-*` attributes in
  `Base.astro`, `Toc.astro`, `Slide.astro` and `Home.astro` read it. Components never touch it: they save through
  `progress` and fire `lumi:progress`, and `app.js` then calls `sync()`.
- `app.js` — navigation (arrows/keyboard/swipe/trackpad), SW registration, starts Alpine.

**CSS** is layered: `main.css` declares `@layer reset, tokens, base, layout, components, scenes, pages;` and imports
`base.css` (reset/tokens/base/layout), `components.css`, `scenes.css` and `home.css`. Design tokens (colours incl.
`--l1…--l4`, fonts, materials) are in the `tokens` layer of `base.css`. Uses modern CSS freely (nesting, `@scope`, `@property`, `:has()`,
container queries, `oklch()`, cross-document View Transitions) — no need to add fallbacks for old browsers.

**The cardboard look.** Everything should be something you could build from board and paper, lit by one lamp at the
top left, so shadows fall down and right. Materials are tiles in `src/assets/textures/` baked by `tools/textures/bake.js`
(`--tx-board`, `--tx-grain`, …), multiplied on a colour with `background-blend-mode`. Cut edges use `#cut`, `#torn` and
`#cutout`, the SVG filters at the top of `components/Sprite.astro`. `scenes.css` turns inline SVG into paper automatically:
filled shapes lose the `#1d1846` outline (open strokes stay as felt tip) and each top-level piece of a `.scene` gets
`#cutout`. `.scene` is a diorama: back wall, art, `::before` frame, `::after` grain. The book is dyed card, not plain
brown: `--tx-board` is undyed, so multiply it on a palette colour. Bare kraft only shows in cut edges and thickness.

**Offline / service worker.** Production builds set `data-offline` on `<html>`, which gates SW registration.
After a build, the `astro:build:done` hook in `astro.config.mjs` walks `dist/`, hashes the files, and writes one `sw.js` per book
(so neither lists the other) from the `src/lib/sw-template.js` template by replacing `"__VERSION__"`, `__PREFIX__`, `__ROOT__` and `__FILES__`. Any output change bumps the version. Paths in
the precache list are relative so the site works under a GitHub Pages sub-path.

**Base path.** Always pass internal URLs through `link()` (`link("/assets/...")`, `link(home)`) in templates; don't
hard-code the repo sub-path or the language prefix. Files in `public/` keep their paths; anything imported from
`src/assets/` gets a hashed `/_astro/` URL.

## Licensing

Code (`astro.config.mjs`, `src/lib/`, `src/pages/`, JS, CSS, `Base.astro`, `Slide.astro`, other components) is 0BSD;
content (`src/content/`, `Home.astro`, `src/scenes/`, `Sprite.astro`) is CC0. Bundled fonts are OFL — keep their
`OFL-*.txt` files in `public/assets/fonts/`.
