# Using Obsidian as Your Blog's Data Source

An alternative to the Notion workflow—pull blog posts from your Obsidian vault. Works both locally (for dev) and in CI/CD (via Obsidian Headless Sync). Your knowledge base stays accessible to AI tools like Claude Code and Claude Cowork.

---

## 1 · Why Obsidian?

- **Local-first**: Your notes are plain Markdown files on your machine
- **AI-accessible**: Claude Code, Claude Cowork, and other LLM tools can read and work with your vault
- **CI/CD compatible**: Obsidian Headless Sync pulls vault files in build pipelines — no machine required
- **You own your data**: No vendor lock-in, files live in your vault (synced via iCloud, Obsidian Sync, etc.)

---

## 2 · Architecture

Your Obsidian vault is your single source of truth. The blog pulls from it in two ways:

```
┌─────────────────────────────────┐
│  Your Obsidian Vault (iCloud)   │
│  ├── personal/                  │
│  ├── work/                      │
│  ├── blog-posts/                │  ← Posts with `published: true`
│  │   ├── my-first-post.md       │
│  │   └── draft-idea.md          │  (published: false, ignored)
│  └── random-notes/              │
└──────────┬──────────────────────┘
           │
     Obsidian Sync
           │
    ┌──────┴──────┐
    ▼              ▼
 Local dev      CI/CD (Cloudflare Pages, etc.)
 reads from     uses `ob sync` (Headless Sync)
 local path     to pull vault files
    │              │
    └──────┬───────┘
           ▼
  fetchObsidianPosts.ts
  filters published, converts syntax
           │
           ▼
  src/pages/posts/ → Astro build → Deploy
```

The script auto-detects the environment:
- **Locally**: reads from `OBSIDIAN_VAULT_PATH`
- **In CI**: runs `ob sync` via `OBSIDIAN_AUTH_TOKEN`, then reads synced files

---

## 3 · Environment Setup

### Local development

Create `.env` at project root:

```bash
OBSIDIAN_VAULT_PATH="/Users/yourname/Documents/ObsidianVault"
OBSIDIAN_POSTS_FOLDER="blog-posts"   # optional, defaults to "blog-posts"
```

### CI/CD (Cloudflare Pages, Vercel, GitHub Actions, etc.)

Set these environment variables in your hosting provider:

```bash
OBSIDIAN_AUTH_TOKEN="your-obsidian-auth-token"  # from `ob login`
OBSIDIAN_VAULT_NAME="Your Vault Name"           # name of your remote vault
OBSIDIAN_POSTS_FOLDER="blog-posts"              # optional, defaults to "blog-posts"
OBSIDIAN_SYNC_PASSWORD="your-e2ee-password"     # only if using end-to-end encryption
```

To get your auth token, run locally:
```bash
npm install -g obsidian-headless
ob login
# token is stored locally — copy it for CI use
```

Your CI build command:
```bash
npx obsidian-headless && bun run build:obsidian
```

> **Note**: `npx obsidian-headless` ensures the CLI is available. The `fetchObsidianPosts.ts`
> script handles `ob sync-setup` and `ob sync` automatically when `OBSIDIAN_AUTH_TOKEN` is set.

---

## 4 · Post Frontmatter Format

Your Obsidian posts need YAML frontmatter:

```markdown
---
title: "My Amazing Post"
description: "A brief description for SEO and previews"
pubDate: 2026-01-15
published: true
tags:
  - tech
  - obsidian
heroImageUrl: "https://example.com/image.jpg"
heroImageAlt: "Description of the image"
slug: "custom-slug"  # optional, defaults to filename
---

Your post content here...
```

### Required Fields
| Field | Type | Description |
|-------|------|-------------|
| `title` | string | Post title |
| `pubDate` | date | Publication date (YYYY-MM-DD) |
| `published` | boolean | Must be `true` to be included |

### Optional Fields
| Field | Type | Description |
|-------|------|-------------|
| `description` | string | SEO/preview description |
| `tags` | string[] | List of tags |
| `heroImageUrl` | string | Hero image URL |
| `heroImageAlt` | string | Alt text for hero image |
| `slug` | string | Custom URL slug (defaults to filename) |

---

## 5 · Obsidian Syntax Conversion

The script automatically converts Obsidian-specific syntax:

| Obsidian | Converted To |
|----------|--------------|
| `[[wikilink]]` | `[wikilink](wikilink)` |
| `[[page\|display]]` | `[display](page)` |
| `![[image.png]]` | `![](image.png)` |
| `![[image.png\|alt]]` | `![alt](image.png)` |
| `==highlight==` | `<mark>highlight</mark>` |
| `> [!note] Title` | `> **Note:** Title` |

---

## 6 · Commands

```bash
# Fetch posts from Obsidian vault
bun run fetch-posts:obsidian

# Dev with Obsidian as source
bun run dev:obsidian

# Build with Obsidian as source
bun run build:obsidian
```

---

## 7 · Workflow

### Local development
1. Write in Obsidian (syncs via iCloud across your devices)
2. Set `published: true` in frontmatter when ready
3. Run `bun run dev:obsidian` to preview locally

### Publishing (CI/CD — no machine required)
1. Write in Obsidian on any device
2. Set `published: true` in frontmatter
3. Obsidian Sync pushes changes to Obsidian's servers
4. Trigger a deploy (push to git, webhook, or manual)
5. CI runs `build:obsidian` → Headless Sync pulls vault → build → deploy

### Triggering deploys

Since Obsidian doesn't have webhooks like Notion, you can trigger deploys via:

- **Git push**: commit & push anything to trigger Cloudflare Pages rebuild
- **Deploy hook**: most hosts (Cloudflare Pages, Vercel, Netlify) offer deploy hook URLs you can call from a shortcut
- **Obsidian plugin**: use a community plugin to call your deploy hook URL
- **Scheduled builds**: configure CI to rebuild on a schedule (e.g., every hour)

Example deploy hook via a Raycast/Alfred shortcut:
```bash
curl -X POST "https://api.cloudflare.com/your-deploy-hook-url"
```

---

## 8 · Switching from Notion

To fully switch from Notion to Obsidian:

1. Update `prebuild` in `package.json`:
   ```json
   "prebuild": "bun scripts/fetchObsidianPosts.ts"
   ```

2. Update `dev`, `start`, and `build` scripts similarly

3. Set CI environment variables (`OBSIDIAN_AUTH_TOKEN`, `OBSIDIAN_VAULT_NAME`)

4. Set CI build command to include `npx obsidian-headless` (ensures CLI is available)

5. Remove Notion dependencies (optional):
   ```bash
   bun remove @notionhq/client notion-to-md
   ```

Or keep both and choose per-build which source to use.

---

## TL;DR

- Posts live in your Obsidian vault alongside all your other notes
- Frontmatter (`published: true`) controls what gets published
- Locally: script reads from your vault path
- CI/CD: Headless Sync pulls vault → script filters & converts → Astro builds
- No machine needs to be running to publish

Your knowledge base and blog, unified. Claude Code and Cowork can access everything locally. Ship it.
