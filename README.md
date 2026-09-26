# Il viaggio di Lumi

An interactive picture book for children aged 7–9, in Italian: from the Big Bang
to the birth of the Earth. It has four lessons of about 30 minutes each, and
each lesson ends with a quiz and a medal. The book ends with a printable
diploma.

Built with [Deno](https://deno.com) and [Lume](https://lume.land) (_static site
generator, Vento templates_), vanilla CSS and vanilla JS web components. There
are no frameworks and no build step for CSS or JS.

## Commands

```sh
deno task serve   # dev server with live reload on http://localhost:3000
deno task build   # static site in _site/
```

## Structure

```
_config.ts                 Lume config: turns each content folder into a book (prev/next, index, TOC),
                           matches every page with its scene, writes the manifest and sw.js
AUTHORING.md               how to edit (and translate) the texts, for non-developers
src/
  content/it/              ALL the texts of the book, and nothing else (see AUTHORING.md)
    index.md               the book cover (home page)
    lezione-N/NN-name.md   one Markdown file per page, ordered by their number
    _data/lessons.yml      the 4 lessons (title, subtitle, date)
    _data/ui.yml           interface texts: menus, buttons, messages of the games
  _sw.js                   service worker template (offline cache + updates)
  _includes/layouts/       base.vto (shell, top bar) · page.vto (book page, pager) · home.vto (cover)
  _includes/scenes/        the stage of each page (illustration + activity), code only:
                           lezione-N/NN-*.vto matches the page with the same lesson and number;
                           quiz.vto is shared by the four quizzes
  _includes/partials/      toc.vto (index dialog) · sprite.vto (cartoon SVG symbols) · medal.vto
                           credits.vto (license footnote on cover + index)
  assets/css/              base.css (fonts, tokens, layout, page transitions) · components.css · scenes.css
  assets/icons/            app icons: icon.svg is the source, the PNGs are rendered from it
  assets/fonts/            Baloo 2 + Nunito variable woff2 (latin, latin-ext) and their OFL texts
  assets/js/
    app.js                 navigation (arrows, keyboard, swipe, trackpad), TOC, progress, read-aloud
    core.js                texts (t()), saved progress (localStorage), confetti, sounds, "activity done" stars
    components.js          <scene-slider> <hold-button> <flip-card> <hot-spots> <sort-game>
                           <order-game> <tap-scene> <torch-reveal> <quiz-set> <nucleus-builder>
                           <fusion-game> <candy-jar> <anim-trigger> <name-cert>
    canvas.js              <space-canvas mode="bang|soup|static|gravity|supernova|accretion|earth">
```

## Offline and installable

The book is a PWA: it can be installed on a phone, tablet or computer, and it
works fully offline. After every production build, `_config.ts` lists all the
files in `_site/` and writes `sw.js` from the `src/_sw.js` template, with a
version hash of the whole site. On the first visit the service worker stores
the whole book (about 1.5 MB).

When a new version is deployed, `sw.js` changes. The app checks for it when a
page loads, when the connection comes back and when the app returns to the
foreground (at most every 30 minutes). The new version downloads in the
background and shows up on the next page turn. The page on screen doesn't
reload.

`deno task serve` doesn't generate `sw.js`, and it removes any service worker
left over from a production build, so live reload keeps working.

## Texts and code are separate

Every text lives in `src/content/<lang>/`. Authors edit Markdown and YAML there without touching any code. See
[AUTHORING.md](AUTHORING.md). A page is a `.md` file. Its frontmatter holds the page details and the words of its
activity, and its body is Lumi's speech bubble:

```yaml
---
title: "Lo spazio si gonfia"
when: "Una frazione di secondo dopo il Big Bang"   # shown in the time badge
task: "What the child should do"                   # "Prova tu!" box
fact: "Fun fact"                                   # collapsible "Lo sapevi?" box
kind: cover | quiz | cert                          # optional
slider: { from: "🎈", to: "🎈🎈🎈", label: "..." }    # scene-specific texts, read by its scene
steps: ["...", "..."]
strings:                                           # texts the JS shows (see core.js t())
  boom: "..."
---
Lumi's speech bubble, in **Markdown**.
```

The stage (illustration + activity) is the scene with the same lesson and page number in
`src/_includes/scenes/lezione-N/NN-*.vto`. It gets the page data, so it writes `{{ slider.from }}`,
`{{ spots[0].tip |> md(true) }}` and so on. Scene-specific styles live next to the scene in a
`<style>@scope { … }</style>` block. Most scenes are SVG with a `viewBox="0 0 400 300"` inside a `.scene` (4:3).
`<scene-slider>` exposes `--t` (0→1) so a scene can morph purely in CSS. `<tap-scene>` and `<hold-button>` expose
`--p` in the same way.

The JS never contains text. `base.vto` writes a JSON blob with `_data/ui.yml`'s `js:` texts plus the page's
`strings:`, and components read it with `t("key", { n })`. `{name}` placeholders work the same way in templates,
through the `fill` filter.

**Languages.** `LANGS` in `_config.ts` lists the content folders. The first one is served at `/`, the others at
`/<lang>/`, each with its own page chain, TOC, manifest, read-aloud voice and date format (`ui.yml` → `app.locale`).
Content files can be renamed or translated freely, because scenes are matched by lesson and page number.

## Modern platform features used

Cross-document View Transitions (with forward/back types), `@scope`, CSS
nesting, `@layer`, `@property`, container queries, `:has()`, `@starting-style`
and `allow-discrete` transitions on `<dialog>`, `::details-content`, exclusive
`<details name>`, `linear()` easing, `oklch()`/`color-mix()`/relative colours,
`text-wrap: balance|pretty`, Service Worker + Web App Manifest (offline, installable), Web Animations, Web Audio (synthesized sounds) and
the Speech Synthesis API (Italian read-aloud).

## How it was made

This project was generated by an AI assistant, [Claude](https://claude.ai) by
Anthropic. Claude wrote both the code and the content (lesson texts, quizzes
and illustrations). Two people reviewed the work.

## License

- **Code** (`_config.ts`, `src/assets/js/`, `src/assets/css/`, `base.vto`, `page.vto` and the partials):
  [0BSD](LICENSE).
- **Content** (texts in `src/content/`, illustrations in `src/_includes/scenes/`,
  `src/_includes/layouts/home.vto` and `src/_includes/partials/sprite.vto`):
  [CC0 1.0](LICENSE-CONTENT), public domain.
- **Fonts** (bundled in `src/assets/fonts/`): [Baloo 2](src/assets/fonts/OFL-Baloo2.txt)
  and [Nunito](src/assets/fonts/OFL-Nunito.txt), under the SIL Open Font License 1.1.

You can use, copy, adapt and share the book, also in class or commercially,
without asking permission and without having to credit anyone. Only the fonts
keep their own license: if you redistribute them, include their `OFL-*.txt` files.
