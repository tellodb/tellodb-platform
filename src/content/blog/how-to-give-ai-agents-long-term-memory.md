---
title: "How to Give AI Agents Long-Term Memory: A Python Tutorial"
description: "Step-by-step guide to adding persistent memory to AI agents. Learn three approaches from file-based to vector databases, with runnable Python code."
excerpt: "Your AI agent forgets everything between sessions. This tutorial shows you how to add long-term memory using Python, from simple file storage to production-ready vector databases."
publishedAt: 2026-05-28T00:00:00.000Z
updatedAt: 2026-05-28T00:00:00.000Z
author: "Sharjeel"
tags:
  - AI Agent Memory
  - Python Tutorial
  - Long-Term Memory
  - LLM Agents
  - Vector Database
image: /screen.png
featured: true
---

You built an AI agent. It works great in a single conversation. The user says "my name is Sarah" and the agent responds naturally for the rest of the chat. But close the session and start a new one, and the agent has no idea who Sarah is. Every conversation starts from zero.

This is the fundamental memory problem with AI agents. Large language models are stateless — they don't retain anything between API calls unless you explicitly pass it in the context window. And context windows, while growing, are finite. You can't just dump your entire conversation history into every request forever.

This tutorial walks you through three concrete approaches to giving your AI agent persistent, long-term memory using Python. We start simple with file-based storage, move to vector databases, and finish with a structured memory system that handles contradictions and supports metadata. Every approach includes runnable code you can adapt to your own projects.

## Why Chat History Alone Doesn't Work

Before diving into solutions, let's understand why the obvious approach — just saving the full conversation and re-feeding it — fails at scale.

Here's a minimal agent that remembers nothing:

```python
import openai

def chat(message: str) -> str:
    response = openai.chat.completions.create(
        model="gpt-4",
        messages=[
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": message},
        ],
    )
    return response.choices[0].message.content

# Session 1
print(chat("My name is Sarah and I work at Acme Corp"))
# → "Nice to meet you, Sarah! How can I help?"

# Session 2 (new conversation)
print(chat("What's my name?")
# → "I don't have that information. Could you tell me your name?"
```

The agent forgets everything. The fix seems simple: keep a running list of messages and send the whole history. Let's try that:

```python
import openai

class MemorylessAgent:
    def __init__(self):
        self.history = []

    def chat(self, message: str) -> str:
        self.history.append({"role": "user", "content": message})
        
        response = openai.chat.completions.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": "You are a helpful assistant."},
                *self.history,
            ],
        )
        
        reply = response.choices[0].message.content
        self.history.append({"role": "assistant", "content": reply})
        return reply

# Works within a session
agent = MemorylessAgent()
print(agent.chat("My name is Sarah"))
print(agent.chat("What's my name?"))  # → "Your name is Sarah!"
```

This works — but only within a single session. Close the program and start fresh, and `self.history` is gone. You need persistence. And as conversations grow, you hit a harder problem: context windows overflow.

GPT-4 has a 128K token context window. Sounds large, until you realize that a detailed conversation about a complex project can easily reach 50K tokens. Multi-turn conversations with tool calls, document references, and user preferences accumulate fast. At some point you're paying for expensive tokens just to re-read information the model already processed.

The real solution is a memory system that stores information externally and retrieves only what's relevant for each new interaction. Let's build one.

## Approach 1: File-Based Memory

The simplest memory system is a JSON file. It's not elegant, but it teaches the core concept: persist data outside the model, retrieve it when needed.

Here's a complete, working file-based memory agent:

