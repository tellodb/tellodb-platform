import type { DocumentHead } from "@builder.io/qwik-city";

import { buildSeoHead } from "~/lib/seo";

export interface DocsNavItem {
  href: string;
  title: string;
  description?: string;
  icon?: string;
}

export interface DocsCategory {
  category: string;
  items: DocsNavItem[];
}

export const docsNavigation: DocsCategory[] = [
  {
    category: "Fundamentals",
    items: [
      {
        href: "/docs",
        title: "Overview",
        description: "What TelloDB is for and why the engine behaves differently.",
        icon: "rocket_launch"
      },
      {
        href: "/docs/quickstart",
        title: "Quickstart",
        description: "Launch the engine, connect from the SDK, and run your first query.",
        icon: "bolt"
      },
      {
        href: "/docs/install",
        title: "Install",
        description: "Dependencies, binary build, and first local boot.",
        icon: "bolt"
      },
      {
        href: "/docs/concepts",
        title: "Core Concepts",
        description: "Temporal memory terms and retrieval mental models.",
        icon: "psychology"
      }
    ]
  },
  {
    category: "Architecture",
    items: [
      {
        href: "/docs/architecture",
        title: "System Architecture",
        description: "How storage, vector, lexical, and graph layers fit together.",
        icon: "dashboard"
      },
      {
        href: "/docs/data-model",
        title: "Data Model",
        description: "The `AgentObservation` contract and field semantics.",
        icon: "dataset"
      },
      {
        href: "/docs/memory-kinds",
        title: "Memory Kinds",
        description: "How conversational, fact, and summary memories age differently.",
        icon: "category"
      },
      {
        href: "/docs/id-conventions",
        title: "ID Conventions",
        description: "How IDs encode entity, session, and turn safely.",
        icon: "tag"
      },
      {
        href: "/docs/ingestion-pipeline",
        title: "Ingestion Pipeline",
        description: "From raw text to vectors, graph edges, and deduplication.",
        icon: "hub"
      },
      {
        href: "/docs/vector-index",
        title: "Vector Index",
        description: "HNSW indexing and semantic candidate retrieval.",
        icon: "memory"
      },
      {
        href: "/docs/lexical-index",
        title: "Lexical Index",
        description: "BM25 scoring for exact terms and numbers.",
        icon: "text_snippet"
      },
      {
        href: "/docs/reranking",
        title: "Cross Reranking",
        description: "Cross-encoder scoring for top-k precision.",
        icon: "auto_awesome"
      },
      {
        href: "/docs/time-ranking",
        title: "Time Ranking",
        description: "Decay, TTL, and freshness-aware ranking.",
        icon: "schedule"
      },
      {
        href: "/docs/fact-supersession",
        title: "Fact Supersession",
        description: "How outdated facts are invalidated by newer truth.",
        icon: "published_with_changes"
      }
    ]
  },
  {
    category: "API",
    items: [
      {
        href: "/docs/api-auth",
        title: "API Auth",
        description: "Platform-issued keys and a clear path to scoped auth.",
        icon: "api"
      },
      {
        href: "/docs/api-ingest",
        title: "POST /ingest",
        description: "Store episodic and companion memories.",
        icon: "database"
      },
      {
        href: "/docs/api-query-semantic",
        title: "POST /query/semantic",
        description: "Hybrid retrieval with semantic-first intent.",
        icon: "travel_explore"
      },
      {
        href: "/docs/api-query-temporal",
        title: "POST /query/temporal",
        description: "When-windowed retrieval for timeline reasoning.",
        icon: "history"
      },
      {
        href: "/docs/api-delete",
        title: "DELETE /memory",
        description: "Delete and repair indexes safely.",
        icon: "delete"
      }
    ]
  },
  {
    category: "SDKs",
    items: [
      {
        href: "/docs/sdk-javascript",
        title: "JavaScript SDK",
        description: "Node and edge client patterns for ingestion and retrieval.",
        icon: "terminal"
      },
      {
        href: "/docs/sdk-python",
        title: "Python SDK",
        description: "Async ingestion and production query patterns.",
        icon: "code"
      }
    ]
  },
  {
    category: "Operations",
    items: [
      {
        href: "/docs/local-engine",
        title: "Local Engine",
        description: "Run the Rust binary as a sidecar for development.",
        icon: "memory"
      },
      {
        href: "/docs/deployment",
        title: "Deployment",
        description: "Production runtime, persistence, and scaling guidance.",
        icon: "deployed_code"
      },
      {
        href: "/docs/observability",
        title: "Observability",
        description: "Tracing, metrics, and recall quality monitoring.",
        icon: "bar_chart"
      },
      {
        href: "/docs/benchmarking",
        title: "Benchmarking",
        description: "Reproduce long-context evaluations and compare runs.",
        icon: "bar_chart"
      },
      {
        href: "/docs/security",
        title: "Security Model",
        description: "How to think about hosted access and tenant scope.",
        icon: "verified_user"
      },
      {
        href: "/docs/troubleshooting",
        title: "Troubleshooting",
        description: "Common ingest/query failures and practical fixes.",
        icon: "build"
      }
    ]
  },
  {
    category: "Reference",
    items: [
      {
        href: "/docs/glossary",
        title: "Glossary",
        description: "Short definitions for memory and retrieval terms.",
        icon: "hub"
      }
    ]
  }
];

export function createHead(
  title: string,
  description: string,
  pathname = "/docs",
  keywords?: string[],
  structuredData?: Record<string, unknown>
): DocumentHead {
  return buildSeoHead({
    title,
    description,
    pathname,
    keywords,
    structuredData
  });
}
