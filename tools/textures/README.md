# Texture bakery

`bake.js` generates the materials in `src/assets/textures/` (kraft board, paper, black card, cut edge, bare
ribs). The site loads only the resulting WebP files, so there is no build step and they work offline.

To change a material, edit `bake.js`, load it as a module in a page in a Chromium browser (WebP encoding via
`OffscreenCanvas.convertToBlob` is Chromium-only), and save the base64 result of `bake("kraft")` as
`src/assets/textures/kraft.webp`. Any headless browser driver can automate it.
