import type { APIRoute } from "astro";
import { appOf, BOOKS } from "../../lib/book";

/** One web app manifest per book, with the name and description from _data/ui.yml */
export const getStaticPaths = () =>
  BOOKS.map(({ folder, lang, home }) => ({
    params: { lang: home.replace(/^\/|\/$/g, "") || undefined },
    props: { folder, lang, up: home === "/" ? "" : "../" },
  }));

export const GET: APIRoute = ({ props: { folder, lang, up } }) => {
  const app = appOf(folder);
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
