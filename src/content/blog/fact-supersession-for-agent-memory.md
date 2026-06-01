---
title: How to Handle Contradicting Facts in AI Agent Memory
description: A practical guide to implementing fact supersession — the mechanism that stops AI agents from giving contradictory answers about the same user.
excerpt: Your agent told a user they live in Miami, then cited their NYC address in the same conversation. Fact supersession is the retrieval-layer mechanism that prevents this.
publishedAt: 2026-05-28T00:00:00.000Z
updatedAt: 2026-05-28T00:00:00.000Z
author: Tellodb Team
tags:
  - Fact Supersession
  - Agent Memory
  - Retrieval Quality
  - Belief Revision
image: /screen.png
featured: true
---

## The contradiction problem in agent memory

Your AI agent has a memory. It stores facts about users: names, locations, preferences, account statuses. Over time, those facts change. A user moves from New York to Miami. A customer switches from Stripe to Adyen. A lead moves from "interested" to "qualified" to "churned."

If your memory system stores every fact and retrieves them without understanding which ones are current, your agent will eventually do something embarrassing: present contradicting facts side by side in the same response. Or worse, confidently state the outdated one because it had slightly better lexical overlap with the user's query.

This is not a rare edge case. It is the default behavior of any memory system that treats facts as append-only logs without a supersession mechanism. This post walks through how to fix it.

## A concrete scenario: NYC to Miami

Let's trace a real example step by step so the problem is concrete.

**January 15** — User tells the agent: *"I live in New York City."*

The agent stores this as a fact:

```python
fact_nyc = {
    "content": "User lives in New York City",
    "source": "user_statement",
    "timestamp": "2026-01-15T10:00:00Z",
    "status": "active",
    "superseded_by": None
}
```

**March 20** — User tells the agent: *"I moved to Miami last month."*

Here is where the naive system breaks. Without supersession, the agent now has two facts that both appear true:

```python
fact_miami = {
    "content": "User lives in Miami",
    "source": "user_statement",
    "timestamp": "2026-03-20T14:00:00Z",
    "status": "active",
    "superseded_by": None
}
```

Both facts are marked `"status": "active"`. When the agent retrieves facts to answer *"Where does the user live?"*, it might return both. Or it might return only the NYC fact if the retrieval system favors older, more established entries. Either way, the agent now has a problem: it does not know which fact is true.

**April 5** — User asks: *"Can you find me a dentist near me?"*

Without supersession, the agent might search for dentists in NYC — citing the older, outdated fact. The user is frustrated. The agent looks incompetent.

With supersession, the system marks the NYC fact as replaced by the Miami fact at the moment the second statement arrives. The retrieval layer then knows to prefer the Miami fact for any present-tense query.

## What fact supersession actually is

Fact supersession is a retrieval-layer mechanism that links two facts with a directional relationship: one fact has *replaced* another. It is not deletion. The old fact still exists in storage. But the system now understands that, for current-state queries, the new fact takes precedence.

