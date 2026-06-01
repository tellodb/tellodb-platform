import { readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";

const SITE_ORIGIN = "https://tellodb.com";
const BLOG_DIR = join(process.cwd(), "src/content/blog");
const OUT_DIR = join(process.cwd(), ".vercel/output/static");

const today = new Date().toISOString().split("T")[0];

const staticPages = [
  { loc: "/", priority: 1.0, lastmod: today },
  { loc: "/blog", priority: 0.9, lastmod: today },
  { loc: "/platform", priority: 0.8, lastmod: today },
  { loc: "/platform/benchmarks", priority: 0.7, lastmod: today },
  { loc: "/platform/trust", priority: 0.7, lastmod: today },
  { loc: "/platform/byoc", priority: 0.7, lastmod: today },
  { loc: "/signup", priority: 0.6, lastmod: today },
  { loc: "/login", priority: 0.5, lastmod: today },
];

const docsPages = [
  { loc: "/docs", priority: 0.9 },
  { loc: "/docs/quickstart", priority: 0.8 },
  { loc: "/docs/install", priority: 0.8 },
  { loc: "/docs/concepts", priority: 0.8 },
  { loc: "/docs/architecture", priority: 0.8 },
  { loc: "/docs/data-model", priority: 0.7 },
  { loc: "/docs/memory-kinds", priority: 0.7 },
  { loc: "/docs/id-conventions", priority: 0.6 },
  { loc: "/docs/ingestion-pipeline", priority: 0.7 },
  { loc: "/docs/vector-index", priority: 0.7 },
  { loc: "/docs/lexical-index", priority: 0.7 },
  { loc: "/docs/reranking", priority: 0.7 },
  { loc: "/docs/time-ranking", priority: 0.7 },
  { loc: "/docs/fact-supersession", priority: 0.7 },
  { loc: "/docs/api-auth", priority: 0.8 },
  { loc: "/docs/api-ingest", priority: 0.7 },
  { loc: "/docs/api-query-semantic", priority: 0.7 },
  { loc: "/docs/api-query-temporal", priority: 0.7 },
  { loc: "/docs/api-delete", priority: 0.6 },
  { loc: "/docs/sdk-javascript", priority: 0.7 },
  { loc: "/docs/sdk-python", priority: 0.7 },
  { loc: "/docs/local-engine", priority: 0.8 },
  { loc: "/docs/deployment", priority: 0.7 },
  { loc: "/docs/observability", priority: 0.6 },
  { loc: "/docs/benchmarking", priority: 0.7 },
  { loc: "/docs/security", priority: 0.8 },
  { loc: "/docs/trust", priority: 0.7 },
  { loc: "/docs/troubleshooting", priority: 0.6 },
  { loc: "/docs/glossary", priority: 0.5 },
  { loc: "/docs/core", priority: 0.7 },
  { loc: "/docs/platform", priority: 0.7 },
  { loc: "/docs/memory-proxy", priority: 0.7 },
  { loc: "/docs/cognitive-extraction", priority: 0.6 },
  { loc: "/docs/analytics-api", priority: 0.6 },
  { loc: "/docs/context-templates", priority: 0.6 },
  { loc: "/docs/rate-limiting", priority: 0.5 },
  { loc: "/docs/connectors", priority: 0.6 },
  { loc: "/docs/mcp-server", priority: 0.7 },
  { loc: "/docs/self-hosting", priority: 0.7 },
];

function normalizeDate(value) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value.trim();
  return "";
}

function getBlogPosts() {
  const files = readdirSync(BLOG_DIR).filter((f) => f.endsWith(".md"));
  return files
    .map((file) => {
      const raw = readFileSync(join(BLOG_DIR, file), "utf-8");
      const { data } = matter(raw);
      const slug = file.replace(/\.md$/, "");
      const publishedAt = normalizeDate(data.publishedAt);
      const updatedAt = normalizeDate(data.updatedAt) || publishedAt;
      return {
        url: `/blog/${slug}`,
        publishedAt,
        updatedAt,
      };
    })
    .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
}

function absoluteUrl(pathname) {
  if (!pathname || pathname === "/") return `${SITE_ORIGIN}/`;
  const p = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${SITE_ORIGIN}${p.endsWith("/") ? p.slice(0, -1) : p}`;
}

mkdirSync(OUT_DIR, { recursive: true });

const blogPosts = getBlogPosts();

const urls = [
  ...staticPages,
  ...docsPages.map((p) => ({ ...p, lastmod: today })),
  ...blogPosts.map((post) => ({
    loc: post.url,
    priority: 0.8,
    lastmod: post.updatedAt || post.publishedAt,
  })),
];

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${urls
    .map(
      (u) => `<url>
    <loc>${absoluteUrl(u.loc)}</loc>
    <lastmod>${u.lastmod}</lastmod>
    <priority>${u.priority}</priority>
  </url>`,
    )
    .join("\n  ")}
</urlset>`;

writeFileSync(join(OUT_DIR, "sitemap.xml"), sitemap, "utf-8");
console.log(`Generated sitemap.xml with ${urls.length} URLs`);

const robots = [
  "User-agent: *",
  "Allow: /$",
  "Allow: /blog",
  "Allow: /docs",
  "Allow: /platform/benchmarks",
  "Allow: /platform/trust",
  "Allow: /platform/byoc",
  "Allow: /signup",
  "Allow: /login",
  "Disallow: /api/",
  "Disallow: /platform/billing",
  "Disallow: /platform/settings",
  "Disallow: /platform/clusters",
  "Disallow: /logout",
  "",
  `Sitemap: ${SITE_ORIGIN}/sitemap.xml`,
  "",
].join("\n");

writeFileSync(join(OUT_DIR, "robots.txt"), robots, "utf-8");
console.log("Generated robots.txt");
