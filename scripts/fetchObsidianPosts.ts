#!/usr/bin/env bun
import matter from "gray-matter";
import slugify from "slugify";
import fs from "node:fs/promises";
import path from "node:path";
import "dotenv/config";

// Configuration via environment variables
const VAULT_PATH = process.env.OBSIDIAN_VAULT_PATH;
const POSTS_FOLDER = process.env.OBSIDIAN_POSTS_FOLDER || "blog-posts";
const OUTPUT_DIR = "./src/pages/posts";

/**
 * Convert Obsidian-specific syntax to standard Markdown
 */
function convertObsidianSyntax(content: string): string {
  let result = content;

  // Convert image embeds: ![[image.png]] → ![](image.png)
  // Also handles: ![[image.png|alt text]] → ![alt text](image.png)
  result = result.replace(/!\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, file, alt) => {
    return alt ? `![${alt}](${file})` : `![](${file})`;
  });

  // Convert wikilinks with aliases: [[page|display text]] → [display text](page)
  result = result.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, (_, page, display) => {
    return `[${display}](${page})`;
  });

  // Convert simple wikilinks: [[page]] → [page](page)
  result = result.replace(/\[\[([^\]]+)\]\]/g, (_, page) => {
    return `[${page}](${page})`;
  });

  // Convert Obsidian highlights: ==highlight== → <mark>highlight</mark>
  result = result.replace(/==([^=]+)==/g, "<mark>$1</mark>");

  // Convert Obsidian callouts to blockquotes (basic conversion)
  // > [!note] Title → > **Note:** Title
  result = result.replace(/^> \[!(\w+)\](.*)$/gm, (_, type, rest) => {
    const typeCapitalized = type.charAt(0).toUpperCase() + type.slice(1);
    return `> **${typeCapitalized}:**${rest}`;
  });

  return result;
}

/**
 * Recursively find all markdown files in a directory
 */
async function findMarkdownFiles(dir: string): Promise<string[]> {
  const files: string[] = [];

  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        // Skip hidden directories and common non-content folders
        if (!entry.name.startsWith(".") && entry.name !== "node_modules") {
          files.push(...(await findMarkdownFiles(fullPath)));
        }
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        files.push(fullPath);
      }
    }
  } catch (err) {
    console.error(`Error reading directory ${dir}:`, err);
  }

  return files;
}

async function processPost(filePath: string): Promise<boolean> {
  const startTime = Date.now();

  try {
    const fileContent = await fs.readFile(filePath, "utf-8");
    const { data: frontMatter, content: rawContent } = matter(fileContent);

    // Skip if not published
    if (!frontMatter.published) {
      return false;
    }

    // Extract and validate required fields
    const title = frontMatter.title;
    if (!title) {
      console.log(`⚠️  Skipping ${filePath}: no title in frontmatter`);
      return false;
    }

    // Generate slug from frontmatter, filename, or title
    const filename = path.basename(filePath, ".md");
    const slug =
      frontMatter.slug ||
      slugify(filename, { lower: true, strict: true }) ||
      slugify(title, { lower: true, strict: true });

    // Get publication date (prefer pubDate, fall back to date, then file stats)
    let pubDate = frontMatter.pubDate || frontMatter.date;
    if (!pubDate) {
      const stats = await fs.stat(filePath);
      pubDate = stats.mtime.toISOString();
    }

    // Convert Obsidian syntax to standard Markdown
    const convertedContent = convertObsidianSyntax(rawContent);

    // Build output frontmatter matching the content collection schema
    const outputFrontMatter: Record<string, any> = {
      layout: "../../layouts/BlogPost.astro",
      title,
      slug,
      pubDate,
      published: true,
    };

    // Optional fields
    if (frontMatter.description) {
      outputFrontMatter.description = frontMatter.description;
    }
    if (frontMatter.tags && Array.isArray(frontMatter.tags)) {
      outputFrontMatter.tags = frontMatter.tags;
    }
    if (frontMatter.heroImageUrl) {
      outputFrontMatter.heroImageUrl = frontMatter.heroImageUrl;
      if (frontMatter.heroImageAlt) {
        outputFrontMatter.heroImageAlt = frontMatter.heroImageAlt;
      }
    }

    // Write the processed file
    const outputContent = matter.stringify(convertedContent, outputFrontMatter);
    const targetPath = path.join(OUTPUT_DIR, `${slug}.md`);
    await fs.writeFile(targetPath, outputContent, "utf-8");

    const duration = Date.now() - startTime;
    console.log(`✅  ${title} -> ${targetPath} (${duration}ms)`);
    return true;
  } catch (err) {
    console.error(`❌  Error processing ${filePath}:`, err);
    return false;
  }
}

async function main() {
  console.time("⏱️  Total fetch time");

  // Validate configuration
  if (!VAULT_PATH) {
    console.error("❌  OBSIDIAN_VAULT_PATH environment variable is not set");
    console.error("");
    console.error("Set it in your .env file:");
    console.error('  OBSIDIAN_VAULT_PATH="/path/to/your/obsidian/vault"');
    console.error('  OBSIDIAN_POSTS_FOLDER="blog-posts"  # optional, defaults to "blog-posts"');
    process.exit(1);
  }

  const postsDir = path.join(VAULT_PATH, POSTS_FOLDER);

  // Check if the posts directory exists
  try {
    await fs.access(postsDir);
  } catch {
    console.error(`❌  Posts directory not found: ${postsDir}`);
    console.error("");
    console.error("Make sure your Obsidian vault has a folder for blog posts.");
    console.error(`Expected path: ${postsDir}`);
    process.exit(1);
  }

  console.log(`📂 Reading from: ${postsDir}`);

  // Find all markdown files
  console.time("🔍 Finding markdown files");
  const markdownFiles = await findMarkdownFiles(postsDir);
  console.timeEnd("🔍 Finding markdown files");
  console.log(`Found ${markdownFiles.length} markdown files`);

  // Ensure output directory exists
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  // Process all posts in parallel
  console.time("🔄 Processing posts");
  const results = await Promise.all(markdownFiles.map(processPost));
  console.timeEnd("🔄 Processing posts");

  const publishedCount = results.filter(Boolean).length;
  console.log(`\n📝 Published ${publishedCount} posts`);

  console.timeEnd("⏱️  Total fetch time");
}

main().catch((err) => {
  console.error("❌  Obsidian import failed:", err);
  process.exit(1);
});
