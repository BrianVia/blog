# Ahrefs remediation ledger

Source export: `/tmp/cmux-drop-40c55621-d9c4-4c58-81e7-29729796c59f.zip`

Export date: 2026-07-16

Last updated: 2026-07-16

This file tracks every report in the Ahrefs export. Reports with `-links` are
evidence/detail views of the corresponding page-level finding, so they share a
root cause and verification evidence.

Status meanings:

- **Fixed locally**: the source and generated production build prove the old
  finding is absent.
- **Expected/informational**: the report describes healthy protocol behavior or
  a historical comparison, not a defect to remove.
- **Pending external verification**: code is fixed, but production must be
  deployed and recrawled before Ahrefs can confirm it.

## Open follow-ups

| Follow-up | Status | Evidence / next action |
| --- | --- | --- |
| Deploy the current changes and rerun the Ahrefs crawl | Pending external verification | A 2026-07-16 live check still sees the old slashless homepage canonical and navigation. Run `bun run audit:seo:live` after deployment, then start a fresh Ahrefs crawl. |

Environment note: the configured `NOTION_API_KEY` currently returns HTTP 401.
The prebuild falls back only for recognized Notion availability/authentication
failures when cached posts exist; a code error or build with no cached posts
still fails. Replace the invalid secret to resume fresh content sync, but never
commit it.

## Redirect and canonical URL findings

Root cause: production serves directory pages with trailing slashes, while Astro
previously emitted slashless sitemap entries, canonicals, and internal links.
The site now uses `trailingSlash: "always"`; shared navigation, tag links, post
links, adjacent-post metadata, canonicals, and paginated bookmark URLs all use
the production URL shape.

| Ahrefs report | Rows | Status | Verification |
| --- | ---: | --- | --- |
| `Error-3XX_redirect_in_sitemap.csv` | 24 | Fixed locally | All generated sitemap `<loc>` values for HTML routes end in `/`; zero bad sitemap URLs in the build audit. |
| `Error-Canonical_points_to_redirect.csv` | 23 | Fixed locally | Every indexable generated HTML page has a self-canonical URL ending in `/`. |
| `Error-Canonical_points_to_redirect-links.csv` | 23 | Fixed locally | Detail report for the same 23 canonical targets. |
| `Warning-indexable-Page_has_links_to_redirect.csv` | 1 | Fixed locally | Homepage internal routes now link directly to trailing-slash destinations. |
| `Warning-indexable-Page_has_links_to_redirect-links.csv` | 23 | Fixed locally | Detail rows are all slashless internal URLs; generated links now use `/`. |
| `Notice-Page_has_links_to_redirect.csv` | 24 | Fixed locally | All 212 detail rows were internal trailing-slash redirects. |
| `Notice-Page_has_links_to_redirect-links.csv` | 212 | Fixed locally | Generated-site scan finds no slashless links to known HTML routes. |
| `Warning-3XX_redirect.csv` | 25 | Fixed locally / expected | 24 slash redirects are fixed. The remaining `http://brianvia.blog/` → HTTPS redirect is correct and intentionally retained. |
| `Warning-3XX_redirect-links.csv` | 298 | Fixed locally | All 298 link rows map to the same 24 slashless internal route targets. |
| `Notice-Redirected_page_has_no_incoming_internal_links.csv` | 24 | Fixed locally | These were the same obsolete slashless route variants; internal links now point at final URLs. |
| `Notice-Redirected_page_has_no_incoming_internal_links-links.csv` | 298 | Fixed locally | Detail rows duplicate the trailing-slash link set above. |
| `Notice-HTTP_to_HTTPS_redirect.csv` | 1 | Expected/informational | HTTP → HTTPS is the secure canonical redirect and must remain. |
| `Notice-Canonical_URL_changed.csv` | 2 | Expected/informational | Historical change notice for `/about/` and `/uses/`; current generated canonicals are valid and self-referencing. |

## Broken pages and Cloudflare email protection

Root cause: Cloudflare Email Address Obfuscation rewrote two valid email-like
strings to `/cdn-cgi/l/email-protection`, which Ahrefs then crawled as an
internal 404. `email_off` markers now protect the social email link and imported
post bodies from that rewrite.

| Ahrefs report | Rows | Status | Verification |
| --- | ---: | --- | --- |
| `Error-404_page.csv` | 1 | Fixed locally | Generated output contains no `/cdn-cgi/l/email-protection` URL. |
| `Error-404_page-links.csv` | 2 | Fixed locally | Both source contexts are wrapped in Cloudflare `email_off` markers. |
| `Error-4XX_page.csv` | 1 | Fixed locally | Duplicate page-level view of the same endpoint. |
| `Error-4XX_page-links.csv` | 2 | Fixed locally | Duplicate link-detail view of the same endpoint. |
| `Warning-Page_has_links_to_broken_page.csv` | 2 | Fixed locally | No generated link targets the reported endpoint. |
| `Warning-Page_has_links_to_broken_page-links.csv` | 2 | Fixed locally | Detail view of the two protected source contexts. |

Cloudflare's current Email Address Obfuscation documentation explicitly lists
the `email_off` HTML comments as the supported way to exclude specific email
content: <https://developers.cloudflare.com/waf/tools/scrape-shield/email-address-obfuscation/>.

## Bookmark images, mixed content, and page size

Root causes: the bookmark API can return Python-style serialized image objects,
the invalid string `self`, and `http://` image URLs. It also returned 1,994
bookmarks into one HTML document. Bookmark ingestion now extracts embedded image
URLs, rejects non-HTTP(S) values, upgrades images to HTTPS, supplies descriptive
alt text, and paginates the complete archive at 60 bookmarks per page.

