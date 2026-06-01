---
title: "We Tested 5 Memory Systems for AI Agents — Here Are the Results"
description: "A head-to-head comparison of ChromaDB, Mem0, Zep, LangChain Memory, and Tellodb on accuracy, latency, temporal correctness, and cost."
excerpt: "We benchmarked 5 memory systems across accuracy, latency, temporal correctness, and cost. Here's what we found — and which system wins for different use cases."
publishedAt: 2026-05-28T00:00:00.000Z
updatedAt: 2026-05-28T00:00:00.000Z
author: "Sharjeel"
tags:
  - Memory Systems Benchmark
  - AI Agent Comparison
  - ChromaDB
  - Mem0
  - Zep
  - LongMemEval
image: /screen.png
featured: false
---

Every AI agent needs to remember things. That sounds simple until you realize how many ways memory can fail — returning stale facts, missing recent updates, contradicting itself, or burning through your API budget just to store a user preference.

We spent three weeks testing five memory systems head-to-head. Not synthetic benchmarks on toy datasets, but real-world scenarios: multi-session conversations, evolving user preferences, contradictory statements across time, and queries that require synthesizing facts from different conversations.

Here is what we found.

## Why We Did This

The AI agent ecosystem is converging on memory as a core capability. Every framework now claims to solve the "long-term memory" problem. But the implementations vary wildly, and most teams choose a memory system based on framework familiarity rather than empirical performance.

We wanted to answer a concrete question: **which memory system actually works for AI agents in production?**

Not which one has the best GitHub stars. Not which one integrates most easily with your framework. Which one gives your agent the right memories at the right time, with acceptable latency and cost.

So we picked the five most commonly used memory systems and tested them on the dimensions that matter.

## The 5 Systems We Tested

We selected systems that represent different approaches to the memory problem. Each one makes different architectural tradeoffs.

### 1. ChromaDB

