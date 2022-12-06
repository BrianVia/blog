import rss from "@astrojs/rss";

export const get = () =>
  rss({
    // `<title>` field in output xml
    title: "Brian Via B.log()",
    // `<description>` field in output xml
    description: "Musings on Software or anything else that strikes my fancy",
    // base URL for RSS <item> links
    // SITE will use "site" from your project's astro.config.
    site: import.meta.env.SITE,
    // list of `<item>`s in output xml
    // simple example: generate items for every md file in /src/pages
    // see "Generating items" section for required frontmatter and advanced use cases
    items: import.meta.glob("./**/*.md"),
    // (optional) inject custom xml
    customData: `<language>en-us</language>`,
  });
