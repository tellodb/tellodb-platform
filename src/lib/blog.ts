import matter from "gray-matter";
import { marked } from "marked";

export interface BlogPostSummary {
  slug: string;
  url: string;
  title: string;
  description: string;
  excerpt: string;
  publishedAt: string;
  updatedAt: string;
  author: string;
  tags: string[];
  image: string;
  featured: boolean;
  readingTimeMinutes: number;
}

export interface BlogPost extends BlogPostSummary {
  html: string;
}

interface BlogFrontmatter {
  title?: unknown;
  description?: unknown;
  excerpt?: unknown;
  publishedAt?: unknown;
  updatedAt?: unknown;
  author?: unknown;
  tags?: string[] | string;
  image?: unknown;
  featured?: boolean;
}

const rawBlogFiles = import.meta.glob("../content/blog/*.md", {
  eager: true,
  query: "?raw",
  import: "default"
}) as Record<string, string>;

function normalizeFrontmatterString(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "string") {
    return value.trim();
  }

  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}

function requireFrontmatterValue(
  slug: string,
  field: keyof Pick<BlogFrontmatter, "title" | "description" | "publishedAt">,
  value: unknown
): string {
  const normalized = normalizeFrontmatterString(value);

  if (!normalized) {
    throw new Error(`Blog post "${slug}" is missing required frontmatter field "${field}".`);
  }

  return normalized;
}

function normalizeTags(tags: BlogFrontmatter["tags"]): string[] {
  if (!tags) {
    return [];
  }

  if (Array.isArray(tags)) {
    return tags.map((tag) => String(tag).trim()).filter(Boolean);
  }

  return tags
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function createExcerpt(content: string, frontmatterExcerpt?: unknown): string {
  const normalizedExcerpt = normalizeFrontmatterString(frontmatterExcerpt);

  if (normalizedExcerpt) {
    return normalizedExcerpt;
  }

  const plainText = content
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[>#*_~-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (plainText.length <= 180) {
    return plainText;
  }

  return `${plainText.slice(0, 177).trimEnd()}...`;
}

function calculateReadingTimeMinutes(content: string): number {
  const wordCount = content
    .replace(/```[\s\S]*?```/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

  return Math.max(1, Math.round(wordCount / 220));
}

function parsePost(filePath: string, rawSource: string): BlogPost {
  const slug = filePath.split("/").pop()?.replace(/\.md$/, "") ?? "";
  const { data, content } = matter(rawSource);
  const frontmatter = data as BlogFrontmatter;
  const title = requireFrontmatterValue(slug, "title", frontmatter.title);
  const description = requireFrontmatterValue(
    slug,
    "description",
    frontmatter.description
  );
  const publishedAt = requireFrontmatterValue(
    slug,
    "publishedAt",
    frontmatter.publishedAt
  );
  const updatedAt = normalizeFrontmatterString(frontmatter.updatedAt) || publishedAt;
  const tags = normalizeTags(frontmatter.tags);

  return {
    slug,
    url: `/blog/${slug}`,
    title,
    description,
    excerpt: createExcerpt(content, frontmatter.excerpt),
    publishedAt,
    updatedAt,
    author: normalizeFrontmatterString(frontmatter.author) || "TelloDB Team",
    tags,
    image: normalizeFrontmatterString(frontmatter.image) || "/screen.png",
    featured: frontmatter.featured !== false,
    readingTimeMinutes: calculateReadingTimeMinutes(content),
    html: marked.parse(content) as string
  };
}

const blogPosts = Object.entries(rawBlogFiles)
  .map(([filePath, rawSource]) => parsePost(filePath, rawSource))
  .sort(
    (left, right) =>
      new Date(right.publishedAt).getTime() - new Date(left.publishedAt).getTime()
  );

const blogPostsBySlug = Object.fromEntries(
  blogPosts.map((post) => [post.slug, post])
) as Record<string, BlogPost>;

export function getAllBlogPosts(): BlogPost[] {
  return blogPosts;
}

export function getFeaturedBlogPosts(limit = 2): BlogPost[] {
  return blogPosts.filter((post) => post.featured).slice(0, limit);
}

export function getBlogPostBySlug(slug: string): BlogPost | null {
  return blogPostsBySlug[slug] ?? null;
}

export function getRelatedBlogPosts(slug: string, limit = 3): BlogPostSummary[] {
  return blogPosts.filter((post) => post.slug !== slug).slice(0, limit);
}

export function getBlogTagSummaries(): Array<{ tag: string; count: number }> {
  const counts = new Map<string, number>();

  for (const post of blogPosts) {
    for (const tag of post.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((left, right) => right.count - left.count || left.tag.localeCompare(right.tag));
}

export function formatBlogDate(dateString: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric"
  }).format(new Date(dateString));
}
