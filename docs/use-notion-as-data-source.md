Below is a turn-key recipe—code, config, and a sprinkle of attitude—to vacuum every “published = true” post from your Notion database and drop fully-formed MDX files straight into your Astro content collection. Copy-paste, tweak env vars, run, ship. 🚀

⸻

1 · Prereqs (one-liner ⤵)

bun add @notionhq/client notion-to-md gray-matter slugify dotenv

	•	Bun for runtime (fast, ES-native).
	•	@notionhq/client – official Notion SDK.
	•	notion-to-md – converts block trees to Markdown…
	•	…then gray-matter + slugify to wrap front-matter and filenames.
	•	dotenv to keep secrets out of git.

⸻

2 · Environment secrets

Create .env at project root:

NOTION_API_KEY=secret_xxx
NOTION_DB_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

Strong opinion: Never bake these into astro.config.mjs; your repo will end up on GitHub-LeakOfShame™.

⸻

3 · Script: /scripts/fetchNotionPosts.ts

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

const OUTPUT_DIR = "./src/content/blog";

async function main() {
  const pages = await notion.databases.query({
    database_id: process.env.NOTION_DB_ID!,
    filter: { property: "published", checkbox: { equals: true } },
    sorts: [{ property: "createdAt", direction: "descending" }],
  });

  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  for (const page of pages.results) {
    // ---- Metadata --------------------------------------------------------
    // Notion returns rich-text arrays everywhere; helper to unwrap
    const plain = (prop: any) => (prop?.[0]?.plain_text ?? "").trim();

    const title      = plain(page.properties.title?.title);
    const slug       = slugify(title, { lower: true, strict: true });
    const createdAt  = page.properties.createdAt?.created_time
                     ?? page.created_time;
    const heroFile   = page.properties.hero?.files?.[0];
    // external links vs uploaded files
    const heroImage  =
      heroFile?.type === "external" ? heroFile.external.url : heroFile?.file.url;

    // ---- Content ---------------------------------------------------------
    const mdBlocks   = await n2m.pageToMarkdown(page.id);
    const markdown   = n2m.toMarkdownString(mdBlocks);

    // ---- Front-matter + MDX wrapper --------------------------------------
    const { content } = matter.stringify(markdown, {
      title,
      slug,
      createdAt,
      heroImage,
    });

    // ---- Write to disk ---------------------------------------------------
    const target = path.join(OUTPUT_DIR, `${slug}.mdx`);
    await fs.writeFile(target, content);
    console.log(`✅  ${title} -> ${target}`);
  }
}

main().catch((err) => {
  console.error("❌  Notion import failed:", err);
  process.exit(1);
});

CreatedAt & heroImage assume property types:

Notion Property	Type needed
title	Title
published	Checkbox
createdAt	Created time (or Date)
hero	Files (single image)

Change names in the script if yours differ.

⸻

4 · Astro content collection

src/content/config.ts

import { defineCollection, z } from "astro:content";

const blog = defineCollection({
  schema: z.object({
    title: z.string(),
    slug: z.string(),
    createdAt: z.string().transform((d) => new Date(d)),
    heroImage: z.string().url().optional(),
  }),
});

export const collections = { blog };

Your MDX files now validate at build time—no silent breakage.

⸻

5 · Hook it into the build

package.json (or bunfig.toml):

{
  "scripts": {
    "predev": "bun scripts/fetchNotionPosts.ts",
    "prebuild": "bun scripts/fetchNotionPosts.ts",
    "dev": "astro dev",
    "build": "astro build"
  }
}

Every bun dev or Netlify/Vercel build pulls the freshest published posts before Astro even looks at them.

⸻

6 · Handling hero images (optional but pro)

Notion’s signed URLs expire after ~1 hour. If you want cache-forever static images:
	1.	Replace the heroImage block with a download to public/images/.
	2.	Point heroImage front-matter at the local file (/images/${slug}.${ext}).
	3.	Serve via <Image> component or your favorite optimization pipeline.

⸻

7 · Run once ✨

bun scripts/fetchNotionPosts.ts   # pulls now
bun astro dev                     # view at localhost:4321

High-five—you’ve outsourced your content pipeline to 43 lines of TypeScript.

⸻

Opinionated extras you might want next

🎯 Need	Quick fix
Incremental sync (only changed pages)	Store lastSynced in a tiny JSON; query Notion with filter: { timestamp: "last_edited_time", last_edited_time: { after: lastSynced } }
Authoring preview	Add a second checkbox draft and a ?preview flag in your site routing to include drafts during local dev
Rich embeds	Convert Notion callouts → <Callout> MDX component with notion-to-md custom transformers
CI safety	In GitHub Actions, add NOTION_API_KEY & NOTION_DB_ID repo secrets, run the same Bun script before astro build


⸻

TL;DR
	•	Pulls only published posts
	•	Pipes them to valid MDX with typed front-matter
	•	Drops files into Astro’s content/blog
	•	Fully automatable in dev + CI

Clone, slot in API creds, and watch Astro gobble your Notion prose like it’s carb-loading for a marathon. 🏃‍♂️💨

Let me know if you want refinements—incremental sync, image caching, or spicy MDX components. Otherwise: ship it.


From the user - you already have NOTION_DATABASE_ID and NOTION_API_KEY in your .env file.