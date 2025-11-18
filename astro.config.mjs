import { defineConfig } from "astro/config";

import tailwind from "@astrojs/tailwind";

// https://astro.build/config
import sitemap from "@astrojs/sitemap";

// https://astro.build/config
import robotsTxt from "astro-robots-txt";

// https://astro.build/config
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