| Ahrefs report | Rows | Status | Verification |
| --- | ---: | --- | --- |
| `Error-Image_broken.csv` | 3 | Fixed locally | Generated scan finds zero serialized-object or `/self` image sources. |
| `Error-Image_broken-links.csv` | 3 | Fixed locally | The shared bookmark sanitizer fixes all three reported inputs. |
| `Error-Page_has_broken_image.csv` | 1 | Fixed locally | `/links/` contains only normalized HTTP(S) image URLs. |
| `Error-Page_has_broken_image-links.csv` | 3 | Fixed locally | Detail report for the same malformed values. |
| `Warning-HTTPS_HTTP_mixed_content.csv` | 1 | Fixed locally | Generated scan finds zero `http://` image sources. |
| `Warning-HTTPS_HTTP_mixed_content-links.csv` | 27 | Fixed locally | All bookmark image URLs are normalized to HTTPS. Direct checks found 25 secure equivalents returning 200; the two secure equivalents returning 404 are omitted. |
| `Warning-HTTPS_page_links_to_HTTP_image.csv` | 1 | Fixed locally | Duplicate page view of the mixed-image finding. |
| `Warning-HTTPS_page_links_to_HTTP_image-links.csv` | 27 | Fixed locally | Duplicate link-detail view of the same 27 URLs. |
| `Warning-HTML_file_size_too_large.csv` | 1 | Fixed locally | `/links/` fell from 364,807 reported bytes to about 114 KB while retaining all bookmarks across 34 crawlable pages. |

## Headings, titles, descriptions, and alt text

The post layout owns the sole page H1. The Notion importer now demotes top-level
body headings outside code fences, cleans a legacy title annotation, and fills
missing hero alt text. Shared metadata supplies useful fallbacks, keeps title
tags at 60 characters or fewer, and keeps descriptions between 70 and 160
characters. Static and tag-page descriptions were expanded manually.

| Ahrefs report | Rows | Status | Verification |
| --- | ---: | --- | --- |
| `Notice-H1_tag_missing_or_empty.csv` | 1 | Fixed locally | `/uses/` now has one H1. |
| `Notice-Multiple_H1_tags.csv` | 2 | Fixed locally | All indexable generated pages have exactly one H1; importer prevents recurrence. |
| `Notice-Title_too_long.csv` | 3 | Fixed locally | Generated title range is 18–59 characters. |
| `Warning-Meta_description_tag_missing_or_empty.csv` | 2 | Fixed locally | Post metadata now creates a contextual fallback when Notion has no description. |
| `Warning-indexable-Meta_description_too_short.csv` | 1 | Fixed locally | Homepage description is now longer than 70 characters. |
| `Notice-Meta_description_too_short.csv` | 22 | Fixed locally | Generated indexable descriptions are all 70–160 characters. |
| `Warning-Missing_alt_text.csv` | 1 | Fixed locally | Preview images fall back to `Featured image for {title}`. |
| `Warning-Missing_alt_text-links.csv` | 1 | Fixed locally | Generated scan finds no image without non-empty alt text. |
| `Notice-indexable-H1_tag_changed.csv` | 1 | Expected/informational | Historical homepage comparison; current homepage has one stable H1. |
| `Notice-indexable-Meta_description_changed.csv` | 1 | Expected/informational | Historical comparison; change is intentional and resolves the short description warning. |
| `Notice-indexable-Title_tag_changed.csv` | 1 | Expected/informational | Historical comparison; current title passes the length audit. |
| `Notice-indexable-Word_count_changed.csv` | 1 | Expected/informational | Historical homepage content comparison, not an SEO defect. |

## Discovery and off-page notices

| Ahrefs report | Rows | Status | Verification / rationale |
| --- | ---: | --- | --- |
| `Notice-Pages_to_submit_to_IndexNow.csv` | 1 | Expected/informational | Ahrefs recommends notifying IndexNow after a homepage change. The page is already present in the sitemap; submission is an optional post-deploy operation, not an HTML defect. |
| `Notice-No._of_referring_domains_dropped.csv` | 1 | Expected/informational | Off-page historical metric for the generated Paul Graham feed; repository code cannot create referring domains. |
| `Notice-Indexable_page_became_non-indexable.csv` | 3 | Fixed locally / expected | Two rows were the malformed bookmark image URLs now removed. The remaining `/rss.xml` is XML feed content and correctly not an indexable HTML page. |

## Current verification record

- `bun run check`: 0 errors (one informational CommonJS hint).
- `bunx astro build`: 59 static pages built successfully.
- `bun run build`: succeeds; an unavailable/invalid Notion credential falls back to 9 cached posts, the build emits all 59 pages, and the SEO audit now runs as part of the build gate.
- `bun run audit:seo`: reproducible generated-site gate covering canonicals,
  redirect-prone internal URL shapes, missing resources, titles, descriptions,
  H1 counts, image URLs/alt text, sitemap URL shapes, and HTML size.
- `bun run audit:seo:live`: production crawler for sitemap pages and internal
  resources, using manual redirect handling so a 3xx cannot masquerade as a
  successful response.
- Latest production audit (2026-07-16): **49 findings remain on the currently
  deployed revision**. `origin/master` is still `5c4f1b3`, the same revision as
  local `HEAD`; none of the remediation changes have been published yet.
- Production-preview crawl: all 72 unique internal resources returned direct
  2xx responses with redirect following disabled.
- Generated-site audit across all 59 HTML files:
  - zero canonical URL shape failures;
  - zero title-length failures;
  - zero description-length failures;
  - zero H1-count failures;
  - zero HTTP, malformed, or alt-less image failures;
  - zero non-trailing-slash HTML URLs in the sitemap.
- `git diff --check`: clean.
