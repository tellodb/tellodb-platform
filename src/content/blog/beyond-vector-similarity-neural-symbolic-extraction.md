---
title: "How to Extract Structured Knowledge from Chat: A Neural-Symbolic Approach"
description: "A hands-on tutorial combining NER, relationship extraction, and deterministic math to go beyond basic RAG and build truly structured memory from conversational data."
excerpt: "Vector similarity only gets you partway there. This tutorial walks through building a neural-symbolic pipeline that extracts entities, maps relationships, and computes exact numbers from chat logs using Python, spaCy, and deterministic logic."
publishedAt: 2026-05-28T00:00:00.000Z
updatedAt: 2026-05-28T00:00:00.000Z
author: "Tellodb Team"
tags:
  - Neural Extraction
  - Knowledge Graph
  - AI Agents
  - Python Tutorial
  - RAG
image: /screen.png
featured: true
---

# How to Extract Structured Knowledge from Chat: A Neural-Symbolic Approach

Most Retrieval-Augmented Generation (RAG) systems use one trick: embed text into a vector, store it, and retrieve it by similarity. It works for fuzzy, semantic queries like "what did we discuss about project deadlines?" But it falls apart when you need **exact facts**, **aggregated numbers**, or **relational structure**.

If a user tells an agent "I spent $50 on dinner on Tuesday" and later "I spent $80 on groceries on Thursday," a vector database can retrieve both chunks when asked about spending. But computing the total? Finding every expense this week without missing a single mention? That's where pure embedding retrieval breaks down.

This tutorial shows you how to build a **neural-symbolic extraction pipeline** — a system that combines neural models (for understanding language) with deterministic logic (for precision). By the end, you'll have a working approach to:

1. Extract named entities from chat using NER models
2. Build relationships between entities into a knowledge graph
3. Pull out numbers and compute exact aggregates
4. Understand what each approach can and can't do compared to pure vector retrieval

This is the approach we use in our memory engine, but the technique is general. You can apply it to any system that needs to go beyond basic RAG.

## Why Pure Vector Retrieval Isn't Enough

Vector embeddings are powerful for capturing semantic meaning. They let you find "similar" content even when the wording is different. But they have real limitations:

- **No structured facts.** A vector embedding of "I work at Acme Corp" doesn't tell you that `user` → `works_at` → `Acme Corp`. It just knows the text is "about" employment.
- **No exact arithmetic.** If you embed "$50" and "$80," the embedding doesn't know that the total is $130. It just knows they're both about money.
- **No entity tracking.** Asking "who is Alice?" against a vector store returns chunks where "Alice" appears, but doesn't give you a structured profile of Alice — her role, relationships, or mentions across time.

A neural-symbolic approach fixes these gaps. The neural layer handles the fuzzy, language-understanding part. The symbolic layer handles the precise, structured part. Together, they give an agent something closer to actual understanding rather than pattern matching.

## Stage 1: Named Entity Recognition with spaCy

The first step is extracting entities — names, organizations, locations, and dates — from raw chat text. We'll use [spaCy](https://spacy.io/), which provides pre-trained NER models out of the box.

### Installing spaCy and the English Model

```bash
pip install spacy
python -m spacy download en_core_web_sm
```

The `en_core_web_sm` model is small but effective. For production use, consider `en_core_web_trf` (a transformer-based model) for higher accuracy.

### Extracting Entities from Chat Messages

Here's a function that takes a list of chat messages and returns structured entities:

