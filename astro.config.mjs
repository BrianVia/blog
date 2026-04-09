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
      changefreq: "weekly",
      priority: 0.5,
      serialize(item) {
        // Boost blog posts and homepage above static pages
        if (/\/posts\/[^/]+\/?$/.test(item.url)) {
          item.changefreq = "monthly";
          item.priority = 0.9;
        } else if (/^https?:\/\/[^/]+\/?$/.test(item.url)) {
          item.changefreq = "weekly";
          item.priority = 1.0;
        } else if (/\/(links|books|feeds)\/?$/.test(item.url)) {
          item.changefreq = "weekly";
          item.priority = 0.7;
        } else {
          item.changefreq = "monthly";
          item.priority = 0.4;
        }
        return item;
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