import { component$ } from "@builder.io/qwik";
import { Link } from "@builder.io/qwik-city";

import {
  formatBlogDate,
  getAllBlogPosts,
  getFeaturedBlogPosts,
} from "~/lib/blog";
import { buildSeoHead } from "~/lib/seo";
import { SITE_NAME, absoluteUrl } from "~/lib/site";

const posts = getAllBlogPosts();
const featuredPosts = getFeaturedBlogPosts(2);

export default component$(() => {
  return (
    <div class="blog-index">
      <section class="blog-hero">
        <h1 class="blog-hero-title">Tellodb Blog</h1>
        <p class="blog-hero-lead">
          Writing for high-intent searches around temporal memory, hybrid
          retrieval, and infrastructure for agents that need continuity over
          time.
        </p>

        <div class="blog-hero-metrics">
          <div class="blog-metric-card">
            <span class="blog-metric-label">Published posts</span>
            <strong class="blog-metric-value">{posts.length}</strong>
          </div>
          <div class="blog-metric-card">
            <span class="blog-metric-label">Primary topics</span>
            <strong class="blog-metric-value">
              Memory, Retrieval, Evaluation
            </strong>
          </div>
          <div class="blog-metric-card">
            <span class="blog-metric-label">Audience</span>
            <strong class="blog-metric-value">
              AI teams shipping to production
            </strong>
          </div>
        </div>
      </section>

      <section class="blog-section">
        <div class="blog-section-header">
          <div>
            <p class="blog-section-label">Featured</p>
            <h2>Cornerstone posts</h2>
          </div>
          <Link href="/docs" class="blog-inline-link">
            See docs
          </Link>
        </div>

        <div class="blog-card-grid blog-card-grid-featured">
          {featuredPosts.map((post) => (
            <Link
              key={post.slug}
              href={post.url}
              class="blog-card blog-card-featured"
            >
              <div class="blog-card-meta">
                <span>{formatBlogDate(post.publishedAt)}</span>
                <span>{post.readingTimeMinutes} min read</span>
              </div>
              <h3 class="blog-card-title">{post.title}</h3>
              <p class="blog-card-excerpt">{post.excerpt}</p>
              <div class="blog-card-tags">
                {post.tags.map((tag) => (
                  <span key={`${post.slug}-${tag}`} class="blog-card-tag">
                    {tag}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section class="blog-section">
        <div class="blog-section-header">
          <div>
            <p class="blog-section-label">Latest</p>
            <h2>All posts</h2>
          </div>
        </div>

        <div class="blog-card-grid">
          {posts.map((post) => (
            <Link key={post.slug} href={post.url} class="blog-card">
              <div class="blog-card-meta">
                <span>{formatBlogDate(post.publishedAt)}</span>
                <span>{post.author}</span>
              </div>
              <h3 class="blog-card-title">{post.title}</h3>
              <p class="blog-card-description">{post.description}</p>
              <p class="blog-card-excerpt">{post.excerpt}</p>
              <div class="blog-card-footer">
                <div class="blog-card-tags">
                  {post.tags.slice(0, 3).map((tag) => (
                    <span key={`${post.slug}-${tag}`} class="blog-card-tag">
                      {tag}
                    </span>
                  ))}
                </div>
                <span class="blog-read-more">Read article</span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
});

export const head = buildSeoHead({
  title: "Blog | Tellodb",
  description:
    "Insights on temporal memory, hybrid retrieval, evaluation, and infrastructure for AI agents that need continuity.",
  pathname: "/blog",
  keywords: [
    "agent memory",
    "temporal memory",
    "hybrid retrieval",
    "vector database alternatives",
    "AI infrastructure blog",
  ],
  structuredData: {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: `${SITE_NAME} Blog`,
    description:
      "Insights on temporal memory, retrieval, evaluation, and memory infrastructure for AI agents.",
    url: absoluteUrl("/blog"),
  },
});