This draws from a long tradition in knowledge representation. The AI research community has studied belief revision since the 1980s. [AGM theory](https://en.wikipedia.org/wiki/AGM_theory) (named after Alchourrón, Gärdenfors, and Makinson) formalized how rational agents should retract beliefs when new information contradicts them. Fact supersession is the practical, applied version of that problem for LLM-powered agents.

The key distinction from simple "overwrite" logic: supersession preserves history. You can still answer *"Where did the user live before Miami?"* because the NYC fact exists — it is just marked as superseded.

## When to supersede vs. when to keep both facts

Not every new fact replaces an old one. A decision tree helps clarify the logic:

```
New fact arrives that contradicts an existing fact
│
├── Is the contradiction about the SAME attribute?
│   ├── YES → Does the new fact represent a temporal update?
│   │   ├── YES (user moved, status changed) → SUPEREDE the old fact
│   │   └── NO (conflicting opinions, ambiguous info) → KEEP BOTH, flag for disambiguation
│   └── NO (different attributes entirely) → KEEP BOTH (no conflict)
│
├── Does the user explicitly state the old info is wrong?
│   ├── YES → SUPEREDE the old fact
│   └── NO → Is the new fact more recent and more specific?
│       ├── YES → SUPEREDE with confidence score
│       └── NO → KEEP BOTH, let retrieval rank by relevance
```

The critical question is whether the new fact represents a **temporal update** to the same attribute. "I live in NYC" and "I live in Miami" are about the same attribute (location) at different points in time. That is a clear supersession candidate. "I live in NYC" and "I prefer Italian food" are not in conflict — they describe different attributes.

## Implementing fact supersession in Python

Here is a minimal but complete implementation of a fact supersession system. This demonstrates the core data model and the logic for detecting and applying supersession.

```python
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional


@dataclass
class Fact:
    content: str
    attribute: str  # e.g., "location", "payment_provider", "plan"
    timestamp: datetime
    source: str = "user_statement"
    status: str = "active"  # "active" or "superseded"
    superseded_by: Optional[str] = None  # id of the replacing fact


class FactStore:
    def __init__(self):
        self.facts: dict[str, Fact] = {}
        self._counter = 0

    def _next_id(self) -> str:
        self._counter += 1
        return f"fact_{self._counter}"

    def add_fact(self, content: str, attribute: str, timestamp: datetime, source: str = "user_statement") -> str:
        new_id = self._next_id()
        new_fact = Fact(
            content=content,
            attribute=attribute,
            timestamp=timestamp,
            source=source,
        )

        # Check for existing active facts on the same attribute
        for existing_id, existing_fact in self.facts.items():
            if (
                existing_fact.attribute == attribute
                and existing_fact.status == "active"
                and self._is_temporal_update(existing_fact, new_fact)
            ):
                existing_fact.status = "superseded"
                existing_fact.superseded_by = new_id

        self.facts[new_id] = new_fact
        return new_id

    def _is_temporal_update(self, old: Fact, new: Fact) -> bool:
        """Determine if new fact is a temporal update to the same attribute."""
        # Same attribute, newer timestamp, different content
        return (
            old.attribute == new.attribute
            and new.timestamp > old.timestamp
            and old.content.lower() != new.content.lower()
        )

    def get_current_facts(self, attribute: Optional[str] = None) -> list[Fact]:
        """Retrieve only active (non-superseded) facts."""
        results = []
        for fact in self.facts.values():
            if fact.status != "active":
                continue
            if attribute and fact.attribute != attribute:
                continue
            results.append(fact)
        return results

    def get_fact_history(self, attribute: str) -> list[Fact]:
        """Retrieve all facts for an attribute, ordered by timestamp."""
        facts = [f for f in self.facts.values() if f.attribute == attribute]
        return sorted(facts, key=lambda f: f.timestamp)

    def get_superseded_facts(self) -> list[Fact]:
        """Retrieve all facts that have been replaced."""
        return [f for f in self.facts.values() if f.status == "superseded"]
```

Now let's walk through the NYC-to-Miami scenario with this code:

```python
store = FactStore()

# January 15 — user says they live in NYC
jan_id = store.add_fact(
    content="User lives in New York City",
    attribute="location",
    timestamp=datetime(2026, 1, 15, 10, 0, 0),
)

# March 20 — user says they moved to Miami
mar_id = store.add_fact(
    content="User lives in Miami",
    attribute="location",
    timestamp=datetime(2026, 3, 20, 14, 0, 0),
)

# Check what the agent sees for a present-tense query
current = store.get_current_facts(attribute="location")
print([f.content for f in current])
# Output: ['User lives in Miami']
# The NYC fact is still in storage, but not shown for current queries.

# Check the full history
history = store.get_fact_history(attribute="location")
for fact in history:
    print(f"{fact.timestamp.date()} | {fact.status} | {fact.content}")
# Output:
# 2026-01-15 | superseded | User lives in New York City
# 2026-03-20 | active | User lives in Miami
```

The NYC fact is not deleted. It is still available if someone asks *"Where did the user live before Miami?"* But for present-tense retrieval, only the Miami fact surfaces.

## Retrieval behavior after supersession

The retrieval policy matters as much as the data model. Here is how a retrieval layer should handle superseded facts:

```python
def retrieve_facts(
    store: FactStore,
    query: str,
    intent: str = "current",  # "current" or "historical"
    attribute_hint: Optional[str] = None,
) -> list[Fact]:
    """
    Retrieve facts based on query intent.

    intent="current" → only active facts (suppressed superseded)
    intent="historical" → all facts including superseded ones
    """
    if intent == "historical":
        # For historical queries, return full history
        if attribute_hint:
            return store.get_fact_history(attribute_hint)
        return list(store.facts.values())

    # For current queries, return only active facts
    return store.get_current_facts(attribute=attribute_hint)
```

This separation is the core insight: supersession does not destroy information. It gives the retrieval layer two modes. In "current" mode, it hides stale facts. In "historical" mode, it surfaces them. The model never has to reconcile contradictory facts because the retrieval layer already did that work.

## Why timestamps alone are not enough

A common first instinct is to just sort by timestamp and always return the most recent fact. This fails in practice for several reasons:

1. **Lexical overlap bias.** If the user asks "Where do I live in NYC?", the older NYC fact has stronger semantic overlap with the query, even though it is outdated. A simple timestamp sort does not prevent the retrieval system from preferring the older fact due to embedding similarity.

2. **Context window contamination.** If both facts end up in the same prompt, the model sees two competing claims. It might hedge ("You mentioned NYC earlier, but more recently Miami") instead of confidently stating the current fact.

3. **No concept of "replaced."** Timestamp ordering tells you which fact is newer, but not *why* the older one should be ignored. Supersession creates an explicit link: fact A replaced fact B. That link can be encoded in the database schema, the retrieval ranking logic, and the prompt construction.

Temporal weighting helps, but explicit invalidation is what actually solves the problem.

## How this fits into the larger memory architecture

Fact supersession is one mechanism in a complete memory retrieval pipeline. It works alongside:

- **Temporal ranking** — applies freshness decay to all memories so newer facts naturally rank higher, even without explicit supersession.
- **Deterministic aggregation** — handles numeric queries (totals, counts, sums) where you need exact values, not just the most recent observation.
- **Memory kinds** — different fact types (preferences, episodes, summaries) interact with supersession rules differently. A preference might supersede, but an episode (a specific past event) typically should not.

The [memory kinds documentation](/docs/memory-kinds) explains how different fact types interact with supersession rules.

## When NOT to supersede

Supersession is not always the right tool. Keep both facts active when:

- **The facts are not about the same attribute.** "I live in Miami" and "I prefer dark mode" are not in conflict.
- **The facts represent parallel truths.** "I use Chrome at work" and "I use Firefox at home" are both true simultaneously.
- **The contradiction is ambiguous.** If the user says something that *might* conflict with an existing fact but it is unclear, flag it for disambiguation rather than automatically superseding. You can ask the user to clarify, or let the model handle the ambiguity at generation time.

The decision tree above helps codify this. The key question is: does the new fact represent a *change* to the same attribute, or is it orthogonal information?

## Building a more robust supersession detector

The simple `_is_temporal_update` method in the code above works for clear-cut cases. In production, you will want a more nuanced approach. Here is an example that uses embedding similarity to detect semantic overlap between facts:

```python
from sentence_transformers import SentenceTransformer
import numpy as np


class SemanticSupersessionDetector:
    def __init__(self, similarity_threshold: float = 0.75):
        self.model = SentenceTransformer("all-MiniLM-L6-v2")
        self.threshold = similarity_threshold

    def is_supersession_candidate(self, old_fact: Fact, new_fact: Fact) -> bool:
        """
        Detect if two facts are semantically about the same attribute,
        even if phrased differently.
        """
        # Quick attribute match first
        if old_fact.attribute != new_fact.attribute:
            return False

        # Must be newer
        if new_fact.timestamp <= old_fact.timestamp:
            return False

        # Check semantic similarity
        embeddings = self.model.encode([old_fact.content, new_fact.content])
        similarity = np.dot(embeddings[0], embeddings[1]) / (
            np.linalg.norm(embeddings[0]) * np.linalg.norm(embeddings[1])
        )

        return similarity >= self.threshold
```

This handles cases where the user phrases the same attribute differently: "I live in New York" vs. "I'm based in NYC" vs. "My address is in Manhattan." A simple string comparison would miss these, but semantic similarity catches them.

You can integrate this with the `FactStore` from earlier by replacing the `_is_temporal_update` method with a call to this detector. The threshold of 0.75 is a starting point — tune it based on your data.

## The takeaway

If your agent is meant to operate continuously over time, fact supersession should be part of your data model, not a post-processing trick or a prompt-engineering hack. The more a system interacts with the same user or account, the more important it becomes to distinguish between what *was* true and what *is* true.

The implementation is not complicated. Track facts with attributes and timestamps. When a new fact arrives for the same attribute, link the old fact to the new one as superseded. In your retrieval layer, suppress superseded facts for current-state queries. Preserve them for historical queries.

That is the difference between a memory system that understands change and one that just remembers strings.