```python
import json
import os
from datetime import datetime
from openai import OpenAI

MEMORY_FILE = "agent_memory.json"
client = OpenAI()

def load_memory() -> list[dict]:
    if os.path.exists(MEMORY_FILE):
        with open(MEMORY_FILE, "r") as f:
            return json.load(f)
    return []

def save_memory(memories: list[dict]) -> None:
    with open(MEMORY_FILE, "w") as f:
        json.dump(memories, f, indent=2)

def add_memory(content: str, category: str = "general") -> dict:
    memory = {
        "id": len(load_memory()) + 1,
        "content": content,
        "category": category,
        "created_at": datetime.now().isoformat(),
        "access_count": 0,
    }
    memories = load_memory()
    memories.append(memory)
    save_memory(memories)
    return memory

def search_memory(query: str) -> list[dict]:
    memories = load_memory()
    if not memories:
        return []
    
    results = []
    query_lower = query.lower()
    for mem in memories:
        if query_lower in mem["content"].lower():
            mem["access_count"] += 1
            results.append(mem)
    
    save_memory(memories)
    return sorted(results, key=lambda m: m["access_count"], reverse=True)

def chat_with_memory(user_message: str) -> str:
    relevant = search_memory(user_message)
    
    context_parts = []
    if relevant:
        context_parts.append("Relevant memories:")
        for m in relevant[:5]:
            context_parts.append(f"- {m['content']} ({m['category']})")
    
    context = "\n".join(context_parts) if context_parts else "No relevant memories found."
    
    messages = [
        {
            "role": "system",
            "content": (
                f"You are a helpful assistant with access to persistent memory.\n\n"
                f"Memory context:\n{context}\n\n"
                f"Use this information to personalize your responses. "
                f"If the user shares new personal information, note it for future reference."
            ),
        },
        {"role": "user", "content": user_message},
    ]
    
    response = client.chat.completions.create(model="gpt-4", messages=messages)
    reply = response.choices[0].message.content
    
    # Auto-store personal information
    if any(keyword in user_message.lower() for keyword in ["my name", "i work", "i live", "i prefer", "i like"]):
        add_memory(user_message, "personal_info")
    
    return reply

# Demo
add_memory("Sarah works at Acme Corp as a software engineer", "personal_info")
add_memory("Sarah prefers TypeScript over Python", "preference")

print(chat_with_memory("What do I do for work?"))
# → "You're a software engineer at Acme Corp, Sarah."
```

This approach has clear advantages: zero dependencies beyond `openai`, easy to debug, and works anywhere. But it breaks down in three ways:

1. **Keyword matching is brittle.** The `search_memory` function only matches exact substrings. "Who am I?" won't match a memory about "Sarah."
2. **No semantic understanding.** The system can't find related information — only identical strings.
3. **Scaling issues.** Every search scans the entire file. With thousands of memories, this becomes slow.

For a personal project or prototype, this is genuinely useful. For anything else, you need semantic search.

## Approach 2: Vector Database Memory

Vector databases solve the semantic search problem. Instead of matching keywords, you convert text into numerical embeddings — vectors that capture meaning. Similar concepts end up close together in vector space, so "What do I do for work?" can match "Sarah works at Acme Corp."

