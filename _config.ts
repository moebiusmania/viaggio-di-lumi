import lume from "lume/mod.ts";
import basePath from "lume/plugins/base_path.ts";
import { Page } from "lume/core/file.ts";

const site = lume({ src: "./src" });

// `deno task serve` sets this: no service worker while developing
const dev = Deno.env.get("LUME_LIVE_RELOAD") === "true";
site.data("offline", !dev);

site.add("assets");
// Prefix internal URLs with the --location path (e.g. /<repo>/ on GitHub Pages)
site.use(basePath());

// "{name}" placeholders in UI texts, e.g. {{ ui.page.kicker |> fill({ lesson, page }) }}
site.filter("fill", fill);

function fill(text: string, vars: Record<string, unknown>) {
  return String(text ?? "").replace(/\{(\w+)\}/g, (all, key) => String(vars[key] ?? all));
}

/**
 * All the texts live in src/content/<lang>/ (Markdown pages + _data/*.yml);
 * all the code (layouts, scenes, CSS, JS) lives elsewhere. The first language
 * is served at the site root, the others under /<lang>/.
 */
const LANGS = ["it"];

interface Lesson {
  n: number;
  title: string;
  subtitle: string;
  when: string;
}

/**
 * The scene (illustration + activity) of a page is the file in
 * src/_includes/scenes/ with the same lesson and page number
 * (lezione-1/03-palloncino.md -> scenes/lezione-1/03-*.vto), so content
 * files can be renamed or translated freely. Quizzes share scenes/quiz.vto.
 */
function findScenes() {
  const scenes = new Map<string, string>();
  const dir = site.src("_includes/scenes");
  for (const folder of Deno.readDirSync(dir)) {
    const lesson = folder.name.match(/(\d+)$/)?.[1];
    if (!folder.isDirectory || !lesson) continue;
    for (const file of Deno.readDirSync(`${dir}/${folder.name}`)) {
      const order = parseInt(file.name, 10);
      if (!Number.isNaN(order)) scenes.set(`${Number(lesson)}/${order}`, `scenes/${folder.name}/${file.name}`);
    }
  }
  return scenes;
}

/**
 * Turns the content folders into books, one per language:
 * - src/content/it/index.md becomes the home page, lezione-N/NN-*.md the pages
 *   of lesson N, ordered by their number (03-zuppa.md -> 3);
 * - every page gets previous/next links, its position on the cosmic journey,
 *   the table of contents and the texts the JS needs.
 */
site.preprocess([".html"], (pages) => {
  const scenes = findScenes();
  const books = new Map<string, Lume.Page[]>();

  for (const page of pages) {
    const [, lang, path] = page.src.path.match(/^\/content\/([^/]+)\/(.+)$/) ?? [];
    if (!lang) continue;
    if (!LANGS.includes(lang)) throw new Error(`Unknown language "${lang}": add it to LANGS in _config.ts`);
    const data = page.data;
    const home = lang === LANGS[0] ? "/" : `/${lang}/`;
    Object.assign(data, { lang, home, url: path === "index" ? home : `${home}${path}/` });
    if (!books.has(lang)) books.set(lang, []);

    const slide = path.match(/^[^/]*?(\d+)\/(\d+)-[^/]+$/);
    if (path === "index") {
      data.layout = "layouts/home.vto";
    } else if (slide) {
      data.lesson = Number(slide[1]);
      data.order = Number(slide[2]);
      data.layout = "layouts/page.vto";
      data.scene = data.kind === "quiz" ? "scenes/quiz.vto" : scenes.get(`${data.lesson}/${data.order}`);
      if (!data.scene) {
        throw new Error(
          `No scene for ${page.src.path}: add src/_includes/scenes/lezione-${data.lesson}/${slide[2]}-….vto`,
        );
      }
      books.get(lang)!.push(page);
    }
  }

  for (const [lang, slides] of books) {
    const langPages = pages.filter((p) => p.data.lang === lang);
    const lessons = (langPages[0]?.data.lessons ?? []) as Lesson[];
    slides.sort((a, b) => a.data.lesson - b.data.lesson || a.data.order - b.data.order);

    const toc = lessons.map((lesson) => {
      const lessonSlides = slides.filter((s) => s.data.lesson === lesson.n);
      return {
        ...lesson,
        url: lessonSlides[0]?.data.url,
        pages: lessonSlides.map((s) => ({
          title: s.data.title,
          url: s.data.url,
          kind: s.data.kind ?? "page",
        })),
      };
    });

    slides.forEach((page, i) => {
      const data = page.data;
      const lessonInfo = toc.find((l) => l.n === data.lesson);
      if (!lessonInfo) throw new Error(`Lesson ${data.lesson} is missing from content/${lang}/_data/lessons.yml`);
      Object.assign(data, {
        index: i,
        total: slides.length,
        prev: slides[i - 1]?.data.url ?? data.home,
        next: slides[i + 1]?.data.url ?? data.home,
        lessonInfo,
        pageNum: lessonInfo.pages.findIndex((p) => p.url === data.url) + 1,
        lessonTotal: lessonInfo.pages.length,
        lastLesson: toc.at(-1)?.n,
      });
    });

    for (const page of langPages) {
      page.data.toc = toc;
      // texts for the JS: the shared ones in _data/ui.yml, overridden by the page's own `strings`
      const text = { locale: page.data.ui?.app?.locale, ...page.data.ui?.js, ...page.data.strings };
      page.data.jsText = JSON.stringify(text).replaceAll("<", "\\u003c");
    }
  }
});