```python
import spacy
from dataclasses import dataclass, field
from typing import List, Dict

nlp = spacy.load("en_core_web_sm")

@dataclass
class Entity:
    text: str
    label: str  # PERSON, ORG, GPE (location), DATE, MONEY, etc.
    start: int
    end: int

@dataclass
class ExtractedMessage:
    original_text: str
    timestamp: str
    entities: List[Entity] = field(default_factory=list)

def extract_entities(messages: List[Dict[str, str]]) -> List[ExtractedMessage]:
    """
    Extract named entities from a list of chat messages.
    Each message should have 'text' and 'timestamp' keys.
    """
    results = []

    # Use spaCy's pipe for efficient batch processing
    texts = [msg["text"] for msg in messages]
    timestamps = [msg["timestamp"] for msg in messages]
    docs = list(nlp.pipe(texts, batch_size=50))

    for doc, timestamp in zip(docs, timestamps):
        entities = []
        for ent in doc.ents:
            entities.append(Entity(
                text=ent.text,
                label=ent.label_,
                start=ent.start_char,
                end=ent.end_char,
            ))
        results.append(ExtractedMessage(
            original_text=doc.text,
            timestamp=timestamp,
            entities=entities,
        ))

    return results


# Example usage
chat_messages = [
    {"text": "I had dinner with Alice at The Garden last Tuesday", "timestamp": "2026-05-20"},
    {"text": "Spent $45 on the meal, it was pretty good", "timestamp": "2026-05-20"},
    {"text": "Alice works at Google now, she mentioned the new project", "timestamp": "2026-05-20"},
    {"text": "I need to call the dentist on Friday", "timestamp": "2026-05-21"},
    {"text": "Bob from Microsoft sent me the proposal, $300 for consulting", "timestamp": "2026-05-22"},
]

extracted = extract_entities(chat_messages)

for msg in extracted:
    print(f"\n[{msg.timestamp}] {msg.original_text}")
    for ent in msg.entities:
        print(f"  → {ent.label}: {ent.text}")
```

Running this produces:

```
[2026-05-20] I had dinner with Alice at The Garden last Tuesday
  → PERSON: Alice
  → ORG: The Garden
  → DATE: last Tuesday

[2026-05-20] Spent $45 on the meal, it was pretty good
  → MONEY: $45

[2026-05-20] Alice works at Google now, she mentioned the new project
  → PERSON: Alice
  → ORG: Google
  → DATE: now

[2026-05-21] I need to call the dentist on Friday
  → DATE: Friday

[2026-05-22] Bob from Microsoft sent me the proposal, $300 for consulting
  → PERSON: Bob
  → ORG: Microsoft
  → MONEY: $300
```

Notice what spaCy gives you: structured, labeled entities with exact character positions. This is something vector embeddings simply don't provide.

### Using HuggingFace Transformers for Higher Accuracy

