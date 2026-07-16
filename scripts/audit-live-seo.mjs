import * as cheerio from "cheerio";

const SITE_URL = (process.env.SITE_URL || "https://brianvia.blog").replace(/\/+$/, "");
const MAX_HTML_BYTES = 256 * 1024;

async function fetchDirect(url) {
  const response = await fetch(url, {
    redirect: "manual",
    headers: { "user-agent": "BrianViaBlogSeoAudit/1.0" },
  });
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`${response.status}${response.headers.get("location") ? ` -> ${response.headers.get("location")}` : ""}`);
  }
  return response;
}

async function mapConcurrent(values, concurrency, callback) {
  const queue = [...values];
  const results = [];
  await Promise.all(
    Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
      while (queue.length) {
        const value = queue.shift();
        results.push(await callback(value));
      }
    }),
  );
  return results;
}

const failures = [];
const sitemapUrls = new Set();

try {
  const indexResponse = await fetchDirect(`${SITE_URL}/sitemap-index.xml`);
  const indexXml = await indexResponse.text();
  const childSitemaps = [...indexXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  await mapConcurrent(childSitemaps, 4, async (sitemapUrl) => {
    try {
      const response = await fetchDirect(sitemapUrl);
      const xml = await response.text();
      for (const match of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) sitemapUrls.add(match[1]);
    } catch (error) {
      failures.push(`${sitemapUrl}: ${error.message}`);
    }
  });
} catch (error) {
  failures.push(`${SITE_URL}/sitemap-index.xml: ${error.message}`);
}

const internalResources = new Set();
let htmlPages = 0;
let largestHtml = { url: "", bytes: 0 };

await mapConcurrent(sitemapUrls, 8, async (pageUrl) => {
  let response;
  try {
    response = await fetchDirect(pageUrl);
  } catch (error) {
    failures.push(`${pageUrl}: ${error.message}`);
    return;
  }
  if (!(response.headers.get("content-type") || "").includes("text/html")) return;

  htmlPages += 1;
  const html = await response.text();
  const bytes = Buffer.byteLength(html);
  const $ = cheerio.load(html);
  if (bytes > largestHtml.bytes) largestHtml = { url: pageUrl, bytes };
  if (bytes > MAX_HTML_BYTES) failures.push(`${pageUrl}: HTML is ${bytes} bytes`);

  const canonical = $('link[rel="canonical"]').attr("href");
  const title = $("title").text().trim();
  const description = $('meta[name="description"]').attr("content")?.trim() || "";
  if (canonical !== pageUrl) failures.push(`${pageUrl}: canonical is ${canonical || "missing"}`);
  if (!title || title.length > 60) failures.push(`${pageUrl}: title length is ${title.length}`);
  if (description.length < 70 || description.length > 160) {
    failures.push(`${pageUrl}: description length is ${description.length}`);
  }
  if ($('h1').length !== 1) failures.push(`${pageUrl}: found ${$('h1').length} H1 tags`);

  $("img").each((_, element) => {
    const src = $(element).attr("src") || "";
    const alt = $(element).attr("alt");
    if (alt === undefined || alt.trim() === "") failures.push(`${pageUrl}: missing image alt (${src})`);
    if (src.startsWith("http://")) failures.push(`${pageUrl}: mixed-content image (${src})`);
    if (src.includes("{'width'") || src.endsWith("/self")) failures.push(`${pageUrl}: malformed image (${src})`);
  });

  $("a[href], link[href], script[src], img[src]").each((_, element) => {
    const raw = $(element).attr("href") || $(element).attr("src");
    if (!raw || raw.startsWith("#") || raw.startsWith("mailto:") || raw.startsWith("data:")) return;
    let url;
    try {
      url = new URL(raw, `${SITE_URL}/`);
    } catch {
      failures.push(`${pageUrl}: invalid URL (${raw})`);
      return;
    }
    if (url.origin !== SITE_URL) return;
    if (url.pathname === "/cdn-cgi/l/email-protection") {
      failures.push(`${pageUrl}: Cloudflare email-protection link is crawlable`);
    }
    internalResources.add(url.href);
  });
});

await mapConcurrent(internalResources, 10, async (resourceUrl) => {
  try {
    await fetchDirect(resourceUrl);
  } catch (error) {
    failures.push(`${resourceUrl}: internal resource ${error.message}`);
  }
});

if (failures.length > 0) {
  console.error(`Live SEO audit failed with ${failures.length} issue(s):`);
  for (const failure of [...new Set(failures)]) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  `Live SEO audit passed: ${htmlPages} sitemap HTML pages, ${internalResources.size} internal resources, largest HTML ${largestHtml.bytes} bytes (${largestHtml.url}).`,
);