/** One web app manifest per language, with the name and description from _data/ui.yml */
site.process("*", (pages, allPages) => {
  for (const lang of LANGS) {
    const app = pages.find((p) => p.data.lang === lang)?.data.ui?.app;
    if (!app) continue;
    const up = lang === LANGS[0] ? "" : "../";
    const icon = (src: string, sizes: string, type: string, purpose = "any") => ({
      src: up + src,
      sizes,
      type,
      purpose,
    });
    const manifest = {
      id: "./",
      name: app.name,
      short_name: app.shortName,
      description: app.description,
      lang,
      start_url: "./",
      scope: "./",
      display: "standalone",
      background_color: "#84623f",
      theme_color: "#c49a6c",
      categories: ["education", "kids", "books"],
      icons: [
        icon("assets/icons/icon-192.png", "192x192", "image/png"),
        icon("assets/icons/icon-512.png", "512x512", "image/png"),
        icon("assets/icons/icon-512.png", "512x512", "image/png", "maskable"),
        icon("assets/icons/icon.svg", "any", "image/svg+xml"),
      ],
    };
    const url = `${lang === LANGS[0] ? "/" : `/${lang}/`}manifest.webmanifest`;
    allPages.push(Page.create({ url, content: JSON.stringify(manifest, null, 2) + "\n" }));
  }
});

/**
 * Offline support: once the site is written, list every file in it and write
 * sw.js from the src/_sw.js template. Its VERSION is a hash of all the files,
 * so any change to the book makes browsers download the new version.
 * Paths are relative to sw.js, so they work under any base path.
 */
site.addEventListener("afterBuild", async () => {
  if (dev) return;
  const dest = site.dest();
  const files: string[] = [];
  const hash: Uint8Array[] = [];
  const encoder = new TextEncoder();

  async function walk(dir: string) {
    const entries = await Array.fromAsync(Deno.readDir(`${dest}/${dir}`));
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const path = dir ? `${dir}/${entry.name}` : entry.name;
      if (entry.isDirectory) await walk(path);
      // the social card is only for link previews, the app never shows it
      else if (
        entry.isFile && path !== "sw.js" && !entry.name.startsWith(".") && !path.startsWith("assets/images/social.")
      ) {
        // pages are served as folders: "lezione-1/00-copertina/index.html" -> "lezione-1/00-copertina/"
        const url = path === "index.html" ? "./" : path.replace(/(^|\/)index\.html$/, "$1");
        files.push(url);
        hash.push(encoder.encode(url), await Deno.readFile(`${dest}/${path}`));
      }
    }
  }
  await walk("");

  const digest = await crypto.subtle.digest("SHA-256", await new Blob(hash).arrayBuffer());
  const version = Array.from(new Uint8Array(digest).slice(0, 6), (b) => b.toString(16).padStart(2, "0")).join("");
  const template = await Deno.readTextFile(site.src("_sw.js"));
  const sw = template
    .replace('"__VERSION__"', JSON.stringify(version))
    .replace("__FILES__", JSON.stringify(files, null, 2));
  await Deno.writeTextFile(`${dest}/sw.js`, sw);
  console.log(`Service worker: ${files.length} files, version ${version}`);
});

export default site;
