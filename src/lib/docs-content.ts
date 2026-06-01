export interface DocsCodeBlock {
  label?: string;
  language?: string;
  code: string;
}

export interface DocsCallout {
  tone?: "info" | "warning" | "success";
  title?: string;
  body: string;
}

export interface DocsStat {
  label: string;
  value: string;
  description?: string;
  tone?: "default" | "primary" | "success" | "warning";
}

export interface DocsArtifact {
  name: string;
  description: string;
  meta?: string;
}

export interface DocsTable {
  columns: string[];
  rows: Array<{
    label: string;
    values: string[];
  }>;
  footnote?: string;
}

export interface DocsSection {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
  steps?: string[];
  codeBlocks?: DocsCodeBlock[];
  callout?: DocsCallout;
  stats?: DocsStat[];
  artifacts?: DocsArtifact[];
  table?: DocsTable;
}

export interface DocsPage {
  slug: string;
  eyebrow: string;
  title: string;
  lead: string;
  description: string;
  sections: DocsSection[];
}

export const detailedDocsPages: DocsPage[] = [
  {
    slug: "install",
    eyebrow: "Setup",
    title: "Install Tellodb",
    lead: "Set up the Tellodb engine locally with predictable binaries, model downloads, and SDK wiring.",
    description:
      "Installation guide for Tellodb including prerequisites, build flow, and first health check.",
    sections: [
      {
        heading: "Prerequisites",
        paragraphs: [
          "Tellodb is built as a Rust service with optional SDK clients. For a smooth start, install Rust stable and keep at least 4GB free disk for model and index artifacts.",
          "Use a dedicated workspace directory for cache and data files so benchmarks and local testing can be reset without touching your main development environment.",
        ],
        bullets: [
          "Rust toolchain (stable channel)",
          "Git for fetching benchmark assets",
          "Node 20+ if you are using the platform/docs UI",
          "Python 3.10+ only if using the Python SDK examples",
        ],
      },
      {
        heading: "Build and first boot",
        paragraphs: [
          "The release build gives realistic performance for retrieval and reranking tests. Development builds are fine for functional checks but not for latency decisions.",
        ],
        steps: [
          "Clone the monorepo and open `Tellodb`.",
          "Build release binary with Cargo.",
          "Start the API server on loopback.",
          "Call `/health` before sending ingest/query traffic.",
        ],
        codeBlocks: [
          {
            label: "Build and run",
            language: "bash",
            code: `cargo build --release
export TEMPORAL_MEMORY_API_KEY=my-key
export TEMPORAL_MEMORY_DATA_DIR=./.tm-data
./target/release/tellodb
# Listens on http://127.0.0.1:3000 by default`,
          },
        ],
      },
      {
        heading: "SDK smoke test",
        paragraphs: [
          "After the server is healthy, run one ingest and one query through your preferred SDK. This validates auth headers, entity scoping, and transport behavior in one pass.",
        ],
        codeBlocks: [
          {
            label: "Minimal curl check",
            language: "bash",
            code: `curl -sS http://127.0.0.1:3000/ingest \\
  -H "content-type: application/json" \\
  -d '{"entity_id":"user-123","memory_id":"mem-001","timestamp":1700000000000,"textual_content":"I now drink tea instead of coffee."}'`,
          },
        ],
      },
    ],
  },
  {
    slug: "concepts",
    eyebrow: "Foundations",
    title: "Core Concepts",
    lead: "Understand the core memory concepts before tuning retrieval or shipping integrations.",
    description:
      "Conceptual overview of Tellodb memory, companion memories, and hybrid retrieval behavior.",
    sections: [
      {
        heading: "Memory is multi-representation",
        paragraphs: [
          "Tellodb stores a memory event in multiple forms: raw text, embedding vector, lexical index terms, and graph relationships. This is why exact terms and paraphrases can both be recovered without scanning full transcripts.",
          "The engine is not just an ANN index. It is a retrieval system that fuses multiple signals into one ranked result list.",
        ],
      },
      {
        heading: "Companion memories",
        paragraphs: [
          "Ingest can emit companion records such as facts and summaries. Companion memories compress conversational noise into stable retrieval surfaces, improving recall quality on long sessions.",
          "Companions are linked back to source turns through graph edges so provenance is auditable.",
        ],
        bullets: [
          "Fact companions represent stable propositions.",
          "Summary companions capture compact session gist.",
          "Derived records never lose linkage to original turns.",
        ],
      },
      {
        heading: "Freshness and truth",
        paragraphs: [
          "Temporal ranking and fact supersession prevent stale context from dominating retrieval. If user preferences change, older conflicting facts are demoted or invalidated.",
          "The practical goal is simple: newer truth should win unless the query explicitly asks for historical state.",
        ],
      },
    ],
  },
  {
    slug: "architecture",
    eyebrow: "Architecture",
    title: "System Architecture",
    lead: "Tellodb combines temporal storage, vector retrieval, lexical scoring, and graph lineage in one service.",
    description:
      "Detailed architecture of Tellodb components and request flow.",
    sections: [
      {
        heading: "Runtime components",
        bullets: [
          "HTTP API: request validation and orchestration",
          "Temporal store: durable source of truth records",
          "Vector index: nearest-neighbor semantic recall",
          "Lexical index: BM25 exact-term recovery",
          "Graph store: provenance and supersession links",
          "Semantic models: bi-encoder and optional cross-encoder",
        ],
        paragraphs: [
          "Each component can fail independently, so production readiness depends on explicit health checks and reconciliation jobs between indexes and durable storage.",
        ],
      },
      {
        heading: "Ingest flow",
        codeBlocks: [
          {
            label: "Ingest lifecycle",
            language: "text",
            code: `request -> normalize -> companion expansion -> embedding -> dedup\n       -> write temporal store -> write vector/lexical/graph indexes`,
          },
        ],
        paragraphs: [
          "Durable write order matters. The source-of-truth store should be committed before secondary index updates are marked complete, otherwise reconciliation gets harder after crashes.",
        ],
      },
      {
        heading: "Query flow",
        paragraphs: [
          "Query requests gather candidates from both semantic and lexical paths. Candidate lists can be reranked and fused, then filtered by temporal policy before response serialization.",
          "This design keeps both high recall and exact-term precision, even when the user asks for rare names, IDs, or dates.",
        ],
        codeBlocks: [
          {
            label: "Hybrid retrieval sketch",
            language: "text",
            code: `semantic_topk + lexical_topk -> optional cross-rerank -> RRF fusion\n-> temporal filters (TTL, superseded facts) -> final ranked hits`,
          },
        ],
      },
    ],
  },
  {
    slug: "data-model",
    eyebrow: "Data",
    title: "Data Model",
    lead: "The core record is `AgentObservation`, designed for temporal ordering and retrieval interoperability.",
    description:
      "Field-level explanation of the AgentObservation schema and retrieval implications.",
    sections: [
      {
        heading: "Primary record",
        codeBlocks: [
          {
            label: "Rust shape",
            language: "rust",
            code: `pub struct AgentObservation {
    pub entity_id: String,
    pub textual_content: String,
    pub embedding: Vec<f32>,
    pub kind: MemoryKind,
    pub created_at_ms: u64,
}`,
          },
        ],
        paragraphs: [
          "`entity_id` defines the ownership scope. `created_at_ms` gives deterministic time ordering. `kind` controls decay and retention policy at query time.",
        ],
      },
      {
        heading: "Field constraints",
        bullets: [
          "`entity_id` should be stable and tenant-safe",
          "`textual_content` should contain normalized text",
          "`embedding` dimension must match model output",
          "`created_at_ms` should use event time when possible",
        ],
        paragraphs: [
          "Store event time instead of processing time when available. This makes replay and timeline queries deterministic across re-ingestion runs.",
        ],
      },
      {
        heading: "Why this model works",
        paragraphs: [
          "The model is intentionally compact. Secondary concerns like supersession, deletion lineage, or vector IDs are handled by adjacent tables rather than inflating the main record.",
          "Compact records reduce serialization overhead and simplify consistency checks in recovery tooling.",
        ],
      },
    ],
  },
  {
    slug: "memory-kinds",
    eyebrow: "Policies",
    title: "Memory Kinds and Retention",
    lead: "Different memory kinds should age and rank differently to keep retrieval useful over time.",
    description: "Retention and ranking behavior by MemoryKind.",
    sections: [
      {
        heading: "Kind taxonomy",
        bullets: [
          "Conversational: raw episodic turns",
          "SessionSummary: compressed session-level context",
          "Fact: stable propositions and profile truths",
          "Lesson: extracted guidance from prior outcomes",
          "Decision: explicit committed decision",
          "Preference: user preferences intended to persist",
        ],
      },
      {
        heading: "Default policy ideas",
        paragraphs: [
          "Not all memories should decay equally. Conversational snippets become noisy quickly, while facts and preferences should persist unless explicitly superseded.",
          "Define policy centrally and keep it versioned; this prevents silent retrieval drift when teams tune decay weights ad hoc.",
        ],
        codeBlocks: [
          {
            label: "Example policy table",
            language: "yaml",
            code: `conversational: { ttl_days: 90,  decay_half_life_days: 14 }
session_summary: { ttl_days: 60, decay_half_life_days: 10 }
fact: { ttl_days: 730, decay_half_life_days: 120 }
preference: { ttl_days: 730, decay_half_life_days: null }
decision: { ttl_days: null, decay_half_life_days: null }`,
          },
        ],
      },
      {
        heading: "Operational guardrails",
        bullets: [
          "Record policy version used at ingest time.",
          "Recompute scores if policy version changes materially.",
          "Log filtered-hit counts by reason (ttl, invalidated, scope).",
        ],
      },
    ],
  },
  {
    slug: "id-conventions",
    eyebrow: "IDs",
    title: "ID and Session Conventions",
    lead: "Deterministic IDs make provenance, replays, and deletes much easier to reason about.",
    description: "ID structure and companion-memory naming conventions.",
    sections: [
      {
        heading: "Base memory ID format",
        paragraphs: [
          "A common convention is `entity_id::session_id::turn_index`. It allows lightweight parsing of ownership and session context without additional joins.",
          "Use immutable IDs. If content changes, create a new memory and link with graph edges instead of mutating IDs.",
        ],
        codeBlocks: [
          {
            label: "Examples",
            language: "text",
            code: `user-42::session-7::3
user-42::session-7::1000003   # summary companion`,
          },
        ],
      },
      {
        heading: "Companion memory IDs",
        bullets: [
          "Summary companions can reserve a high turn-index range.",
          "Fact companions can reserve a separate range and include ordinal slot.",
          "Keep deterministic mapping from source turn to companions.",
        ],
        paragraphs: [
          "Deterministic companion IDs prevent duplicate expansion when ingest is retried.",
        ],
      },
      {
        heading: "Delete and repair implications",
        paragraphs: [
          "When one memory is deleted, deterministic ID layout helps locate related companions and graph edges. Recovery jobs can reconstruct index state using predictable ID neighborhoods.",
        ],
      },
    ],
  },
  {
    slug: "ingestion-pipeline",
    eyebrow: "Pipeline",
    title: "Ingestion Pipeline",
    lead: "Ingestion transforms raw events into durable, queryable Tellodb memory with deduplication and lineage.",
    description:
      "Step-by-step ingest pipeline including embedding, dedup, indexing, and graph updates.",
    sections: [
      {
        heading: "Pipeline stages",
        steps: [
          "Validate payload and normalize text.",
          "Expand companion memories when configured.",
          "Embed each memory candidate.",
          "Run dedup against content hash and entity scope.",
          "Persist source-of-truth records.",
          "Update vector, lexical, and graph indexes.",
          "Emit ingest result with accepted/skipped counters.",
        ],
      },
      {
        heading: "Failure strategy",
        paragraphs: [
          "Index operations should be idempotent. If ingest crashes after durable write but before index completion, a background repair pass should re-index missing memory IDs.",
          "Never treat a secondary index success as proof that durable write succeeded. Source-of-truth storage decides ground reality.",
        ],
      },
      {
        heading: "Recommended response shape",
        codeBlocks: [
          {
            label: "Ingest response",
            language: "json",
            code: `{
  "accepted": 12,
  "deduplicated": 3,
  "invalid": 0,
  "memory_ids": ["user-123::session-9::41", "user-123::session-9::42"]
}`,
          },
        ],
      },
    ],
  },
  {
    slug: "vector-index",
    eyebrow: "Retrieval",
    title: "Vector Index",
    lead: "The vector index provides fast semantic candidate retrieval for paraphrase-heavy queries.",
    description: "How Tellodb uses vector embeddings and HNSW ANN search.",
    sections: [
      {
        heading: "Embedding path",
        paragraphs: [
          "A bi-encoder converts memory text and queries into a shared dense space. Vector similarity retrieves semantically close passages even when wording differs.",
          "Normalize vectors consistently for both ingest and query paths to avoid score drift.",
        ],
      },
      {
        heading: "HNSW tradeoffs",
        bullets: [
          "Higher `ef_search` improves recall but increases latency.",
          "Higher `M` improves graph connectivity but uses more memory.",
          "Batch insertion patterns influence graph quality and cold-start behavior.",
        ],
        codeBlocks: [
          {
            label: "Typical tuning",
            language: "yaml",
            code: `vector_index:
  metric: cosine
  m: 24
  ef_construction: 200
  ef_search_default: 64`,
          },
        ],
      },
      {
        heading: "Operational checks",
        bullets: [
          "Track recall@k on a fixed evaluation set.",
          "Monitor p95 query latency by entity size bucket.",
          "Verify vector-id to memory-id mapping consistency after restarts.",
        ],
      },
    ],
  },
  {
    slug: "lexical-index",
    eyebrow: "Retrieval",
    title: "Lexical Index (BM25)",
    lead: "Lexical retrieval catches exact names, tokens, and numeric strings that dense embeddings may miss.",
    description: "BM25 lexical indexing behavior and hybrid retrieval role.",
    sections: [
      {
        heading: "Why lexical still matters",
        paragraphs: [
          "Semantic retrieval is strong for paraphrase, but weak for exact literal matching in some cases. BM25 restores precision for IDs, dates, error codes, and uncommon terms.",
          "Hybrid retrieval avoids the false dichotomy of semantic-only vs keyword-only systems.",
        ],
      },
      {
        heading: "Tokenization guidance",
        bullets: [
          "Normalize casing with domain-aware exceptions.",
          "Keep punctuation splitting consistent between ingest and query.",
          "Preserve key delimiters for IDs when possible.",
        ],
        codeBlocks: [
          {
            label: "Example lexical-heavy query",
            language: "json",
            code: `{
  "textual_query": "order_id 9f8a12e0 timeout on shard-3",
  "entity_id": "tenant-77",
  "limit": 8
}`,
          },
        ],
      },
      {
        heading: "Fusion expectations",
        paragraphs: [
          "BM25 candidates should be fused with semantic candidates, not blindly appended. Rank fusion methods like RRF keep both signals while reducing dominance by either side.",
        ],
      },
    ],
  },
  {
    slug: "reranking",
    eyebrow: "Precision",
    title: "Cross-Encoder Reranking",
    lead: "Reranking improves top-k relevance by scoring query and passage jointly.",
    description: "How and when to apply cross-encoder reranking in Tellodb.",
    sections: [
      {
        heading: "Where reranking fits",
        paragraphs: [
          "Use semantic + lexical retrieval for broad candidate generation, then apply reranking to a small candidate set. This gives better precision without full-corpus cross-encoding cost.",
          "Reranking is most useful for ambiguous or compositional queries.",
        ],
      },
      {
        heading: "Candidate budgeting",
        bullets: [
          "Retrieve 30-100 candidates from fusion stage.",
          "Rerank top 20-40 for latency-sensitive workloads.",
          "Expose a per-request override for evaluation runs.",
        ],
        codeBlocks: [
          {
            label: "Rerank config",
            language: "yaml",
            code: `reranking:
  enabled: true
  model: cross-encoder/ms-marco-MiniLM-L-6-v2
  max_candidates: 32`,
          },
        ],
      },
      {
        heading: "When to disable",
        paragraphs: [
          "Disable reranking for strict low-latency paths where lexical exact-match dominates query value, or when running tiny local benchmarks focused only on ingestion correctness.",
        ],
      },
    ],
  },
  {
    slug: "time-ranking",
    eyebrow: "Temporal",
    title: "Time-Aware Ranking",
    lead: "Tellodb ranks by relevance and freshness so outdated context does not dominate.",
    description: "How TTL and decay are applied during query ranking.",
    sections: [
      {
        heading: "Temporal scoring",
        paragraphs: [
          "After retrieval and optional reranking, Tellodb applies temporal policy. Expired memories are filtered; surviving memories can be decayed based on age and kind.",
          "This reduces stale recall while preserving long-lived facts and preferences.",
        ],
      },
      {
        heading: "TTL and decay",
        codeBlocks: [
          {
            label: "Conceptual score",
            language: "text",
            code: `final_score = relevance_score * freshness_weight(kind, age)
if age > ttl(kind): drop`,
          },
        ],
        bullets: [
          "TTL is a hard cutoff.",
          "Decay is a soft demotion.",
          "Policy is kind-specific, not global.",
        ],
      },
      {
        heading: "Practical tuning",
        paragraphs: [
          "Tune using replay datasets with known truth changes. If historical facts still outrank new facts, shorten half-life for conversational memory or increase supersession penalty.",
        ],
      },
    ],
  },
  {
    slug: "fact-supersession",
    eyebrow: "Truth Management",
    title: "Fact Supersession",
    lead: "Fact supersession marks older conflicting facts as invalid so latest truth wins.",
    description:
      "How Tellodb tracks and enforces fact supersession over time.",
    sections: [
      {
        heading: "Current fact slots",
        paragraphs: [
          "Facts are grouped by logical key (for example `preferred_drink`). The current slot points to the newest valid memory ID for that key and entity.",
          "Historical facts are preserved in history tables for audits, but invalidated facts are excluded from normal retrieval results.",
        ],
      },
      {
        heading: "Update behavior",
        steps: [
          "Extract normalized fact key/value pair.",
          "Lookup current fact slot by entity+key.",
          "Insert new fact as current slot entry.",
          "Mark prior current fact as invalidated with superseded-by reference.",
          "Append both records to fact history.",
        ],
      },
      {
        heading: "Example",
        codeBlocks: [
          {
            label: "Preference change",
            language: "text",
            code: `t1: preferred_drink = coffee   -> current

t2: preferred_drink = tea      -> becomes current
    coffee fact marked invalidated(superseded_by=t2)`,
          },
        ],
      },
    ],
  },
  {
    slug: "api-ingest",
    eyebrow: "API",
    title: "POST /ingest",
    lead: "Ingest stores one or more memory events and optionally emits companion memories.",
    description: "API contract for ingesting memories into Tellodb.",
    sections: [
      {
        heading: "Request contract",
        paragraphs: [
          "At minimum, include `entity_id` and `textual_content`. Advanced payloads can include explicit timestamps, memory kind hints, or session metadata.",
          "Use idempotency keys when your producer can retry requests.",
        ],
        codeBlocks: [
          {
            label: "Example request",
            language: "json",
            code: `{
  "entity_id": "user-123",
  "memory_id": "user-123::chat-82::42",
  "timestamp": 1763653742000,
  "textual_content": "I moved from NYC to LA last month."
}`,
          },
        ],
      },
      {
        heading: "Response semantics",
        bullets: [
          "`accepted`: memories persisted and indexed",
          "`deduplicated`: memories skipped as duplicates",
          "`invalid`: rejected payload records",
          "`memory_ids`: IDs of accepted primary memories",
        ],
      },
      {
        heading: "Example curl",
        codeBlocks: [
          {
            label: "Ingest call",
            language: "bash",
            code: `curl -sS http://127.0.0.1:3000/ingest \\
  -H "content-type: application/json" \\
  -H "x-api-key: XXX1111AAA" \\
  -d '{"entity_id":"user-123","memory_id":"mem-001","timestamp":1700000000000,"textual_content":"I moved from NYC to LA."}'`,
          },
        ],
      },
    ],
  },
  {
    slug: "api-query-semantic",
    eyebrow: "API",
    title: "POST /query/semantic",
    lead: "Semantic query retrieves memories by intent and meaning, then applies temporal policy.",
    description: "API contract for semantic/hybrid query in Tellodb.",
    sections: [
      {
        heading: "Request fields",
        bullets: [
          "`textual_query`: user question or search prompt",
          "`entity_id`: retrieval scope",
          "`limit`: max returned hits",
          "`kind_filter` (optional): restrict memory kinds",
          "`include_superseded` (optional): include invalidated facts",
        ],
      },
      {
        heading: "Hybrid retrieval behavior",
        paragraphs: [
          "Despite the endpoint name, semantic query can still include lexical fusion and reranking under the hood, depending on engine configuration.",
          "This keeps the API stable while retrieval internals evolve.",
        ],
      },
      {
        heading: "Example response",
        codeBlocks: [
          {
            label: "Top hit payload",
            language: "json",
            code: `{
  "hits": [
    {
      "memory_id": "user-123::chat-82::42",
      "textual_content": "I moved from NYC to LA last month.",
      "kind": "Fact",
      "score": 0.924,
      "created_at_ms": 1763653742000
    }
  ]
}`,
          },
        ],
      },
    ],
  },
  {
    slug: "api-query-temporal",
    eyebrow: "API",
    title: "GET /temporal/query",
    lead: "Temporal query constrains retrieval to explicit time windows for timeline-sensitive reasoning.",
    description: "API contract for temporal-windowed retrieval.",
    sections: [
      {
        heading: "When to use",
        paragraphs: [
          "Use temporal query when users ask what was true at a specific time, or when you need only the most recent period of activity.",
          "This endpoint is useful for compliance, debugging, and user-facing activity summaries.",
        ],
      },
      {
        heading: "Window controls",
        codeBlocks: [
          {
            label: "Temporal request (GET)",
            language: "bash",
            code: `curl "http://127.0.0.1:3000/temporal/query?entity_id=user-123&textual_query=where+did+I+live&window_start_ms=1751328000000&window_end_ms=1767225599000&limit=10"`,
          },
        ],
        bullets: [
          "Window boundaries are inclusive.",
          "Out-of-window memories are excluded before final ranking.",
          "Temporal filters combine with kind filters if provided.",
        ],
      },
      {
        heading: "Interpretation",
        paragraphs: [
          "Temporal windows answer a different question than decay. Decay softly biases relevance toward freshness, while windows enforce hard time boundaries.",
        ],
      },
    ],
  },
  {
    slug: "api-delete",
    eyebrow: "API",
    title: "POST /memory/delete",
    lead: "Delete removes a memory from retrieval surfaces and records an audit trail for reconstruction.",
    description:
      "Deletion and index repair behavior for Tellodb memory records.",
    sections: [
      {
        heading: "Delete contract",
        paragraphs: [
          "Deletion is sent as a POST request identifying the memory by `memory_id` and scope context. The engine removes vector/lexical references and writes a deletion-log record for audits.",
          "For fact memories, delete may trigger slot repair to recover latest valid predecessor.",
        ],
        codeBlocks: [
          {
            label: "Delete request",
            language: "json",
            code: `{
  "memory_id": "user-123::chat-82::42",
  "reason": "user_requested_erasure"
}`,
          },
        ],
      },
      {
        heading: "Safety guidance",
        bullets: [
          "Require authorization stronger than read-only keys.",
          "Keep immutable delete audit logs.",
          "Return idempotent success for already-deleted IDs.",
          "Run periodic consistency checks across all indexes.",
        ],
      },
      {
        heading: "Verification",
        paragraphs: [
          "After delete, query the same prompt and confirm memory is absent from results. For fact deletes, verify current fact slot points to expected fallback record.",
        ],
      },
    ],
  },
  {
    slug: "cognitive-extraction",
    eyebrow: "Intelligence",
    title: "Cognitive Extraction Pipeline",
    lead: "Transform raw episodic text into structured knowledge triples and verified entities.",
    description:
      "Overview of Tellodb's neural entity extraction and autonomous relationship discovery.",
    sections: [
      {
        heading: "Neural Entity Extraction",
        paragraphs: [
          "Tellodb integrates a local BERT-based model for Named Entity Recognition (NER). During ingestion, episodic text is scanned to identify core entities without requiring external LLM calls.",
          "Entities are classified into standard categories (Person, Organization, Location, Miscellaneous), allowing for precise scoping and relationship mapping.",
        ],
        bullets: [
          "PER: Identities and individual actors.",
          "ORG: Companies, teams, and institutions.",
          "LOC: Geographic context and movement history.",
          "MISC: General artifacts and specific concepts.",
        ],
      },
      {
        heading: "Autonomous Relationship Discovery",
        paragraphs: [
          "Extracted entities are passed through a heuristic relationship engine that automatically constructs knowledge graph triples.",
          "For example, detecting a Person and an Organization in the same context can trigger an `associated_with` edge, while two people can trigger a `knows` edge.",
        ],
      },
      {
        heading: "Implicit Preference Detection",
        paragraphs: [
          "Tellodb identifies sentiment and preference signals (love, hate, prefer, favorite) automatically. When detected, the memory is elevated to a `Preference` kind, exempting it from standard time-decay policies to ensure core user identity persists.",
        ],
      },
    ],
  },
  {
    slug: "analytics-api",
    eyebrow: "Analytics",
    title: "The Metric Vault",
    lead: "Track and aggregate numeric truth with absolute deterministic precision.",
    description:
      "How to use the Tellodb Analytics API for range-based sums and counts of extracted metrics.",
    sections: [
      {
        heading: "Deterministic Metric Extraction",
        paragraphs: [
          "Beyond semantic recall, Tellodb uses deterministic regex extractors to identify numeric values during ingestion. These are stored in the Metric Vault—a specialized B-Tree index optimized for temporal range scans.",
        ],
        bullets: [
          "Currency ($50, 100 EUR): Track user spending habits.",
          "Distance (5 miles, 10km): Track physical activity and movement.",
          "Counts (3 times, 5 people): Track frequency and social context.",
        ],
      },
      {
        heading: "Querying the Vault",
        paragraphs: [
          "The `/analytics/query` endpoint allows you to compute sums and counts over specific time windows without hallucination risks.",
        ],
        codeBlocks: [
          {
            label: "Aggregation Request",
            language: "json",
            code: `{
  "entity_id": "user-123",
  "label": "money",
  "start_timestamp_ms": 1743465600000,
  "end_timestamp_ms": 1744070400000
}`,
          },
        ],
      },
    ],
  },
  {
    slug: "memory-proxy",
    eyebrow: "Ecosystem",
    title: "The Tellodb Proxy (Coming Soon)",
    lead: "An OpenAI-compatible gateway that automatically injects memory into your agent's system prompt.",
    description:
      "Learn about the planned Tellodb Proxy for adding long-term memory to any application with zero code changes.",
    sections: [
      {
        heading: "Overview",
        paragraphs: [
          "The Tellodb Proxy (Memory Router) is a planned feature that will act as a middleware between your application and your LLM provider. It will intercept standard OpenAI-style chat completion requests, retrieve the most relevant memories for the specified user, and inject them into the system prompt before forwarding the request to the upstream model.",
          "This will allow you to add Tellodb's persistent memory to any existing agent or application by simply changing the `base_url`. The feature is currently in development.",
        ],
      },
      {
        heading: "How it works",
        steps: [
          "Your app sends a request to `/v1/chat/completions` on the Tellodb engine.",
          "Tellodb extracts the `user` field from the payload to identify the `entity_id`.",
          "It performs a high-precision semantic lookup based on the latest user message.",
          "The system prompt is augmented with a structured `[ALETHEIADB PERSISTENT MEMORY]` block.",
          "The augmented request is forwarded to OpenAI (or your configured provider).",
          "The final response is returned to your application.",
        ],
      },
      {
        heading: "Usage Example",
        paragraphs: [
          "To use the proxy, simply point your OpenAI client to your Tellodb instance. The `user` parameter is mapped to Tellodb's `entity_id`.",
        ],
        codeBlocks: [
          {
            label: "Python (OpenAI SDK)",
            language: "python",
            code: `from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:3000/v1",
    api_key="YOUR_ALETHEIADB_API_KEY"
)

# Tellodb will automatically retrieve memories for 'user-42'
response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "What was the name of that coffee I liked?"}],
    user="user-42"
)`,
          },
        ],
      },
      {
        heading: "Configuration",
        paragraphs: [
          "The proxy behavior can be tuned using the following environment variables on the Tellodb engine:",
        ],
        bullets: [
          "OPENAI_API_KEY: Your upstream provider key.",
          "ALETHEIADB_PROXY_TARGET_URL: The upstream endpoint (defaults to OpenAI).",
          "ALETHEIADB_PORT: The local port Tellodb is running on (for loopback lookups).",
        ],
      },
    ],
  },
  {
    slug: "sdk-javascript",
    eyebrow: "SDK",
    title: "JavaScript SDK",
    lead: "Use the JavaScript SDK for server-side apps, workers, and API integrations.",
    description: "JavaScript SDK usage patterns for ingest and query.",
    sections: [
      {
        heading: "Client initialization",
        paragraphs: [
          "Initialize one client per process and reuse it. This keeps connection overhead low and centralizes retry and timeout policy.",
          "Prefer environment-variable configuration for endpoint URLs and API keys.",
        ],
        codeBlocks: [
          {
            label: "Create client",
            language: "ts",
            code: `import { TellodbClient } from "tellodb";

const client = TellodbClient.fromCloud({
  baseUrl: process.env.ALETHEIA_URL!,
  apiKey: process.env.ALETHEIA_API_KEY!
});`,
          },
        ],
      },
      {
        heading: "Ingest and query",
        codeBlocks: [
          {
            label: "Basic flow",
            language: "ts",
            code: `await client.ingest({
  entity_id: "user-123",
  text: "I switched to pour-over coffee last month."
});

const results = await client.query(
  "What coffee style do I use now?",
  { entity_id: "user-123", limit: 5 }
);`,
          },
        ],
      },
      {
        heading: "Production patterns",
        bullets: [
          "Set request deadlines per endpoint class.",
          "Use circuit breakers for dependency outages.",
          "Attach request IDs for traceability.",
          "Implement idempotent ingest retries.",
        ],
      },
    ],
  },
  {
    slug: "sdk-python",
    eyebrow: "SDK",
    title: "Python SDK",
    lead: "The Python SDK is suited for data pipelines, evaluation harnesses, and backend services.",
    description: "Python SDK usage patterns with async and batch calls.",
    sections: [
      {
        heading: "Client setup",
        codeBlocks: [
          {
            label: "Initialize client",
            language: "python",
            code: `from tellodb import TellodbClient

client = TellodbClient.from_local(
    api_key="XXX1111AAA",
    timeout=10,
)
# or for cloud:
# client = TellodbClient.from_cloud(api_key="sk-...")`,
          },
        ],
        paragraphs: [
          "Use one reusable client instance and avoid constructing clients inside hot loops.",
        ],
      },
      {
        heading: "Batch ingest pattern",
        codeBlocks: [
          {
            label: "Batch ingestion",
            language: "python",
            code: `from tellodb import IngestItem

items = [
    IngestItem(entity_id="user-123", text="I moved to LA."),
    IngestItem(entity_id="user-123", text="I now prefer tea."),
]
client.ingest_many(items)`,
          },
        ],
        paragraphs: [
          "For very large batches, parallelize by entity partition to reduce lock contention and preserve ordering semantics within each session.",
        ],
      },
      {
        heading: "Evaluation usage",
        bullets: [
          "Keep deterministic seeds for benchmark comparability.",
          "Record model and policy versions in run metadata.",
          "Persist raw hit lists, not only aggregate metrics.",
        ],
      },
    ],
  },
  {
    slug: "deployment",
    eyebrow: "Operations",
    title: "Deployment Guide",
    lead: "Production deployment should preserve durability first, then optimize for latency and throughput.",
    description:
      "Practical deployment recommendations for Tellodb in production.",
    sections: [
      {
        heading: "Deployment topology",
        paragraphs: [
          "A common topology runs Tellodb as a dedicated memory service behind an internal API gateway. Keep data directories on persistent volumes with regular backups.",
          "Avoid ephemeral disks for primary data unless you have robust replication and recovery strategy.",
        ],
      },
      {
        heading: "Environment checklist",
        bullets: [
          "Persistent volume for redb and index data",
          "Model cache directory with predictable permissions",
          "Resource limits sized for reranking workloads",
          "Readiness and liveness probes",
          "Structured log export and metrics scraping",
        ],
      },
      {
        heading: "Container starter",
        codeBlocks: [
          {
            label: "Example run",
            language: "bash",
            code: `docker run --rm -p 3000:3000 \\
  -v /srv/tellodb-data:/data \\
  -e TEMPORAL_MEMORY_DATA_DIR=/data \\
  tellodb:latest (build from Dockerfile in repo)`,
          },
        ],
      },
    ],
  },
  {
    slug: "observability",
    eyebrow: "Operations",
    title: "Observability",
    lead: "Track recall quality and service health together; latency alone is not enough for memory systems.",
    description:
      "Metrics, logs, traces, and quality indicators for Tellodb.",
    sections: [
      {
        heading: "Metrics that matter",
        bullets: [
          "Ingest accepted/deduplicated/invalid counts",
          "Semantic query latency p50/p95/p99",
          "Lexical-only hit share vs hybrid share",
          "Superseded facts filtered per query",
          "Index reconciliation backlog",
        ],
        paragraphs: [
          "Quality metrics should be first-class dashboards, not hidden in offline scripts.",
        ],
      },
      {
        heading: "Structured logging",
        codeBlocks: [
          {
            label: "Log fields",
            language: "json",
            code: `{
  "request_id": "req_7f1d",
  "route": "/query/semantic",
  "entity_id": "user-123",
  "semantic_candidates": 40,
  "lexical_candidates": 15,
  "latency_ms": 32
}`,
          },
        ],
        paragraphs: [
          "Include enough retrieval internals in logs to debug ranking anomalies without sampling full payload text.",
        ],
      },
      {
        heading: "Alerting",
        bullets: [
          "Sustained p95 latency breach",
          "Spike in invalid ingest payload ratio",
          "Sharp drop in recall@k against canary eval set",
          "Index mismatch detected by repair scanner",
        ],
      },
    ],
  },
  {
    slug: "benchmarking",
    eyebrow: "Evaluation",
    title: "Benchmarking and Evaluation",
    lead: "Benchmark memory quality with repeatable datasets, fixed configurations, and a clear split between preliminary signal and publishable scorecards.",
    description:
      "How to benchmark Tellodb retrieval quality and latency reliably.",
    sections: [
      {
        heading: "Current benchmark status",
        paragraphs: [
          "We have not yet published a full-blown benchmark campaign across all target tasks, models, and ablation settings. What we do have today are preliminary harness runs and archived evaluator outputs that already give a directional read on retrieval quality and runtime behavior.",
          "The purpose of this page is to show what is already instrumented, what the early LoCoMo recall run looks like, and what still needs to happen before we call the numbers final.",
        ],
        callout: {
          tone: "warning",
          title: "Important",
          body: "Treat the results below as preliminary engineering signals, not a finalized benchmark report. Full LongMemEval publication-grade runs, ablations, and model-normalized comparisons are still in progress.",
        },
        stats: [
          {
            label: "Benchmark Phase",
            value: "Preliminary",
            description: "Harness is live; full campaign is still pending.",
            tone: "warning",
          },
          {
            label: "Published Dataset Signal",
            value: "LoCoMo",
            description:
              "Current docs publish the cleanest retrieval summary from archived logs.",
            tone: "primary",
          },
          {
            label: "Archived Artifacts",
            value: "2 Logs",
            description:
              "`locomo_output.txt` and `longmemeval_output.txt` are retained in the repo.",
            tone: "default",
          },
          {
            label: "Next Milestone",
            value: "Full LongMemEval",
            description:
              "Run, validate, and publish the cleaned scorecard plus ablations.",
            tone: "success",
          },
        ],
      },
      {
        heading: "What is already in the repo",
        paragraphs: [
          "Two benchmark artifacts are currently tracked in the workspace and referenced internally when validating the evaluator pipeline.",
          "The LoCoMo artifact already contains a clean recall summary. The LongMemEval artifact is preserved as a working benchmark log, but we are intentionally not publishing a polished LongMemEval scorecard from it yet.",
        ],
        artifacts: [
          {
            name: "locomo_output.txt",
            description:
              "Preliminary LoCoMo recall run log with full progress output, timing breakdowns, and the final Recall@8 summary.",
            meta: "Current best directional retrieval read for docs publication.",
          },
          {
            name: "longmemeval_output.txt",
            description:
              "Archived preliminary benchmark output kept in the repo while the final LongMemEval evaluation flow is cleaned up and rerun end to end.",
            meta: "Tracked as a working artifact, not yet a publication-ready benchmark table.",
          },
        ],
      },
      {
        heading: "Preliminary LoCoMo snapshot",
        paragraphs: [
          "The strongest concrete benchmark signal we are comfortable surfacing today comes from the LoCoMo recall harness. This run focuses on whether the correct evidence session appears in the retrieved Top-8, which is a useful proxy for whether the memory engine is bringing the right context back into scope before any downstream answer-generation layer gets involved.",
          "That distinction matters. We want to isolate memory retrieval quality first, then layer answer quality and judge-model evaluation on top. Otherwise, retrieval regressions and generation regressions get mixed together.",
        ],
        stats: [
          {
            label: "Overall Recall@8",
            value: "94.7%",
            description:
              "Evidence session found in the Top-8 for 1538 evaluated questions.",
            tone: "primary",
          },
          {
            label: "Questions Evaluated",
            value: "1538",
            description: "No skipped questions in the archived run.",
            tone: "success",
          },
          {
            label: "Avg Query Time",
            value: "65 ms",
            description:
              "Average end-to-end query timing reported by the harness.",
            tone: "default",
          },
          {
            label: "Avg Total Time",
            value: "83 ms",
            description:
              "Includes ingest/query/pack timing reported per evaluation cycle.",
            tone: "default",
          },
          {
            label: "Avg Batch Ingest",
            value: "407 ms",
            description:
              "Average ingest batch time during the initial session indexing phase.",
            tone: "default",
          },
          {
            label: "Top-K Window",
            value: "8 Sessions",
            description: "Run used `top-k=8` and `max-chunks-per-session=4`.",
            tone: "default",
          },
        ],
        table: {
          columns: [
            "Single-Hop",
            "Multi-Hop",
            "Open Domain",
            "Temporal",
            "Overall",
          ],
          rows: [
            {
              label: "Recall@8",
              values: ["90.8%", "80.4%", "97.9%", "93.8%", "94.7%"],
            },
            {
              label: "Question Count",
              values: ["282", "92", "841", "321", "1538"],
            },
          ],
          footnote:
            "This table is taken from the archived LoCoMo recall log and represents retrieval-stage evidence recovery, not a final answer-generation leaderboard.",
        },
      },
      {
        heading: "How to read these numbers",
        paragraphs: [
          "The LoCoMo result is promising because it says the right session is usually being recovered even in a long-running conversation setting. The open-domain and temporal slices are especially strong in this early run, which suggests the hybrid lexical-plus-semantic stack is doing real work beyond naive vector search.",
          "The multi-hop slice is the current pressure point. That is not surprising: once the right evidence is split across multiple linked conversational fragments, raw retrieval has to do more than recover a single relevant session. This is exactly where graph lineage, fact companions, temporal linking, and deterministic aggregation become more important.",
          "The timing split is also useful. Average engine-stage totals show that embedding and hydrate costs dominate more than ANN search. That points optimization effort toward payload hydration, result packing, and indexing layout rather than only ANN micro-tuning.",
        ],
        bullets: [
          "Average engine query stages in the archived run were roughly: embed 11 ms, ANN 2 ms, FTS 4 ms, hydrate 39 ms, total 64 ms.",
          "Reranking was disabled in this run, which means the current score reflects the base hybrid retrieval pipeline without cross-encoder rescue.",
          "Semantic dedup and consolidation were also disabled, so there is still headroom for future ablation work.",
        ],
      },
      {
        heading: "Run configuration behind the preliminary LoCoMo result",
        paragraphs: [
          "The archived LoCoMo run used the Rust evaluator directly against the engine with an explicit retrieval-only configuration. That is useful because it minimizes ambiguity about where latency and quality are coming from.",
          "For benchmark reproducibility, keep the full invocation with the result artifact. Small flags such as rerank on/off, start index, chunk caps, or ingest concurrency can materially change both runtime and quality.",
        ],
        codeBlocks: [
          {
            label: "Rust evaluator invocation",
            language: "bash",
            code: `cargo run --release --manifest-path benchmarks/rust_evaluator/Cargo.toml -- \\
  --dataset-kind locomo \\
  --dataset benchmarks/LoCoMo/data/locomo10.json \\
  --engine-url http://127.0.0.1:3000 \\
  --engine-api-key XXX1111AAA \\
  --reset-first \\
  --limit 99999 \\
  --ingest-concurrency 16 \\
  --top-k 8 \\
  --max-chunks-per-session 4 recall`,
          },
          {
            label: "Archived run characteristics",
            language: "text",
            code: `dataset: LoCoMo
questions: 1538
top-k sessions: 8
max chunks per session: 4
neural rerank: false
semantic dedup: false
consolidation: false
reset first: true`,
          },
          {
            label: "LongMemEval harness entry point",
            language: "bash",
            code: `cargo run --release --manifest-path benchmarks/rust_evaluator/Cargo.toml -- \\
  --dataset-kind longmemeval \\
  --dataset benchmarks/LongMemEval/data/longmemeval_s_cleaned.json \\
  --engine-url http://127.0.0.1:3000 \\
  --engine-api-key XXX1111AAA \\
  --reset-first \\
  --ingest-concurrency 1 \\
  --top-k 8 \\
  --max-chunks-per-session 4 recall`,
          },
        ],
      },
      {
        heading:
          "What still needs to happen before we call benchmarking complete",
        paragraphs: [
          "A proper benchmark page for Tellodb should not stop at one preliminary retrieval run. We still need a full matrix across datasets, retrieval settings, optional reranking, answer-generation layers, and judge-model evaluation so the results are defensible outside the repo.",
          "In practice, that means LoCoMo is only the first published checkpoint. LongMemEval, ablations, and answer-quality scoring are the next layer.",
        ],
        steps: [
          "Rerun LongMemEval end to end with the cleaned dataset and publish the final summary separately from working logs.",
          "Add retrieval ablations for rerank on/off, lexical-only, semantic-only, and hybrid fusion.",
          "Report answer-quality metrics alongside retrieval metrics so improvements can be tied to end-user outcome quality.",
          "Track warm versus cold runs, model versions, and hardware profile so latency claims remain reproducible.",
          "Keep failed examples and inspect them manually because aggregate percentages hide the most valuable failure modes.",
        ],
      },
      {
        heading: "Benchmark principles we follow",
        bullets: [
          "Use fixed datasets and deterministic start indices whenever possible.",
          "Record model versions, engine config, and policy version with every run.",
          "Separate warm and cold measurements so cache effects do not blur real latency.",
          "Keep ingest and query concurrency explicit in the command line and in the published report.",
          "Publish both retrieval-stage metrics and downstream answer metrics instead of treating them as interchangeable.",
          "Retain raw artifacts so regressions can be audited, not just summarized.",
        ],
      },
    ],
  },
  {
    slug: "troubleshooting",
    eyebrow: "Support",
    title: "Troubleshooting",
    lead: "Common production and local-development issues with practical fixes.",
    description:
      "Troubleshooting guide for ingest, query, index, and auth failures.",
    sections: [
      {
        heading: "Ingest succeeds but query misses facts",
        bullets: [
          "Verify entity scope is identical between ingest and query.",
          "Check fact was invalidated by newer superseding memory.",
          "Confirm memory kind filters are not excluding expected hits.",
          "Inspect dedup table for accidentally collapsed records.",
        ],
      },
      {
        heading: "High latency spikes",
        bullets: [
          "Reduce rerank candidate count.",
          "Tune HNSW `ef_search` for your latency budget.",
          "Check for disk saturation on data volume.",
          "Warm model cache before traffic cutover.",
        ],
      },
      {
        heading: "Quick diagnostic commands",
        codeBlocks: [
          {
            label: "Probe semantic endpoint",
            language: "bash",
            code: `curl -i --max-time 10 http://127.0.0.1:3000/query/semantic \\
  -H "content-type: application/json" \\
  -H "x-api-key: XXX1111AAA" \\
  -d '{"entity_id":"user-123","textual_query":"latest preference","limit":3}'`,
          },
        ],
      },
    ],
  },
  {
    slug: "core",
    eyebrow: "Product",
    title: "Tellodb Core Engine",
    lead: "The Rust-powered temporal memory engine that runs anywhere. Self-host, embed, or integrate.",
    description:
      "Tellodb Core is the open-source, single-binary memory engine for AI agents. Hybrid vector + BM25 search, knowledge graphs, deterministic analytics, and fact supersession.",
    sections: [
      {
        heading: "What is Tellodb Core?",
        paragraphs: [
          "Tellodb Core is a standalone Rust binary that provides persistent, temporal, multi-model memory for AI agents. It is designed to run on any machine — from a developer laptop to a production server — without requiring a cloud account, a database cluster, or an internet connection.",
          "The engine combines four storage substrates under one roof: a vector index (HNSW via usearch), a full-text search index (BM25F on redb), a typed knowledge graph (RDF-style adjacency lists on redb), and a deterministic analytics vault for numeric metric extraction. All four are written into the same binary with zero external dependencies at runtime.",
        ],
      },
      {
        heading: "How It Works",
        paragraphs: [
          "Think of Tellodb Core as a database purpose-built for agent memory. You send it observations (facts, conversations, events) via REST endpoints, and it indexes them across all four substrates simultaneously. When you query, it performs hybrid retrieval — fusing vector similarity scores with BM25F lexical scores using Reciprocal Rank Fusion — and returns temporally-ordered, fact-consistent results.",
          "The engine tracks time natively. Every memory carries a timestamp, and the retrieval pipeline uses temporal recency scoring to prefer recent memories while still surfacing relevant historical facts. Facts can be superseded (new truth replaces old truth), creating a continuously updated world model.",
        ],
      },
      {
        heading: "What Runs Where",
        stats: [
          {
            label: "Binary size",
            value: "~45 MB",
            description:
              "Single statically-linked executable, no runtime deps.",
            tone: "primary",
          },
          {
            label: "Startup time",
            value: "< 1s",
            description: "Cold-start from scratch, all indexes in memory.",
            tone: "success",
          },
          {
            label: "Memory per 100K observations",
            value: "~800 MB",
            description:
              "Includes all index overhead. Configurable via retention.",
            tone: "default",
          },
          {
            label: "Query latency",
            value: "< 50ms p99",
            description: "Hybrid vector + lexical search with semantic rerank.",
            tone: "success",
          },
        ],
      },
      {
        heading: "Getting Started",
        steps: [
          "Download the binary from the GitHub releases page or build from source: cargo build --release.",
          "Set your API key: export TEMPORAL_MEMORY_API_KEY=your-secret-key.",
          "Choose an embedding model: export TEMPORAL_MEMORY_EMBEDDING_MODEL=BAAI/bge-small-en-v1.5.",
          "Run: ./tellodb. The engine starts on port 3000 by default.",
          "Ingest your first memory: POST /ingest with a JSON payload containing text, entity_id, and timestamp.",
          "Query: POST /query with a textual_query and limit. The engine returns ranked, temporally-scored results.",
        ],
        codeBlocks: [
          {
            label: "Docker quick start",
            language: "bash",
            code: "docker run -p 3000:3000 \\\n  -e TEMPORAL_MEMORY_API_KEY=my-secret \\\n  -e TEMPORAL_MEMORY_EMBEDDING_MODEL=BAAI/bge-small-en-v1.5 \\\n  -e TEMPORAL_MEMORY_DATA_DIR=/data \\\n  tellodb:latest (build from Dockerfile in repo)",
          },
          {
            label: "First ingest",
            language: "bash",
            code: 'curl -X POST http://localhost:3000/ingest \\\n  -H "Content-Type: application/json" \\\n  -H "x-api-key: my-secret" \\\n  -d \'{\n    "entity_id": "user-1",\n    "memory_id": "mem-001",\n    "timestamp": 1700000000000,\n    "textual_content": "Alice enjoys hiking in the mountains on weekends.",\n    "kind": "Fact"\n  }\'',
          },
          {
            label: "First query",
            language: "bash",
            code: 'curl -X POST http://localhost:3000/query \\\n  -H "Content-Type: application/json" \\\n  -H "x-api-key: my-secret" \\\n  -d \'{\n    "textual_query": "What does Alice enjoy?",\n    "limit": 5\n  }\'',
          },
        ],
      },
      {
        heading: "Deployment Models",
        bullets: [
          "Self-hosted binary: Download, run. No cloud, no lock-in. Works on macOS, Linux, Windows.",
          "Docker: Official container images with pre-baked models on GitHub Container Registry.",
          "Embedded library: Link Tellodb as a Rust crate in your own application (coming soon).",
          "Platform-managed: Deploy on the Tellodb Platform for one-click provisioning, billing, and team management.",
        ],
      },
    ],
  },
  {
    slug: "platform",
    eyebrow: "Product",
    title: "Tellodb Platform",
    lead: "The managed SaaS layer on top of Tellodb Core. Deploy clusters, manage teams, track usage, and never touch infrastructure.",
    description:
      "The Tellodb Platform provides a full web console, Stripe billing, team management, graph visualization, and analytics on top of the core memory engine.",
    sections: [
      {
        heading: "What is the Platform?",
        paragraphs: [
          "The Tellodb Platform is a managed cloud service built on top of the open-source Tellodb Core engine. While the core engine runs anywhere as a standalone binary, the Platform wraps it with authentication, billing, team collaboration, and a rich web dashboard — so you can focus on building agents, not managing servers.",
        ],
      },
      {
        heading: "Platform vs Core",
        stats: [
          {
            label: "Core Engine",
            value: "Self-hosted",
            description:
              "Download and run on your own hardware. Open source, Apache 2.0.",
            tone: "primary",
          },
          {
            label: "Platform",
            value: "Managed SaaS",
            description:
              "We run the engine for you. One-click deploy, automatic scaling.",
            tone: "success",
          },
          {
            label: "Core Auth",
            value: "API Key",
            description: "Single admin key. You manage access yourself.",
            tone: "default",
          },
          {
            label: "Platform Auth",
            value: "Full Stack",
            description: "Supabase Auth — login, teams, scoped API keys, RLS.",
            tone: "success",
          },
          {
            label: "Core Pricing",
            value: "Free",
            description: "Open source. No license fees.",
            tone: "primary",
          },
          {
            label: "Platform Pricing",
            value: "Pay-as-you-go",
            description:
              "$1/1M truths fractionally, $400/mo dedicated. Free tier available.",
            tone: "success",
          },
        ],
      },
      {
        heading: "What You Get",
        bullets: [
          "Mission Control dashboard: Real-time stats, cluster list, API key management in one screen.",
          "One-click cluster deploy: Choose a tier (Fractional or Dedicated Pro), name your cluster, and deploy instantly.",
          "Stripe billing: Pay-as-you-go or flat-rate. Manage payment methods, view invoices, upgrade/downgrade.",
          "Team management: Invite colleagues, assign roles (owner/admin/member), collaborate on shared clusters.",
          "Knowledge Graph Explorer: Search entities, walk graph neighborhoods, discover shared connections between subjects.",
          "Analytics dashboard: Daily usage charts, query/ingest breakdowns, storage trends.",
          "API Playground: Interactive request builder with code snippets for Python, cURL, and Node.js.",
        ],
      },
      {
        heading: "Getting Started on the Platform",
        steps: [
          "Create an account at tellodb.com/signup. Your first cluster (Fractional tier) is provisioned automatically.",
          "Copy your API key from Mission Control → API Keys. This key authenticates all requests to the platform.",
          "Use the API Playground in your cluster's detail page to test ingest and query operations.",
          "Invite team members from Settings → Team. They can access shared clusters based on their role.",
          "Monitor usage from Analytics or the Billing page. Usage is tracked daily and available via the API.",
          "Upgrade to Dedicated Pro for guaranteed performance, higher limits, and priority support.",
        ],
      },
    ],
  },
  {
    slug: "glossary",
    eyebrow: "Reference",
    title: "Glossary",
    lead: "A quick reference for recurring Tellodb terms in docs, APIs, and benchmarking.",
    description: "Glossary of Tellodb and retrieval terminology.",
    sections: [
      {
        heading: "Core terms",
        bullets: [
          "AgentObservation: primary stored memory record.",
          "Companion memory: derived fact or summary linked to source turn.",
          "Supersession: invalidating old fact with newer fact.",
          "RRF: reciprocal rank fusion for combining retrieval lists.",
          "TTL: hard expiry threshold for memory eligibility.",
        ],
      },
      {
        heading: "Retrieval terms",
        bullets: [
          "Bi-encoder: independent query/document embeddings.",
          "Cross-encoder: joint query+document relevance model.",
          "HNSW: approximate nearest-neighbor graph index.",
          "BM25: probabilistic lexical scoring method.",
        ],
      },
      {
        heading: "Operational terms",
        bullets: [
          "Reconciliation: repairing secondary indexes from durable store.",
          "Canary eval: small fixed test set for release health checks.",
          "Entity scope: ownership boundary used to isolate memory retrieval.",
        ],
      },
    ],
  },
  {
    slug: "context-templates",
    eyebrow: "Platform",
    title: "Context Templates",
    lead: "Define exactly how your memories get formatted when passed to an LLM. Use markers to inject live data into any prompt structure.",
    description:
      "Context templates let you control the formatting of memory data for LLM prompts. Use markers like %{facts limit=10} and %{user_summary} to build dynamic context blocks.",
    sections: [
      {
        heading: "What are Context Templates?",
        paragraphs: [
          "Context templates are configurable prompt blocks that define how Tellodb memories are formatted when sent to your LLM. Instead of receiving raw JSON, your agent gets a clean, readable paragraph or structured text block — tailored to your exact use case.",
          "Templates use simple markers like %{facts limit=5} to inject live data from the engine. When a template is rendered, Tellodb queries the relevant memories and replaces each marker with the actual content.",
        ],
      },
      {
        heading: "Available Markers",
        table: {
          columns: ["Marker", "Description", "Parameters"],
          rows: [
            {
              label: "%{facts}",
              values: [
                "Top relevant facts",
                "limit=N — max results (default 10)",
              ],
            },
            {
              label: "%{user_summary}",
              values: ["Aggregated user profile facts", "None"],
            },
            {
              label: "%{graph_neighbors}",
              values: [
                "Connected entities from graph",
                "n=N — neighbor count (default 5)",
              ],
            },
            {
              label: "%{temporal_range}",
              values: [
                "Time-based memory filter",
                "days=N — lookback days (default 7)",
              ],
            },
            {
              label: "%{related_entities}",
              values: ["Entity list from graph walk", "None"],
            },
          ],
          footnote:
            "All markers are optional. Unknown markers render as empty strings.",
        },
      },
      {
        heading: "Usage",
        steps: [
          "Navigate to Settings → Context Templates in Mission Control.",
          "Click 'New Template', enter a name, and build your template string with markers.",
          "Or select a built-in preset (Compact, Conversational, Enterprise RAG) and customize it.",
          "Save the template. Use it by calling the /api/context/assemble endpoint with the template_id.",
          "Integrate the assembled context into your LLM system prompt via SDK or API.",
        ],
        codeBlocks: [
          {
            label: "Assemble context via API",
            language: "bash",
            code: 'curl -X POST https://api.tellodb.com/api/context/assemble \\\n  -H "Content-Type: application/json" \\\n  -H "x-api-key: YOUR_API_KEY" \\\n  -d \'{\n    "cluster_id": "YOUR_CLUSTER_ID",\n    "template_id": "TEMPLATE_UUID",\n    "query": "recent user activity"\n  }\'',
          },
          {
            label: "Python SDK",
            language: "python",
            code: 'from tellodb import MemoryClient\n\nclient = MemoryClient(api_key="sk-...")\ncontext = client.context.assemble(\n    cluster_id="cl_abc123",\n    template_id="tmpl_user_profile",\n    query="recent preferences"\n)\nprint(context.context)\n# Output:\n# USER PROFILE\n# - Alice is a vegetarian\n# - Alice prefers outdoor activities\n#\n# RECENT FACTS\n# - Alice went hiking on Saturday\n# - Alice bought new hiking boots',
          },
        ],
      },
    ],
  },
  {
    slug: "rate-limiting",
    eyebrow: "Platform",
    title: "Rate Limits & Quotas",
    lead: "Tellodb uses per-cluster rate limits to ensure fair resource allocation across tenants. Limits scale with your tier.",
    description:
      "Rate limits for the Tellodb Platform API. Learn about RPM limits, daily quotas, retry-after headers, and how limits scale with your plan tier.",
    sections: [
      {
        heading: "How Rate Limits Work",
        paragraphs: [
          "Every API request to the Tellodb platform is counted against a rate limit for the originating cluster. Limits are enforced in two dimensions: requests per minute (RPM) and requests per day. When a limit is exceeded, the API returns HTTP 429 with a Retry-After header.",
          "Rate limits reset at the end of each window (1 minute for RPM, midnight UTC for daily). 429 responses include X-RateLimit-Remaining and X-RateLimit-Reset headers so your application can adapt.",
        ],
        stats: [
          {
            label: "Free Tier RPM",
            value: "60",
            description: "1 request per second average",
            tone: "default",
          },
          {
            label: "Free Tier Daily",
            value: "10,000",
            description: "Resets at midnight UTC",
            tone: "default",
          },
          {
            label: "Pro Tier RPM",
            value: "300",
            description: "5 requests per second average",
            tone: "primary",
          },
          {
            label: "Pro Tier Daily",
            value: "100,000",
            description: "10x free tier capacity",
            tone: "primary",
          },
          {
            label: "Enterprise",
            value: "Unlimited",
            description: "Custom SLA, no rate limits",
            tone: "success",
          },
        ],
      },
      {
        heading: "Response Headers",
        table: {
          columns: ["Header", "Description"],
          rows: [
            {
              label: "X-RateLimit-Limit",
              values: ["The maximum requests per minute for this cluster"],
            },
            {
              label: "X-RateLimit-Remaining",
              values: ["How many requests are left in the current window"],
            },
            {
              label: "X-RateLimit-Reset",
              values: ["Unix timestamp when the window resets"],
            },
            {
              label: "Retry-After",
              values: ["Seconds to wait before retrying (on 429 only)"],
            },
          ],
        },
      },
      {
        heading: "Best Practices",
        bullets: [
          "Implement exponential backoff: on 429, wait Retry-After seconds, then double the wait on subsequent failures.",
          "Use the X-RateLimit-Remaining header to pre-warn when approaching limits. Slow down requests when remaining < 10% of limit.",
          "Batch ingest operations rather than sending one-at-a-time. Each batch-ingest call counts as 1 request regardless of size.",
          "Monitor your usage in Mission Control → Analytics. The usage dashboard shows daily trends and remaining quota.",
          "Upgrade to Pro for 5x higher limits. Contact Enterprise sales if you need more.",
        ],
      },
    ],
  },
  {
    slug: "connectors",
    eyebrow: "Platform",
    title: "Data Connectors",
    lead: "Auto-ingest data from Slack, GitHub, Notion, and more. Connect once, and Tellodb continuously syncs new content as it arrives.",
    description:
      "Connect external services to your Tellodb cluster for automatic data ingestion. Supports Slack, GitHub, Notion, Gmail, and Google Drive.",
    sections: [
      {
        heading: "What are Connectors?",
        paragraphs: [
          "Connectors automatically pull data from external services into your Tellodb cluster. Once configured, they run on a schedule (typically every 15 minutes) and ingest new content as conversation memories, fact memories, or decision records depending on the source.",
          "Each connector requires OAuth authorization or an API token. Credentials are encrypted at rest in our database. You can revoke a connector at any time from the Connectors page.",
        ],
      },
      {
        heading: "Available Connectors",
        table: {
          columns: ["Service", "What Gets Ingested", "Memory Kind"],
          rows: [
            {
              label: "Slack",
              values: ["Channel messages and thread replies", "Conversation"],
            },
            {
              label: "GitHub",
              values: [
                "Issues, pull requests, commits, comments",
                "Decision, Fact",
              ],
            },
            {
              label: "Notion",
              values: ["Pages, databases, and their content", "Fact"],
            },
            {
              label: "Gmail",
              values: ["Emails and thread conversations", "Conversation"],
            },
            {
              label: "Google Drive",
              values: ["Documents, sheets, slides", "Fact"],
            },
          ],
          footnote:
            "Each connector's data is automatically tagged with its source for traceability.",
        },
      },
      {
        heading: "Setup Guide",
        steps: [
          "Navigate to your cluster → Connectors tab.",
          "Select the service you want to connect (e.g., Slack).",
          "Click 'Connect' — you'll be redirected to the service's OAuth authorization page.",
          "Authorize Tellodb to access the required scopes (read-only where possible).",
          "You'll be redirected back to the Connectors page showing your new connector as 'Active'.",
          "The first sync starts automatically within 15 minutes. Click 'Sync Now' for an immediate sync.",
          "Monitor sync status, last sync time, and item count from the Connectors page.",
        ],
        codeBlocks: [
          {
            label: "List connectors via API",
            language: "bash",
            code: 'curl https://api.tellodb.com/api/clusters/YOUR_CLUSTER_ID/connectors \\\n  -H "x-api-key: YOUR_API_KEY"',
          },
        ],
      },
    ],
  },
  {
    slug: "mcp-server",
    eyebrow: "Platform",
    title: "MCP Server (Model Context Protocol)",
    lead: "Connect Tellodb to any MCP-compatible client — Claude Desktop, Cursor, Windsurf, and more — with zero configuration.",
    description:
      "Tellodb exposes a Model Context Protocol (MCP) server for integration with Claude Desktop, Cursor, and other MCP clients. Search memories, store facts, and explore graphs from your AI tools.",
    sections: [
      {
        heading: "What is MCP?",
        paragraphs: [
          "The Model Context Protocol (MCP) is an open standard for connecting AI assistants with external tools and data sources. Tellodb exposes an MCP server that lets any MCP-compatible client — including Claude Desktop, Cursor, and Windsurf — query memories, store facts, and explore knowledge graphs directly.",
          "By supporting MCP, Tellodb works with every MCP client out of the box. No custom SDKs or integration code needed.",
        ],
      },
      {
        heading: "Available Tools",
        table: {
          columns: ["Tool", "Description", "Required Params"],
          rows: [
            {
              label: "search_memory",
              values: [
                "Search memories with hybrid vector+lexical retrieval",
                "query",
              ],
            },
            {
              label: "store_fact",
              values: ["Store a new fact or observation", "text, entity_id"],
            },
            {
              label: "explore_graph",
              values: ["Walk the knowledge graph from an entity", "entity"],
            },
            {
              label: "get_memory",
              values: ["Retrieve a specific memory by ID", "memory_id"],
            },
          ],
        },
      },
      {
        heading: "Quick Start — Claude Desktop",
        steps: [
          "Open Claude Desktop → Settings → Developer → Edit Config.",
          "Add the following entry to your claude_desktop_config.json:",
          "Restart Claude Desktop. You should see the Tellodb tools in the toolbox.",
          'Ask Claude to "search my memories" or "store that Alice likes hiking".',
        ],
        codeBlocks: [
          {
            label: "claude_desktop_config.json",
            language: "json",
            code: '{\n  "mcpServers": {\n    "tellodb": {\n      "command": "npx",\n      "args": ["@tellodb/mcp-client"],\n      "env": {\n        "ALETHEIADB_API_KEY": "YOUR_API_KEY"\n      }\n    }\n  }\n}',
          },
        ],
      },
      {
        heading: "Server Endpoint",
        bullets: [
          "The MCP server is available at: https://api.tellodb.com/mcp",
          "Authentication is via x-api-key header or Bearer token in the Authorization header.",
          "The protocol uses JSON-RPC 2.0 over HTTP POST.",
          "A server card is available at: https://tellodb.com/.well-known/mcp/server-card.json",
          "Install the MCP client package: npm install @tellodb/mcp-client",
        ],
      },
    ],
  },
  {
    slug: "trust",
    eyebrow: "Platform",
    title: "Trust & Security",
    lead: "Tellodb is built with security and privacy as first principles. SOC 2 compliant, GDPR ready, and fully auditable.",
    description:
      "Security, privacy, and compliance information for the Tellodb platform. Encryption, infrastructure, data protection, and certifications.",
    sections: [
      {
        heading: "Security by Design",
        paragraphs: [
          "Tellodb is built from the ground up with security as a core requirement. The core engine is a single Rust binary with zero runtime dependencies — no npm, no pip, no system libraries. This dramatically reduces the attack surface compared to languages like Python or Node.js.",
          "All data is encrypted at rest (AES-256) and in transit (TLS 1.3). API keys are stored as SHA-256 hashes and compared using constant-time comparison to prevent timing side-channel attacks.",
        ],
        stats: [
          {
            label: "Encryption",
            value: "AES-256",
            description: "At rest. TLS 1.3 in transit.",
            tone: "success",
          },
          {
            label: "Auth",
            value: "SHA-256",
            description: "API keys hashed. Constant-time comparison.",
            tone: "success",
          },
          {
            label: "Runtime Deps",
            value: "0",
            description: "Single Rust binary. No npm/pip/system deps.",
            tone: "success",
          },
          {
            label: "Auth Model",
            value: "RLS + Clusters",
            description: "Row-Level Security + namespace isolation.",
            tone: "default",
          },
        ],
      },
      {
        heading: "Infrastructure & Isolation",
        bullets: [
          "Multi-tenant isolation: every API key is scoped to a cluster_id. Data is partitioned at the database level using RLS policies.",
          "Platform proxy: the Qwik frontend authenticates all requests and prefixes entity_id with the user's namespace. The Rust engine never sees raw user IDs from other tenants.",
          "Vercel Edge + Supabase: both platforms are SOC 2 certified. Our dependency on their infrastructure means inheriting their security posture.",
          "Self-hosting option: for organizations requiring full control, the core engine runs as a standalone binary with no external dependencies and no telemetry.",
          "No data sharing: we never use customer data for training, benchmarking, or product improvement without explicit opt-in.",
        ],
      },
      {
        heading: "Compliance",
        table: {
          columns: ["Standard", "Status", "Details"],
          rows: [
            {
              label: "SOC 2 Type 2",
              values: ["In Progress", "Auditor: Vanta. Expected Q3 2026."],
            },
            {
              label: "GDPR",
              values: [
                "Compliant",
                "Standard Contractual Clauses available. DPA on request.",
              ],
            },
            {
              label: "HIPAA",
              values: [
                "Configurable",
                "Self-hosted deployment. BAA available for enterprise.",
              ],
            },
          ],
          footnote:
            "Contact trust@tellodb.com for security questionnaires, penetration test summaries, and architecture diagrams.",
        },
      },
      {
        heading: "Trust Center",
        paragraphs: [
          "Visit the Tellodb Trust Center at /platform/trust for the full security overview, including encryption details, data processing agreements, breach notification procedures, and infrastructure architecture diagrams.",
          "For urgent security matters: security@tellodb.com. For compliance documentation: trust@tellodb.com.",
        ],
      },
    ],
  },
  {
    slug: "self-hosting",
    eyebrow: "Operations",
    title: "Self-Hosting & BYOC",
    lead: "Run Tellodb in your own infrastructure. One binary, zero dependencies, full control. Or deploy in your cloud with our BYOC program.",
    description:
      "Self-host Tellodb Core as a single binary, Docker container, or deploy via BYOC in your AWS/GCP/Azure account.",
    sections: [
      {
        heading: "Self-Hosted Core Engine",
        paragraphs: [
          "The Tellodb Core engine is a single Rust binary — download, run. No Docker required. No database to configure. Works on macOS, Linux, and Windows. Everything needed for agent memory is inside the binary: HNSW vector index, BM25F full-text search, typed knowledge graph, temporal KV store, and deterministic analytics vault.",
          "Embeddings are handled locally via Candle (CPU/GPU) or ONNX Runtime. No external embedding API is needed. The engine works completely air-gapped.",
        ],
        codeBlocks: [
          {
            label: "Quick start (binary)",
            language: "bash",
            code: "curl -L https://github.com/Tellodb/Tellodb/releases/latest/download/tellodb-x86_64-linux -o tellodb\nchmod +x tellodb\nexport TEMPORAL_MEMORY_API_KEY=my-secret\nexport TEMPORAL_MEMORY_EMBEDDING_MODEL=BAAI/bge-small-en-v1.5\n./tellodb\n# Listening on http://localhost:3000",
          },
          {
            label: "Docker",
            language: "bash",
            code: "docker run -p 3000:3000 \\\n  -e TEMPORAL_MEMORY_API_KEY=my-secret \\\n  -e TEMPORAL_MEMORY_EMBEDDING_MODEL=BAAI/bge-small-en-v1.5 \\\n  -e TEMPORAL_MEMORY_DATA_DIR=/data \\\n  tellodb:latest (build from Dockerfile in repo)",
          },
        ],
      },
      {
        heading: "Configuration",
        steps: [
          "Set TEMPORAL_MEMORY_API_KEY: Any string used to authenticate all requests. Treat this like a database password.",
          "Choose an embedding model: Set TEMPORAL_MEMORY_EMBEDDING_MODEL to a HuggingFace model ID (e.g., BAAI/bge-small-en-v1.5). The model is downloaded on first run and cached locally.",
          "Set the data directory: TEMPORAL_MEMORY_DATA_DIR defaults to the current directory. All database files (.redb) and the vector index (.hnsw) are stored here.",
          "Bind address: TEMPORAL_MEMORY_HOST (default 0.0.0.0) and PORT / TEMPORAL_MEMORY_PORT (default 3000).",
          "Enable GPU: Build with --features gpu-cuda and set TEMPORAL_MEMORY_DEVICE=cuda.",
        ],
        stats: [
          {
            label: "Binary Size",
            value: "~45 MB",
            description: "Statically linked. No runtime dependencies.",
            tone: "primary",
          },
          {
            label: "Startup Time",
            value: "< 1s",
            description: "Cold start, all indexes loaded.",
            tone: "success",
          },
          {
            label: "Memory (100K obs)",
            value: "~800 MB",
            description: "Includes all indexes. Configurable retention.",
            tone: "default",
          },
          {
            label: "Price",
            value: "Free",
            description: "Open source (Apache 2.0). No license fees.",
            tone: "success",
          },
        ],
      },
      {
        heading: "Enterprise BYOC",
        paragraphs: [
          "For organizations requiring dedicated infrastructure with full data sovereignty, we offer a Bring Your Own Cloud (BYOC) program. You provide the cloud account (AWS, GCP, or Azure); we provide Terraform modules that provision the Tellodb Core instance in your VPC. The management plane only receives health metrics — your data never leaves your infrastructure.",
          "BYOC includes: dedicated single-tenant instance, customer-managed encryption keys (CMEK), custom networking (VPC, PrivateLink), 99.95% uptime SLA, and priority support.",
          "Contact enterprise@tellodb.com for a BYOC assessment and pricing.",
        ],
        bullets: [
          "Terraform modules for automated provisioning in AWS, GCP, and Azure.",
          "Zero-access architecture — no SSH, VPN, or inbound network access required for operations.",
          "Outbound-only connectivity to the management plane for health metrics.",
          "Configurable retention policies, backup schedules, and disaster recovery.",
        ],
      },
    ],
  },
];

export const detailedDocsBySlug: Record<string, DocsPage> = Object.fromEntries(
  detailedDocsPages.map((page) => [page.slug, page]),
);
