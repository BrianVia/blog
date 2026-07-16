export interface Bookmark {
  id: string;
  title: string;
  url: string;
  createdAt: string;
  bookmarkSource: "Raindrop" | "ReadwiseReader";
  originalUrl: string;
  summary?: string;
  author?: string;
  tags?: string[];
  imageUrl?: string;
}

export const BOOKMARKS_ENDPOINT =
  "https://weekly-digest.brian-via.workers.dev/bookmarks/all-bookmarks.json";
export const BOOKMARKS_PER_PAGE = 60;

// These legacy previews were already stale upstream. Their HTTP versions were
// ignored as mixed content by the crawler, while the secure equivalents return
// a real 404. Omitting a dead preview is better than emitting a broken image.
const KNOWN_BROKEN_IMAGES = new Set([
  "https://www.eastoftheweb.com/short-stories/UBooks/Covers/c_TheyMade_ip_cov.jpg",
  "https://cdn.shopify.com/s/files/1/1186/0402/products/Intelligent-Change-2021-Productivity-Planner-Uppdated_grande.jpg?v=1614902964",
]);

function normalizeImageUrl(rawValue: unknown): string | undefined {
  if (typeof rawValue !== "string") return undefined;
  let value = rawValue.trim();
  if (!value) return undefined;

  // Some upstream Open Graph responses stringify a Python-style image object.
  // Pull out its URL rather than emitting the whole object as a relative path.
  const embeddedUrl = value.match(/["']url["']\s*:\s*["'](https?:\/\/[^"']+)["']/i);
  if (embeddedUrl) value = embeddedUrl[1];

  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
    // Never introduce mixed content on the HTTPS site.
    if (url.protocol === "http:") url.protocol = "https:";
    const normalizedUrl = url.toString();
    return KNOWN_BROKEN_IMAGES.has(normalizedUrl) ? undefined : normalizedUrl;
  } catch {
    return undefined;
  }
}

export async function getBookmarks(): Promise<Bookmark[]> {
  try {
    const response = await fetch(BOOKMARKS_ENDPOINT);
    if (!response.ok) throw new Error(`bookmarks endpoint returned ${response.status}`);
    const bookmarks = (await response.json()) as Bookmark[];
    return bookmarks
      .map((bookmark) => ({
        ...bookmark,
        imageUrl: normalizeImageUrl(bookmark.imageUrl),
      }))
      .sort(
        (a, b) =>
          new Date(b.createdAt).valueOf() - new Date(a.createdAt).valueOf(),
      );
  } catch (error) {
    console.warn("[bookmarks] fetch failed, rendering empty state:", error);
    return [];
  }
}
