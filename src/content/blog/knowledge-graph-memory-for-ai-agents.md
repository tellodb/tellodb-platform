---
title: "Building Knowledge Graph Memory for AI Agents: A Practical Guide"
description: "A hands-on guide to adding structured memory to AI agents using knowledge graphs. Learn to build, query, and combine graph and vector retrieval with real Python examples."
excerpt: "Vector memory finds similar text. Graph memory finds connected facts. This guide walks through building both with NetworkX and combining them for production agents."
publishedAt: 2026-05-28T00:00:00.000Z
updatedAt: 2026-05-28T00:00:00.000Z
author: "Tellodb Team"
tags:
  - Knowledge Graph
  - Agent Memory
  - Graph Retrieval
  - NetworkX
  - Python
image: /screen.png
featured: true
---

# Building Knowledge Graph Memory for AI Agents: A Practical Guide

## The problem with flat memory

Most agent memory systems store facts as text embeddings. When the agent needs to recall something, it runs a similarity search against those embeddings and returns the closest match.

This works well for a narrow class of queries. "What did the user say about React?" returns a relevant passage. "Find memories about the San Francisco trip" pulls up something useful.

But agents encounter questions that similarity search was never designed to answer:

- "Who does the user collaborate with at work?"
- "Which projects have overlap with this client?"
- "What preferences has the user expressed across different tools?"
- "How are these three facts related to each other?"

These are relationship questions. They require traversal across connected entities, not pattern matching against vector space. A knowledge graph gives your agent the ability to answer them.

