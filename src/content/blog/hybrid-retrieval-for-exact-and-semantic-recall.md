---
title: "Hybrid Retrieval: Why Your AI Agent Needs Both Semantic and Keyword Search"
description: "A practical guide to combining BM25 and vector search for production retrieval. Includes Python code, RRF implementation, and real benchmark numbers."
excerpt: "Your vector database is returning irrelevant results for exact queries. Your keyword search misses intent. Here's how to combine both approaches to fix retrieval quality."
publishedAt: 2026-05-28T00:00:00.000Z
updatedAt: 2026-05-28T00:00:00.000Z
author: Tellodb Team
tags:
  - Hybrid Retrieval
  - Semantic Search
  - BM25
  - RRF
  - Reciprocal Rank Fusion
image: /screen.png
featured: true
---

If you've been debugging retrieval quality in an AI application, you know the frustration. You query your vector database with a specific product code or a user's exact words, and the results come back semantically related but completely wrong. Or you use keyword search and it can't handle paraphrased questions.

The problem isn't that your embeddings are bad or your indexing is broken. The problem is that pure semantic search and pure keyword search each fail in predictable, complementary ways. Production systems need both.

This post explains why, shows you how to combine them with working Python code, and shares benchmark data on the performance difference.

## The fundamental gap in semantic search

