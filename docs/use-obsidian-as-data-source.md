# Using Obsidian as Your Blog's Data Source

An alternative to the Notion workflow—pull blog posts from your local Obsidian vault. Perfect for when you want your knowledge base accessible to local AI tools like Claude Code or Claude Cowork.

---

## 1 · Why Obsidian?

- **Local-first**: Your notes are plain Markdown files on your machine
- **AI-accessible**: Claude Code, Claude Cowork, and other LLM tools can read and work with your vault
- **No API latency**: Reading local files is instant
- **You own your data**: No vendor lock-in, no cloud dependency

---

## 2 · Architecture

```
~/Documents/ObsidianVault/        ← Your vault (iCloud, Dropbox, wherever)
├── personal/
├── work/
├── blog-posts/                   ← Posts with `published: true`
│   ├── my-first-post.md
│   └── draft-idea.md             (published: false, ignored)
└── random-notes/

~/projects/blog/                  ← This git repo
├── src/pages/posts/              ← Script copies published posts here
├── scripts/
│   └── fetchObsidianPosts.ts
└── ...
```

The script reads from your vault and copies only `published: true` posts to the blog repo.

---

## 3 · Environment Setup

Create `.env` at project root:

```bash
OBSIDIAN_VAULT_PATH="/Users/yourname/Documents/ObsidianVault"
OBSIDIAN_POSTS_FOLDER="blog-posts"   # optional, defaults to "blog-posts"
```

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

1. Write in Obsidian (syncs via iCloud/Dropbox/whatever)
2. Set `published: true` in frontmatter when ready
3. Run `bun run fetch-posts:obsidian` (or use a hotkey/shortcut)
4. Commit & push to deploy

### Optional: One-liner publish alias

```bash
# Add to ~/.zshrc or ~/.bashrc
alias publish-blog="cd ~/projects/blog && bun run fetch-posts:obsidian && git add -A && git commit -m 'Publish posts' && git push"
```

---

## 8 · Switching from Notion

To fully switch from Notion to Obsidian:

1. Update `prebuild` in `package.json`:
   ```json
   "prebuild": "bun scripts/fetchObsidianPosts.ts"
   ```

2. Update `dev` and `start` scripts similarly

3. Remove Notion dependencies (optional):
   ```bash
   bun remove @notionhq/client notion-to-md
   ```

Or keep both and choose per-build which source to use.

---

## TL;DR

- Posts live in your Obsidian vault
- Frontmatter controls what gets published
- Script copies to blog repo, converting Obsidian syntax
- Commit & push to deploy

Your knowledge base and blog, unified. Claude Code and Cowork can access everything. Ship it.
