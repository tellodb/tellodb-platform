---
title: "Production AI Memory: From Prototype to Serving 10,000 Users"
description: "A practical guide to taking AI agent memory from a working prototype to a production system serving thousands of concurrent users."
excerpt: "Your memory prototype works. It retrieves facts, feeds them to a model, and gives coherent answers. But it was built for one user on a warm cache. Here is what breaks when you ship it."
publishedAt: 2026-05-28T00:00:00.000Z
updatedAt: 2026-05-28T00:00:00.000Z
author: "Sharjeel"
tags:
  - Production Memory
  - Scaling
  - Agent Infrastructure
image: /screen.png
featured: false
---

# Production AI Memory: From Prototype to Serving 10,000 Users

Your memory prototype works. You embed user statements, retrieve them by similarity, and feed them into a model prompt. The answers make sense. It took an afternoon to build and it feels like the hard part is done.

It is not.

That prototype is running on a warm cache with one user, a short conversation history, and zero contradiction management. Every one of those assumptions breaks under production load. This post walks through exactly what breaks, why it breaks, and the concrete configuration, monitoring, and testing you need to ship a memory system that holds up at scale.

## Why prototypes deceive you

Most memory prototypes look good because the failure modes are invisible at small scale:

- **One user, no isolation problems.** Tenant separation is not tested because there is only one tenant. The moment you add a second user, cross-contamination risks appear.
- **Short conversations, no contradictions.** A user says "I prefer dark mode" in message 3 and "Actually, light mode is better" in message 47. With 50 messages, you see both facts. With 5,000 messages across months, supersession logic matters.
- **Warm embedding cache, low latency.** The first 1,000 embeddings are fast because they are in memory. At 100,000 embeddings, index structure and disk I/O dominate retrieval time.
- **Few memories, everything is relevant.** With 50 facts, the top-5 retrieval always returns something useful. At 50,000 facts per user, precision drops without hybrid retrieval.

The prototype is not wrong. It is incomplete. Production memory requires retrieval engineering, isolation guarantees, contradiction management, and observability that standard APM tools do not provide.

## Architecture: What a production memory system looks like

Here is the architecture shape that converges across production deployments. This is not theoretical — it is the pattern you will find in any system serving thousands of concurrent users with memory.

```
┌─────────────────────────────────────────────────────────────────┐
│                        API Gateway                              │
│                  (rate limiting, auth, routing)                  │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Memory Service Layer                         │
│                                                                 │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │ Ingest   │  │   Retrieval  │  │  Consistency │              │
│  │ Pipeline │  │   Pipeline   │  │    Engine    │              │
│  │          │  │              │  │              │              │
│  │ embed →  │  │ vector + BM25│  │  supersede → │              │
│  │ store →  │  │ + temporal   │  │  decay →     │              │
│  │ index    │  │ = ranked     │  │  merge       │              │
│  └──────────┘  └──────────────┘  └──────────────┘              │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Storage Layer                              │
│                                                                 │
│  ┌───────────┐  ┌───────────┐  ┌────────────┐  ┌────────────┐ │
│  │ Vector    │  │  Lexical  │  │   Graph    │  │  Document  │ │
│  │  Index    │  │  Index    │  │   Store    │  │   Store    │ │
│  │  (HNSW)   │  │  (BM25)   │  │ (edges/    │  │ (raw       │ │
│  │           │  │           │  │  relations)│  │  memories) │ │
│  └───────────┘  └───────────┘  └────────────┘  └────────────┘ │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Observability Stack                          │
│  Prometheus (metrics) → Grafana (dashboards) → Alertmanager    │
└─────────────────────────────────────────────────────────────────┘
```

Three things to notice in this diagram:

1. **Retrieval is not just vector search.** It combines vector similarity, lexical matching, and temporal ranking. Each signal catches different failure modes.
2. **The consistency engine is a separate concern.** It handles fact supersession (when new information replaces old) and decay (when facts become stale over time). Without it, your retrieval layer returns contradictory evidence.
3. **Isolation happens at the storage layer, not the application layer.** Every query is scoped to a tenant identifier that is validated before any index is accessed.

## Configuration for production

The difference between a prototype config and a production config is not just resource limits. It is the index parameters, consistency policies, and connection pooling that prevent cascading failures.

