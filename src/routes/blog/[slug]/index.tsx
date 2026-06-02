import { component$ } from "@builder.io/qwik";
import {
  Link,
  routeLoader$,
  type DocumentHeadProps
} from "@builder.io/qwik-city";

import {
  formatBlogDate,
  getBlogPostBySlug,
  getRelatedBlogPosts
} from "~/lib/blog";
import { buildSeoHead } from "~/lib/seo";
import { SITE_NAME, absoluteAssetUrl, absoluteUrl } from "~/lib/site";

export const useBlogPost = routeLoader$(({ params, status }) => {
  const post = getBlogPostBySlug(params.slug);

  if (!post) {
    status(404);
    return null;
  }

  return post;
});

export default component$(() => {
  const post = useBlogPost();

  if (!post.value) {
    return (
      <section class="blog-not-found">
        <div class="eyebrow blog-eyebrow">Not Found</div>
        <h1>Post not found</h1>
        <p class="blog-hero-lead">
          The blog article you requested does not exist.
        </p>
        <Link href="/blog" class="blog-inline-link">
          Back to blog
        </Link>
      </section>
    );
  }

  const relatedPosts = getRelatedBlogPosts(post.value.slug, 3);

  return (
    <div class="blog-post-view">
      <header class="blog-post-header">
        <div class="eyebrow blog-eyebrow">TelloDB Blog</div>
        <div class="blog-post-meta">
          <span>{formatBlogDate(post.value.publishedAt)}</span>
          <span>{post.value.readingTimeMinutes} min read</span>
          <span>{post.value.author}</span>
        </div>
        <h1 class="blog-post-title">{post.value.title}</h1>
        <p class="blog-post-lead">{post.value.description}</p>
        <div class="blog-card-tags">
          {post.value.tags.map((tag) => (
            <span key={`${post.value.slug}-${tag}`} class="blog-card-tag">
              {tag}
            </span>
          ))}
        </div>
      </header>

      <div class="blog-prose" dangerouslySetInnerHTML={post.value.html} />

      {relatedPosts.length ? (
        <section class="blog-related">
          <div class="blog-section-header">
            <div>
              <p class="blog-section-label">Keep Reading</p>
              <h2>Related posts</h2>
            </div>
          </div>
          <div class="blog-card-grid">
            {relatedPosts.map((relatedPost) => (
              <Link key={relatedPost.slug} href={relatedPost.url} class="blog-card">
                <div class="blog-card-meta">
                  <span>{formatBlogDate(relatedPost.publishedAt)}</span>
                  <span>{relatedPost.readingTimeMinutes} min read</span>
                </div>
                <h3 class="blog-card-title">{relatedPost.title}</h3>
                <p class="blog-card-excerpt">{relatedPost.excerpt}</p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
});

export const head = ({ resolveValue }: DocumentHeadProps) => {
  const post = resolveValue(useBlogPost);

  if (!post) {
    return buildSeoHead({
      title: "Blog Post Not Found | TelloDB",
      description: "The requested blog article could not be found.",
      pathname: "/blog",
      noindex: true
    });
  }

  return buildSeoHead({
    title: `${post.title} | TelloDB`,
    description: post.description,
    pathname: post.url,
    type: "article",
    image: post.image,
    keywords: post.tags,
    publishedAt: post.publishedAt,
    updatedAt: post.updatedAt,
    authors: [post.author],
    structuredData: {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: post.title,
      description: post.description,
      datePublished: post.publishedAt,
      dateModified: post.updatedAt,
      author: {
        "@type": "Organization",
        name: post.author
      },
      publisher: {
        "@type": "Organization",
        name: SITE_NAME
      },
      image: absoluteAssetUrl(post.image),
      url: absoluteUrl(post.url),
      keywords: post.tags.join(", ")
    }
  });
};