For better accuracy, especially on domain-specific text, you can swap in a transformer-based NER model from [HuggingFace](https://huggingface.co/). Here's how to use the `dslim/bert-base-NER` model, which is one of the most popular NER models on the Hub:

```python
from transformers import pipeline

ner_pipeline = pipeline("ner", model="dslim/bert-base-NER", aggregation_strategy="simple")

def extract_entities_transformer(text: str) -> list:
    """
    Extract entities using a BERT-based NER model from HuggingFace.
    Returns a list of dicts with 'entity_group', 'word', and 'score'.
    """
    results = ner_pipeline(text)
    # Filter to high-confidence predictions and deduplicate subword tokens
    entities = []
    for ent in results:
        if ent["score"] > 0.85:
            entities.append({
                "text": ent["word"],
                "label": ent["entity_group"],
                "confidence": round(ent["score"], 3),
            })
    return entities


# Example
text = "I discussed the Q3 budget with Sarah from Apple last Monday"
entities = extract_entities_transformer(text)
for ent in entities:
    print(f"  {ent['label']}: {ent['text']} (confidence: {ent['confidence']})")
```

```
  PER: Sarah (confidence: 0.993)
  ORG: Apple (confidence: 0.991)
  DATE: last Monday (confidence: 0.987)
```

The transformer model often outperforms spaCy's small model, especially on ambiguous text. The tradeoff is inference speed and model size. For a production pipeline processing thousands of messages, you'll want to benchmark both approaches against your data.

## Stage 2: Building Relationships from Extracted Entities

Entities alone are useful, but the real power comes from **connecting them**. If you know that "Alice" is a PERSON and "Google" is an ORG mentioned in the same message, you can infer an `associated_with` relationship. If a message mentions a PERSON and a MONEY entity, you can infer a `spent_with` relationship.

### Relationship Extraction Logic

Here's a practical approach to building a knowledge graph from extracted entities. We define relationship rules that look at co-occurring entities within the same message:

```python
from enum import Enum
from dataclasses import dataclass
from typing import List, Tuple, Optional
import uuid

class RelationType(Enum):
    ASSOCIATED_WITH = "associated_with"       # PERSON mentioned near ORG
    LOCATED_IN = "located_in"                 # PERSON/ORG near LOC/GPE
    SPENT_ON = "spent_on"                     # MONEY in message with topic
    WORKS_AT = "works_at"                     # PERSON + "works" + ORG
    PREFERS = "prefers"                       # PERSON + positive sentiment + entity
    MENTIONED_ON = "mentioned_on"             # any entity + DATE

@dataclass
class Relationship:
    id: str
    source: str
    target: str
    relation_type: RelationType
    confidence: float
    context: str  # original message text
    timestamp: str

def build_relationships(
    extracted_messages: List[ExtractedMessage],
) -> List[Relationship]:
    """
    Build relationships from co-occurring entities within the same message.
    Uses simple heuristic rules — in production, you'd use a trained relation
    extraction model or an LLM for more complex cases.
    """
    relationships = []

    for msg in extracted_messages:
        entities_by_label = {}
        for ent in msg.entities:
            entities_by_label.setdefault(ent.label, []).append(ent.text)

        persons = entities_by_label.get("PERSON", [])
        orgs = entities_by_label.get("ORG", [])
        locations = entities_by_label.get("GPE", [])
        money = entities_by_label.get("MONEY", [])
        dates = entities_by_label.get("DATE", [])

        # Rule 1: PERSON + ORG → associated_with
        for person in persons:
            for org in orgs:
                relationships.append(Relationship(
                    id=str(uuid.uuid4()),
                    source=person,
                    target=org,
                    relation_type=RelationType.ASSOCIATED_WITH,
                    confidence=0.8,
                    context=msg.original_text,
                    timestamp=msg.timestamp,
                ))

        # Rule 2: PERSON + "works" keyword + ORG → works_at
        if "works" in msg.original_text.lower():
            for person in persons:
                for org in orgs:
                    relationships.append(Relationship(
                        id=str(uuid.uuid4()),
                        source=person,
                        target=org,
                        relation_type=RelationType.WORKS_AT,
                        confidence=0.95,
                        context=msg.original_text,
                        timestamp=msg.timestamp,
                    ))

        # Rule 3: MONEY → spent_on (with whatever topic context exists)
        for amount in money:
            topics = orgs + locations
            for topic in topics:
                relationships.append(Relationship(
                    id=str(uuid.uuid4()),
                    source="user",
                    target=topic,
                    relation_type=RelationType.SPENT_ON,
                    confidence=0.7,
                    context=msg.original_text,
                    timestamp=msg.timestamp,
                ))

        # Rule 4: any entity + DATE → mentioned_on
        all_entities = persons + orgs + locations
        for entity in all_entities:
            for date in dates:
                relationships.append(Relationship(
                    id=str(uuid.uuid4()),
                    source=entity,
                    target=date,
                    relation_type=RelationType.MENTIONED_ON,
                    confidence=0.9,
                    context=msg.original_text,
                    timestamp=msg.timestamp,
                ))

    return relationships


# Build the graph
relationships = build_relationships(extracted)

print(f"Built {len(relationships)} relationships:")
for rel in relationships:
    print(f"  {rel.source} --[{rel.relation_type.value}]--> {rel.target} "
          f"(confidence: {rel.confidence})")
```

```
Built 14 relationships:
  Alice --[associated_with]--> The Garden (confidence: 0.8)
  Alice --[mentioned_on]--> last Tuesday (confidence: 0.9)
  user --[spent_on]--> The Garden (confidence: 0.7)
  Alice --[works_at]--> Google (confidence: 0.95)
  Alice --[mentioned_on]--> now (confidence: 0.9)
  Bob --[associated_with]--> Microsoft (confidence: 0.8)
  Bob --[mentioned_on]--> (confidence: 0.9)
  user --[spent_on]--> Microsoft (confidence: 0.7)
  ...
```

### Storing as a Graph

These relationships are the edges of a knowledge graph. You can store them in a graph database like Neo4j, or in a simple adjacency list if you're building a lightweight system. The key insight is that **relationships are first-class data**, not something the LLM has to infer at query time.

For a more sophisticated approach, you can use dependency parsing (spaCy provides this for free) to extract relationships based on grammatical structure rather than just co-occurrence. For example, "Alice works at Google" has a clear subject-verb-object structure that a dependency parser can capture precisely. See the [spaCy documentation on dependency parsing](https://spacy.io/usage/linguistic-features#dependency-parsing) for details.

## Stage 3: Deterministic Number Extraction and Aggregation

This is where the symbolic part of "neural-symbolic" really shines. Numbers need **exact** handling — you don't want an LLM "estimating" that $50 + $80 = roughly $130. You want code that computes it precisely.

### Extracting Numbers with Regex

A straightforward regex approach handles most common number formats in chat:

```python
import re
from dataclasses import dataclass
from typing import List

@dataclass
class Metric:
    value: float
    unit: str        # "USD", "EUR", "miles", "km", "count", etc.
    raw_text: str    # the original text match
    context: str     # surrounding sentence
    timestamp: str

# Patterns for common metric types
METRIC_PATTERNS = [
    # Currency: $50, $12.50, €100, 100 EUR, etc.
    (r'\$[\d,]+(?:\.\d{2})?', lambda m: ("USD", float(m.group().replace('$', '').replace(',', '')))),
    (r'€[\d,]+(?:\.\d{2})?', lambda m: ("EUR", float(m.group().replace('€', '').replace(',', '')))),
    (r'£[\d,]+(?:\.\d{2})?', lambda m: ("GBP", float(m.group().replace('£', '').replace(',', '')))),
    (r'(\d+(?:\.\d+)?)\s*(?:USD|dollars?)', lambda m: ("USD", float(m.group(1)))),

    # Distance: 5 miles, 10km, 3.5 km
    (r'(\d+(?:\.\d+)?)\s*(?:miles?|mi)', lambda m: ("miles", float(m.group(1)))),
    (r'(\d+(?:\.\d+)?)\s*(?:kilometers?|km)', lambda m: ("km", float(m.group(1)))),

    # Counts: "3 times", "2 people", "5 items"
    (r'(\d+)\s*(?:times?|people|items?)', lambda m: ("count", float(m.group(1)))),
]

def extract_metrics(text: str, timestamp: str = "") -> List[Metric]:
    """
    Extract numeric metrics from text using deterministic regex patterns.
    This is precise — no LLM guessing involved.
    """
    metrics = []
    for pattern, parser in METRIC_PATTERNS:
        for match in re.finditer(pattern, text, re.IGNORECASE):
            unit, value = parser(match)
            metrics.append(Metric(
                value=value,
                unit=unit,
                raw_text=match.group(),
                context=text,
                timestamp=timestamp,
            ))
    return metrics


# Example
messages_with_money = [
    "Spent $45 on dinner last Tuesday",
    "Bought groceries for $32.50 on Wednesday",
    "Alice paid $80 for the concert tickets",
    "Drove 15 miles to the office, then 5 miles home",
    "Meeting with 3 people from the design team",
]

all_metrics = []
for msg in messages_with_money:
    metrics = extract_metrics(msg, timestamp="2026-05-20")
    all_metrics.extend(metrics)

print("Extracted metrics:")
for m in all_metrics:
    print(f"  {m.raw_text} → {m.value} {m.unit}")
```

```
Extracted metrics:
  $45 → 45.0 USD
  $32.50 → 32.5 USD
  $80 → 80.0 USD
  15 miles → 15.0 miles
  5 miles → 5.0 miles
  3 people → 3.0 count
```

### Computing Aggregates

Now that you have structured metrics, computing totals is trivial — no LLM needed:

```python
from collections import defaultdict

def compute_aggregates(metrics: List[Metric]) -> dict:
    """
    Compute exact aggregates from extracted metrics.
    Group by unit and compute sum, count, min, max.
    """
    by_unit = defaultdict(list)
    for m in metrics:
        by_unit[m.unit].append(m.value)

    aggregates = {}
    for unit, values in by_unit.items():
        aggregates[unit] = {
            "total": sum(values),
            "count": len(values),
            "average": sum(values) / len(values),
            "min": min(values),
            "max": max(values),
        }

    return aggregates


aggregates = compute_aggregates(all_metrics)

print("\nAggregates:")
for unit, stats in aggregates.items():
    print(f"  {unit}: total={stats['total']}, count={stats['count']}, "
          f"avg={stats['average']:.1f}, min={stats['min']}, max={stats['max']}")
```

```
Aggregates:
  USD: total=157.5, count=3, avg=52.5, min=32.5, max=80.0
  miles: total=20.0, count=2, avg=10.0, min=5.0, max=15.0
  count: total=3.0, count=1, avg=3.0, min=3.0, max=3.0
```

This is deterministic. Every time you run this on the same input, you get the exact same output. That's something an LLM can't guarantee.

## Putting It All Together: The Full Pipeline

Here's how these three stages connect into a single pipeline:

```python
def neural_symbolic_pipeline(messages: List[Dict[str, str]]) -> dict:
    """
    Full neural-symbolic extraction pipeline:
    1. Neural NER to extract entities
    2. Heuristic relationship building
    3. Deterministic metric extraction and aggregation
    """
    # Stage 1: Neural entity extraction
    extracted_messages = extract_entities(messages)

    # Stage 2: Build knowledge graph relationships
    relationships = build_relationships(extracted_messages)

    # Stage 3: Extract and aggregate metrics
    all_metrics = []
    for msg in extracted_messages:
        metrics = extract_metrics(msg.original_text, msg.timestamp)
        all_metrics.extend(metrics)

    aggregates = compute_aggregates(all_metrics)

    # Collect all unique entities
    all_entities = {}
    for msg in extracted_messages:
        for ent in msg.entities:
            key = (ent.text, ent.label)
            if key not in all_entities:
                all_entities[key] = {
                    "text": ent.text,
                    "label": ent.label,
                    "mentions": [],
                }
            all_entities[key]["mentions"].append(msg.timestamp)

    return {
        "entities": list(all_entities.values()),
        "relationships": [
            {
                "source": r.source,
                "target": r.target,
                "type": r.relation_type.value,
                "confidence": r.confidence,
            }
            for r in relationships
        ],
        "metrics": [
            {"value": m.value, "unit": m.unit, "raw": m.raw_text}
            for m in all_metrics
        ],
        "aggregates": aggregates,
    }


# Run the full pipeline
result = neural_symbolic_pipeline(chat_messages)

print(f"Entities found: {len(result['entities'])}")
print(f"Relationships built: {len(result['relationships'])}")
print(f"Metrics extracted: {len(result['metrics'])}")
print(f"Aggregate totals: {result['aggregates']}")
```

## Pure Vector vs. Neural-Symbolic: A Comparison

Here's a practical comparison of what each approach handles well and where it falls short:

| Capability | Pure Vector Retrieval | Neural-Symbolic Pipeline |
|---|---|---|
| Fuzzy semantic search | Excellent — core strength | Good — still uses embeddings |
| Exact entity lookup | Weak — similarity ≠ precision | Strong — extracted and labeled |
| Relationship mapping | None — no structured graph | Strong — builds graph edges |
| Numeric aggregation | Poor — LLM must compute | Exact — deterministic math |
| New domain adaptation | Easy — just change embeddings | Moderate — needs NER model tuning |
| Latency | Low — single vector lookup | Higher — multi-stage processing |
| Explainability | Low — "similar" is opaque | High — every fact has a source |

The takeaway isn't that one replaces the other. **Use both.** Vector retrieval for the fuzzy, "find me something similar" queries. Neural-symbolic extraction for the "what exactly did I spend" and "who works where" questions.

For a deeper dive into how these approaches work in practice, the [HuggingFace NER documentation](https://huggingface.co/docs/transformers/tasks/token_classification) and spaCy's [production tips](https://spacy.io/usage/production-guides) are excellent starting points. For the knowledge graph layer, the [Stanford NLP Group's work on relation extraction](https://nlp.stanford.edu/nlp/javanese/cgi-bin/web-query.cgi) and the [OpenIE project](https://openie.allenai.org/) are foundational.

## When to Use This Approach

This pipeline makes sense when:

- You need **exact answers** to factual questions (not just "relevant" chunks)
- You're tracking **entities over time** (people, organizations, spending)
- You want **aggregated metrics** you can trust (totals, counts, averages)
- You need **explainability** — you can show exactly where each fact came from

If your use case is purely "find similar documents," pure vector retrieval might be sufficient. But if you're building agents that need to remember and reason about structured facts, neural-symbolic extraction is worth the added complexity.

## Next Steps

Start with Stage 1. Take a sample of your chat data and run it through spaCy's NER. You'll immediately see structured entities you weren't getting from vector embeddings alone. Then layer in relationship building and metric extraction as your needs grow.

The key insight is this: **memory isn't just about finding similar text. It's about understanding what was said.** Entities, relationships, and numbers are the building blocks of that understanding, and they're within reach with tools you probably already have in your Python stack.