Here is a production-ready configuration for a memory system. This example uses YAML, but the structure applies regardless of your stack:

```yaml
# memory-production.yaml
server:
  host: "0.0.0.0"
  port: 8080
  workers: 8  # match CPU cores
  max_connections: 500
  request_timeout_ms: 5000

embedding:
  model: "text-embedding-3-small"
  dimensions: 1536
  batch_size: 128  # batch embeddings to reduce API calls
  cache:
    enabled: true
    max_entries: 50000
    ttl_seconds: 86400

retrieval:
  # Hybrid retrieval weights
  vector_weight: 0.6
  lexical_weight: 0.25
  temporal_weight: 0.15
  
  # HNSW index parameters
  hnsw:
    ef_construction: 200
    m: 32
    ef_search: 128  # higher = better recall, more latency
  
  # How many candidates to fetch before reranking
  candidate_pool: 50
  # Final results returned to the model
  top_k: 10

consistency:
  # Fact supersession: when a new fact replaces an old one
  supersession:
    enabled: true
    similarity_threshold: 0.92  # facts above this similarity are candidates for supersession
    conflict_resolution: "newest_wins"  # or "most_frequent", "manual"
  
  # Fact decay: facts lose relevance over time
  decay:
    enabled: true
    half_life_days: 90  # a fact's weight halves every 90 days
    min_weight: 0.1     # floor so old facts don't disappear entirely

tenant:
  isolation: "strict"  # engine-level isolation, not app-level filtering
  max_memories_per_tenant: 100000
  max_retrieval_concurrent: 20

storage:
  vector_db:
    host: "${VECTOR_DB_HOST}"
    port: 6333
    pool_size: 20
    timeout_ms: 3000
  postgres:
    host: "${POSTGRES_HOST}"
    port: 5432
    pool_size: 30
    max_overflow: 10
    idle_timeout_ms: 30000
```

Key things in this config:

- **Batch size of 128 for embeddings.** Embedding API calls are expensive. Batching reduces round-trips by 10x compared to embedding one statement at a time.
- **Hybrid retrieval weights.** Pure vector search misses exact matches ("the API key is sk-1234"). BM25 catches those. Temporal weighting ensures recent facts rank higher than stale ones.
- **HNSW ef_search of 128.** The default of 16 is fine for prototypes. At 100k+ vectors per tenant, you need higher ef_search to maintain recall. This trades ~5ms of latency for meaningfully better retrieval quality.
- **Decay half-life of 90 days.** A user's preference from two years ago is probably irrelevant. Decay prevents stale facts from polluting retrieval results without hard-deleting them.

## Monitoring memory health

Standard infrastructure monitoring (CPU, memory, request latency) tells you whether the service is running. It does not tell you whether the memory is actually working. You need memory-specific metrics.

Here is a Prometheus scrape config to collect memory system metrics:

```yaml
# prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: "memory-service"
    static_configs:
      - targets: ["memory-service:8080"]
    metrics_path: /metrics
    scrape_interval: 5s

  - job_name: "memory-consistency"
    static_configs:
      - targets: ["memory-service:8081"]
    metrics_path: /metrics
```

These are the memory-specific metrics you should track. Each one corresponds to a failure mode:

### Retrieval quality metrics

```promql
# Percentage of retrieval results that are relevant (you need a relevance signal — 
# from user feedback, model self-evaluation, or implicit signals like follow-up questions)
# This is your single most important memory health metric.
avg(memory_retrieval_relevance_score) by (tenant)

# Retrieval latency p99 — if this spikes, your index is undersized or fragmented
histogram_quantile(0.99, rate(memory_retrieval_latency_seconds_bucket[5m]))

# Retrieval result count — if this drops to 0 for active users, something is wrong with ingestion
avg(memory_retrieval_result_count) by (tenant)
```

### Ingestion pipeline metrics

```promql
# Embedding batch failure rate — if this rises, your embedding API quota is probably exhausted
rate(memory_embedding_batch_errors_total[5m])

# Ingestion lag — time between a memory being submitted and becoming searchable
# This should be under 5 seconds. If it is climbing, your indexing pipeline is backed up.
histogram_quantile(0.95, rate(memory_ingestion_lag_seconds_bucket[5m]))

# Index size per tenant — watch for runaway growth
max(memory_index_size_bytes) by (tenant)
```

