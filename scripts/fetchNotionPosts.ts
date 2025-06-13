#!/usr/bin/env bun
import { Client } from "@notionhq/client";
import { NotionToMarkdown } from "notion-to-md";
import matter from "gray-matter";
import slugify from "slugify";
import fs from "node:fs/promises";
import path from "node:path";
import "dotenv/config";

const notion = new Client({ auth: process.env.NOTION_API_KEY! });
const n2m   = new NotionToMarkdown({ notionClient: notion });

const OUTPUT_DIR = "./src/pages/posts";

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
  
  console.timeEnd("⏱️  Total fetch time");
}

async function processPost(page: any) {
  const startTime = Date.now();
  
  // ---- Metadata --------------------------------------------------------
  // Notion returns rich-text arrays everywhere; helper to unwrap
  const plain = (prop: any) => (prop?.[0]?.plain_text ?? "").trim();

  // Get properties based on your database schema
  const title = plain(page.properties.Name?.title);
  const description = plain(page.properties.Description?.rich_text);
  const slugProp = plain(page.properties.slug?.rich_text);
  const slug = slugProp || slugify(title, { lower: true, strict: true });
  const createdAt = page.properties.Created?.created_time || page.created_time;
  const heroImageUrl = page.properties.heroImageUrl?.url;
  const heroImageAltText = plain(page.properties.heroImageAltText?.rich_text);
  
  // Get tags
  const tags = page.properties.Tags?.multi_select?.map((tag: any) => tag.name) || [];

  if (!title) {
    console.log(`⚠️  Skipping page with no title`);
    return;
  }

  // ---- Content ---------------------------------------------------------
  const mdBlocks = await n2m.pageToMarkdown(page.id);
  const markdownContent = n2m.toMarkdownString(mdBlocks);

  // ---- Front-matter + MD wrapper --------------------------------------
  // Only include defined values in front matter
  const frontMatter: any = {
    layout: "../../layouts/BlogPost.astro",
    title,
    slug,
    pubDate: createdAt,
    published: true,
  };

  if (description) frontMatter.description = description;
  if (heroImageUrl) {
    frontMatter.heroImage = {
      src: heroImageUrl,
      alt: heroImageAltText || "",
      width: 1200
    };
  }
  if (tags.length > 0) frontMatter.tags = tags;

  const content = matter.stringify(markdownContent.parent || '', frontMatter);

  // ---- Write to disk ---------------------------------------------------
  const target = path.join(OUTPUT_DIR, `${slug}.md`);
  await fs.writeFile(target, content);
  
  const duration = Date.now() - startTime;
  console.log(`✅  ${title} -> ${target} (${duration}ms)`);
}

main().catch((err) => {
  console.error("❌  Notion import failed:", err);
  process.exit(1);
});