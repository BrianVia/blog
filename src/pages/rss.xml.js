import rss from "@astrojs/rss";
import { getCollection } from "astro:content";
import { marked } from "marked";

const SITE = "https://brianvia.blog";

export async function GET(context) {
  const posts = await getCollection("posts");
  const publishedPosts = posts
    .filter((post) => post.data.published === true)
    .sort((a, b) => new Date(b.data.pubDate).valueOf() - new Date(a.data.pubDate).valueOf());

  return rss({
    title: "Brian Via B.log()",
    description: "Musings on Software or anything else that strikes my fancy",
    site: context.site,
    items: publishedPosts.map((post) => {
      const html = marked.parse(post.body || "");
      // Rewrite root-relative asset paths to absolute so feed readers resolve them.
      const content = html.replace(/(src|href)="\/(?!\/)/g, `$1="${SITE}/`);
      return {
        title: post.data.title,
        pubDate: post.data.pubDate,
        description: post.data.description || "",
        link: `/posts/${post.data.slug}`,
        content,
      };
    }),
    customData: `<language>en-us</language>`,
  });
}
