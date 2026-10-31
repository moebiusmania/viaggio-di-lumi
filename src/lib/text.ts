import MarkdownIt from "markdown-it";

const markdown = new MarkdownIt({ html: true });

/** Inline Markdown in a frontmatter text: `**bold**` and so on, with no surrounding <p>. */
export const md = (text: unknown) => markdown.renderInline(String(text ?? ""));

/** "{name}" placeholders in UI texts, e.g. fill(ui.page.kicker, { lesson, page }) */
export const fill = (text: unknown, vars: Record<string, unknown>) =>
  String(text ?? "").replace(/\{(\w+)\}/g, (all, key) => String(vars[key] ?? all));

/** An internal address with the site's base path (e.g. /<repo>/ on GitHub Pages). */
export const link = (path: string) => import.meta.env.BASE_URL.replace(/\/$/, "") + path;
