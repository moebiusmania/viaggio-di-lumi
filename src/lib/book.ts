import type { AstroComponentFactory } from "astro/runtime/server/index.js";
import { getCollection } from "astro:content";

/**
 * All the texts live in src/content/<lang>/ (Markdown pages + _data/*.yml);
 * all the code (layouts, scenes, CSS, JS) lives elsewhere. The first language
 * is served at the site root, the others under /<lang>/.
 */
export const LANGS = ["it"];

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

const homeOf = (lang: string) => lang === LANGS[0] ? "/" : `/${lang}/`;

/**
 * Turns the content folders into books, one per language:
 * - content/it/index.md becomes the home page, lezione-N/NN-*.md the pages
 *   of lesson N, ordered by their number (03-zuppa.md -> 3);
 * - every page gets previous/next links, its position on the cosmic journey,
 *   the table of contents and the texts the JS needs.
 */
async function build() {
  const entries = await getCollection("book");
  const pages: Record<string, any>[] = [];

  for (const lang of new Set(entries.map((e) => e.id.split("/")[0]))) {
    if (!LANGS.includes(lang)) throw new Error(`Unknown language "${lang}": add it to LANGS in src/lib/book.ts`);
  }

  for (const lang of LANGS) {
    const home = homeOf(lang);
    const ui = yml(`${lang}/_data/ui.yml`);
    const lessons = yml(`${lang}/_data/lessons.yml`);
    const own = entries.filter((e) => e.id.startsWith(`${lang}/`));
    const book = own.map((entry) => {
      const path = entry.id.slice(lang.length + 1);
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
        pages: lessonSlides.map((s) => ({ title: s.title, url: s.url, kind: s.kind ?? "page" })),
      };
    });

    slides.forEach((page, i) => {
      const lessonInfo = toc.find((l: any) => l.n === page.lesson);
      if (!lessonInfo) throw new Error(`Lesson ${page.lesson} is missing from content/${lang}/_data/lessons.yml`);
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
      const text = { locale: ui.app.locale, ...ui.js, ...page.strings };
      page.jsText = JSON.stringify(text).replaceAll("<", "\\u003c");
      pages.push(page);
    }
  }
  return pages;
}

let cache: ReturnType<typeof build> | undefined;
export const allPages = () => (import.meta.env.DEV ? build() : (cache ??= build()));

/** The app name and description of each language, for its web app manifest. */
export const appOf = (lang: string) => yml(`${lang}/_data/ui.yml`).app;
