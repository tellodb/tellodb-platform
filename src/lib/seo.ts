import type { DocumentHead } from "@builder.io/qwik-city";

import {
  DEFAULT_SOCIAL_IMAGE,
  DEFAULT_SOCIAL_IMAGE_ALT,
  SITE_NAME,
  absoluteAssetUrl,
  absoluteUrl
} from "~/lib/site";

type StructuredData =
  | Record<string, unknown>
  | Array<Record<string, unknown>>;

interface SeoOptions {
  title: string;
  description?: string;
  pathname: string;
  type?: "website" | "article";
  image?: string;
  imageAlt?: string;
  keywords?: string[];
  noindex?: boolean;
  publishedAt?: string;
  updatedAt?: string;
  authors?: string[];
  structuredData?: StructuredData;
  styles?: Array<{
    key: string;
    style: string;
  }>;
}

export function buildSeoHead({
  title,
  description = "TelloDB is the persistent memory layer for AI agents that need temporal awareness, truth extraction, and continuity across models.",
  pathname,
  type = "website",
  image = DEFAULT_SOCIAL_IMAGE,
  imageAlt = DEFAULT_SOCIAL_IMAGE_ALT,
  keywords,
  noindex = false,
  publishedAt,
  updatedAt,
  authors,
  structuredData,
  styles
}: SeoOptions): DocumentHead {
  const url = absoluteUrl(pathname);
  const imageUrl = absoluteAssetUrl(image);
  const robots = noindex
    ? "noindex, nofollow, noarchive"
    : "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1";

  return {
    title,
    meta: [
      {
        key: "meta-description",
        name: "description",
        content: description
      },
      {
        key: "og-locale",
        property: "og:locale",
        content: "en_US"
      },
      {
        key: "meta-robots",
        name: "robots",
        content: robots
      },
      ...(keywords?.length
        ? [
            {
              key: "meta-keywords",
              name: "keywords",
              content: keywords.join(", ")
            }
          ]
        : []),
      {
        key: "og-type",
        property: "og:type",
        content: type
      },
      {
        key: "og-site-name",
        property: "og:site_name",
        content: SITE_NAME
      },
      {
        key: "og-title",
        property: "og:title",
        content: title
      },
      {
        key: "og-description",
        property: "og:description",
        content: description
      },
      {
        key: "og-url",
        property: "og:url",
        content: url
      },
      {
        key: "og-image",
        property: "og:image",
        content: imageUrl
      },
      {
        key: "og-image-alt",
        property: "og:image:alt",
        content: imageAlt
      },
      {
        key: "twitter-card",
        name: "twitter:card",
        content: "summary_large_image"
      },
      {
        key: "twitter-title",
        name: "twitter:title",
        content: title
      },
      {
        key: "twitter-description",
        name: "twitter:description",
        content: description
      },
      {
        key: "twitter-image",
        name: "twitter:image",
        content: imageUrl
      },
      ...(publishedAt
        ? [
            {
              key: "article-published-time",
              property: "article:published_time",
              content: publishedAt
            }
          ]
        : []),
      ...(updatedAt
        ? [
            {
              key: "article-modified-time",
              property: "article:modified_time",
              content: updatedAt
            }
          ]
        : []),
      ...(authors?.map((author, index) => ({
        key: `article-author-${index}`,
        property: "article:author",
        content: author
      })) ?? [])
    ],
    scripts: structuredData
      ? [
          {
            key: "structured-data",
            props: {
              type: "application/ld+json"
            },
            script: JSON.stringify(structuredData)
          }
        ]
      : [],
    styles
  };
}
