# Tellodb Platform

**Tellodb** is a temporal memory database for AI agents. It stores memories as evolving evidence, tracks which facts are currently true, invalidates stale facts, computes numeric answers deterministically, and retrieves context through a hybrid of vector, lexical, graph, and temporal search.

Unlike generic memory APIs that just wrap embeddings and return stale information, Tellodb is an actual database engine built in Rust. It focuses on the core problem of long-term agent memory: **knowing what is currently true, rather than just recalling what was said in the past.**

This open-source repository (`tellodb-platform`) powers the official web platform deployed at [tellodb.com](https://tellodb.com), built with [Qwik](https://qwik.builder.io/). It serves the marketing landing page, developer documentation, blog, and the user dashboard for API key management.

## What Tellodb Does Better (The Benefits)

- **Temporal Truth & Fact Supersession:** Tellodb understands when a new fact supersedes an old one (e.g., "I moved to Seattle" invalidates "I live in Austin"). Stale facts are filtered out, giving your agents accurate context.
- **Deterministic Numeric Memory:** It computes numeric answers (counts, sums) deterministically using a metric vault, rather than relying on the LLM to guess the right number from a context window.
- **Local-First, Single-Binary Engine:** The core engine is deployed via a highly performant Rust binary. Keep your data private and local.
- **True Hybrid Retrieval:** Combines HNSW vector search, BM25 full-text search, graph knowledge retrieval, and time-aware ranking in one unified system.
- **Drop-in Proxy:** Add memory to existing OpenAI SDK apps by simply changing the base URL. Tellodb automatically injects context and forwards the request to your LLM provider.
- **Model Context Protocol (MCP):** Designed for IDEs and agents like Claude Code, Cursor, and Windsurf via an MCP stdio server.

## How to Use Tellodb

### 1. Local Engine
Run Tellodb privately on your local machine for privacy-focused coding agents.
```bash
tellodb serve
```

### 2. Drop-In Proxy
For developers already using OpenAI-style APIs, add memory to your agents without rewriting your application code. Change your SDK's base URL to point to your Tellodb instance, and pass your Tellodb API key.

### 3. Hosted Platform & API Keys
The hosted API provides managed memory infrastructure with API keys and usage stats. Log into the platform dashboard to manage your credentials.

---

## Developing the Web Platform

This repository contains the Qwik rewrite of the Tellodb dashboard and marketing site.

### Includes
- Marketing landing page on `/`
- Documentation surface on `/docs`
- Blog surface on `/blog`
- Demo login on `/login`
- Cookie-backed API key dashboard on `/platform`

### Run locally

```bash
npm install
npm run dev
```

### Production build

```bash
npm run build
npm run serve
```

### Demo Login

You can test the platform dashboard locally using the demo credentials:
- **Email:** `demo@tellodb.dev`
- **Password:** `tellodb-demo`

*(Override these by setting `ALETHEIADB_DEMO_EMAIL` and `ALETHEIADB_DEMO_PASSWORD` in your environment.)*

### Blog Authoring

Blog posts live in `src/content/blog/*.md`.
- The filename becomes the slug.
- Frontmatter drives title, description, dates, tags, and featured state.
- New `.md` files are picked up automatically by the blog index, post routes, sitemap, and SEO metadata.