### Consistency metrics

```promql
# Supersession rate — healthy systems supersede ~2-5% of facts per day
# If this is 0%, either your users are not updating information or supersession is broken.
rate(memory_supersession_events_total[24h])

# Stale fact ratio — percentage of retrieved facts that are past their decay threshold
# This should stay under 10%. If it climbs, your decay parameters need tuning.
avg(memory_stale_fact_ratio) by (tenant)

# Contradiction detection rate — how often the system detects conflicting facts
rate(memory_contradiction_detected_total[24h])
```

Set up these Grafana alerts:

```json
{
  "alert": "MemoryRetrievalDegraded",
  "condition": "avg(memory_retrieval_relevance_score) < 0.6",
  "for": "10m",
  "annotations": {
    "summary": "Retrieval quality below 60% for {{ $labels.tenant }}",
    "runbook": "Check index fragmentation, review recent ingestion batches for embedding quality"
  }
},
{
  "alert": "MemoryIngestionBacklog", 
  "condition": "histogram_quantile(0.95, rate(memory_ingestion_lag_seconds_bucket[5m])) > 30",
  "for": "5m",
  "annotations": {
    "summary": "Ingestion lag exceeds 30 seconds at p95",
    "runbook": "Check embedding API rate limits, increase worker count, check for slow index operations"
  }
},
{
  "alert": "MemoryStaleFactRatio",
  "condition": "avg(memory_stale_fact_ratio) by (tenant) > 0.15",
  "for": "30m",
  "annotations": {
    "summary": "Stale fact ratio above 15% for tenant {{ $labels.tenant }}",
    "runbook": "Review decay configuration, trigger a decay sweep, check if supersession is running"
  }
}
```

Without these metrics, you are flying blind. You will not know retrieval quality has degraded until users start complaining about contradictory answers.

## Load testing your memory system

Before you ship, you need to verify that retrieval latency stays flat as the corpus grows, that tenant isolation holds under concurrent access, and that consistency operations work under load.

Here is a k6 load test that covers all three scenarios:

```javascript
// memory-load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';

const ingestionCounter = new Counter('memory_ingestions');
const retrievalCounter = new Counter('memory_retrievals');
const retrievalLatency = new Trend('memory_retrieval_latency');

// Simulate 10,000 users across 100 tenants
const TENANT_COUNT = 100;
const USERS_PER_TENANT = 100;
const API_BASE = __ENV.API_BASE || 'http://localhost:8080';

export const options = {
  stages: [
    { duration: '2m', target: 200 },   // ramp up to 200 VUs
    { duration: '5m', target: 200 },   // hold at 200 VUs
    { duration: '2m', target: 500 },   // spike to 500 VUs
    { duration: '5m', target: 500 },   // hold at 500 VUs
    { duration: '2m', target: 0 },     // ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<200'],  // 95% of requests under 200ms
    memory_retrieval_latency: ['p(95)<150'],  // retrieval under 150ms at p95
    http_req_failed: ['rate<0.01'],    // less than 1% error rate
  },
};

function randomTenant() {
  return `tenant-${Math.floor(Math.random() * TENANT_COUNT)}`;
}

function randomUser(tenant) {
  return `${tenant}-user-${Math.floor(Math.random() * USERS_PER_TENANT)}`;
}

export function setup() {
  // Seed the system with baseline data
  const tenant = 'tenant-0';
  const user = `${tenant}-user-0`;
  const statements = [
    "I prefer dark mode in all applications",
    "My timezone is UTC-5 (EST)",
    "I work on backend infrastructure",
    "I use TypeScript and Rust primarily",
    "I prefer concise responses, no filler",
  ];
  
  for (const statement of statements) {
    http.post(`${API_BASE}/api/memory/ingest`, JSON.stringify({
      tenant_id: tenant,
      user_id: user,
      content: statement,
      type: 'preference',
    }), { headers: { 'Content-Type': 'application/json' } });
  }
  
  return { tenant, user };
}

export default function (data) {
  const tenant = randomTenant();
  const user = randomUser(tenant);
  
  // Scenario 1: Memory ingestion (10% of traffic)
  if (Math.random() < 0.1) {
    const res = http.post(`${API_BASE}/api/memory/ingest`, JSON.stringify({
      tenant_id: tenant,
      user_id: user,
      content: `Memory entry at ${Date.now()} from ${user}`,
      type: 'observation',
    }), { headers: { 'Content-Type': 'application/json' } });
    
    check(res, { 'ingestion succeeded': (r) => r.status === 201 });
    ingestionCounter.add(1);
  }
  
  // Scenario 2: Memory retrieval (90% of traffic)
  const queries = [
    "What are the user's display preferences?",
    "What timezone does the user work in?",
    "What programming languages does the user prefer?",
    "What is the user's communication style preference?",
    "What does the user work on?",
  ];
  
  const query = queries[Math.floor(Math.random() * queries.length)];
  
  const start = Date.now();
  const res = http.post(`${API_BASE}/api/memory/retrieve`, JSON.stringify({
    tenant_id: tenant,
    user_id: user,
    query: query,
    top_k: 10,
  }), { headers: { 'Content-Type': 'application/json' } });
  
  const elapsed = Date.now() - start;
  retrievalLatency.add(elapsed);
  retrievalCounter.add(1);
  
  check(res, {
    'retrieval succeeded': (r) => r.status === 200,
    'returned results': (r) => JSON.parse(r.body).results.length > 0,
    'no cross-tenant leak': (r) => {
      const results = JSON.parse(r.body).results;
      return results.every(r => r.tenant_id === tenant);
    },
    'latency acceptable': () => elapsed < 150,
  });
  
  sleep(0.1);  // 100ms think time
}

export function teardown(data) {
  console.log(`Test complete. Final tenant: ${data.tenant}`);
}
```

