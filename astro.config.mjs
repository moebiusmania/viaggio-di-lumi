import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "astro/config";
import { parse } from "yaml";

/** Lets the code import the texts in src/content/<lang>/_data/*.yml, with live reload. */
const yaml = () => ({
  name: "lumi-yaml",
  enforce: "pre",
  transform(code, id) {
    if (id.endsWith(".yml")) return { code: `export default ${JSON.stringify(parse(code))}`, map: null };
  },
});

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  entries.sort((a, b) => a.name.localeCompare(b.name));
  const files = await Promise.all(entries.map((e) => {
    const path = join(dir, e.name);
    return e.isDirectory() ? walk(path) : [path];
  }));
  return files.flat();
}

/** The folder of each book in dist/, and the prefix of its offline cache. See BOOKS in src/lib/book.ts. */
const books = [
  { home: "", prefix: "lumi-" },
  { home: "lessons/", prefix: "lessons-" },
];

/**
 * Offline support: once the site is written, write one sw.js per book from the
 * src/lib/sw-template.js template, listing that book's pages and the shared files.
 * Its VERSION is a hash of those files, so any change to the book makes browsers
 * download the new version. Each worker knows only its own book, so sw.js never
 * gives away the other one. Paths are relative to sw.js, so they work under any base path.
 */
const offline = () => ({
  name: "lumi-offline",
  hooks: {
    "astro:build:done": async ({ dir, logger }) => {
      const dest = fileURLToPath(dir);
      const paths = (await walk(dest)).map((file) => relative(dest, file).split("\\").join("/")).filter((path) => {
        const name = path.split("/").at(-1);
        // the social card is only for link previews, the app never shows it
        return name !== "sw.js" && !name.startsWith(".") && !path.startsWith("assets/images/social.");
      });
      const template = await readFile(new URL("./src/lib/sw-template.js", import.meta.url), "utf8");

      for (const { home, prefix } of books) {
        const root = "../".repeat(home.split("/").length - 1) || "./";
        const inBook = (path) => (home ? path.startsWith(home) : !books.some((b) => b.home && path.startsWith(b.home)));
        const hash = createHash("sha256");
        const files = [];
        for (const path of paths) {
          let url;
          if (inBook(path)) {
            // pages are served as folders: "lezione-1/00-copertina/index.html" -> "lezione-1/00-copertina/"
            const own = path.slice(home.length);
            url = own === "index.html" ? "./" : own.replace(/(^|\/)index\.html$/, "$1");
          } else if (home && /^(_astro|assets)\//.test(path)) {
            url = root + path;
          } else {
            continue;
          }
          files.push(url);
          hash.update(url).update(await readFile(join(dest, path)));
        }
        const version = hash.digest("hex").slice(0, 12);
        const sw = template
          .replace('"__VERSION__"', JSON.stringify(version))
          .replace("__PREFIX__", prefix)
          .replace("__ROOT__", root)
          .replace("__FILES__", JSON.stringify(files, null, 2));
        await writeFile(join(dest, home, "sw.js"), sw);
        logger.info(`Service worker for /${home}: ${files.length} files, version ${version}`);
      }
    },
  },
});

// CI passes --site and --base for the GitHub Pages address
export default defineConfig({
  site: "http://localhost:3000",
  build: { format: "directory" },
  // line breaks next to {expressions} must stay spaces, or the words on either side join up
  compressHTML: false,
  server: { port: 3000 },
  devToolbar: { enabled: false },
  // authors' punctuation is kept exactly as they wrote it
  markdown: { smartypants: false, syntaxHighlight: false },
  integrations: [offline()],
  vite: { plugins: [yaml()] },
});
