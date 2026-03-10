import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";
import sitemap from "@astrojs/sitemap";
import robotsTxt from "astro-robots-txt";

export default defineConfig({
  integrations: [
    tailwind(),
    sitemap({
      // Only include standard sitemap namespace - exclude video/news/etc to reduce bloat
      namespaces: {
        xhtml: true,
        news: false,
        video: false,
        image: false,
      },
    }),
    robotsTxt(),
  ],
  site: `https://brianvia.blog`,
  trailingSlash: "never",
  markdown: {
    gfm: true,
    breaks: false,
    pedantic: false,
    tables: true,
    sanitize: false,
  },
  build: {
    // Enable prerender route conflict detection to catch routing bugs at build time
    failOnPrerenderConflict: true,
  },
});