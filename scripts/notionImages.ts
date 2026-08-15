// Notion hands out signed S3 URLs for uploaded files that expire roughly an
// hour after they are issued. Baking those URLs into a statically built page
// means every image 403s shortly after the deploy goes out, so download the
// bytes at fetch time and point the markup at a local copy instead.
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";

export const IMAGE_DIR = "./public/images/notion";
export const IMAGE_ROUTE = "/images/notion";

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "image/avif": ".avif",
  "image/svg+xml": ".svg",
  "image/heic": ".heic",
  "image/tiff": ".tiff",
  "image/bmp": ".bmp",
  "image/x-icon": ".ico",
};
const KNOWN_EXTENSIONS = new Set(Object.values(EXTENSION_BY_MIME));

// Images the site does not host itself (Unsplash and friends) keep working and
// support on-the-fly resizing, so leave those pointing at their origin.
export function isExpiringNotionUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  const host = url.hostname.toLowerCase();
  return (
    host === "notion.so" ||
    host.endsWith(".notion.so") ||
    host.endsWith(".notion-static.com") ||
    host.endsWith(".amazonaws.com") ||
    url.searchParams.has("X-Amz-Signature")
  );
}

// `www.notion.so/image/<url-encoded s3 url>` hides the real filename behind a
// layer of encoding, so decode before reading the extension off the path.
export function extensionFor(raw: string, contentType: string | null): string {
  const mime = (contentType || "").split(";")[0]!.trim().toLowerCase();
  if (EXTENSION_BY_MIME[mime]) return EXTENSION_BY_MIME[mime]!;

  let pathname: string;
  try {
    pathname = decodeURIComponent(new URL(raw).pathname);
  } catch {
    pathname = "";
  }
  const fromPath = path.extname(pathname).toLowerCase();
  if (fromPath === ".jpeg") return ".jpg";
  if (KNOWN_EXTENSIONS.has(fromPath)) return fromPath;
  return ".bin";
}

// A signed URL is regenerated on every Notion read, so the URL is not a stable
// identity for the file. Name the mirrored copy after a hash of its bytes: the
// same image keeps the same path across builds, and two posts sharing an image
// share a single file.
const mirroredNames = new Set<string>();
const inFlight = new Map<string, Promise<string | null>>();
let tempCounter = 0;

export function mirroredImageCount(): number {
  return mirroredNames.size;
}

async function downloadImage(rawUrl: string, attempts = 3): Promise<string | null> {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await fetch(rawUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      const bytes = Buffer.from(await res.arrayBuffer());
      if (bytes.length === 0) throw new Error("empty response body");

      const name =
        createHash("sha256").update(bytes).digest("hex").slice(0, 16) +
        extensionFor(rawUrl, res.headers.get("content-type"));
      const target = path.join(IMAGE_DIR, name);

      await fs.mkdir(IMAGE_DIR, { recursive: true });
      // The name is derived from the content, so an existing file is already
      // byte-identical. Otherwise write through a unique temp path and rename:
      // posts are processed in parallel and a half-written file must never be
      // visible to the Astro build that follows.
      if (!(await fs.access(target).then(() => true, () => false))) {
        const temp = `${target}.${process.pid}-${tempCounter++}.tmp`;
        await fs.writeFile(temp, bytes);
        await fs.rename(temp, target);
      }

      mirroredNames.add(name);
      return `${IMAGE_ROUTE}/${name}`;
    } catch (err: any) {
      if (attempt === attempts) {
        console.warn(`⚠️  Could not mirror image (${err?.message || err}): ${rawUrl}`);
        return null;
      }
      await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** (attempt - 1)));
    }
  }
  return null;
}

// Returns a local path for Notion-hosted images, or the original URL when the
// image is externally hosted or the download failed. Falling back to the signed
// URL keeps the build green — a failed mirror degrades to today's behaviour
// rather than dropping the image from the page entirely.
export async function mirrorImage(rawUrl: string): Promise<string> {
  if (!isExpiringNotionUrl(rawUrl)) return rawUrl;

  let pending = inFlight.get(rawUrl);
  if (!pending) {
    pending = downloadImage(rawUrl);
    inFlight.set(rawUrl, pending);
  }
  return (await pending) ?? rawUrl;
}

// Drop mirrored files that no post references any more, so repeated local runs
// do not grow the directory without bound. Only safe once every post has been
// processed — until then the referenced set is incomplete.
export async function pruneUnreferencedImages(): Promise<number> {
  const existing = await fs.readdir(IMAGE_DIR).catch(() => [] as string[]);
  const stale = existing.filter((name) => !mirroredNames.has(name));
  await Promise.all(stale.map((name) => fs.rm(path.join(IMAGE_DIR, name), { force: true })));
  return stale.length;
}