Run it:

```bash
k6 run --out prometheus=http://localhost:9090 memory-load-test.js
```

Pay attention to three things in the results:

1. **Retrieval latency must stay flat between the 2-minute and 7-minute marks.** If it climbs as the system ingests more data, your index is not handling growth correctly.
2. **The cross-tenant leak check must never fire.** If even one result contains a different tenant's data, you have a critical isolation bug.
3. **The latency check on individual retrievals.** Any retrieval taking over 150ms is a problem — your model's time-to-first-token budget is typically 200-300ms, and retrieval is not the only step.

## Common production failures

These are the failures you will actually encounter, with specific symptoms and fixes:

### Failure 1: Retrieval latency creep

**Symptom:** Retrieval p95 latency goes from 40ms to 200ms over two weeks. CPU usage is low. Memory usage is stable.

**Root cause:** The HNSW index has not been rebuilt after exceeding its configured cardinality threshold. At 50k+ vectors with default HNSW parameters, graph traversal degrades.

**Fix:** Rebuild the index with higher `m` and `ef_construction` values. For 100k+ vectors per tenant, use `m=32` and `ef_construction=200`. Schedule periodic index rebuilds during low-traffic windows:

```bash
curl -X POST http://memory-service:8080/api/admin/index/rebuild \
  -H "Content-Type: application/json" \
  -d '{"tenant": "all", "index": "hnsw", "optimize": true}'
```

### Failure 2: Stale facts dominating retrieval

**Symptom:** Users report the agent gives outdated information. Relevance metrics drop. The consistency engine logs show zero supersession events.

**Root cause:** The supersession similarity threshold is too high (0.98+). The system does not recognize that "I switched to light mode" supersedes "I prefer dark mode" because the semantic similarity is below the threshold.

**Fix:** Lower the similarity threshold to 0.90-0.92. Add a scheduled decay sweep:

```yaml
# cron job that runs every 6 hours
consistency:
  decay:
    sweep_schedule: "0 */6 * * *"
    batch_size: 1000
```

### Failure 3: Embedding API rate limiting

**Symptom:** Ingestion lag spikes to 30+ seconds. Embedding batch error rate increases. The ingestion pipeline queues up but never crashes.

**Root cause:** You hit the embedding provider's rate limit. The default batch size of 1 is making too many API calls.

**Fix:** Increase batch size to 64-128 (most embedding APIs support this). Add exponential backoff with jitter:

```python
import time
import random

def embed_with_retry(texts, max_retries=5):
    for attempt in range(max_retries):
        try:
            return embedding_client.embed(texts)
        except RateLimitError:
            wait = (2 ** attempt) + random.uniform(0, 1)
            time.sleep(wait)
    raise Exception("Embedding failed after max retries")
```

