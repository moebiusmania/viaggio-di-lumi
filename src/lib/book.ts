import type { AstroComponentFactory } from "astro/runtime/server/index.js";
import { getCollection } from "astro:content";

/**
 * All the texts live in src/content/<folder>/ (Markdown pages + _data/*.yml);
 * all the code (layouts, scenes, CSS, JS) lives elsewhere. Each folder is a book:
 * a language of it, or a different edition. Books share the scenes, and each one
 * has its own address and saved progress. A book not served at "/" also needs an
 * entry in `books` in astro.config.mjs for its offline support.
 */
export const BOOKS = [
  { folder: "it", lang: "it", home: "/", progress: "lumi-v1" },
  { folder: "lessons", lang: "it", home: "/lessons/", progress: "lumi-lessons-v1" },
];

const yml = (file: string) =>
  import.meta.glob("../content/*/_data/*.yml", { eager: true, import: "default" })[`../content/${file}`] as any;

/**
 * The scene (illustration + activity) of a page is the file in src/scenes/ with the
 * same lesson and page number (lezione-1/03-palloncino.md -> scenes/lezione-1/03-*.astro),
 * so content files can be renamed or translated freely. Quizzes share scenes/quiz.astro.
 */
const sceneFiles = import.meta.glob("../scenes/**/*.astro", { eager: true, import: "default" });

function findScene(lesson: number, order: number): AstroComponentFactory | undefined {
  for (const [path, scene] of Object.entries(sceneFiles)) {
    const [, l, n] = path.match(/(\d+)\/(\d+)[^/]*$/) ?? [];
    if (Number(l) === lesson && Number(n) === order) return scene as AstroComponentFactory;
  }
}

/**
 * Turns the content folders into books:
 * - content/<folder>/index.md becomes the home page, lezione-N/NN-*.md the pages
 *   of lesson N, ordered by their number (03-zuppa.md -> 3);
 * - every page gets previous/next links, its position on the cosmic journey,
 *   the table of contents and the texts the JS needs.
 */
async function build() {
  const entries = await getCollection("book");
  const pages: Record<string, any>[] = [];

  for (const folder of new Set(entries.map((e) => e.id.split("/")[0]))) {
    if (!BOOKS.some((b) => b.folder === folder)) {
      throw new Error(`Unknown book "${folder}": add it to BOOKS in src/lib/book.ts`);
    }
  }

  for (const { folder, lang, home, progress } of BOOKS) {
    const ui = yml(`${folder}/_data/ui.yml`);
    const lessons = yml(`${folder}/_data/lessons.yml`);
    const own = entries.filter((e) => e.id.startsWith(`${folder}/`));
    const book = own.map((entry) => {
      const path = entry.id.slice(folder.length + 1);
      const data = {
        ...entry.data,
        lang,
        home,
        ui,
        lessons,
        content: entry.rendered?.html ?? "",
        url: path === "index" ? home : `${home}${path}/`,
      } as Record<string, any>;
      const slide = path.match(/^[^/]*?(\d+)\/(\d+)-[^/]+$/);
      if (slide) {
        data.lesson = Number(slide[1]);
        data.order = Number(slide[2]);
        data.scene = data.kind === "quiz" ? sceneFiles["../scenes/quiz.astro"] : findScene(data.lesson, data.order);
        if (!data.scene) {
          throw new Error(`No scene for ${entry.filePath}: add src/scenes/lezione-${data.lesson}/${slide[2]}-….astro`);
        }
      }
      return data;
    });

    const slides = book.filter((p) => p.lesson)
      .sort((a, b) => a.lesson - b.lesson || a.order - b.order);

    const toc = lessons.map((lesson: any) => {
      const lessonSlides = slides.filter((s) => s.lesson === lesson.n);
      return {
        ...lesson,
        url: lessonSlides[0]?.url,
        // only lessons with a quiz award a medal
        quiz: lessonSlides.some((s) => s.kind === "quiz"),
        pages: lessonSlides.map((s) => ({ title: s.title, url: s.url, kind: s.kind ?? "page" })),
      };
    });

    slides.forEach((page, i) => {
      const lessonInfo = toc.find((l: any) => l.n === page.lesson);
      if (!lessonInfo) throw new Error(`Lesson ${page.lesson} is missing from content/${folder}/_data/lessons.yml`);
      Object.assign(page, {
        index: i,
        total: slides.length,
        prev: slides[i - 1]?.url ?? home,
        next: slides[i + 1]?.url ?? home,
        lessonInfo,
        pageNum: lessonInfo.pages.findIndex((p: any) => p.url === page.url) + 1,
        lessonTotal: lessonInfo.pages.length,
        lastLesson: toc.at(-1)?.n,
      });
    });

    for (const page of book) {
      page.toc = toc;
      // texts for the JS: the shared ones in _data/ui.yml, overridden by the page's own `strings`
      const text = { locale: ui.app.locale, progressKey: progress, ...ui.js, ...page.strings };
      page.jsText = JSON.stringify(text).replaceAll("<", "\\u003c");
      pages.push(page);
    }
  }
  return pages;
}

let cache: ReturnType<typeof build> | undefined;
export const allPages = () => (import.meta.env.DEV ? build() : (cache ??= build()));

/** The app name and description of a book, for its web app manifest. */
export const appOf = (folder: string) => yml(`${folder}/_data/ui.yml`).app;
