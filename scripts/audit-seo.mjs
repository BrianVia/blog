import fs from "node:fs";
import path from "node:path";
import * as cheerio from "cheerio";

const DIST_DIR = path.resolve("dist");
const SITE_URL = "https://brianvia.blog";
const MAX_HTML_BYTES = 256 * 1024;

function walk(directory, predicate) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory()
      ? walk(target, predicate)
      : predicate(target)
        ? [target]
        : [];
  });
}

function expectedUrlFor(file) {
  const relative = path.relative(DIST_DIR, file).split(path.sep).join("/");
  if (relative === "index.html") return `${SITE_URL}/`;
  if (relative.endsWith("/index.html")) {
    return new URL(`/${relative.slice(0, -"index.html".length)}`, SITE_URL).toString();
  }
  return new URL(`/${relative}`, SITE_URL).toString();
}

function localFileFor(pathname) {
  const decoded = decodeURIComponent(pathname);
  if (decoded === "/") return path.join(DIST_DIR, "index.html");
  if (decoded.endsWith("/")) return path.join(DIST_DIR, decoded, "index.html");
  return path.join(DIST_DIR, decoded);
}

if (!fs.existsSync(DIST_DIR)) {
  console.error("SEO audit failed: dist/ does not exist. Run `bun run build` first.");
  process.exit(1);
}

const htmlFiles = walk(DIST_DIR, (file) => file.endsWith(".html"));
const failures = [];
let largestHtml = { file: "", bytes: 0 };
let internalResources = 0;

for (const file of htmlFiles) {
  const relative = path.relative(DIST_DIR, file).split(path.sep).join("/");
  const html = fs.readFileSync(file, "utf8");
  const $ = cheerio.load(html);
  const noindex = ($('meta[name="robots"]').attr("content") || "").includes("noindex");
  const expectedUrl = expectedUrlFor(file);
  const title = $("title").text().trim();
  const description = $('meta[name="description"]').attr("content")?.trim() || "";
  const canonical = $('link[rel="canonical"]').attr("href");

  if (Buffer.byteLength(html) > largestHtml.bytes) {
    largestHtml = { file: relative, bytes: Buffer.byteLength(html) };
  }
  if (Buffer.byteLength(html) > MAX_HTML_BYTES) {
    failures.push(`${relative}: HTML is ${Buffer.byteLength(html)} bytes (limit ${MAX_HTML_BYTES})`);
  }

  if (!noindex) {
    if (canonical !== expectedUrl) {
      failures.push(`${relative}: canonical ${canonical || "(missing)"} != ${expectedUrl}`);
    }
    if (!title || title.length > 60) {
      failures.push(`${relative}: title length is ${title.length}`);
    }
    if (description.length < 70 || description.length > 160) {
      failures.push(`${relative}: meta description length is ${description.length}`);
    }
    if ($('h1').length !== 1) {
      failures.push(`${relative}: expected one H1, found ${$('h1').length}`);
    }
  }

  $("img").each((_, element) => {
    const src = $(element).attr("src") || "";
    const alt = $(element).attr("alt");
    if (alt === undefined || alt.trim() === "") {
      failures.push(`${relative}: image has missing/empty alt text (${src})`);
    }
    if (src.startsWith("http://")) {
      failures.push(`${relative}: mixed-content image (${src})`);
    }
    if (src.includes("{'width'") || src.endsWith("/self")) {
      failures.push(`${relative}: malformed image URL (${src})`);
    }
  });

  $('script[type="application/ld+json"]').each((_, element) => {
    let data;
    try {
      data = JSON.parse($(element).text());
    } catch {
      failures.push(`${relative}: invalid JSON-LD`);
      return;
    }
    const inspectStructuredData = (value) => {
      if (Array.isArray(value)) {
        value.forEach(inspectStructuredData);
        return;
      }
      if (value && typeof value === "object") {
        Object.values(value).forEach(inspectStructuredData);
        return;
      }
      if (typeof value !== "string" || !value.startsWith(SITE_URL)) return;
      const url = new URL(value);
      if (value !== url.toString()) {
        failures.push(`${relative}: structured-data URL is not encoded (${value})`);
      }
      if (!path.extname(url.pathname) && !url.pathname.endsWith("/")) {
        failures.push(`${relative}: structured-data URL would redirect (${value})`);
      }
    };
    inspectStructuredData(data);
  });

  $("a[href], link[href], script[src], img[src]").each((_, element) => {
    // A noindex error document may advertise its logical /404/ canonical even
    // though the static host serves it from the special 404.html fallback.
    if (noindex && element.tagName === "link" && $(element).attr("rel") === "canonical") return;
    const raw = $(element).attr("href") || $(element).attr("src");
    if (!raw || raw.startsWith("#") || raw.startsWith("mailto:") || raw.startsWith("data:")) return;
    let url;
    try {
      url = new URL(raw, `${SITE_URL}/`);
    } catch {
      failures.push(`${relative}: invalid resource URL (${raw})`);
      return;
    }
    if (url.origin !== SITE_URL) return;
    internalResources += 1;
    if (url.pathname === "/cdn-cgi/l/email-protection") {
      failures.push(`${relative}: Cloudflare email-protection link leaked into output`);
    }
    if (!path.extname(url.pathname) && url.pathname !== "/" && !url.pathname.endsWith("/")) {
      failures.push(`${relative}: internal HTML link would redirect (${url.pathname})`);
    }
    const target = localFileFor(url.pathname);
    if (!fs.existsSync(target)) {
      failures.push(`${relative}: internal resource does not exist (${url.pathname})`);
    }
  });
}

const sitemapFiles = walk(DIST_DIR, (file) => /^sitemap.*\.xml$/.test(path.basename(file)));
for (const file of sitemapFiles) {
  const xml = fs.readFileSync(file, "utf8");
  for (const match of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
    const url = new URL(match[1]);
    if (!path.extname(url.pathname) && !url.pathname.endsWith("/")) {
      failures.push(`${path.basename(file)}: sitemap HTML URL would redirect (${url.href})`);
    }
    if (url.origin === SITE_URL && !fs.existsSync(localFileFor(url.pathname))) {
      failures.push(`${path.basename(file)}: sitemap URL does not exist (${url.href})`);
    }
  }
}

if (failures.length > 0) {
  console.error(`SEO audit failed with ${failures.length} issue(s):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  `SEO audit passed: ${htmlFiles.length} HTML pages, ${internalResources} internal resource references, largest HTML ${largestHtml.bytes} bytes (${largestHtml.file}).`,
);
