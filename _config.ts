import lume from "lume/mod.ts";
import basePath from "lume/plugins/base_path.ts";

const site = lume({ src: "./src" });

// `deno task serve` sets this: no service worker while developing
const dev = Deno.env.get("LUME_LIVE_RELOAD") === "true";
site.data("offline", !dev);

site.add("assets");
site.add("manifest.webmanifest");
// Prefix internal URLs with the --location path (e.g. /<repo>/ on GitHub Pages)
site.use(basePath());

interface Lesson {
  n: number;
  title: string;
  subtitle: string;
  when: string;
}

/**
 * Chains every "slide" page (the pages inside src/lezione-N) into one
 * ordered book: previous/next links, position on the cosmic journey and
 * the table of contents shared by every page.
 * Page order comes from the numeric prefix of the file name (03-zuppa.vto).
 */
site.preprocess([".html"], (pages) => {
  const lessons = (pages[0]?.data.lessons ?? []) as Lesson[];

  const slides = pages
    .filter((p) => p.data.type === "slide")
    .map((p) => {
      p.data.order = parseInt(p.src.path.split("/").pop() ?? "0", 10);
      return p;
    })
    .sort((a, b) => a.data.lesson - b.data.lesson || a.data.order - b.data.order);

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
    const lessonInfo = toc[data.lesson - 1];
    Object.assign(data, {
      index: i,
      total: slides.length,
      prev: slides[i - 1]?.data.url ?? "/",
      next: slides[i + 1]?.data.url ?? "/",
      lessonInfo,
      pageNum: lessonInfo.pages.findIndex((p) => p.url === data.url) + 1,
      lessonTotal: lessonInfo.pages.length,
    });
  });

  for (const page of pages) page.data.toc = toc;
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
      else if (entry.isFile && path !== "sw.js" && !entry.name.startsWith(".")) {
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