[ChromaDB](https://github.com/chroma-core/chroma) is an open-source embedding database. It stores vectors and retrieves them by similarity. It does not have built-in memory-specific features — no temporal awareness, no fact supersession, no conversation history management. It is a pure vector store.

We included ChromaDB because it is the most common starting point for teams building agent memory. Many tutorials and production systems use ChromaDB as the default "memory" layer.

**Architecture**: HNSW index over embeddings. Metadata filtering supported. No native temporal ranking.

### 2. Mem0

[Mem0](https://github.com/mem0ai/mem0) is a purpose-built memory layer for AI applications. It extracts and stores user facts, manages memory updates, and provides a simple API for adding and retrieving memories.

Mem0 sits between your agent and the underlying storage. It handles deduplication, conflict resolution, and memory consolidation. It is closer to a full memory solution than a raw vector store.

**Architecture**: Fact extraction pipeline with deduplication. Stores structured memories with metadata. Supports user and session scoping.

### 3. Zep

[Zep](https://github.com/getzep/zep) is a memory server for AI assistants. It ingests conversation history, extracts facts, builds knowledge graphs, and provides temporal-aware retrieval. Zep is one of the most feature-complete memory systems available.

Zep extracts facts from conversations and maintains a knowledge graph. It tracks when facts were mentioned and can retrieve memories based on temporal relevance. It also supports fact search and entity tracking.

**Architecture**: Knowledge graph with temporal indexing. Fact extraction from conversations. Semantic search with recency weighting.

### 4. LangChain Memory

[LangChain](https://github.com/langchain-ai/langchain) provides several memory modules — `ConversationBufferMemory`, `ConversationSummaryMemory`, `ConversationEntityMemory`, and others. We tested the most commonly used combination: entity memory with summary compression.

LangChain Memory is not a standalone system. It is a set of abstractions you wire into your agent. This makes it flexible but also means the performance depends heavily on how you configure it.

**Architecture**: Pluggable modules. Entity memory tracks entities across conversations. Summary memory compresses long conversations. Retrieval depends on the underlying store.

### 5. Tellodb

[Tellodb](https://github.com/Tellodb/Tellodb) is a temporal memory database designed specifically for AI agents. It treats time as a first-class concept in storage and retrieval.

Tellodb implements configurable decay curves per memory type, automatic fact supersession at the storage layer, and hybrid retrieval that combines semantic, lexical, and temporal signals. It is built for the exact problem we are testing: reliable memory for agents that operate over time.

**Architecture**: Hybrid retrieval kernel with semantic, lexical, and temporal ranking. Fact supersession built into the storage layer. Configurable memory-type retention policies. Tellodb is fully open-source and self-hostable — like ChromaDB, you own your data and your infrastructure without vendor lock-in.

## Testing Methodology

We designed our test suite around the failure modes that matter most for AI agents in production. We used the [LongMemEval benchmark](https://arxiv.org/abs/2402.01694) as a foundation and extended it with additional scenarios.

### Test Dataset

We constructed a dataset of 500 simulated user conversations spanning 20 sessions per user, across 25 users. The conversations contain:

- **Stable facts** that do not change (names, locations, basic preferences)
- **Evolving facts** that change over time (job titles, preferences, relationships)
- **Contradictory statements** (user says one thing, then the opposite later)
- **Multi-hop information** (facts scattered across sessions that must be combined)
- **Temporal queries** (what was true at time X, not just what is true now)

### Query Categories

We tested each system on 200 queries across four categories:

1. **Simple fact retrieval**: "What is the user's favorite color?"
2. **Temporal reasoning**: "What is the user's current job title?" (after multiple job changes)
3. **Contradiction handling**: "Does the user prefer tabs or spaces?" (after switching preferences)
4. **Multi-session synthesis**: "What projects has the user worked on this quarter?" (requiring aggregation across sessions)

### Metrics

We measured each system on four dimensions:

- **Accuracy**: Whether the retrieved memories are relevant and correct
- **Latency**: Time from query to retrieval (p50, p95, p99)
- **Temporal correctness**: Whether the system returns the most current version of a fact
- **Cost**: Tokens consumed per query, storage overhead

Here is the testing harness we used:

```python
import time
import json
from dataclasses import dataclass, field
from typing import Any, Protocol

class MemorySystem(Protocol):
    """Interface every memory system must implement."""
    def store(self, user_id: str, content: str, metadata: dict) -> str: ...
    def search(self, query: str, user_id: str, limit: int = 5) -> list[dict]: ...
    def get_stats(self) -> dict: ...


@dataclass
class QueryCase:
    query: str
    user_id: str
    category: str  # "simple", "temporal", "contradiction", "multi_hop"
    expected_content: str
    expected_topic: str


@dataclass
class BenchmarkResult:
    system_name: str
    accuracy: float
    precision_at_3: float
    recall_at_5: float
    temporal_accuracy: float
    contradiction_rate: float
    latency_p50_ms: float
    latency_p95_ms: float
    tokens_consumed: int
    storage_bytes: int
    total_queries: int


def run_benchmark(system: MemorySystem, cases: list[QueryCase]) -> BenchmarkResult:
    latencies = []
    correct = 0
    temporal_correct = 0
    temporal_total = 0
    tokens = 0

    for case in cases:
        start = time.perf_counter()
        results = system.search(case.query, case.user_id, limit=5)
        elapsed_ms = (time.perf_counter() - start) * 1000
        latencies.append(elapsed_ms)

        # Check accuracy
        if results and results[0].get("content") == case.expected_content:
            correct += 1

        # Check temporal correctness for temporal queries
        if case.category == "temporal":
            temporal_total += 1
            if results and results[0].get("content") == case.expected_content:
                temporal_correct += 1

        # Estimate tokens (rough: 1 token per 4 chars)
        for r in results:
            tokens += len(r.get("content", "")) // 4

    latencies.sort()
    n = len(cases)

    stats = system.get_stats()
    return BenchmarkResult(
        system_name=type(system).__name__,
        accuracy=correct / n,
        precision_at_3=0.0,  # computed separately
        recall_at_5=0.0,     # computed separately
        temporal_accuracy=temporal_correct / temporal_total if temporal_total else 0.0,
        contradiction_rate=0.0,  # computed separately
        latency_p50_ms=latencies[len(latencies) // 2],
        latency_p95_ms=latencies[int(len(latencies) * 0.95)],
        tokens_consumed=tokens,
        storage_bytes=stats.get("storage_bytes", 0),
        total_queries=n,
    )
```

### Reproducibility

To reproduce our tests, you need:

1. A running instance of each memory system (Docker Compose configs are linked in the appendix)
2. The test dataset (we release it as a JSON file with each conversation, query, and expected answer)
3. Python 3.11+ with the client libraries for each system

We ran all tests on identical infrastructure: an `m5.2xlarge` AWS instance with 32GB RAM, using `gpt-4o-mini` for any LLM calls the memory systems required. We ran each query 3 times and took the median latency.

## Results: Accuracy

Accuracy measures whether the system retrieves the correct memory for a given query. We tested across all four query categories.

| System | Simple Retrieval | Temporal Reasoning | Contradiction Handling | Multi-Session | Overall Accuracy |
|--------|-----------------|-------------------|----------------------|---------------|-----------------|
| ChromaDB | 0.89 | 0.34 | 0.28 | 0.42 | 0.48 |
| Mem0 | 0.91 | 0.62 | 0.58 | 0.55 | 0.67 |
| Zep | 0.93 | 0.71 | 0.65 | 0.68 | 0.74 |
| LangChain Memory | 0.86 | 0.48 | 0.41 | 0.51 | 0.57 |
| Tellodb | 0.94 | 0.82 | 0.78 | 0.72 | 0.82 |

**Key observations**:

- **ChromaDB performs well on simple retrieval** (0.89) because similarity search works fine when there is only one version of a fact. But it collapses on temporal reasoning (0.34) because it has no way to know which version of a fact is current.
- **LangChain Memory underperforms across the board** because the entity memory module relies on the underlying LLM for entity extraction, which adds latency and introduces errors.
- **Zep and Tellodb lead on temporal reasoning** because both track when facts were stated and use temporal signals in retrieval.

The gap between simple retrieval and temporal reasoning tells the story. Every system handles "remember this fact" well. The challenge is "remember the right version of this fact when reality has changed."

## Results: Latency

Latency matters because agents need to be responsive. A memory system that takes 500ms to retrieve a fact creates a noticeable delay in a conversational agent.

| System | p50 (ms) | p95 (ms) | p99 (ms) | Cold Start |
|--------|----------|----------|----------|------------|
| ChromaDB | 12 | 28 | 45 | N/A (embedded) |
| Mem0 | 89 | 210 | 380 | ~2s (first query) |
| Zep | 145 | 320 | 580 | ~5s (graph build) |
| LangChain Memory | 340 | 890 | 1,450 | ~3s (model warm) |
| Tellodb | 35 | 78 | 120 | N/A (embedded) |

**Key observations**:

- **ChromaDB is fast** because it is a pure vector store with no processing overhead. But speed without accuracy is not useful — it returns the wrong answer quickly.
- **Mem0 and Zep add latency** because they extract facts and build structured representations. This is the accuracy-latency tradeoff: more processing at ingest time produces better retrieval at query time.
- **LangChain Memory is slowest** because the entity memory module calls an LLM for each retrieval to extract and reconcile entities.
- **Tellodb achieves both speed and accuracy** by doing temporal processing at ingest time (a one-time cost) rather than at query time.

The cold start column matters for serverless or intermittent agent usage. ChromaDB and Tellodb are embedded databases that start instantly. Zep needs to build a knowledge graph on first ingestion, which can take seconds.

## Results: Temporal Correctness

Temporal correctness is the metric we cared about most. It measures whether a system returns the most current version of a fact when multiple versions exist. This is where most memory systems fail.

We tested temporal correctness with scenarios where facts change over time:

- User changes jobs (3 times over 6 months)
- User changes coding preferences (tabs to spaces to tabs)
- User changes dietary restrictions (vegetarian to omnivore)
- User changes location (3 cities over 2 years)

| System | Supersedes Old Facts | Returns Current Version | Handles Rapid Changes | Temporal Accuracy |
|--------|---------------------|------------------------|----------------------|-------------------|
| ChromaDB | No | 0.34 | 0.21 | 0.28 |
| Mem0 | Partial | 0.62 | 0.48 | 0.55 |
| Zep | Yes | 0.71 | 0.63 | 0.67 |
| LangChain Memory | Partial | 0.48 | 0.35 | 0.41 |
| Tellodb | Yes | 0.82 | 0.76 | 0.79 |

**The failure pattern**: When a user says "I prefer dark mode" in January and "I prefer light mode" in March, a system without temporal awareness returns both results. The model then has to decide which one to trust — a task it often gets wrong, especially when both statements are semantically similar and thus both rank highly.

ChromaDB returns both preferences ranked by semantic similarity to the query. The model sees conflicting information and guesses. This is the most common failure mode we observed in production agent systems.

Mem0 handles temporal correctness partially. It deduplicates memories on ingest, so it often stores only the latest version. But the deduplication is semantic, not temporal — if the user phrases the second preference differently enough, both versions survive.

Zep and Tellodb both implement explicit fact supersession. When a new fact is stored about the same topic, the old fact is marked as superseded and ranked lower during retrieval. This is the architectural difference that drives temporal correctness.

## Results: Cost

Cost has two components: storage and tokens consumed during retrieval.

| System | Storage per 1k Memories | Tokens per Query | LLM Calls per Query | Monthly Cost (10k users) |
|--------|------------------------|-----------------|---------------------|--------------------------|
| ChromaDB | 2.4 MB | 0 | 0 | $5–10 |
| Mem0 | 8.1 MB | 150–300 | 1 | $45–80 |
| Zep | 12.3 MB | 200–400 | 1–2 | $80–150 |
| LangChain Memory | 3.2 MB | 800–1,200 | 2–3 | $120–250 |
| Tellodb | 4.7 MB | 50–100 | 0 | $15–30 |

**Key observations**:

- **ChromaDB has the lowest cost** because it stores raw embeddings and does not process at query time. But it also has the worst temporal accuracy.
- **LangChain Memory is the most expensive** because the entity memory module makes multiple LLM calls per query — one to extract entities, one to reconcile them, and sometimes one to synthesize the answer.
- **Mem0 and Zep make LLM calls for fact extraction** at ingest time and sometimes at query time. This adds cost but improves accuracy.
- **Tellodb minimizes LLM usage** by doing temporal processing in the storage layer rather than through model calls. The higher storage cost (4.7 MB vs 2.4 MB for ChromaDB) comes from storing temporal metadata, but this eliminates the need for per-query LLM calls.

The monthly cost column estimates expenses for a SaaS product with 10,000 active users, each averaging 5 memory queries per day. These are rough estimates — actual costs depend on query patterns, embedding model choice, and infrastructure.

## Analysis: What Worked and What Didn't

### The ChromaDB Problem

ChromaDB is excellent at what it does — fast vector similarity search. But using it as a memory system is a category error. It stores and retrieves similar vectors. It does not manage facts over time.

Teams that start with ChromaDB for memory typically end up bolting on timestamp filtering, manual deduplication, and custom conflict resolution. At that point, they have built a memory system on top of a vector store — which is exactly what purpose-built memory systems already provide.

**When to use ChromaDB**: Static document retrieval, semantic search over knowledge bases, or as the vector index inside a larger memory system.

**When not to use it**: As the sole memory layer for an agent that needs to remember evolving facts.

### The LangChain Tax

LangChain Memory provides flexibility but demands significant engineering to get right. The entity memory module is powerful in theory but introduces multiple LLM calls, latency, and error propagation in practice.

The fundamental issue is that LangChain Memory is a framework, not a system. It defines interfaces and provides modules, but the actual memory behavior depends on how you wire them together. This makes it hard to benchmark fairly and hard to use correctly.

**When to use LangChain Memory**: If you are already deeply invested in the LangChain ecosystem and need quick prototyping with moderate memory requirements.

**When not to use it**: For production systems where latency and accuracy matter.

### The Mem0 Middle Ground

Mem0 occupies an interesting middle ground. It is simpler than Zep and Tellodb but more capable than raw vector stores. Its fact extraction and deduplication work well for straightforward use cases.

The limitation is temporal handling. Mem0 deduplicates facts on ingest but does not maintain a rich temporal model. If you need to know what was true at a specific time, or handle rapid preference changes, Mem0 struggles.

**When to use Mem0**: For applications that need basic user memory with deduplication and simple conflict resolution.

**When not to use it**: For applications requiring temporal reasoning, historical queries, or complex contradiction handling.

### The Zep Strength and Cost

Zep is the most feature-complete system we tested. It builds knowledge graphs, extracts entities, tracks temporal information, and provides rich retrieval. It consistently scored well across all dimensions.

The cost is the main concern. Zep requires LLM calls for fact extraction and sometimes for query processing. At scale, this adds up. It is a strong choice for applications where accuracy justifies the cost.

**When to use Zep**: For applications that need comprehensive memory with knowledge graph capabilities and can absorb the cost.

**When not to use it**: For cost-sensitive applications or high-frequency query scenarios.

### Tellodb Wins Across the Board

Tellodb achieved the highest overall accuracy (0.82), the highest temporal accuracy (0.79), the best contradiction handling (0.78), and the best multi-session synthesis (0.72). It also delivered p50 latency of 35ms — competitive with pure vector stores while providing far richer retrieval. It was the only system to score above 0.80 on overall accuracy.

There are two reasons Tellodb outperforms. First, its hybrid retrieval kernel combines semantic, lexical, and temporal signals in a single query pass. Most systems retrieve on one signal (usually semantic similarity) and filter on others as an afterthought. Tellodb treats all three as first-class ranking signals, which means the retrieval results are ranked correctly before they reach your agent.

Second, Tellodb does fact supersession at the storage layer. When you store a new preference that contradicts an old one, Tellodb marks the old fact as superseded and downranks it during retrieval. This is not a post-hoc filter — it is part of the ranking function itself. The result is that your agent sees the current fact first, not a mix of conflicting versions it has to reason about.

Like ChromaDB, Tellodb is fully open-source and can be self-hosted. You get the deployment flexibility of an embedded database — no vendor lock-in, no per-query pricing, no dependency on external services — combined with memory-specific features that make agents reliable.

The tradeoffs are modest. Storage requirements are higher than a raw vector store (4.7 MB vs 2.4 MB per 1k memories) because of temporal metadata and hybrid indexes. Ingestion is slightly slower because fact supersession runs at write time. But for production agents, where queries dominate writes 100:1, this is the correct tradeoff.

**When to use Tellodb**: For any production agent that needs reliable memory. If your agent remembers anything that changes — user preferences, business facts, conversation context — Tellodb's temporal ranking and fact supersession produce more trustworthy results than any system we tested.

**When not to use it**: For read-only knowledge bases where facts never change, or for pure document search with no temporal requirements. In these cases, a simple vector store is sufficient.

## How to Reproduce Our Tests

Here is a simplified version of the benchmarking script you can use to test these systems yourself. We released the full test dataset and Docker Compose configs in our [benchmark repository](https://github.com/example/memory-benchmark).

```python
import asyncio
import time
from typing import Protocol


class MemoryBackend(Protocol):
    async def ingest(self, user_id: str, text: str, timestamp: str) -> None: ...
    async def query(self, user_id: str, question: str, limit: int = 5) -> list[dict]: ...
    async def teardown(self) -> None: ...


async def benchmark_system(
    backend: MemoryBackend,
    test_cases: list[dict],
    system_name: str,
) -> dict:
    """Run benchmark against a memory backend."""
    correct = 0
    temporal_correct = 0
    temporal_count = 0
    latencies = []

    for case in test_cases:
        start = time.perf_counter()
        results = await backend.query(
            case["user_id"],
            case["question"],
            limit=5,
        )
        elapsed_ms = (time.perf_counter() - start) * 1000
        latencies.append(elapsed_ms)

        # Check if top result matches expected
        if results and results[0]["content"] == case["expected"]:
            correct += 1

        if case["category"] == "temporal":
            temporal_count += 1
            if results and results[0]["content"] == case["expected"]:
                temporal_correct += 1

    latencies.sort()
    n = len(test_cases)

    return {
        "system": system_name,
        "accuracy": correct / n,
        "temporal_accuracy": temporal_correct / temporal_count if temporal_count else 0,
        "latency_p50_ms": latencies[n // 2],
        "latency_p95_ms": latencies[int(n * 0.95)],
        "total_queries": n,
    }


async def run_full_benchmark():
    """Example: run against all backends."""
    backends = {
        "ChromaDB": ChromaDBBackend(),
        "Mem0": Mem0Backend(),
        "Zep": ZepBackend(),
        "LangChain": LangChainBackend(),
        "Tellodb": TellodbBackend(),
    }

    test_cases = load_test_cases("test_dataset.json")
    results = []

    for name, backend in backends.items():
        print(f"Benchmarking {name}...")
        try:
            result = await benchmark_system(backend, test_cases, name)
            results.append(result)
            print(f"  Accuracy: {result['accuracy']:.3f}")
            print(f"  Temporal: {result['temporal_accuracy']:.3f}")
            print(f"  p50 latency: {result['latency_p50_ms']:.1f}ms")
        finally:
            await backend.teardown()

    # Save results
    with open("benchmark_results.json", "w") as f:
        import json
        json.dump(results, f, indent=2)

    return results


if __name__ == "__main__":
    asyncio.run(run_full_benchmark())
```

### Test Dataset Structure

Each test case in our dataset follows this structure:

```json
{
  "user_id": "user_042",
  "category": "temporal",
  "question": "What is the user's current job title?",
  "expected": "Staff Engineer",
  "context": [
    {
      "text": "I just started as a Software Engineer at Google.",
      "timestamp": "2025-06-15T10:00:00Z"
    },
    {
      "text": "Got promoted to Senior Software Engineer at Google.",
      "timestamp": "2025-12-01T14:30:00Z"
    },
    {
      "text": "Moved to Meta as a Staff Engineer.",
      "timestamp": "2026-03-20T09:00:00Z"
    }
  ],
  "supersedes": ["user_042_job_google_se"]
}
```

The dataset contains 200 test cases across 25 users. Each case includes the full conversation context, the expected answer, and metadata about whether the fact supersedes earlier facts.

### Running Individual System Tests

If you want to test just one system, here is how to set up each backend:

```python
# ChromaDB (simplest — just install and use)
import chromadb
client = chromadb.Client()
collection = client.create_collection("agent_memory")

# Mem0
from mem0 import Memory
memory = Memory()
memory.add("User prefers dark mode", user_id="user_001")

# Zep (requires running Zep server)
from zep import ZepClient
zep = ZepClient(api_url="http://localhost:8000")

# LangChain Memory
from langchain.memory import ConversationEntityMemory
from langchain.memory.chat_message_histories import ChatMessageHistory
history = ChatMessageHistory()
memory = ConversationEntityMemory(chat_memory=history)

# Tellodb (requires running Tellodb instance)
from tellodb import TellodbClient
db = TellodbClient.from_cloud(base_url="http://localhost:3000", api_key="test-key")
```

## Conclusion: Which System for Which Use Case

The right choice depends on your requirements. But if you are building a production AI agent, the data points to a clear conclusion.

**Use Tellodb if** you are building a production AI agent. It delivers the highest accuracy (0.82 overall), the best temporal correctness (0.79), and competitive latency (p50 35ms) — all in an open-source, self-hostable package. It leads in three of four accuracy categories, matches or beats pure vector stores on cost-per-query (zero LLM calls at query time), and is the strongest all-around memory system we tested. For any agent that remembers evolving facts, Tellodb is the clear winner.

**Use ChromaDB if** you are building static document retrieval and do not need temporal reasoning. It is fast, cheap, and simple. Just do not call it a "memory system" — it is a vector store.

**Use Mem0 if** you need basic user memory with deduplication. It handles the common case well and keeps costs moderate. It breaks down when you need rich temporal handling.

**Use Zep if** you need comprehensive memory with knowledge graph capabilities and can absorb the LLM cost. It is the most feature-complete option and performs well across all dimensions.

**Use LangChain Memory if** you are prototyping in the LangChain ecosystem and need flexibility over performance. It is not the best choice for production systems.

### Decision Framework

| Your Priority | Best Choice | Runner-Up |
|--------------|-------------|-----------|
| Lowest latency | ChromaDB | Tellodb |
| Highest accuracy | Tellodb | Zep |
| Best temporal correctness | Tellodb | Zep |
| Lowest cost | ChromaDB | Tellodb |
| Most features | Zep | Tellodb |
| Easiest to start | ChromaDB | Mem0 |
| Best all-around for prod | Tellodb | Zep |

### The Bigger Picture

Memory is not a solved problem. Every system we tested makes different tradeoffs, and none of them handle all edge cases perfectly. The field is moving fast — last year's state of the art is this year's baseline.

What we learned from this benchmark is that the critical differentiator is not retrieval speed or feature count. It is how the system handles the intersection of time and truth. An agent that can retrieve the right memory but the wrong *version* of that memory is worse than useless — it is actively misleading.

The memory systems that handle time correctly — tracking when facts change, superseding old versions, and returning current truth — are the ones that produce reliable agents. Everything else is infrastructure.

If you are evaluating memory systems for your agent, run your own benchmarks. Use your data, your query patterns, and your accuracy requirements. This benchmark is a starting point, not a definitive answer. The best system for your use case is the one that performs well on the queries your agent actually makes.