We'll use [ChromaDB](https://docs.trychroma.com/) for this example because it's lightweight and requires no server. For production, consider [Pinecone](https://www.pinecone.io/), [Weaviate](https://weaviate.io/), or [Qdrant](https://qdrant.tech/).

First, install dependencies:

```bash
pip install chromadb openai
```

Here's a complete vector memory agent:

```python
import chromadb
from chromadb.config import Settings
from openai import OpenAI
from datetime import datetime

client = OpenAI()

chroma_client = chromadb.PersistentClient(path="./chroma_memory")
collection = chroma_client.get_or_create_collection(
    name="agent_memories",
    metadata={"hnsw:space": "cosine"},
)

def get_embedding(text: str) -> list[float]:
    response = client.embeddings.create(
        model="text-embedding-3-small",
        input=text,
    )
    return response.data[0].embedding

def store_memory(content: str, category: str = "general") -> str:
    mem_id = f"mem_{collection.count() + 1}_{datetime.now().timestamp()}"
    embedding = get_embedding(content)
    
    collection.add(
        ids=[mem_id],
        embeddings=[embedding],
        documents=[content],
        metadatas=[{
            "category": category,
            "created_at": datetime.now().isoformat(),
            "access_count": 0,
        }],
    )
    return mem_id

def recall_memories(query: str, top_k: int = 5) -> list[dict]:
    query_embedding = get_embedding(query)
    
    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=top_k,
        include=["documents", "metadatas", "distances"],
    )
    
    memories = []
    if results["ids"][0]:
        for i, mem_id in enumerate(results["ids"][0]):
            memories.append({
                "id": mem_id,
                "content": results["documents"][0][i],
                "metadata": results["metadatas"][0][i],
                "distance": results["distances"][0][i],
            })
    
    # Update access counts
    for mem in memories:
        meta = mem["metadata"]
        meta["access_count"] = meta.get("access_count", 0) + 1
        collection.update(
            ids=[mem["id"]],
            metadatas=[meta],
        )
    
    return memories

def chat_with_vector_memory(user_message: str) -> str:
    relevant = recall_memories(user_message, top_k=5)
    
    context_parts = []
    if relevant:
        context_parts.append("Relevant memories (most relevant first):")
        for i, mem in enumerate(relevant, 1):
            relevance = max(0, (1 - mem["distance"]) * 100)
            context_parts.append(
                f"{i}. {mem['content']} "
                f"[category: {mem['metadata']['category']}, "
                f"relevance: {relevance:.0f}%]"
            )
    
    context = "\n".join(context_parts) if context_parts else "No relevant memories found."
    
    response = client.chat.completions.create(
        model="gpt-4",
        messages=[
            {
                "role": "system",
                "content": (
                    f"You are a helpful assistant with persistent memory.\n\n"
                    f"Retrieved memories:\n{context}\n\n"
                    f"Use these memories to personalize responses. "
                    f"When users share new information, offer to remember it."
                ),
            },
            {"role": "user", "content": user_message},
        ],
    )
    
    reply = response.choices[0].message.content
    
    # Auto-extract and store important information
    extraction_response = client.chat.completions.create(
        model="gpt-4",
        messages=[
            {
                "role": "system",
                "content": (
                    "Extract any personal facts, preferences, or important "
                    "information from this message. Return JSON with 'facts' "
                    "list. Each fact has 'content' and 'category' "
                    "(personal_info, preference, project, relationship, other). "
                    "Return empty list if nothing notable."
                ),
            },
            {"role": "user", "content": user_message},
        ],
        response_format={"type": "json_object"},
    )
    
    import json
    try:
        extracted = json.loads(extraction_response.choices[0].message.content)
        for fact in extracted.get("facts", []):
            store_memory(fact["content"], fact.get("category", "general"))
    except (json.JSONDecodeError, KeyError):
        pass
    
    return reply

# Demo
store_memory("Sarah works as a software engineer at Acme Corp", "personal_info")
store_memory("Sarah's favorite programming language is Rust", "preference")
store_memory("Sarah is building a memory system for AI agents", "project")

print(chat_with_vector_memory("What programming languages do I like?"))
# → Vector search finds the Rust preference even though the query doesn't
#   use the word "like" — it matches semantically.
```

This is a massive improvement. The vector search finds related information regardless of exact wording. The auto-extraction step (using a second LLM call) means the agent automatically stores new facts without the user having to explicitly ask.

The tradeoff is infrastructure. You're now depending on an embedding model (which costs money per call), a vector database (which needs storage and potentially a server), and you have more moving parts to debug. For production systems, this is the right tradeoff. For learning, it's worth understanding the limitations:

- **Embedding costs add up.** Every `store_memory` and `recall_memories` call generates an API request to the embedding model. At scale, this can be significant.
- **Cosine similarity isn't perfect.** It measures topical similarity, not factual correctness. A memory about "Sarah likes cats" might have high similarity to a query about "pets" even if you actually want "Sarah's preferences."
- **No relationship tracking.** The vector store doesn't know that "Sarah works at Acme" and "Sarah is a software engineer" are about the same person.

This brings us to the advanced approach.

## Approach 3: Structured Memory with Metadata

Production memory systems need structure. Instead of treating all memories equally, you want to categorize them, track relationships, handle updates, and query with precision. This approach combines vector search for recall with structured metadata for filtering and organization.

```python
import chromadb
import json
from datetime import datetime
from openai import OpenAI
from enum import Enum

client = OpenAI()
chroma_client = chromadb.PersistentClient(path="./structured_memory")

# Separate collections for different memory types
facts_collection = chroma_client.get_or_create_collection(
    name="facts",
    metadata={"hnsw:space": "cosine"},
)
preferences_collection = chroma_client.get_or_create_collection(
    name="preferences",
    metadata={"hnsw:space": "cosine"},
)
conversations_collection = chroma_client.get_or_create_collection(
    name="conversations",
    metadata={"hnsw:space": "cosine"},
)

class MemoryType(Enum):
    FACT = "fact"
    PREFERENCE = "preference"
    CONVERSATION = "conversation"

class StructuredMemory:
    def __init__(self):
        self.collections = {
            MemoryType.FACT: facts_collection,
            MemoryType.PREFERENCE: preferences_collection,
            MemoryType.CONVERSATION: conversations_collection,
        }
    
    def _get_embedding(self, text: str) -> list[float]:
        response = client.embeddings.create(
            model="text-embedding-3-small",
            input=text,
        )
        return response.data[0].embedding
    
    def store(
        self,
        content: str,
        memory_type: MemoryType,
        metadata: dict | None = None,
    ) -> str:
        collection = self.collections[memory_type]
        mem_id = f"{memory_type.value}_{collection.count() + 1}"
        embedding = self._get_embedding(content)
        
        base_metadata = {
            "type": memory_type.value,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat(),
            "version": 1,
            "superseded": False,
        }
        if metadata:
            base_metadata.update(metadata)
        
        collection.add(
            ids=[mem_id],
            embeddings=[embedding],
            documents=[content],
            metadatas=[base_metadata],
        )
        return mem_id
    
    def supersede(self, old_id: str, new_content: str, reason: str) -> str:
        """Replace an outdated memory with a new version."""
        collection = None
        old_metadata = None
        
        for coll in self.collections.values():
            try:
                result = coll.get(ids=[old_id], include=["metadatas"])
                if result["ids"]:
                    collection = coll
                    old_metadata = result["metadatas"][0]
                    break
            except Exception:
                continue
        
        if not collection:
            raise ValueError(f"Memory {old_id} not found")
        
        # Mark old memory as superseded
        old_metadata["superseded"] = True
        old_metadata["superseded_at"] = datetime.now().isoformat()
        old_metadata["superseded_reason"] = reason
        collection.update(ids=[old_id], metadatas=[old_metadata])
        
        # Store new version
        new_type = MemoryType(old_metadata["type"])
        new_id = self.store(
            new_content,
            new_type,
            metadata={
                "supersedes": old_id,
                "supersedes_reason": reason,
            },
        )
        return new_id
    
    def recall(
        self,
        query: str,
        memory_type: MemoryType | None = None,
        include_superseded: bool = False,
        top_k: int = 5,
    ) -> list[dict]:
        query_embedding = self._get_embedding(query)
        
        collections_to_search = (
            [self.collections[memory_type]]
            if memory_type
            else list(self.collections.values())
        )
        
        all_results = []
        for collection in collections_to_search:
            results = collection.query(
                query_embeddings=[query_embedding],
                n_results=top_k,
                include=["documents", "metadatas", "distances"],
            )
            
            if results["ids"][0]:
                for i, mem_id in enumerate(results["ids"][0]):
                    metadata = results["metadatas"][0][i]
                    if not include_superseded and metadata.get("superseded"):
                        continue
                    
                    all_results.append({
                        "id": mem_id,
                        "content": results["documents"][0][i],
                        "metadata": metadata,
                        "distance": results["distances"][0][i],
                    })
        
        all_results.sort(key=lambda m: m["distance"])
        return all_results[:top_k]
    
    def get_user_profile(self) -> dict:
        """Build a structured user profile from stored memories."""
        facts = self.recall("", memory_type=MemoryType.FACT, top_k=50)
        prefs = self.recall("", memory_type=MemoryType.PREFERENCE, top_k=50)
        
        return {
            "facts": [
                {"content": f["content"], "category": f["metadata"].get("category", "general")}
                for f in facts
            ],
            "preferences": [
                {"content": p["content"], "domain": p["metadata"].get("domain", "general")}
                for p in prefs
            ],
        }

memory = StructuredMemory()

# Store structured memories
memory.store("Sarah works as a senior software engineer", MemoryType.FACT, {
    "category": "employment",
    "entity": "Sarah",
})
memory.store("Sarah prefers Rust for systems programming", MemoryType.PREFERENCE, {
    "domain": "programming",
})
memory.store("Sarah's team uses PostgreSQL for production", MemoryType.FACT, {
    "category": "technology",
    "entity": "Acme Corp",
})

# User changes jobs — supersede the old fact
memory.supersede(
    "fact_1",
    "Sarah now works as a staff engineer at TechStart",
    "User mentioned job change on 2026-05-15",
)

# Recall finds the updated fact
results = memory.recall("Where does Sarah work?")
for r in results:
    print(f"{r['content']} (relevance: {(1-r['distance'])*100:.0f}%)")
# → "Sarah now works as a staff engineer at TechStart"
# The old Acme Corp fact is superseded and excluded

# Build a full profile
profile = memory.get_user_profile()
print(json.dumps(profile, indent=2))
```

The key innovations here are:

1. **Separate collections** for facts, preferences, and conversations. This lets you filter by type and apply different retrieval strategies.
2. **Superseding** instead of deleting. When Sarah changes jobs, you don't lose the old information — you mark it as outdated and store the new version. This preserves history and lets you audit changes.
3. **Structured metadata** for filtering. You can query "all facts about Sarah's employment" or "all technology preferences" using metadata filters.

## Handling Contradictions

Real users contradict themselves. "I prefer dark mode." Two weeks later: "Actually, I switched to light mode." A good memory system handles this gracefully.

The superseding mechanism from Approach 3 is part of the solution, but you also need to detect contradictions proactively. Here's how:

```python
def detect_contradiction(new_fact: str, existing_memories: list[dict]) -> dict | None:
    """Check if a new fact contradicts existing memories."""
    response = client.chat.completions.create(
        model="gpt-4",
        messages=[
            {
                "role": "system",
                "content": (
                    "You are a fact-checking assistant. Given a new statement "
                    "and a list of existing facts, determine if the new statement "
                    "contradicts any existing fact.\n\n"
                    "Return JSON:\n"
                    '{"contradicts": true/false, "contradicted_fact_id": "...", '
                    '"explanation": "..."}'
                ),
            },
            {
                "role": "user",
                "content": (
                    f"New statement: {new_fact}\n\n"
                    f"Existing facts:\n"
                    + "\n".join(
                        f"- ID: {m['id']}: {m['content']}"
                        for m in existing_memories
                    )
                ),
            },
        ],
        response_format={"type": "json_object"},
    )
    
    result = json.loads(response.choices[0].message.content)
    if result.get("contradicts"):
        return result
    return None

def smart_store(new_fact: str, category: str) -> dict:
    """Store a fact, checking for contradictions first."""
    existing = memory.recall(new_fact, top_k=10)
    
    contradiction = detect_contradiction(new_fact, existing)
    
    if contradiction:
        old_id = contradiction["contradicted_fact_id"]
        new_id = memory.supersede(
            old_id,
            new_fact,
            contradiction["explanation"],
        )
        return {
            "action": "superseded",
            "old_id": old_id,
            "new_id": new_id,
            "explanation": contradiction["explanation"],
        }
    else:
        new_id = memory.store(new_fact, MemoryType.FACT, {"category": category})
        return {
            "action": "created",
            "new_id": new_id,
        }

result = smart_store(
    "Sarah prefers light mode now",
    "preference",
)
print(result)
# → {
#     "action": "superseded",
#     "old_id": "preference_1",
#     "new_id": "preference_5",
#     "explanation": "The new statement about preferring light mode
#                     contradicts the existing preference for dark mode."
# }
```

This pattern — detect, supersede, explain — gives you a complete contradiction handling pipeline. The LLM handles the nuanced judgment of what counts as a contradiction, while the structured storage preserves the full history.

## Approach 4: Production Memory with Tellodb (Open Source, Rust)

The three approaches above give you the conceptual foundation. You now understand file-based storage, vector search, and structured metadata with supersession. But each approach requires you to build and maintain a significant amount of infrastructure. You're wiring together ChromaDB for vector storage, OpenAI for embeddings and fact extraction, and your own logic for temporal ranking, fact supersession, and deterministic aggregation. That is a lot of moving parts to build, test, and keep running in production.

[Tellodb](https://github.com/tellodb-foundation/tellodb-db) is an open-source memory engine written in Rust that bundles all three approaches into a single binary. It handles embeddings, vector search, temporal ranking, fact supersession, and deterministic aggregation — so you don't need to wire together five different systems.

### One API, All Three Approaches

Instead of building a file store, a vector database, and a metadata layer separately, you get them all through one client:

```python
from tellodb import TellodbClient

# Start locally — no API keys, no servers, no Docker
client = TellodbClient.from_local()
```

**Approach 1 (file-based persistence) is handled automatically.** All data persists to disk. The local binary manages storage, indexing, and retrieval without configuration.

**Approach 2 (vector search) is built in.** You don't need a separate embedding model or vector store:

```python
# Ingest a memory — Tellodb handles embedding and indexing internally
client.ingest(entity_id="user-123", text="I prefer pourover coffee.")

# Semantic retrieval without managing embeddings yourself
hits = client.query("What coffee do I prefer?", entity_id="user-123")
for hit in hits:
    print(f"{hit.textual_content} (score: {hit.similarity})")
```

**Approach 3 (structured metadata, supersession, temporal ranking) is core to the engine.** Tellodb treats every ingested fact as part of a temporal stream. It tracks recency, handles contradictions through fact supersession, and provides deterministic aggregation:

```python
from datetime import datetime

# User's preferences evolve over time
client.ingest(
    entity_id="user-123",
    text="Sarah works as a software engineer at Acme Corp",
    timestamp=datetime(2025, 6, 1),
)
client.ingest(
    entity_id="user-123",
    text="Sarah now works as a staff engineer at TechStart",
    timestamp=datetime(2026, 1, 15),
)

# Temporal query — automatically surfaces the most recent fact
hits = client.query("Where does Sarah work?", entity_id="user-123")
# → "Sarah now works as a staff engineer at TechStart"

# Historical query — ask what was true at a specific point in time
hits = client.query(
    "Where does Sarah work?",
    entity_id="user-123",
    before=datetime(2025, 12, 1),
)
# → "Sarah works as a software engineer at Acme Corp"
```

### Entity Scoping

The `entity_id` parameter scopes all memories to a specific user, organization, or arbitrary entity. This eliminates the multi-tenancy problem entirely — you don't need to build collection-per-user patterns or metadata filters. The engine handles isolation natively:

```python
client.ingest(entity_id="user-123", text="I use Vim as my editor")
client.ingest(entity_id="user-456", text="I use VS Code as my editor")

# Each user gets only their own results
hits_a = client.query("What editor do I use?", entity_id="user-123")
hits_b = client.query("What editor do I use?", entity_id="user-456")
# → No cross-user leakage
```

### Deterministic Aggregation

When multiple facts exist for the same entity, Tellodb can aggregate them deterministically — you control whether the query returns the latest fact, all facts with recency scores, or a consolidated summary. This replaces the manual consolidation script you'd otherwise need to build:

```python
# Aggregate all facts for a user into a structured profile
hits = client.query("summarize", entity_id="user-123", aggregate="latest")
for hit in hits:
    print(f"[{hit.created_at_ms}] {hit.textual_content}")
```

### From Local to Cloud — Same API

The local binary is zero-config for development. When you're ready for production, switch to cloud mode with one line changed:

```python
# Development
client = TellodbClient.from_local()

# Production — same API, managed infrastructure
client = TellodbClient.from_cloud(
    base_url="https://api.tellodb.com",
    api_key="YOUR_KEY",
)

# All ingest/query calls remain identical
client.ingest(entity_id="user-123", text="Hello, world.")
hits = client.query("Hello", entity_id="user-123")
```

No schema changes. No migration. No Docker compose files. The same `ingest()` and `query()` calls work locally and in production.

Tellodb gives you all three approaches in one binary — local for development, cloud for production, same API.

## Production Considerations

Moving from tutorial to production requires addressing several concerns:

### Latency

Every memory operation involves an embedding API call, which adds 100-500ms of latency. Strategies to mitigate this:

- **Cache embeddings** locally. If you store the embedding alongside the memory (which Chroma does automatically), you avoid re-computing embeddings for memories you already have.
- **Batch embedding calls** when storing multiple memories at once.
- **Use smaller embedding models** like `text-embedding-3-small` for non-critical retrievals, reserving larger models for important queries.

### Cost Management

Embedding costs scale linearly with memory operations. At $0.02 per million tokens for `text-embedding-3-small`, a system storing 1,000 memories per day with 100-token average length costs roughly $0.002/day. The real cost is in the LLM calls for contradiction detection and fact extraction. Budget accordingly.

### Multi-Tenancy

If your agent serves multiple users, you need to isolate memories per user. Chroma supports this with collection-per-user or metadata filtering:

```python
def store_for_user(user_id: str, content: str, memory_type: MemoryType):
    memory.store(content, memory_type, {"user_id": user_id})

def recall_for_user(user_id: str, query: str, top_k: int = 5):
    results = memory.recall(query, top_k=top_k * 2)  # over-fetch
    return [r for r in results if r["metadata"].get("user_id") == user_id][:top_k]
```

For serious multi-tenancy, use a vector database with native filtering like [Weaviate](https://weaviate.io/) or [Qdrant](https://qdrant.tech/), which can filter on metadata at query time without retrieving and discarding results.

### Memory Consolidation

Over time, you accumulate redundant memories. "Sarah likes Python," "Sarah's preferred language is Python," and "Sarah programs in Python mostly" are all the same fact. Periodic consolidation cleans this up:

```python
def consolidate_memories(user_id: str):
    """Group similar memories and merge duplicates."""
    profile = memory.get_user_profile()
    
    response = client.chat.completions.create(
        model="gpt-4",
        messages=[
            {
                "role": "system",
                "content": (
                    "Given a list of facts about a user, identify duplicates "
                    "and merge them into canonical forms. Return JSON:\n"
                    '{"canonical_facts": [{"content": "...", "supersedes": ["id1", "id2"]}]}'
                ),
            },
            {
                "role": "user",
                "content": json.dumps(profile["facts"]),
            },
        ],
        response_format={"type": "json_object"},
    )
    
    result = json.loads(response.choices[0].message.content)
    for fact in result.get("canonical_facts", []):
        if len(fact.get("supersedes", [])) > 1:
            # Merge: supersede old IDs and store canonical version
            memory.supersede(fact["supersedes"][0], fact["content"], "consolidation")
            for old_id in fact["supersedes"][1:]:
                memory.supersede(old_id, fact["content"], "consolidation")
```

Run this periodically (weekly or monthly) to keep your memory store clean and accurate.

## Key Takeaways

Let's recap what we covered:

**File-based memory** is the simplest approach — just JSON files with keyword search. It's great for prototypes and learning the concepts. The limitations (no semantic search, poor scaling) make it unsuitable for production.

**Vector database memory** adds semantic understanding. Using embeddings and cosine similarity, you can retrieve memories based on meaning, not just keywords. This is the standard approach used by most production systems. Libraries like [LangChain](https://python.langchain.com/docs/concepts/memory/) and [LlamaIndex](https://docs.llamaindex.ai/en/stable/understanding/agent/memory/) build on this pattern with higher-level abstractions.

**Structured memory with metadata** combines the best of both worlds. You get semantic search for recall, structured metadata for filtering, and versioning for handling contradictions. This is what you need for a serious AI agent that serves real users.

The specific tools matter less than the architecture. Whether you use Chroma, Pinecone, Weaviate, or a custom solution, the core patterns are the same:

1. Store memories with embeddings and metadata outside the model.
2. Retrieve relevant memories using semantic search.
3. Auto-extract new facts from conversations.
4. Handle contradictions through superseding, not deletion.
5. Consolidate periodically to keep things clean.

## Next Steps

Now that you have the fundamentals, here are directions to explore:

- **Conversation summarization.** Instead of storing every message, periodically summarize conversations into key facts. This reduces noise while preserving important information.
- **Temporal awareness.** Track when memories were created and relevance decays over time. Recent information is usually more relevant than old information.
- **Multi-modal memories.** Store images, code snippets, or documents alongside text memories. Use multi-modal embeddings to search across modalities.
- **Memory-augmented generation.** Pass retrieved memories directly into structured prompts rather than stuffing them into the system message. This gives you more control over how the model uses the information.

The code from this tutorial is available as a starting point. Fork it, adapt it, and build agents that actually remember.
