import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";

/** Every page of the book: src/content/<lang>/index.md and lezione-N/NN-*.md. Texts only. */
const book = defineCollection({
  loader: glob({
    pattern: "*/**/*.md",
    base: "./src/content",
    generateId: ({ entry }) => entry.replace(/\.md$/, ""),
  }),
});

export const collections = { book };