This post is a practical guide. You will build a working knowledge graph in Python using [NetworkX](https://networkx.org/), implement traversal queries, and combine graph retrieval with vector search for a hybrid memory system you can adapt to your own agent.

## What a knowledge graph actually stores

A knowledge graph is a directed graph where:

- **Nodes** represent entities: people, organizations, projects, locations, tools, preferences, events.
- **Edges** represent relationships between those entities: works_with, used_at, has_preference, lives_in.
- **Properties** on edges and nodes store metadata: timestamps, confidence scores, active/superseded flags.

This is not a new concept. The [Wikipedia Knowledge Graph](https://en.wikipedia.org/wiki/Knowledge_graph) article traces the idea back to Google's 2012 Knowledge Graph announcement, but the underlying graph database research goes back decades. Academic work like [Bollacker et al.'s "Freebase" paper (2008)](https://dl.acm.org/doi/10.1145/1376616.1376634) laid much of the groundwork for structured entity-relationship storage.

The key insight for agent memory is this: a graph lets you query *how things connect*, not just *what looks similar*.

## Extracting entities from conversations

Before you can build a graph, you need to decide what counts as an entity. In a conversation between a user and an agent, entities are the nouns: people, companies, tools, locations, projects. The simplest approach is to extract entities using a named-entity recognition (NER) model and then link them to graph nodes.

For prototyping, you can use spaCy or a Hugging Face NER pipeline:

```python
from transformers import pipeline

ner = pipeline("ner", model="dbmdz/bert-large-cased-finetuned-conll03-english")

def extract_entities(text):
    """Extract named entities from text using a BERT-based NER model."""
    results = ner(text)
    entities = []
    for ent in results:
        entities.append({
            "text": ent["word"],
            "label": ent["entity"],
            "confidence": float(ent["score"])
        })
    return entities

text = "Alice works at Acme Corp and moved to Miami last September."
print(extract_entities(text))
# [{"text": "Alice", "label": "PER", "confidence": 0.99},
#  {"text": "Acme Corp", "label": "ORG", "confidence": 0.97},
#  {"text": "Miami", "label": "LOC", "confidence": 0.98}]
```

Once you have entities, you link them to graph nodes and create edges based on co-occurrence or explicit relationship extraction. This is the foundation of the ingestion pipeline. For a deeper treatment of entity extraction for agent memory, see [this survey on knowledge graph construction](https://dl.acm.org/doi/10.1145/3365000).

## Building a knowledge graph with NetworkX

[NetworkX](https://networkx.org/) is a Python library for working with graphs. It is well-documented, well-maintained, and works well for prototyping knowledge graph systems. For production use at scale, you would likely move to a dedicated graph database like [Neo4j](https://neo4j.com/docs/) or [Amazon Neptune](https://aws.amazon.com/neptune/), but NetworkX is ideal for understanding the mechanics.

Here is a complete example of building a simple knowledge graph for agent memory:

```python
import networkx as nx
from datetime import datetime

# Create a directed graph
G = nx.DiGraph()

# Add the user node
G.add_node("user:alice", type="person", name="Alice Chen")
G.add_node("org:acme", type="organization", name="Acme Corp")
G.add_node("org:greenfield", type="organization", name="Greenfield Labs")
G.add_node("tool:cursor", type="tool", name="Cursor")
G.add_node("tool:copilot", type="tool", name="GitHub Copilot")
G.add_node("city:miami", type="location", name="Miami")
G.add_node("city:nyc", type="location", name="New York")
G.add_node("project:agent_memory", type="project", name="Agent Memory System")

# Add relationships
G.add_edge("user:alice", "org:acme",
           relation="works_at",
           since="2024-01-15",
           active=True)

G.add_edge("user:alice", "org:greenfield",
           relation="contracted_for",
           since="2025-03-01",
           active=True)

G.add_edge("user:alice", "tool:cursor",
           relation="has_preference",
           confidence=0.9,
           stated_date="2025-06-10")

G.add_edge("user:alice", "tool:copilot",
           relation="has_preference",
           confidence=0.4,
           stated_date="2025-06-10")

G.add_edge("user:alice", "city:miami",
           relation="lives_in",
           active=True,
           since="2025-09-01")

G.add_edge("user:alice", "city:nyc",
           relation="lives_in",
           active=False,
           superseded_by="city:miami",
           since="2020-01-01",
           until="2025-08-30")

G.add_edge("user:alice", "project:agent_memory",
           relation="works_on",
           role="lead",
           since="2025-04-01")

G.add_edge("org:acme", "project:agent_memory",
           relation="funds",
           since="2025-04-01")

print(f"Nodes: {G.number_of_nodes()}")
print(f"Edges: {G.number_of_edges()}")
```

This gives you a graph with a user, two organizations, two tools, two locations, and a project. Every edge carries metadata like timestamps and confidence scores. This metadata is critical for production systems where facts change over time.

## Traversal queries

The power of a knowledge graph is in traversal. Here are the queries your agent actually needs, implemented with NetworkX.

### Single-hop: "Where does the user live?"

```python
def get_active_value(G, entity, relation):
    """Get the active value for a single-value relationship."""
    for _, target, data in G.out_edges(entity, data=True):
        if data.get("relation") == relation and data.get("active", False):
            return target, data
    return None, None

location, props = get_active_value(G, "user:alice", "lives_in")
# Returns: ("city:miami", {"relation": "lives_in", "active": True, "since": "2025-09-01"})
```

This walks the outgoing edges from the user node, filters by relationship type, and returns the active one. If you had a supersession system, the old `lives_in` edge would have `active=False` and get filtered out.

### Multi-hop: "Which organizations are connected to the user's current project?"

```python
def multi_hop_query(G, start, relation_1, relation_2):
    """
    Two-hop traversal: start -> [relation_1] -> mid -> [relation_2] -> end
    Returns all end nodes reachable via this path.
    """
    results = []
    # First hop
    for _, mid, d1 in G.out_edges(start, data=True):
        if d1.get("relation") == relation_1:
            # Second hop
            for _, end, d2 in G.out_edges(mid, data=True):
                if d2.get("relation") == relation_2:
                    results.append({
                        "intermediate": mid,
                        "target": end,
                        "path": [start, mid, end]
                    })
    return results

# "Which organizations fund the user's projects?"
orgs = multi_hop_query(G, "user:alice", "works_on", "funds")
# Returns: [{"intermediate": "project:agent_memory", "target": "org:acme", ...}]
```

This is a classic two-hop traversal. The agent asked about organizations connected to the user's project. The graph walks from user to project, then from project to organization. A vector index would have no way to perform this query without first retrieving everything and then manually joining.

### BFS traversal: "Find all entities connected to this user within 3 hops"

```python
from collections import deque

def bfs_neighbors(G, start, max_depth=3):
    """Breadth-first search to find all reachable nodes within max_depth."""
    visited = {start}
    queue = deque([(start, 0)])
    results = []

    while queue:
        node, depth = queue.popleft()
        if depth >= max_depth:
            continue
        for _, neighbor, data in G.out_edges(node, data=True):
            if neighbor not in visited:
                visited.add(neighbor)
                results.append({
                    "node": neighbor,
                    "depth": depth + 1,
                    "relation": data.get("relation"),
                    "properties": data
                })
                queue.append((neighbor, depth + 1))
    return results

connected = bfs_neighbors(G, "user:alice", max_depth=2)
for item in connected:
    print(f"{item['node']} (depth {item['depth']}, via {item['relation']})")
# Output:
# org:acme (depth 1, via works_at)
# org:greenfield (depth 1, via contracted_for)
# tool:cursor (depth 1, via has_preference)
# tool:copilot (depth 1, via has_preference)
# city:miami (depth 1, via lives_in)
# city:nyc (depth 1, via lives_in)
# project:agent_memory (depth 1, via works_on)
# org:acme (depth 2, via funds) — reached via project
```

BFS is the workhorse traversal for knowledge graph memory. It finds everything connected to an entity, which is exactly what you need when the agent does not know what it is looking for but knows the starting point.

### Aggregation: "What tools does the user prefer, ranked by confidence?"

```python
def get_preferences(G, entity, min_confidence=0.5):
    """Collect all preference edges, filtered by confidence threshold."""
    prefs = []
    for _, target, data in G.out_edges(entity, data=True):
        if data.get("relation") == "has_preference":
            conf = data.get("confidence", 0)
            if conf >= min_confidence:
                prefs.append({
                    "entity": target,
                    "confidence": conf,
                    "stated": data.get("stated_date")
                })
    prefs.sort(key=lambda x: x["confidence"], reverse=True)
    return prefs

preferences = get_preferences(G, "user:alice", min_confidence=0.5)
# Returns: [{"entity": "tool:cursor", "confidence": 0.9, ...}]
# tool:copilot filtered out (confidence 0.4 < 0.5)
```

This demonstrates how graph queries can incorporate numeric properties for ranking. The confidence score is stored as edge metadata and used to filter and sort results.

## Combining graph and vector retrieval

Neither graph traversal nor vector similarity alone covers all agent memory queries. The strongest systems combine both.

Here is a working example that implements a hybrid retrieval system:

```python
import numpy as np
from typing import List, Dict, Any

class HybridMemory:
    def __init__(self):
        self.graph = nx.DiGraph()
        self.vector_store = {}  # In production, use a real vector DB
        self.embeddings = {}

    def add_memory(self, memory_id: str, text: str, embedding: np.ndarray,
                   entities: List[str] = None, metadata: dict = None):
        """Store a memory in both vector and graph."""
        # Vector store
        self.vector_store[memory_id] = text
        self.embeddings[memory_id] = embedding

        # Graph store
        self.graph.add_node(memory_id, type="memory", text=text, **(metadata or {}))
        if entities:
            for entity in entities:
                if not self.graph.has_node(entity):
                    self.graph.add_node(entity, type="entity")
                self.graph.add_edge(memory_id, entity, relation="mentions")

    def vector_search(self, query_embedding: np.ndarray, top_k: int = 5) -> List[Dict]:
        """Find the most similar memories by cosine similarity."""
        scores = {}
        for mid, emb in self.embeddings.items():
            similarity = np.dot(query_embedding, emb) / (
                np.linalg.norm(query_embedding) * np.linalg.norm(emb)
            )
            scores[mid] = similarity

        ranked = sorted(scores.items(), key=lambda x: x[1], reverse=True)[:top_k]
        return [{"memory_id": mid, "score": score, "text": self.vector_store[mid]}
                for mid, score in ranked]

    def graph_expand(self, memory_ids: List[str], max_hops: int = 2) -> List[str]:
        """Given memory IDs, find all connected entities."""
        expanded = set()
        for mid in memory_ids:
            neighbors = bfs_neighbors(self.graph, mid, max_depth=max_hops)
            for n in neighbors:
                expanded.add(n["node"])
        return list(expanded)

    def hybrid_query(self, query_embedding: np.ndarray,
                     expand_graph: bool = True, top_k: int = 5) -> List[Dict]:
        """
        1. Vector search for initial candidates
        2. Graph expansion to find related entities
        3. Re-rank candidates that mention expanded entities
        """
        # Step 1: Vector search
        candidates = self.vector_search(query_embedding, top_k=top_k * 2)

        if not expand_graph:
            return candidates[:top_k]

        # Step 2: Graph expansion
        candidate_ids = [c["memory_id"] for c in candidates]
        related_entities = self.graph_expand(candidate_ids, max_hops=2)

        # Step 3: Boost candidates that mention related entities
        for candidate in candidates:
            mid = candidate["memory_id"]
            entity_boost = sum(
                0.1 for _, target, _ in self.graph.out_edges(mid, data=True)
                if target in related_entities
            )
            candidate["score"] += entity_boost

        candidates.sort(key=lambda x: x["score"], reverse=True)
        return candidates[:top_k]


# Usage example
memory = HybridMemory()

# Add some memories
memory.add_memory(
    "mem_1",
    "Alice mentioned she prefers Cursor over Copilot for code generation",
    np.random.randn(128),  # In practice, use a real embedding model
    entities=["user:alice", "tool:cursor", "tool:copilot"]
)

memory.add_memory(
    "mem_2",
    "Alice is leading the Agent Memory System project at Acme Corp",
    np.random.randn(128),
    entities=["user:alice", "org:acme", "project:agent_memory"]
)

memory.add_memory(
    "mem_3",
    "Alice moved from NYC to Miami in September 2025",
    np.random.randn(128),
    entities=["user:alice", "city:nyc", "city:miami"]
)

# Query
query_emb = np.random.randn(128)
results = memory.hybrid_query(query_emb, top_k=3)
for r in results:
    print(f"{r['memory_id']}: {r['score']:.3f} — {r['text'][:60]}...")
```

The flow is: vector search finds initial candidates based on semantic similarity, graph traversal expands the context by finding connected entities, and the results are re-ranked to favor candidates that mention entities related to the original hits.

This is the pattern used by production systems. The [Neo4j GraphRAG documentation](https://neo4j.com/docs/graphrag/) describes a similar architecture for combining graph context with language model retrieval.

## Vector search vs graph traversal vs hybrid

| Feature | Vector Search | Graph Traversal | Hybrid |
|---|---|---|---|
| "What did the user say about X?" | Strong | Moderate | Strong |
| "Who does the user work with?" | Weak | Strong | Strong |
| "How are these three facts connected?" | None | Strong | Strong |
| "What tools does the user prefer?" | Moderate | Strong | Strong |
| Semantic similarity | Strong | None | Strong |
| Multi-hop reasoning | None | Strong | Strong |
| Handles ambiguity | Strong | Moderate | Strong |
| Implementation complexity | Low | Medium | High |
| Latency at scale | Low (ANN indexes) | Medium (index traversal) | Medium |
| Storage requirements | High (vectors) | Low (adjacency lists) | High (both) |

The takeaway: use vector search for "find something similar," graph traversal for "find something connected," and hybrid when you need both. Most real-world agent memory systems end up hybrid because user queries do not fit neatly into one category.

## Production considerations

### Graph databases

NetworkX is excellent for prototyping and small-to-medium datasets. For production, you will want a dedicated graph database:

- [Neo4j](https://neo4j.com/docs/) — The most widely used graph database. Strong ecosystem, Cypher query language, supports property graphs.
- [ArangoDB](https://docs.arangodb.com/) — Multi-model database supporting graphs, documents, and key-value.
- [Amazon Neptune](https://aws.amazon.com/neptune/) — Managed graph database on AWS, supports Gremlin and SPARQL.

The [Neo4j Graph Data Science library](https://neo4j.com/docs/graph-data-science/current/) provides pre-built algorithms for community detection, path finding, and centrality analysis — all useful for analyzing agent memory graphs.

### Temporal decay and supersession

Facts change. The user moved from NYC to Miami. They switched tools. A production knowledge graph needs edge metadata to track this:

```python
def get_current_facts(G, entity, relation):
    """Get facts for a relationship, preferring the most recent active value."""
    edges = []
    for _, target, data in G.out_edges(entity, data=True):
        if data.get("relation") == relation:
            edges.append((target, data))

    # Sort by start date, most recent first
    edges.sort(key=lambda x: x[1].get("since", ""), reverse=True)

    # Return the active one, or the most recent if none are marked active
    for target, data in edges:
        if data.get("active", False):
            return target, data
    return edges[0] if edges else (None, None)
```

This pattern handles superseded facts cleanly. The old edge stays in the graph (you might need it for historical queries) but the active one is returned for present-tense queries.

### Confidence and provenance

Not all facts are equally reliable. The user explicitly said "I prefer Cursor" is high confidence. The agent inferred the preference from behavior is lower confidence. Store confidence scores as edge properties and filter accordingly:

```python
def query_with_confidence(G, entity, relation, min_confidence=0.7):
    """Query with a minimum confidence threshold."""
    results = []
    for _, target, data in G.out_edges(entity, data=True):
        if data.get("relation") == relation:
            confidence = data.get("confidence", 1.0)
            if confidence >= min_confidence:
                results.append({"target": target, "confidence": confidence, **data})
    return results
```

The [PROV-DM standard](https://www.w3.org/TR/prov-dm/) from the W3C provides a formal model for data provenance if you need to track where facts came from and how they were derived.

## Memory graph serialization

For persistence, you need to serialize your graph. NetworkX supports several formats:

```python
import json

def export_graph_json(G, filepath):
    """Export graph as JSON for persistence."""
    data = {
        "nodes": [
            {"id": n, **G.nodes[n]} for n in G.nodes()
        ],
        "edges": [
            {"source": u, "target": v, **d} for u, v, d in G.edges(data=True)
        ]
    }
    with open(filepath, "w") as f:
        json.dump(data, f, indent=2, default=str)

def import_graph_json(filepath):
    """Import graph from JSON."""
    G = nx.DiGraph()
    with open(filepath) as f:
        data = json.load(f)
    for node in data["nodes"]:
        nid = node.pop("id")
        G.add_node(nid, **node)
    for edge in data["edges"]:
        source = edge.pop("source")
        target = edge.pop("target")
        G.add_edge(source, target, **edge)
    return G
```

For larger graphs, [Neo4j's Python driver](https://neo4j.com/docs/python-manual/current/) or [Apache AGE](https://age.apache.org/) (a PostgreSQL extension for graph queries) are better options than serializing to JSON.

## When to use knowledge graph memory

Knowledge graph memory is not always the right choice. It adds complexity. Use it when:

- Your agent needs to answer relationship questions ("who knows whom," "what connects to what").
- Facts change over time and you need to track history.
- You need multi-hop reasoning across stored facts.
- You want to combine structured facts with unstructured text retrieval.

If your agent only retrieves similar text passages and never needs to reason about connections, a plain vector store is simpler and faster.

Most production agent systems start with vector search and add graph memory as their relationship queries grow more complex. This is a pragmatic approach — build the simplest thing that works and add structure when you need it.

## Further reading

- [Neo4j GraphRAG — Combining Knowledge Graphs with LLM Retrieval](https://neo4j.com/docs/graphrag/)
- [NetworkX Documentation](https://networkx.org/documentation/stable/)
- [Bollacker et al., "Freebase: A Collaboratively Created Graph Database" (2008)](https://dl.acm.org/doi/10.1145/1376616.1376634)
- [Google Knowledge Graph announcement (2012)](https://blog.google/products/search/introducing-knowledge-graph/)
- [W3C PROV-DM: The PROV Data Model](https://www.w3.org/TR/prov-dm/)
- [Hogan et al., "Knowledge Graphs" (ACM Computing Surveys, 2021)](https://dl.acm.org/doi/10.1145/3365000)

For implementation details on how Tellodb integrates knowledge graph memory with hybrid retrieval, see the [architecture documentation](/docs/architecture).
