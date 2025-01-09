---
layout: "../../layouts/BlogPost.astro"
title: "Building a Link Feed for My Blog with Readwise Reader and Raindrop APIs"
description: "Bringing a(n almost) live link feed to my blog"
pubDate: "2025-01-09"
slug: "008-building-link-feed-for-my-blog"
published: true
tags: ["javascript", "automation", "bookmarks", "readwise", "raindrop"]
heroImage:
  src: "/assets/blog/008-building-link-feed-for-my-blog/bookmarks.jpg"
  alt: "A bunch of bookmarks flying through a library"
  width: 800
---

# Building a Link Feed for My Blog with Readwise Reader and Raindrop APIs

Hey all 0 of my readers! I saw Aaron Swartz had done this on his blog here, so I thought I'd implement a version that pulls my links from Readwise Reader and Raindrop, my two main bookmarking services.
[http://www.aaronsw.com/](http://www.aaronsw.com/)

## What It Does

tl;dr - this script grabs links from Readwise Reader and Raindrop. It then combines them into one unified document structure, and writes to a local json file. That JSON file is then copied to an exposed web server, and can be downloaded when I build my blog

## Accessing service APIs

I'm using Readwise Reader and Raindrop APIs to access my bookmarks.

[Readwise API](https://readwise.io/api_deets)
[Raindrop API](https://developer.raindrop.io/)

## The Code

```typescript
import axios from "axios";
import dotenv from "dotenv";
import { writeFileSync } from "node:fs";

dotenv.config();


/*
Readwise Reader Document
{
  "id": "01jh65n9vnqne5c3zka77b9ygg",
  "url": "https://read.readwise.io/read/01jh65n9vnqne5c3zka77b9ygg",
  "title": "Scientists uncover how the brain washes itself during sleep",
  "author": "ByMitch Leslie",
  "source": "Readwise web highlighter",
  "category": "article",
  "location": "new",
  "tags": {},
  "site_name": "Science Advances",
  "word_count": 812,
  "created_at": "2025-01-09T18:36:37.257536+00:00",
  "updated_at": "2025-01-09T18:36:37.422728+00:00",
  "published_date": 1736294400000,
  "summary": "Scientists have discovered that during non-REM sleep, norepinephrine helps blood vessels in the brain contract and push cerebrospinal fluid, which cleanses the brain of waste. A sleep drug called zolpidem may disrupt this cleansing process, indicating potential side effects for users. This research could lead to better sleep aids that support the brain's natural cleaning function.",
  "image_url": "https://www.science.org/do/10.1126/science.zye6h6x/abs/_20250110_nid_sleeping_mice.jpg",
  "content": null,
  "source_url": "https://www.science.org/content/article/scientists-uncover-how-brain-washes-itself-during-sleep",
  "notes": "",
  "parent_id": null,
  "reading_progress": 0,
  "first_opened_at": "2025-01-09T18:36:37.109000+00:00",
  "last_opened_at": "2025-01-09T18:36:37.109000+00:00",
  "saved_at": "2025-01-09T18:36:37.109000+00:00",
  "last_moved_at": "2025-01-09T18:36:37.109000+00:00"
}



Raindrop Bookmark
{
  "_id": 941550705,
  "link": "https://www.science.org/content/article/scientists-uncover-how-brain-washes-itself-during-sleep",
  "title": "Scientists uncover how the brain washes itself during sleep",
  "excerpt": "Pulsating blood vessels push fluid into and out of the brains of slumbering mice",
  "note": "",
  "type": "link",
  "user": {
    "$ref": "users",
    "$id": 815800
  },
  "cover": "https://www.science.org/do/10.1126/science.zye6h6x/abs/_20250110_nid_sleeping_mice.jpg",
  "media": [
    {
      "link": "https://www.science.org/do/10.1126/science.zye6h6x/abs/_20250110_nid_sleeping_mice.jpg",
      "type": "image"
    },
    {
      "link": "https://www.science.org/do/10.1126/science.zye6h6x/full/_20250110_nid_sleeping_mice-1736361571250.jpg",
      "type": "image"
    },
    {
      "link": "https://www.science.org/do/10.1126/science.zwmauid/full/_20250107_on_mars_sample_return.jpg",
      "type": "image"
    }
  ],
  "tags": [
    "sleep",
    "brain",
    "science",
    "research",
    "study"
  ],
  "important": false,
  "reminder": {
    "date": null
  },
  "removed": false,
  "created": "2025-01-09T18:36:43.898Z",
  "collection": {
    "$ref": "collections",
    "$id": 26156198,
    "oid": 26156198
  },
  "highlights": [],
  "lastUpdate": "2025-01-09T18:36:50.275Z",
  "domain": "science.org",
  "creatorRef": {
    "_id": 815800,
    "avatar": "",
    "name": "BrianVia",
    "email": ""
  },
  "sort": 941550705,
  "cache": {
    "status": "invalid-origin"
  },
  "broken": false,
  "collectionId": 26156198
}

*/
// Unified interface for links
interface UnifiedLink {
  id: string;
  title: string;
  url: string;
  createdAt: Date;
  bookmarkSource: "Raindrop" | "ReadwiseReader";
  tags?: string[];
  summary?: string;
  author?: string;
  imageUrl?: string;
  originalUrl?: string;
}

// Raindrop types and client (reusing your existing code)
interface Bookmark {
  _id: number;
  title: string;
  excerpt: string;
  link: string;
  domain: string;
  cover: string;
  created: string;
  lastUpdate: string;
  tags: string[];
  collectionId: number;
  type: string;
}

interface RaindropResponse {
  items: Bookmark[];
  count: number;
  page: number;
}

class RaindropClient {
  private readonly baseUrl = "https://api.raindrop.io/rest/v1";
  private readonly headers: Record<string, string>;

  constructor(token: string) {
    this.headers = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  }

  async getAllBookmarks(perPage: number = 50): Promise<Bookmark[]> {
    let allBookmarks: Bookmark[] = [];
    let currentPage = 0;
    let hasMore = true;

    while (hasMore) {
      try {
        const response = await axios.get<RaindropResponse>(`${this.baseUrl}/raindrops/0`, {
          headers: this.headers,
          params: {
            page: currentPage,
            perpage: perPage,
            sort: "-created",
          },
        });

        const { items, count } = response.data;
        allBookmarks = [...allBookmarks, ...items];

        hasMore = allBookmarks.length < count;
        currentPage++;
      } catch (error) {
        if (axios.isAxiosError(error)) {
          throw new Error(`Failed to fetch bookmarks: ${error.message}`);
        }
        throw error;
      }
    }

    return allBookmarks;
  }
}

// Readwise Reader types and client
interface ReadwiseReaderDocument {
  image_url: string;
  id: number;
  title: string;
  author: string;
  saved_at: string;
  summary: string;
  url: string;
}

class ReadwiseReaderClient {
  private readonly baseUrl = "https://readwise.io/api/v3";
  private readonly headers: Record<string, string>;

  constructor(token: string) {
    this.headers = {
      Authorization: `Token ${token}`,
    };
  }

  async getAllDocuments(): Promise<ReadwiseReaderDocument[]> {
    let allDocuments: ReadwiseReaderDocument[] = [];
    let nextPageCursor: string | null = null;

    while (true) {
      try {
        const queryParams = new URLSearchParams();
        if (nextPageCursor) {
          queryParams.append("pageCursor", nextPageCursor);
        }

        console.log("Querying Readwise Reader for documents");
        const response = await axios.get<{
          results: ReadwiseReaderDocument[];
          nextPageCursor: string | null;
        }>(`${this.baseUrl}/list/?${queryParams.toString()}`, {
          headers: this.headers,
        });

        // console.log(response.data);

        allDocuments = [...allDocuments, ...response.data.results];
        nextPageCursor = response.data.nextPageCursor;

        if (!nextPageCursor) {
          break;
        }
      } catch (error) {
        if (axios.isAxiosError(error)) {
          throw new Error(`Failed to fetch Readwise Reader documents: ${error.message}`);
        }
        throw error;
      }
    }

    return allDocuments;
  }
}

// Function to normalize and combine links from both sources
async function getAllLinks(): Promise<UnifiedLink[]> {
  const raindropToken = process.env.RAINDROP_TOKEN;
  const readwiseToken = process.env.READWISE_TOKEN;

  if (!raindropToken || !readwiseToken) {
    throw new Error("RAINDROP_TOKEN or READWISE_TOKEN environment variable is not set");
  }

  const raindropClient = new RaindropClient(raindropToken);
  const readwiseClient = new ReadwiseReaderClient(readwiseToken);

  const [raindropBookmarks, readwiseDocuments] = await Promise.all([
    raindropClient.getAllBookmarks(),
    readwiseClient.getAllDocuments(),
  ]);

  console.log(`Raindrop Links`);
  console.log(JSON.stringify(raindropBookmarks[0], null, 2));
  console.log(`Readwise Links`);
  console.log(JSON.stringify(readwiseDocuments[0], null, 2));

  const raindropLinks: UnifiedLink[] = raindropBookmarks.map((bookmark) => ({
    id: bookmark._id.toString(),
    originalUrl: bookmark.link,
    summary: bookmark.excerpt,
    author: bookmark.domain,
    title: bookmark.title,
    url: bookmark.link,
    createdAt: new Date(bookmark.created),
    bookmarkSource: "Raindrop",
    tags: bookmark.tags,
    imageUrl: bookmark.cover,
  }));

  const readwiseLinks: UnifiedLink[] = readwiseDocuments.map((document) => ({
    id: document.id.toString(),
    originalUrl: document.url,
    title: document.title,
    url: document.url,
    createdAt: new Date(document.saved_at),
    bookmarkSource: "ReadwiseReader",
    summary: document.summary,
    author: document.author.startsWith("By") ? document.author.slice(2) : document.author,
    imageUrl: document.image_url,
  }));

  const allLinks = [...readwiseLinks, ...raindropLinks];

  // Sort by most recent
  allLinks.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  writeFileSync("all-bookmarks.json", JSON.stringify(allLinks, null, 2));

  return allLinks;
}

// Example usage
async function main() {
  try {
    const allLinks = await getAllLinks();
    console.log(`Found ${allLinks.length} links:\n`);
    allLinks.forEach((link) => {
      //   console.log(`${link.createdAt.toLocaleDateString()} - ${link.title} (${link.source})`);
      //   console.log(`  ${link.url}`);
      //   if (link.tags) console.log(`  Tags: ${link.tags.join(", ")}`);
      //   if (link.author) console.log(`  Author: ${link.author}`);
      //   if (link.summary) console.log(`  Summary: ${link.summary}`);
      //   console.log();
    });
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
  }
}


main();
```
