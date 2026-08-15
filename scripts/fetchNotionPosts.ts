#!/usr/bin/env bun
import { Client } from "@notionhq/client";
import { NotionToMarkdown } from "notion-to-md";
import matter from "gray-matter";
import slugify from "slugify";
import fs from "node:fs/promises";
import path from "node:path";
import "dotenv/config";
import {
  IMAGE_DIR,
  mirrorImage,
  mirroredImageCount,
  pruneUnreferencedImages,
} from "./notionImages";

const notion = new Client({ auth: process.env.NOTION_API_KEY! });
const n2m   = new NotionToMarkdown({ notionClient: notion });

// notion-to-md emits the signed URL verbatim. Reproduce its alt-text rules
// (caption, else the original filename, else "image") against the *original*
// URL — the mirrored path is a content hash and would make useless alt text.
n2m.setCustomTransformer("image", async (block: any) => {
  const content = block?.image;
  const url = content?.type === "external" ? content.external?.url : content?.file?.url;
  if (!url) return "";

  const caption = (content.caption || []).map((item: any) => item.plain_text).join("");
  let alt = "image";
  if (caption.trim().length > 0) {
    alt = caption;
  } else {
    const matches = url.match(/[^\/\\&\?]+\.\w{3,4}(?=([\?&].*$|$))/);
    if (matches) alt = matches[0];
  }

  return `![${alt}](${await mirrorImage(url)})`;
});

// Tweet embeds: fetch the oEmbed HTML at build time so posts render a real
// tweet card (degrades to a styled blockquote with the tweet text if the
// reader blocks widgets.js).
async function tweetEmbedHtml(url: string): Promise<string | null> {
  if (!/^https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/[^/]+\/status\//.test(url)) return null;
  try {
    const res = await fetch(`https://publish.x.com/oembed?url=${encodeURIComponent(url)}&dnt=true&align=center`);
    if (!res.ok) return null;
    const data: any = await res.json();
    return data.html?.trim() || null;
  } catch {
    return null;
  }
}

// notion-to-md renders embed/bookmark blocks as a literal "[embed](url)" /
// "[bookmark](url)" link. Tweets become embedded cards; everything else
// shows the URL (or the block's caption) as the link text.
for (const blockType of ["embed", "bookmark"]) {
  n2m.setCustomTransformer(blockType, async (block: any) => {
    const url = block?.[blockType]?.url;
    if (!url) return "";
    const tweet = await tweetEmbedHtml(url);
    if (tweet) return tweet;
    const caption = block?.[blockType]?.caption?.[0]?.plain_text?.trim();
    return `[${caption || url}](${url})`;
  });
}

const OUTPUT_DIR = "./src/content/posts";

async function main() {
  console.time("⏱️  Total fetch time");
  
  // Fetch only published pages
  console.time("📊 Notion API query");
  const pages = await notion.databases.query({
    database_id: process.env.NOTION_DATABASE_ID!,
    filter: { property: "Published", checkbox: { equals: true } },
    sorts: [{ property: "Created", direction: "descending" }],
  });
  console.timeEnd("📊 Notion API query");

  console.log(`Found ${pages.results.length} published posts`);

  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  // Process posts in parallel instead of sequentially
  console.time("🔄 Processing all posts");
  await Promise.all(pages.results.map(processPost));
  console.timeEnd("🔄 Processing all posts");

  const pruned = await pruneUnreferencedImages();
  console.log(
    `🖼️  Mirrored ${mirroredImageCount()} Notion image(s) into ${IMAGE_DIR}` +
      (pruned > 0 ? ` (pruned ${pruned} unreferenced)` : ""),
  );

  console.timeEnd("⏱️  Total fetch time");
}

async function processPost(page: any) {
  const startTime = Date.now();
  
  // ---- Metadata --------------------------------------------------------
  // Notion returns rich-text arrays everywhere; helper to unwrap
  const plain = (prop: any) => (prop?.[0]?.plain_text ?? "").trim();

  // Get properties based on your database schema
  const rawTitle = plain(page.properties.Name?.title);
  // A legacy Notion title includes a linked call-to-action in the title
  // property. Keep that annotation out of the document title and H1.
  const title = rawTitle
    .replace(/If you want to skip to the code snippets,?\s*click.*$/i, "")
    .trim();
  const description = plain(page.properties.Description?.rich_text);
  const slugProp = plain(page.properties.slug?.rich_text);
  const slug = slugProp || slugify(title, { lower: true, strict: true });
  const createdAt = page.properties.Created?.created_time || page.created_time;

  // Get tags
  const tags = page.properties.Tags?.multi_select?.map((tag: any) => tag.name) || [];

  // Get hero image from Notion - handle both URL and rich_text types
  const heroImageUrl = page.properties.heroImageUrl?.url || plain(page.properties.heroImageUrl?.rich_text);
  const heroImageAlt = plain(page.properties.heroImageAltText?.rich_text) || plain(page.properties.HeroImageAlt?.rich_text);

  if (!title) {
    console.log(`⚠️  Skipping page with no title`);
    return;
  }

  // ---- Content ---------------------------------------------------------
  const mdBlocks = await n2m.pageToMarkdown(page.id);
  const markdownContent = n2m.toMarkdownString(mdBlocks);

  // BlogPost.astro owns the page's single H1. Notion's heading_1 blocks must
  // therefore begin at H2; leave hash-prefixed lines inside code fences alone.
  let inFence = false;
  const body = (markdownContent.parent || "")
    .split("\n")
    .map((line: string) => {
      if (/^\s*```/.test(line)) {
        inFence = !inFence;
        return line;
      }
      return !inFence && /^# /.test(line) ? `#${line}` : line;
    })
    .join("\n");

  // ---- Front-matter + MD wrapper --------------------------------------
  // Only include defined values in front matter
  const frontMatter: any = {
    title,
    slug,
    pubDate: createdAt,
    published: true,
  };

  if (description) frontMatter.description = description;
  if (tags.length > 0) frontMatter.tags = tags;
  if (heroImageUrl) {
    // The hero drives the on-page image, og:image and the BlogPosting schema,
    // so an expired URL breaks the post and its social card together.
    frontMatter.heroImageUrl = await mirrorImage(heroImageUrl);
    frontMatter.heroImageAlt = heroImageAlt || `Featured image for ${title}`;
  }

  const content = matter.stringify(body, frontMatter);

  // ---- Write to disk ---------------------------------------------------
  const target = path.join(OUTPUT_DIR, `${slug}.md`);
  await fs.writeFile(target, content, 'utf-8');
  
  const duration = Date.now() - startTime;
  console.log(`✅  ${title} -> ${target} (${duration}ms)`);
}

main().catch(async (err) => {
  // Builds should remain reproducible from the checked-out content when Notion
  // is temporarily unavailable or a local developer has no valid credential.
  // A fresh checkout with no cached posts still fails loudly.
  const cachedPosts = await fs
    .readdir(OUTPUT_DIR)
    .then((files) => files.filter((file) => file.endsWith(".md")))
    .catch(() => []);
  const recoverableNotionFailure =
    ["unauthorized", "restricted_resource", "rate_limited", "service_unavailable"].includes(err?.code) ||
    err?.status >= 500;

  if (recoverableNotionFailure && cachedPosts.length > 0) {
    console.warn(
      `⚠️  Notion import failed (${err?.code || err?.message || "unknown error"}); using ${cachedPosts.length} cached posts.`,
    );
    return;
  }

  console.error("❌  Notion import failed and no cached posts are available:", err);
  process.exitCode = 1;
});
