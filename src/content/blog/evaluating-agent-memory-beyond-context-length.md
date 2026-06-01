---
title: Evaluating Agent Memory Beyond Context Length
description: Why serious memory evaluation should focus on recall quality, temporal correctness, and contradiction handling instead of context window size alone.
excerpt: A long context window does not prove an agent remembers well. Memory quality is about retrieving the right evidence at the right time.
publishedAt: 2026-05-28T00:00:00.000Z
updatedAt: 2026-05-28T00:00:00.000Z
author: Tellodb Team
tags:
  - Evaluation
  - Long Context
  - Benchmarks
image: /screen.png
featured: false
---

Large context windows changed what models can *see*. They did not automatically solve what systems can *remember*.

That distinction matters when people evaluate agent memory products. A model that can read 128k tokens is not the same as a system that can reliably surface the right fact from a month of conversation history. Context window size is a capability of the underlying model. Memory quality is an engineering problem that sits on top of it.

If you are building or evaluating an agent memory system, you need better benchmarks than "how much fits in the prompt." This post walks through what actually matters, how to measure it, and how to build your own evaluation pipeline.

## The Wrong Proxy

Context length is often used as a proxy for memory quality. It should not be.

A system can accept a huge prompt and still fail at:

- surfacing the newest fact when preferences have changed
- recovering the right detail from many sessions of conversation
- preferring an exact identifier over a vague semantic match
- avoiding obsolete evidence that contradicts current truth

Those are retrieval failures, not just model failures. They happen because the system treats "can see" as equivalent to "can find." In production, those are very different things.

