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

/**
 * Offline support: once the site is written, list every file in it and write
 * sw.js from the src/lib/sw-template.js template. Its VERSION is a hash of all the files,
 * so any change to the book makes browsers download the new version.
 * Paths are relative to sw.js, so they work under any base path.
 */
const offline = () => ({
  name: "lumi-offline",
  hooks: {
    "astro:build:done": async ({ dir, logger }) => {
      const dest = fileURLToPath(dir);
      const hash = createHash("sha256");
      const files = [];
      for (const file of await walk(dest)) {
        const path = relative(dest, file).split("\\").join("/");
        // the social card is only for link previews, the app never shows it
        if (path === "sw.js" || path.split("/").at(-1).startsWith(".") || path.startsWith("assets/images/social.")) {
          continue;
        }
        // pages are served as folders: "lezione-1/00-copertina/index.html" -> "lezione-1/00-copertina/"
        const url = path === "index.html" ? "./" : path.replace(/(^|\/)index\.html$/, "$1");
        files.push(url);
        hash.update(url).update(await readFile(file));
      }
      const version = hash.digest("hex").slice(0, 12);
      const template = await readFile(new URL("./src/lib/sw-template.js", import.meta.url), "utf8");
      const sw = template
        .replace('"__VERSION__"', JSON.stringify(version))
        .replace("__FILES__", JSON.stringify(files, null, 2));
      await writeFile(join(dest, "sw.js"), sw);
      logger.info(`Service worker: ${files.length} files, version ${version}`);
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