### Failure 4: Cross-tenant data leak

**Symptom:** One user's memory appears in another user's retrieval results. This is a critical security issue.

**Root cause:** The application layer is filtering by tenant_id in a WHERE clause, but a code path bypasses that filter. Maybe a new endpoint was added without the filter. Maybe a cache is returning results from a different tenant.

**Fix:** Move isolation to the engine layer. Every database query should have tenant_id as a first-class filter, not an application-level afterthought. Add a test that verifies isolation:

```python
def test_tenant_isolation():
    # Ingest memory for tenant A
    ingest(tenant_id="tenant-a", user_id="user-1", content="secret A data")
    
    # Query from tenant B — must return empty
    results = retrieve(tenant_id="tenant-b", user_id="user-2", query="secret data")
    assert len(results) == 0, "CRITICAL: Cross-tenant leak detected"
    
    # Query from tenant A — must return the memory
    results = retrieve(tenant_id="tenant-a", user_id="user-1", query="secret data")
    assert len(results) > 0, "Memory not found for correct tenant"
```

### Failure 5: Memory service OOM under load

**Symptom:** The memory service gets killed by the OOM killer during traffic spikes. Kubernetes shows `OOMKilled` in pod status.

**Root cause:** The HNSW index is loaded entirely into memory. With 500 concurrent users and 100k memories each, the working set exceeds container memory limits.

**Fix:** Increase memory limits, but also implement index sharding by tenant. Not all tenants need their index in memory simultaneously:

```yaml
# kubernetes deployment
resources:
  limits:
    memory: "4Gi"
  requests:
    memory: "2Gi"

# Also implement lazy index loading — only load a tenant's index when they have an active request
index_strategy:
  lazy_loading: true
  max_loaded_tenants: 50
  eviction_policy: "lru"
```

### Failure 6: Inconsistent ranking across retrieval methods

**Symptom:** The same query returns different results on consecutive calls. Users see the agent contradict itself within the same conversation.

**Root cause:** The hybrid retrieval weights are not deterministic. If the vector search returns results in a non-deterministic order (which HNSW does by default), the final ranking varies between calls.

**Fix:** Add a tiebreaker in the ranking function. When two results have the same combined score, use recency as the tiebreaker:

```python
def rank_results(vector_results, lexical_results, temporal_context, weights):
    scored = {}
    
    for r in vector_results:
        scored[r.id] = scored.get(r.id, 0) + r.score * weights.vector
    
    for r in lexical_results:
        scored[r.id] = scored.get(r.id, 0) + r.score * weights.lexical
    
    # Temporal boost: more recent = higher score
    for r in scored:
        recency = temporal_context.get_recency(r)
        scored[r] += recency * weights.temporal
    
    # Deterministic tiebreaker: newest first
    results = sorted(scored.items(), key=lambda x: (-x[1], -x[0].created_at))
    return results[:top_k]
```

## The deployment checklist

Before you go live, verify each of these. If any fail, the system is not ready:

1. **Retrieval latency p95 under 100ms with 100k memories per tenant.** Test with production-scale data, not a toy dataset.
2. **Tenant isolation passes with concurrent cross-tenant queries.** Run the isolation test with 500 VUs hitting different tenants simultaneously.
3. **Supersession correctly replaces old facts with new ones.** Ingest contradictory facts and verify the retrieval returns the current version.
4. **Decay sweep runs without errors.** Schedule it, verify it processes the expected number of records, check that old facts lose weight.
5. **Embedding batch processing handles rate limits.** Simulate a rate limit response and verify retry logic works.
6. **Index rebuild completes within maintenance window.** Time a rebuild with your largest tenant's data.
7. **Prometheus metrics are being scraped and Grafana dashboards are live.** If you cannot see retrieval quality metrics, you are not monitoring the system that matters.
8. **Load test passes with 2x expected peak traffic.** If you expect 500 concurrent users, test with 1000.

## The bottom line

Shipping memory to production is not a scaling problem. It is a systems engineering problem. The index configuration determines whether retrieval stays fast. The consistency engine determines whether the agent gives coherent answers. The isolation model determines whether you leak user data. The observability stack determines whether you know when something breaks.

Get the architecture right, instrument it properly, and load test it before you need to. The prototype got you this far. The production system gets you the rest of the way.
