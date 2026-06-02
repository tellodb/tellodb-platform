import { Slot, component$ } from "@builder.io/qwik";
import { Link, type RequestHandler, useLocation } from "@builder.io/qwik-city";

import {
  CONTACT_EMAIL,
  CONTACT_MAILTO,
  LINKEDIN_COMPANY_URL,
} from "~/constants/contact";
import { formatBlogDate, getAllBlogPosts, getBlogTagSummaries } from "~/lib/blog";
import { setPublicEdgeCache } from "~/lib/cache";

const allPosts = getAllBlogPosts();
const tagSummaries = getBlogTagSummaries().slice(0, 8);

export const onRequest: RequestHandler = (event) => {
  setPublicEdgeCache(event);
};

export default component$(() => {
  const location = useLocation();
  const rawPath = location.url.pathname;
  const pathname =
    rawPath.length > 1 && rawPath.endsWith("/")
      ? rawPath.slice(0, -1)
      : rawPath;

  return (
    <div class="blog-shell">
      <aside class="blog-shell-left">
        <div class="blog-shell-left-inner">
          <div class="blog-brand">
            <div class="blog-brand-icon">
              <img
                src="/icon-64.png"
                alt="TelloDB blog"
                width={32}
                height={32}
                loading="eager"
                decoding="async"
              />
            </div>
            <div>
              <p class="blog-brand-title">Blog</p>
              <p class="blog-brand-subtitle">TelloDB Journal</p>
            </div>
          </div>

          <div class="blog-nav-group">
            <p class="blog-nav-heading">Browse</p>
            <div class="blog-nav-items">
              <Link
                href="/blog"
                class={`blog-nav-link ${pathname === "/blog" ? "blog-nav-link-active" : ""}`}
              >
                <span class="blog-nav-copy">
                  <span class="blog-nav-title">All Posts</span>
                  <span class="blog-nav-description">
                    Essays on memory infrastructure, retrieval, and developer workflows.
                  </span>
                </span>
              </Link>
            </div>
          </div>

          <div class="blog-nav-group">
            <p class="blog-nav-heading">Latest Posts</p>
            <div class="blog-nav-items">
              {allPosts.map((post) => {
                const isActive = post.url === pathname;

                return (
                  <Link
                    key={post.slug}
                    href={post.url}
                    class={`blog-nav-link ${isActive ? "blog-nav-link-active" : ""}`}
                  >
                    <span class="blog-nav-copy">
                      <span class="blog-nav-title">{post.title}</span>
                      <span class="blog-nav-description">
                        {formatBlogDate(post.publishedAt)}
                      </span>
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </aside>

      <main class="blog-shell-main">
        <div class="blog-main-gradient" aria-hidden="true" />
        <div class="blog-mobile-nav">
          <div class="blog-mobile-nav-header">
            <p class="blog-mobile-nav-kicker">Latest Posts</p>
            <h2 class="blog-mobile-nav-title">Browse the journal</h2>
          </div>
          <div class="blog-mobile-nav-links">
            <Link
              href="/blog"
              class={`blog-mobile-nav-link ${pathname === "/blog" ? "blog-mobile-nav-link-active" : ""}`}
            >
              All Posts
            </Link>
            {allPosts.map((post) => {
              const isActive = post.url === pathname;

              return (
                <Link
                  key={`mobile-${post.slug}`}
                  href={post.url}
                  class={`blog-mobile-nav-link ${isActive ? "blog-mobile-nav-link-active" : ""}`}
                >
                  {post.title}
                </Link>
              );
            })}
          </div>
        </div>
        <article class="blog-article">
          <Slot />
        </article>
      </main>

      <aside class="blog-shell-right">
        <div class="blog-shell-right-inner">
          <div class="blog-side-card">
            <p class="blog-side-card-title">Why this section exists</p>
            <p class="blog-side-card-copy">
              TelloDB&apos;s blog targets high-intent searches around agent memory,
              temporal retrieval, and production recall quality.
            </p>
          </div>

          <div class="blog-side-card">
            <p class="blog-side-card-title">Topics</p>
            <div class="blog-tag-cloud">
              {tagSummaries.map((tag) => (
                <span key={tag.tag} class="blog-tag-pill">
                  {tag.tag}
                  <span>{tag.count}</span>
                </span>
              ))}
            </div>
          </div>

          <div class="blog-side-card">
            <p class="blog-side-card-title">Need product detail?</p>
            <p class="blog-side-card-copy">
              Use the docs for API shape, architecture, and deployment guidance.
            </p>
            <Link href="/docs" class="blog-side-card-link">
              Open Docs
            </Link>
            <p class="blog-side-card-note">
              Contact:{" "}
              <a href={CONTACT_MAILTO} target="_blank" rel="noreferrer">
                {CONTACT_EMAIL}
              </a>
              {" · "}
              <a href={LINKEDIN_COMPANY_URL} target="_blank" rel="noreferrer">
                LinkedIn
              </a>
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
});
