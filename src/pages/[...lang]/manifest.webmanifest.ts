import type { APIRoute } from "astro";
import { appOf, LANGS } from "../../lib/book";

/** One web app manifest per language, with the name and description from _data/ui.yml */
export const getStaticPaths = () =>
  LANGS.map((lang, i) => ({ params: { lang: i ? lang : undefined }, props: { lang, up: i ? "../" : "" } }));

export const GET: APIRoute = ({ props: { lang, up } }) => {
  const app = appOf(lang);
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
    background_color: "#1b1446",
    theme_color: "#1b1446",
    categories: ["education", "kids", "books"],
    icons: [
      icon("assets/icons/icon-192.png", "192x192", "image/png"),
      icon("assets/icons/icon-512.png", "512x512", "image/png"),
      icon("assets/icons/icon-512.png", "512x512", "image/png", "maskable"),
      icon("assets/icons/icon.svg", "any", "image/svg+xml"),
    ],
  };
  return new Response(JSON.stringify(manifest, null, 2) + "\n");
};
