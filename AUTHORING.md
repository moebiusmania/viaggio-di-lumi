# Editing the texts

Every word of the book lives in **`src/content/it/`**. You can change anything in that folder without touching the
code: the illustrations, games and styles are in other folders (`src/scenes/`, `src/components/`, `src/assets/`) and read the texts
from here.

```
src/content/it/
  index.md                 the cover of the book
  lezione-1/
    00-copertina.md        one file per page, in reading order (the number sets the order)
    01-prima-di-tutto.md
    …
    10-quiz.md
  lezione-2/ … lezione-4/
  _data/
    lessons.yml            title, subtitle and date of each lesson
    ui.yml                 buttons, menus and the messages of the games
```

To see your changes, run `bun run dev` and open <http://localhost:3000>. The page reloads by itself every time
you save.

## A page

Each page is a Markdown file. The part between the two `---` lines holds the page's details and the texts of its
game. Below it is what Lumi says in the speech bubble:

```md
---
title: "BUM! Il Big Bang"
when: "13,8 miliardi di anni fa"
task: "Premi il pulsante e fai partire il conto alla rovescia."
fact: "Il nome «Big Bang» lo inventò per scherzo l'astronomo Fred Hoyle..."
button: "3, 2, 1... BUM! 💥"
caption: "Il puntino caldissimo aspetta... sei pronto?"
---

All'improvviso quel puntino caldissimo ha cominciato a **crescere**...

Attenzione però: non è stato uno scoppio _dentro_ lo spazio...
```

| Field    | Where it shows                                                                  |
| -------- | ------------------------------------------------------------------------------- |
| `title`  | the page heading, the index and the browser tab                                 |
| `when`   | the time badge at the top ("13,8 miliardi di anni fa")                          |
| `task`   | the "Prova tu!" box: what the child should do                                   |
| `fact`   | the "Lo sapevi?" box: a curious fact that opens on tap                          |
| _(body)_ | Lumi's speech bubble. Leave an empty line between paragraphs.                   |
| `kind`   | `cover`, `quiz` or `cert` (the diploma). Don't change it; other pages leave it out. |

The other fields hold the words of that page's game: button labels, slider ends, captions, cards, quiz questions and
so on. Their names say what they are, and a `#` comment above them explains the less obvious ones.

## Rules to keep in mind

- **Write the text, keep the names.** Change what comes after `title:`, never `title` itself. The same goes for the
  names inside `strings:`, `labels:`, `buttons:` and similar fields.
- **Keep the quotes.** Texts go between `"double quotes"`. An apostrophe (`l'universo`) is fine inside them. To use
  a double quote in a text, write `«»` instead, as the book already does.
- **Keep the order of lists.** In `cards`, `spots`, `chips`, `bins`, `steps` and `quiz`, each item is tied to a
  picture or a position by its place in the list. You can change the words of an item, but don't reorder, add or
  remove items. That needs a change in the matching illustration.
  - `steps` are the captions of a slider, from left to right.
  - In the ordering games (`07-granelli`, `09-grande-viaggio`) the list **is** the right answer, from first to last.
    The game shuffles the chips by itself.
- **Quiz answers.** `answer: 2` means the second option is the right one (counting from 1).
- **`{words in braces}`** are filled in by the app (`{n} su {total}` becomes "3 su 7"). Keep them, but you can
  move them within the sentence.
- **Formatting.** In the bubble, `task`, `fact`, cards, quizzes and hotspot tips you can use `**bold**` and
  `_italic_`. Captions that change while the child plays (`steps`, everything under `strings:`) are plain text.
- **Lists picked at random.** A list in `strings:` or in `ui.yml` (like `praise`) means that one of its items is
  chosen at random each time. You can add or remove items there.

## Pages and files

The number at the start of a file name sets the page order. The rest of the name becomes the page address
(`lezione-1/03-palloncino.md` → `/lezione-1/03-palloncino/`). Renaming a file changes its address, so saved
progress for that page is lost. Adding, removing or renumbering pages also needs a developer, because every page
has its own illustration in `src/scenes/`.

## Translating the book

1. Copy `src/content/it/` to `src/content/<code>/`, e.g. `src/content/en/`.
2. Translate every `.md` file and both files in `_data/`. In `ui.yml`, set `locale` (e.g. `en-GB`): it picks the
   read-aloud voice and the date format.
3. Ask a developer to add the language code to `LANGS` in `src/lib/book.ts`.

You can translate the file and folder names too (`lezione-1/03-palloncino.md` → `lesson-1/03-balloon.md`), as long
as the numbers stay the same. The translated book is served at `/<code>/` (e.g. `/en/lesson-1/03-balloon/`).
