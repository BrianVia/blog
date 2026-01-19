import rss from "@astrojs/rss";
import { getCollection } from "astro:content";

export const prerender = true;

export async function GET(context) {
  const posts = await getCollection("posts");
  const publishedPosts = posts
    .filter((post) => post.data.published === true)
    .sort((a, b) => new Date(b.data.pubDate).valueOf() - new Date(a.data.pubDate).valueOf());

  return rss({
    title: "Brian Via B.log()",
    description: "Musings on Software or anything else that strikes my fancy",
    site: context.site,
    items: publishedPosts.map((post) => ({
      title: post.data.title,
      pubDate: post.data.pubDate,
      description: post.data.description || "",
      link: `/posts/${post.data.slug}`,
    })),
    customData: `<language>en-us</language>`,
  });
}