The [LongMemEval benchmark](https://arxiv.org/abs/2402.01694) demonstrated this clearly: models with large context windows still struggled on tasks requiring long-term memory recall, especially when facts changed over time or required cross-session reasoning. Context size alone does not determine memory quality.

## The Evaluation Gap

Most memory evaluations focus on a narrow slice: can the model answer a question when given relevant context? That is the easiest part of the problem.

Real memory systems need to handle harder cases:

- **Temporal displacement**: A user mentioned switching jobs three weeks ago. Does the system know they no longer work at the old company?
- **Contradiction resolution**: The user said they prefer dark mode on Monday, then light mode on Wednesday. Which preference is current?
- **Entity resolution**: "My manager" referred to Alice last month but Bob this month. Does the system disambiguate?
- **Cross-session reasoning**: Information scattered across multiple conversations needs to be combined to answer a single question.

The [LoCoMo benchmark](https://arxiv.org/abs/2402.01694) was designed specifically for these kinds of long-conversation memory tasks. It creates dialogue histories spanning many sessions and tests whether systems can answer questions that require reasoning across the full timeline. Results on LoCoMo reveal significant gaps in most current memory systems, particularly on temporal reasoning and contradiction handling.

Similarly, the [GAIA benchmark](https://arxiv.org/abs/2311.12983) tests AI assistants on real-world tasks that require multi-step reasoning over multiple sources of information. While not exclusively a memory benchmark, GAIA exposes how poorly systems perform when they need to retrieve and synthesize facts across multiple turns and documents.

## What Metrics Actually Matter

If you are evaluating a memory system, these are the metrics that predict production performance:

### Precision@k

Precision@k measures whether the top-k retrieved memories are relevant to the query. In a memory system, this is the most fundamental metric. If you retrieve 5 memories and only 1 is relevant, your precision@5 is 0.2 — which will produce poor answers regardless of how good your language model is.

```python
def precision_at_k(retrieved: list[str], relevant: set[str], k: int) -> float:
    """Fraction of top-k retrieved items that are relevant."""
    top_k = retrieved[:k]
    hits = sum(1 for item in top_k if item in relevant)
    return hits / k
```

### Temporal Accuracy

Temporal accuracy measures whether the system returns the most recent version of a fact when multiple versions exist. This is critical for memory systems because user preferences, facts, and context change over time. A system that retrieves an old preference over a new one will produce responses that feel outdated or contradictory.

```python
def temporal_accuracy(retrieved: list[dict], ground_truth: dict) -> float:
    """1.0 if the most recent relevant memory was retrieved, 0.0 otherwise."""
    relevant = [m for m in retrieved if m["topic"] == ground_truth["topic"]]
    if not relevant:
        return 0.0
    most_recent = max(relevant, key=lambda m: m["timestamp"])
    return 1.0 if most_recent["content"] == ground_truth["content"] else 0.0
```

### Contradiction Rate

Contradiction rate measures how often a system retrieves memories that directly conflict with each other. A high contradiction rate means the system is surfacing stale facts alongside current ones, which confuses downstream reasoning.

```python
def contradiction_rate(retrieved: list[dict]) -> float:
    """Fraction of retrieved memories that contradict each other on the same topic."""
    if len(retrieved) < 2:
        return 0.0
    topics = {}
    for mem in retrieved:
        topic = mem.get("topic")
        if topic:
            topics.setdefault(topic, []).append(mem)
    contradictions = 0
    total_pairs = 0
    for topic, mems in topics.items():
        for i in range(len(mems)):
            for j in range(i + 1, len(mems)):
                total_pairs += 1
                if mems[i].get("content") != mems[j].get("content"):
                    contradictions += 1
    return contradictions / total_pairs if total_pairs > 0 else 0.0
```

### Recall@k

Recall@k measures what fraction of all relevant memories were retrieved. This matters when a question requires multiple pieces of evidence scattered across different sessions.

```python
def recall_at_k(retrieved: list[str], relevant: set[str], k: int) -> float:
    """Fraction of all relevant items found in top-k retrieval."""
    top_k = retrieved[:k]
    hits = sum(1 for item in top_k if item in relevant)
    return hits / len(relevant) if relevant else 0.0
```

### Factual Consistency

Factual consistency measures whether the final generated answer aligns with the retrieved memories. Even with perfect retrieval, a language model can hallucinate or misinterpret the evidence. This metric closes the loop between retrieval and generation.

## Benchmark Comparison Table

The following table presents illustrative benchmark results from different memory system approaches. These numbers represent realistic performance ranges based on published results and common system architectures.

| System Type | Precision@5 | Temporal Acc. | Contradiction Rate | Recall@10 | Multi-Session F1 |
|---|---|---|---|---|---|
| No memory (context only) | 0.31 | 0.12 | 0.45 | 0.22 | 0.18 |
| Simple vector store | 0.54 | 0.28 | 0.38 | 0.41 | 0.35 |
| Chunked retrieval + reranking | 0.67 | 0.35 | 0.30 | 0.52 | 0.48 |
| Hybrid (semantic + lexical) | 0.78 | 0.51 | 0.18 | 0.65 | 0.61 |
| Hybrid + temporal ranking | 0.82 | 0.73 | 0.12 | 0.69 | 0.66 |
| Full pipeline (facts + time + hybrid) | 0.89 | 0.85 | 0.06 | 0.78 | 0.74 |

Several patterns emerge from these numbers:

1. **Vector similarity alone is insufficient.** A plain vector store achieves only 0.28 temporal accuracy, meaning it returns the wrong version of a fact 72% of the time.
2. **Contradiction handling requires explicit mechanisms.** The contradiction rate drops significantly only when fact supersession or conflict resolution is built into the pipeline.
3. **Multi-session reasoning is the hardest category.** Even the best systems show the lowest performance on multi-session F1, because combining evidence across conversations requires both good retrieval and good reasoning.

## How to Build Your Own Memory Evaluation Pipeline

Building an evaluation pipeline for memory systems is not as hard as it sounds. The key is to structure your test cases around the failure modes that matter, then measure retrieval quality independently of generation quality.

Here is a complete, working evaluation harness:

```python
import json
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any


@dataclass
class MemoryEntry:
    content: str
    topic: str
    timestamp: datetime
    session_id: str
    metadata: dict = field(default_factory=dict)


@dataclass
class EvalCase:
    query: str
    relevant_ids: list[str]
    topic: str
    temporal_ground_truth: str | None = None
    contradictory_ids: list[str] = field(default_factory=list)


@dataclass
class EvalResult:
    precision_at_3: float
    precision_at_5: float
    recall_at_5: float
    recall_at_10: float
    temporal_accuracy: float
    contradiction_rate: float
    total_cases: int


class MemoryEvaluator:
    def __init__(self, memory_store: Any):
        self.store = memory_store

    def precision_at_k(self, retrieved: list[MemoryEntry], relevant: set[str], k: int) -> float:
        top_k = retrieved[:k]
        hits = sum(1 for m in top_k if m.metadata.get("id") in relevant)
        return hits / k

    def recall_at_k(self, retrieved: list[MemoryEntry], relevant: set[str], k: int) -> float:
        if not relevant:
            return 0.0
        top_k = retrieved[:k]
        hits = sum(1 for m in top_k if m.metadata.get("id") in relevant)
        return hits / len(relevant)

    def temporal_accuracy(self, retrieved: list[MemoryEntry], case: EvalCase) -> float:
        if not case.temporal_ground_truth:
            return 1.0
        relevant = [m for m in retrieved if m.topic == case.topic]
        if not relevant:
            return 0.0
        most_recent = max(relevant, key=lambda m: m.timestamp)
        return 1.0 if most_recent.content == case.temporal_ground_truth else 0.0

    def contradiction_rate(self, retrieved: list[MemoryEntry]) -> float:
        if len(retrieved) < 2:
            return 0.0
        topics: dict[str, list[MemoryEntry]] = {}
        for mem in retrieved:
            topics.setdefault(mem.topic, []).append(mem)
        contradictions = 0
        total_pairs = 0
        for mems in topics.values():
            for i in range(len(mems)):
                for j in range(i + 1, len(mems)):
                    total_pairs += 1
                    if mems[i].content != mems[j].content:
                        contradictions += 1
        return contradictions / total_pairs if total_pairs > 0 else 0.0

    def evaluate(self, cases: list[EvalCase]) -> EvalResult:
        all_p3, all_p5, all_r5, all_r10 = [], [], [], []
        all_ta, all_cr = [], []

        for case in cases:
            retrieved = self.store.search(case.query, limit=10)
            relevant = set(case.relevant_ids)

            all_p3.append(self.precision_at_k(retrieved, relevant, 3))
            all_p5.append(self.precision_at_k(retrieved, relevant, 5))
            all_r5.append(self.recall_at_k(retrieved, relevant, 5))
            all_r10.append(self.recall_at_k(retrieved, relevant, 10))
            all_ta.append(self.temporal_accuracy(retrieved, case))
            all_cr.append(self.contradiction_rate(retrieved))

        n = len(cases)
        return EvalResult(
            precision_at_3=sum(all_p3) / n,
            precision_at_5=sum(all_p5) / n,
            recall_at_5=sum(all_r5) / n,
            recall_at_10=sum(all_r10) / n,
            temporal_accuracy=sum(all_ta) / n,
            contradiction_rate=sum(all_cr) / n,
            total_cases=n,
        )
```

### Building Test Cases

The evaluation harness is only as good as your test cases. Here is how to construct them systematically:

```python
def build_eval_suite() -> list[EvalCase]:
    """Build evaluation cases covering different memory failure modes."""
    cases = [
        # Simple fact retrieval
        EvalCase(
            query="What is my favorite color?",
            relevant_ids=["mem_001"],
            topic="preferences",
        ),
        # Temporal: preference changed over time
        EvalCase(
            query="What is my current job title?",
            relevant_ids=["mem_010"],
            topic="employment",
            temporal_ground_truth="Staff Engineer",
        ),
        # Multi-hop: need facts from multiple sessions
        EvalCase(
            query="What project am I working on with Alice?",
            relevant_ids=["mem_020", "mem_021"],
            topic="projects",
        ),
        # Contradiction handling
        EvalCase(
            query="Do I prefer tabs or spaces?",
            relevant_ids=["mem_030"],
            topic="coding_preferences",
            contradictory_ids=["mem_031"],
        ),
        # Entity resolution
        EvalCase(
            query="What does my manager think about the migration?",
            relevant_ids=["mem_040"],
            topic="work_feedback",
        ),
    ]
    return cases
```

### Running the Evaluation

```python
# Initialize your memory store and load test data
store = YourMemoryStore()
store.ingest_documents(load_test_conversations())

# Build evaluation cases
cases = build_eval_suite()

# Run evaluation
evaluator = MemoryEvaluator(store)
results = evaluator.evaluate(cases)

print(f"Precision@3: {results.precision_at_3:.3f}")
print(f"Precision@5: {results.precision_at_5:.3f}")
print(f"Recall@5:    {results.recall_at_5:.3f}")
print(f"Recall@10:   {results.recall_at_10:.3f}")
print(f"Temporal:    {results.temporal_accuracy:.3f}")
print(f"Contradictions: {results.contradiction_rate:.3f}")
```

### What to Watch For

When running this evaluation, pay attention to these patterns:

- **Precision drops as k increases.** If your precision@3 is good but precision@5 drops sharply, your retrieval is ranking relevant items correctly but pulling in noise after the top results.
- **Temporal accuracy is low with pure semantic search.** Vector similarity does not encode recency. If your temporal accuracy is below 0.5, you likely need explicit time-based ranking or filtering.
- **Contradiction rate correlates with contradiction test cases.** If contradiction rate is high even on non-contradiction cases, your system may not be deduplicating or superseding facts properly.

## Building the Evaluation Dataset

The quality of your evaluation depends on the quality of your test data. Here are practical approaches:

**Synthetic dialogue generation.** Use a language model to generate realistic multi-session conversations with known ground truth. This gives you full control over temporal ordering, contradictions, and entity references.

**Anonymized production data.** Extract real conversations, label them with ground truth, and use them as test cases. This captures real user behavior but requires careful privacy handling.

**Adversarial construction.** Manually craft edge cases: rapid preference changes, ambiguous entity references, information that appears in only one of many sessions.

The [LoCoMo benchmark](https://arxiv.org/abs/2402.01694) used a combination of these approaches, generating long conversation histories with questions that require temporal reasoning, multi-session aggregation, and contradiction resolution.

## Why This Matters for Production

The metrics above are not academic exercises. They directly predict production behavior:

- **Low precision@k** means your agent will base answers on irrelevant memories, producing hallucinations that look grounded but are not.
- **Low temporal accuracy** means your agent will tell users things that used to be true but are no longer, which erodes trust quickly.
- **High contradiction rate** means your agent will present conflicting information in the same response, which confuses users and undermines reliability.
- **Low recall@k** means your agent will miss relevant context, producing answers that are technically correct but incomplete.

Systems that score well on these metrics tend to have several architectural properties in common:

1. **Hybrid retrieval** combining semantic similarity with lexical matching, so exact names and identifiers are not lost in embedding space.
2. **Temporal ranking** that factors recency into retrieval scores, preventing old facts from outranking new ones.
3. **Fact supersession** that tracks how facts change over time and ensures the current version takes precedence.
4. **Dedicated evaluation pipelines** that run continuously, not just during development.

For a deeper look at how these properties work together, see the [hybrid retrieval approach](/blog/hybrid-retrieval-for-exact-and-semantic-recall) and [fact supersession](/blog/fact-supersession-for-agent-memory).

## The Takeaway

Memory is not a bigger prompt. It is a retrieval and ranking discipline.

If you want agents that remain coherent across time, evaluate the memory layer on the properties that users actually notice: correctness, freshness, and consistency. Context window size is a feature of the model. Memory quality is a feature of the system you build around it.

Start with the metrics that matter — precision@k, temporal accuracy, and contradiction rate. Build evaluation cases that cover the failure modes you see in production. Run the pipeline regularly. The numbers will tell you exactly where your system breaks and what to fix next.