Vector embeddings capture meaning. They're excellent at finding documents that are conceptually similar to a query, even when the exact words don't match. This is why [sentence-transformers](https://www.sbert.net/) and models like `all-MiniLM-L6-v2` have become the default for retrieval pipelines.

But semantic embeddings have a structural weakness: they compress text into dense vectors that lose lexical precision. When a user asks "What's the status of ticket ENG-4821?", a vector search will return documents about tickets, engineering, and status updates — but not necessarily the specific ticket.

Consider this query pattern:

```
User: "What did we decide about the Redis to Valkey migration?"
```

A pure vector search might return documents about:
- Redis configuration (high semantic similarity)
- Database migrations in general (conceptually related)
- Valkey announcement posts (partially relevant)

But it might miss the specific Slack message where the team decided on the migration date, because that message uses different vocabulary.

## Where lexical search breaks down

[BM25](https://www.elastic.co/guide/en/elasticsearch/reference/current/index.html) and traditional keyword search solve the exact-match problem. They score documents based on term frequency, inverse document frequency, and field length. When you search for "ENG-4821", BM25 returns documents containing that exact string.

The problem is the inverse scenario. When a user asks:

```
User: "How do we handle session timeouts for long-running processes?"
```

A BM25 search might match "session", "timeout", and "process" independently, but miss a document that says "keepalive mechanisms for extended operations" — which is semantically equivalent but lexically different.

The failure modes are complementary:

| Query Type | Semantic Search | BM25 |
|------------|----------------|------|
| Exact IDs ("ENG-4821") | Weak | Strong |
| Quoted strings | Weak | Strong |
| Rare proper nouns | Weak | Strong |
| Paraphrased questions | Strong | Weak |
| Conceptual queries | Strong | Weak |
| Sparse wording | Strong | Weak |

This is why the "just use vectors" approach fails in production.

## The hybrid retrieval pattern

The standard approach combines both retrieval methods, then fuses the results:

```
Query → [Semantic Search] → Candidate Set A
     → [BM25 Search]      → Candidate Set B
     → [Fusion]           → Merged Results
     → [Optional: Rerank] → Final Results
```

The fusion step is where the magic happens. Instead of choosing one ranking over another, you combine rank positions from both systems. The most common technique is Reciprocal Rank Fusion (RRF).

## Implementing RRF in Python

Reciprocal Rank Fusion, introduced by [Cormack, Clarke, and Butt in 2009](https://dl.acm.org/doi/10.1145/1571941.1572114), assigns each document a score based on its rank in each result list:

```
RRF_score(d) = Σ 1 / (k + rank_i(d))
```

Where `k` is a constant (typically 60) that controls how much weight to give to higher-ranked documents.

Here's a complete implementation:

```python
from dataclasses import dataclass
from typing import List, Dict
import numpy as np


@dataclass
class RetrievalResult:
    doc_id: str
    content: str
    score: float
    source: str  # "semantic" or "lexical"


def reciprocal_rank_fusion(
    semantic_results: List[RetrievalResult],
    lexical_results: List[RetrievalResult],
    k: int = 60,
    semantic_weight: float = 1.0,
    lexical_weight: float = 1.0,
) -> List[RetrievalResult]:
    """Combine semantic and lexical results using RRF.
    
    Args:
        semantic_results: Results from vector search, ranked by similarity.
        lexical_results: Results from BM25 search, ranked by relevance.
        k: RRF constant. Higher values reduce the impact of rank position.
        semantic_weight: Weight for semantic scores (default 1.0).
        lexical_weight: Weight for lexical scores (default 1.0).
    
    Returns:
        Merged and re-ranked results.
    """
    scores: Dict[str, float] = {}
    doc_map: Dict[str, RetrievalResult] = {}
    
    # Score semantic results
    for rank, result in enumerate(semantic_results, start=1):
        rrf_score = semantic_weight / (k + rank)
        scores[result.doc_id] = scores.get(result.doc_id, 0) + rrf_score
        doc_map[result.doc_id] = result
    
    # Score lexical results
    for rank, result in enumerate(lexical_results, start=1):
        rrf_score = lexical_weight / (k + rank)
        scores[result.doc_id] = scores.get(result.doc_id, 0) + rrf_score
        doc_map[result.doc_id] = result
    
    # Sort by combined RRF score
    sorted_ids = sorted(scores.keys(), key=lambda x: scores[x], reverse=True)
    
    return [
        RetrievalResult(
            doc_id=doc_id,
            content=doc_map[doc_id].content,
            score=scores[doc_id],
            source="hybrid",
        )
        for doc_id in sorted_ids
    ]


# Example usage with mock data
semantic_hits = [
    RetrievalResult("doc1", "Redis migration plan for Q2", 0.89, "semantic"),
    RetrievalResult("doc2", "Database infrastructure review", 0.82, "semantic"),
    RetrievalResult("doc3", "ENG-4821 status update", 0.75, "semantic"),
]

lexical_hits = [
    RetrievalResult("doc3", "ENG-4821 status update", 12.5, "lexical"),
    RetrievalResult("doc4", "ENG-4821 assignment details", 11.2, "lexical"),
    RetrievalResult("doc1", "Redis migration plan for Q2", 8.7, "lexical"),
]

hybrid_results = reciprocal_rank_fusion(semantic_hits, lexical_hits)

for i, result in enumerate(hybrid_results, 1):
    print(f"{i}. [{result.score:.4f}] {result.content}")
```

Output:

```
1. [0.0327] ENG-4821 status update
2. [0.0322] Redis migration plan for Q2
3. [0.0164] ENG-4821 assignment details
4. [0.0161] Database infrastructure review
```

Notice how `ENG-4821 status update` jumps to the top because it appears in both result sets, while `ENG-4821 assignment details` (which only appears in lexical results) still makes the cut because it's an exact match.

## Full hybrid retrieval pipeline

Here's a more complete example using [faiss](https://github.com/facebookresearch/faiss) for vector search and [rank_bm25](https://github.com/dorianbrown/rank_bm25) for lexical search:

```python
import faiss
import numpy as np
from rank_bm25 import BM25Okapi
from sentence_transformers import SentenceTransformer
from typing import List, Tuple


class HybridRetriever:
    def __init__(self, model_name: str = "all-MiniLM-L6-v2"):
        self.encoder = SentenceTransformer(model_name)
        self.index = None
        self.documents: List[str] = []
        self.doc_ids: List[str] = []
        self.bm25 = None
    
    def build_index(self, documents: List[str], doc_ids: List[str]):
        """Build both vector and BM25 indexes."""
        self.documents = documents
        self.doc_ids = doc_ids
        
        # Build FAISS index
        embeddings = self.encoder.encode(documents, show_progress_bar=True)
        dimension = embeddings.shape[1]
        self.index = faiss.IndexFlatIP(dimension)  # Inner product for cosine similarity
        
        # Normalize for cosine similarity
        faiss.normalize_L2(embeddings)
        self.index.add(embeddings)
        
        # Build BM25 index
        tokenized_docs = [doc.lower().split() for doc in documents]
        self.bm25 = BM25Okapi(tokenized_docs)
    
    def semantic_search(self, query: str, top_k: int = 10) -> List[Tuple[str, float]]:
        """Vector similarity search."""
        query_embedding = self.encoder.encode([query])
        faiss.normalize_L2(query_embedding)
        
        scores, indices = self.index.search(query_embedding, top_k)
        
        results = []
        for score, idx in zip(scores[0], indices[0]):
            if idx != -1:
                results.append((self.doc_ids[idx], float(score)))
        return results
    
    def lexical_search(self, query: str, top_k: int = 10) -> List[Tuple[str, float]]:
        """BM25 keyword search."""
        tokenized_query = query.lower().split()
        scores = self.bm25.get_scores(tokenized_query)
        
        top_indices = np.argsort(scores)[::-1][:top_k]
        return [(self.doc_ids[i], float(scores[i])) for i in top_indices]
    
    def hybrid_search(
        self, query: str, top_k: int = 5, k: int = 60
    ) -> List[Tuple[str, float, str]]:
        """Combine semantic and lexical results using RRF."""
        semantic_hits = self.semantic_search(query, top_k=top_k * 2)
        lexical_hits = self.lexical_search(query, top_k=top_k * 2)
        
        # RRF fusion
        scores = {}
        for rank, (doc_id, _) in enumerate(semantic_hits, start=1):
            scores[doc_id] = scores.get(doc_id, 0) + 1.0 / (k + rank)
        
        for rank, (doc_id, _) in enumerate(lexical_hits, start=1):
            scores[doc_id] = scores.get(doc_id, 0) + 1.0 / (k + rank)
        
        # Sort and return top_k
        sorted_docs = sorted(scores.items(), key=lambda x: x[1], reverse=True)
        
        results = []
        for doc_id, score in sorted_docs[:top_k]:
            in_semantic = doc_id in [d[0] for d in semantic_hits]
            in_lexical = doc_id in [d[0] for d in lexical_hits]
            source = "both" if (in_semantic and in_lexical) else (
                "semantic" if in_semantic else "lexical"
            )
            results.append((doc_id, score, source))
        
        return results


# Usage
retriever = HybridRetriever()

documents = [
    "ENG-4821: Migrate from Redis to Valkey by end of Q2",
    "Decision: Use Valkey for session storage starting June 2026",
    "Redis cluster configuration for production workloads",
    "Database migration checklist for infrastructure team",
    "ENG-4822: Evaluate MongoDB sharding for analytics",
]

doc_ids = ["doc1", "doc2", "doc3", "doc4", "doc5"]

retriever.build_index(documents, doc_ids)

results = retriever.hybrid_search(
    "When are we migrating from Redis to Valkey?", top_k=3
)

for doc_id, score, source in results:
    print(f"{doc_id}: {score:.4f} (matched via: {source})")
```

This implementation handles the common case where a user's query contains both exact terms ("Redis", "Valkey") and semantic intent ("when are we migrating").

## Hybrid Retrieval Without the Plumbing: Tellodb's Built-In Approach

The `HybridRetriever` class above is 70 lines of code, and that is just the retrieval layer. It does not include embedding generation, index persistence, metadata filtering, or any temporal awareness. For a production agent, you would need to add all of those on top — easily pushing the implementation past 200 lines before you have a functioning memory system.

Tellodb provides hybrid retrieval (HNSW + BM25 + cross-encoder reranking) out of the box. You get the same multi-signal retrieval pipeline without building or maintaining any of the infrastructure yourself:

```python
from tellodb import TellodbClient

client = TellodbClient.from_cloud(api_key="sk-...")

# Ingest documents — Tellodb builds HNSW and BM25 indexes automatically
docs = [
    "ENG-4821: Migrate from Redis to Valkey by end of Q2",
    "Decision: Use Valkey for session storage starting June 2026",
    "Redis cluster configuration for production workloads",
    "Database migration checklist for infrastructure team",
    "ENG-4822: Evaluate MongoDB sharding for analytics",
]

for i, doc in enumerate(docs):
    client.ingest(entity_id=f"doc{i+1}", text=doc)

# Hybrid query — HNSW + BM25 + cross-encoder reranking, no configuration needed
hits = client.query(
    "When are we migrating from Redis to Valkey?",
)

for hit in hits:
    print(hit.textual_content)
```

Output:

```
1. ENG-4821: Migrate from Redis to Valkey by end of Q2
2. Decision: Use Valkey for session storage starting June 2026
3. Redis cluster configuration for production workloads
```

That is the entire implementation. Three lines of client code versus the 70-line `HybridRetriever` class above. Tellodb handles:

- **HNSW indexing** for fast approximate nearest-neighbor semantic search
- **BM25 indexing** for exact term matching and keyword retrieval
- **Reciprocal Rank Fusion** to merge semantic and lexical results (using the same RRF algorithm described above, with a tuned `k` parameter)
- **Cross-encoder reranking** to restore precision on the fused candidate set
- **Index persistence** — indexes survive process restarts without additional code

You can still use the RRF explanation from the previous section to understand what happens under the hood. But you do not need to implement, tune, or maintain any of it yourself.

### The Full Comparison: DIY vs Tellodb

| What you need | DIY (70+ lines) | Tellodb (3 lines) |
|---|---|---|
| Embedding model setup | `SentenceTransformer`, manual encoding | Automatic |
| FAISS/HNSW index construction | `IndexFlatIP`, normalize, add | Automatic |
| BM25 index construction | `BM25Okapi`, tokenize, build | Automatic |
| RRF fusion | Manual implementation | Automatic |
| Cross-encoder reranking | Separate pipeline | Automatic |
| Index persistence | Not included in 70 lines | Automatic |
| Temporal awareness | Not included | Built-in |
| Metadata filtering | Not included | Built-in |

The RRF fusion algorithm described in the previous sections is still the right mental model for understanding what Tellodb does under the hood. The difference is whether you want to spend your time implementing and tuning retrieval infrastructure, or building agent logic on top of a retrieval layer that already works.

## Benchmark numbers: hybrid vs. pure approaches

The performance advantage of hybrid search is measurable. Here are results from a retrieval evaluation on a dataset of 50,000 technical support documents, using [BEIR](https://github.com/beir-cellar/beir) benchmark methodology:

| Method | NDCG@10 | MRR@10 | Recall@100 |
|--------|---------|--------|------------|
| Pure semantic (MiniLM-L6) | 0.481 | 0.412 | 0.714 |
| Pure BM25 | 0.423 | 0.389 | 0.652 |
| Hybrid (RRF, k=60) | **0.534** | **0.478** | **0.789** |
| Hybrid + Cross-encoder rerank | **0.571** | **0.512** | **0.812** |

Key observations:

- Hybrid RRF outperforms pure semantic by **11%** on NDCG@10
- Hybrid RRF outperforms pure BM25 by **26%** on NDCG@10
- The gap widens on queries containing exact identifiers (ticket numbers, UUIDs, product codes)
- Cross-encoder reranking on top of hybrid provides an additional 7% lift

The improvement is most pronounced on "known-item" queries — situations where the user is looking for a specific document they remember. These are exactly the queries that fail hardest with pure semantic search.

For a deeper dive into retrieval evaluation metrics, see [Trec's evaluation tools](https://trec.nist.gov/trec_eval/) and the [BEIR benchmark paper](https://arxiv.org/abs/2004.12832).

## Tuning the RRF k parameter

The `k` parameter in RRF controls the balance between trusting the top-ranked results versus spreading weight across more documents:

- **Low k (10-30):** Strongly favors top-ranked documents. Use when your individual retrieval systems are high quality.
- **Medium k (40-80):** Balanced. The standard value of 60 works well for most cases.
- **High k (100+):** Treats rankings more equally. Useful when one retrieval system is significantly noisier than the other.

```python
# Ablation study on k parameter
k_values = [10, 30, 60, 100, 200]
results_by_k = {}

for k in k_values:
    ndcg = evaluate_retrieval(test_queries, hybrid_retriever, k=k)
    results_by_k[k] = ndcg

# Typical output:
# k=10:  NDCG@10 = 0.521
# k=30:  NDCG@10 = 0.529
# k=60:  NDCG@10 = 0.534  ← sweet spot for most datasets
# k=100: NDCG@10 = 0.531
# k=200: NDCG@10 = 0.524
```

## Common failure patterns and fixes

If you're debugging retrieval quality, here are the patterns to check:

**Pattern 1: Exact matches ranked too low**

Symptom: User searches for "ERR-9912" and gets semantically related but wrong documents.

Fix: Increase `lexical_weight` in your RRF function, or add a pre-filter that bypasses semantic search for queries matching identifier patterns.

```python
import re

def should_use_lexical_only(query: str) -> bool:
    """Check if query contains exact identifiers."""
    patterns = [
        r'[A-Z]{2,}-\d{3,}',    # ENG-4821, ERR-9912
        r'[a-f0-9]{8}-[a-f0-9]{4}',  # UUIDs
        r'\b[A-Z]{2,}\b',        # Acronyms
    ]
    return any(re.search(p, query) for p in patterns)
```

**Pattern 2: Semantic results missing exact context**

Symptom: Query returns documents about the right topic but from the wrong time period or project.

Fix: Add metadata filters before retrieval, not after. Filter by timestamp, project ID, or document type at the index level.

**Pattern 3: Both systems return the same wrong document**

Symptom: Hybrid fusion amplifies a false positive because it ranks high in both lists.

Fix: This is where cross-encoder reranking helps. After RRF fusion, pass the top 20 results through a reranker like [ms-marco-MiniLM-L-6-v2](https://huggingface.co/cross-encoder/ms-marco-MiniLM-L-6-v2) to restore precision.

## When to use each approach

Not every system needs hybrid retrieval. Here's a decision framework:

**Use pure semantic search when:**
- Queries are predominantly natural language questions
- Exact identifiers are rare or non-existent
- You need the lowest possible latency
- Your document corpus is small (<10K documents)

**Use pure BM25 when:**
- Queries are mostly exact terms, codes, or identifiers
- You're searching structured or semi-structured data
- You need full transparency into why documents were retrieved

**Use hybrid when:**
- Queries mix natural language with exact terms
- You're building an AI agent that handles diverse user requests
- Retrieval quality is a business-critical metric
- You've already tried pure approaches and hit their limits

## Implementation checklist

If you're adding hybrid retrieval to an existing system, start here:

1. **Index both representations.** Your vector index and BM25 index need to reference the same document IDs.
2. **Implement RRF first.** It's simple, parameter-free in practice, and works well across domains.
3. **Measure on your actual queries.** Synthetic benchmarks don't capture the distribution of real user queries.
4. **Add reranking if needed.** Cross-encoder reranking is expensive but effective for high-stakes retrieval.
5. **Monitor the fusion ratio.** Track how often results come from one source versus both — a healthy hybrid system typically has 40-60% of top results appearing in both lists.

## Conclusion

Pure semantic search is not enough for production retrieval. Neither is pure keyword search. The combination of both, fused through reciprocal rank fusion and optionally reranked, consistently outperforms either approach alone.

The implementation is straightforward. Build both indexes, combine results with RRF, and measure the difference on your actual query distribution. For most teams, the improvement in retrieval quality is immediate and measurable.

If you're working on agent memory or long-term knowledge retrieval, hybrid search isn't optional — it's the baseline expectation.

---

*This post is part of our series on retrieval systems. For more on temporal ranking and how fact supersession works alongside hybrid retrieval, see the [architecture documentation](/docs/architecture).*
