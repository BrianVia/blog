import { defineConfig } from "astro/config";

import tailwind from "@astrojs/tailwind";

// https://astro.build/config
import sitemap from "@astrojs/sitemap";

// https://astro.build/config
import robotsTxt from "astro-robots-txt";

// https://astro.build/config
export default defineConfig({
  image: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.amazonaws.com",
      },
    ],
  },
  integrations: [tailwind(), sitemap(), robotsTxt()],
  site: `https://brianvia.blog`,
  trailingSlash: "never",
  build: {
    format: "preserve",
  },
  markdown: {
    gfm: true,
    breaks: false,
    pedantic: false,
    tables: true,
    sanitize: false,
  },
});