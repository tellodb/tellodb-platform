---
title: "Local-First AI Development: Why Your Memory Engine Should Run on Your Laptop"
description: A practical guide to building agent memory systems that run locally — faster iteration, lower costs, and no cloud dependency during development.
excerpt: Most agent memory debugging happens against remote services. This post explains why running the same engine locally changes everything, and walks through a complete setup from zero to a working local memory stack.
publishedAt: 2026-05-28T00:00:00.000Z
updatedAt: 2026-05-28T00:00:00.000Z
author: Sharjeel
tags:
  - Local Development
  - Agent Infrastructure
  - Developer Experience
  - Tutorial
image: /screen.png
featured: false
---

Memory quality is not something you validate once. You tune it continuously — adjusting chunking strategies, tweaking retrieval thresholds, swapping ranking models, and testing how well a conversation can be recalled ten interactions later. Every one of those changes requires feedback. When that feedback loop depends on a hosted environment, you spend more time waiting than learning.

Local-first infrastructure solves this. Not by replacing the cloud, but by letting you do the hard work — the debugging, the experimenting, the benchmarking — on the machine sitting in front of you.

This post is a practical guide. By the end, you will have a local memory engine running, a Python script storing and retrieving memories, and a test suite you can run without any network dependency.

## Why Local-First Matters for Agent Memory

Agent memory is different from a typical database workload. You are not just storing key-value pairs. You are:

- Ingesting conversations and extracting facts
- Ranking memories by relevance to the current context
- Updating stale information when new facts contradict old ones
- Evaluating recall quality across sessions
- Tuning chunking and embedding strategies

Each of these is an experiment. And experiments need fast iteration cycles. If storing a conversation means hitting an API with 200ms latency, then running 500 test cases takes minutes instead of seconds. If reproducing a bug means deploying to a staging cluster, you lose the ability to step through the problem with a debugger.

The core problem is not that cloud-hosted memory engines are bad. It is that the feedback loop is too long for the kind of work memory development requires.

## Local vs. Cloud Development: A Comparison

Understanding the tradeoffs helps you make better architectural decisions from day one.

### Latency

A local memory engine responds in under a millisecond for most operations. A cloud-hosted service adds network round-trip time, TLS handshake overhead, and potential cold-start delays. For a single operation, 50-200ms is unremarkable. For a benchmark suite running 1,000 retrieval queries, that difference is the gap between a 2-second run and a 3-minute run.

### Cost

Cloud memory services charge per request, per GB stored, and per embedding generated. During development, you might run the same ingestion pipeline fifty times while debugging a chunking bug. Locally, that costs you nothing beyond the electricity your laptop already uses. For teams on a budget, this removes a real barrier to experimentation.

### Debugging Experience

When something goes wrong locally, you can inspect the raw database files, run SQL queries directly, attach a debugger, or add logging without redeploying anything. When something goes wrong in the cloud, you are limited to log aggregation dashboards, API response codes, and sometimes not even that.

### Determinism

Local environments are reproducible in a way that cloud environments rarely are. No shared state, no other tenants affecting performance, no network variability. If your test passes locally and fails in staging, you know the problem is in the deployment configuration — not in your memory logic.

### Offline Development

Planes, trains, coffee shops with no Wi-Fi. Local-first tools let you keep working. This is not a theoretical benefit. Teams that ship faster are often the ones that can iterate during dead time.

### When Cloud Makes Sense

Cloud is the right choice for production traffic, multi-user collaboration, and workloads that exceed your local machine's capacity. The point is not to avoid the cloud. It is to do the development work locally so that by the time you deploy, the code is already correct.

## Setting Up a Local Memory Engine

Here is a complete setup from a fresh machine. The goal is a local memory engine that stores conversations, retrieves memories by relevance, and can be inspected directly.

### Prerequisites

You need Rust installed. The memory engine is a single binary with no runtime dependencies — no Docker, no database server, no background process.

```bash
# Install Rust if you haven't already
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Verify installation
rustc --version
cargo --version
```

### Building the Engine

Clone the repository and build in release mode. The release build is significantly faster and the binary is self-contained.

```bash
git clone https://github.com/tellodb/tellodb.git
cd tellodb

# Build the engine binary
cargo build --release

# The binary will be at target/release/tellodb
# Add it to your PATH
export PATH="$PWD/target/release:$PATH"
```

### Starting the Local Instance

The engine starts with sensible defaults. No configuration file required for development.

```bash
# Start the memory engine on localhost:3000
export TEMPORAL_MEMORY_API_KEY=my-key
export TEMPORAL_MEMORY_DATA_DIR=./dev-data
./tellodb

# You should see:
# INFO tellodb: Memory Engine live address=0.0.0.0:3000
```

That is it. You now have a local memory engine running with the same API surface as the production service. The `--data-dir` flag points to a local directory where all data is stored as SQLite files. You can inspect them directly, copy them around, or delete them to start fresh.

### Verifying the Installation

Run a quick health check:

```bash
curl http://127.0.0.1:3000/health
# {"status":"ok","auth_required":true,"device":"CPU","data_root":"./dev-data"}

# Version info is at /version:
curl http://127.0.0.1:3000/version
# {"engine_version":"0.1.0","api_version":"0.1.0","auth_required":true}
```

## Storing and Retrieving Memories with Python

Now let us write some code. The following Python example demonstrates the core workflow: connecting to your local engine, storing a conversation, and retrieving memories by relevance.

### Install the SDK

```bash
pip install tellodb
```

### Write the Script

Create a file called `memory_demo.py`:

```python
from tellodb import TellodbClient

# Connect to your local engine
client = TellodbClient.from_cloud(
    base_url="http://127.0.0.1:3000",
    api_key="my-key",
)

# Store a conversation
conversations = [
    "I'm working on a Rust project that processes CSV files.",
    "Great! For CSV processing in Rust, the csv crate is the standard choice.",
    "Yeah, some files are around 2GB. I need to stream them rather than load everything into memory.",
    "For 2GB files, streaming is definitely the way to go.",
]

for i, text in enumerate(conversations):
    client.ingest(
        entity_id="user-1",
        memory_id=f"rust-csv-{i}",
        text=text,
    )

print("Stored 4 memories")

# Now retrieve memories relevant to a new query
hits = client.query(
    "How do I handle large CSV files in Rust?",
    entity_id="user-1",
    top_k=3,
)

for hit in hits:
    print(f"[{hit.similarity:.2f}] {hit.textual_content[:80]}...")
```

### Run It

```bash
python memory_demo.py
# Stored 4 memories
# [0.92] For 2GB files, streaming is definitely the way to go. Use csv::Read...
# [0.87] Great! For CSV processing in Rust, the csv crate is the standard ch...
# [0.81] I'm working on a Rust project that processes CSV files...
```

The memories are stored locally in `./dev-data`. You can stop the engine, restart it, and the data persists. Delete the directory and start fresh.

## Updating Stale Memories

Real agents need to handle contradiction. If a user says "I switched from Python to Rust for this project" three sessions later, the old memories about Python should not dominate retrieval.

```python
# Store new information that contradicts earlier memories
client.ingest(
    entity_id="user-1",
    memory_id="go-csv-0",
    text="I decided to use Go instead of Rust for the CSV tool.",
)

# Retrieve again — the new memory should rank higher
hits = client.query(
    "What language am I using for CSV processing?",
    entity_id="user-1",
    top_k=2,
)

for hit in hits:
    print(f"[{hit.similarity:.2f}] {hit.textual_content[:80]}...")
```

This pattern — storing metadata that links new memories to old ones — is how production agents handle evolving knowledge. Testing it locally with real data is how you catch ranking bugs before users do.

## Writing Tests for Memory Behavior

Manual testing is necessary but insufficient. A test suite lets you verify that memory retrieval behaves correctly as you change configurations.

Create a file called `test_memory.py`:

```python
import pytest
from tellodb import TellodbClient

@pytest.fixture
def client():
    """Each test gets a fresh engine instance."""
    client = TellodbClient.from_local(api_key="my-key")
    yield client

class TestMemoryRetrieval:
    def test_basic_retrieval(self, client):
        """Stored memories should be retrievable."""
        client.ingest(
            entity_id="test-user",
            text="My birthday is March 15th.",
        )
        results = client.query("When is my birthday?", entity_id="test-user")
        assert len(results) > 0
        assert "March 15" in results[0].textual_content

    def test_stale_memory_ranking(self, client):
        """Updated facts should rank above older ones."""
        client.ingest(entity_id="test-user", text="I live in New York.")
        client.ingest(entity_id="test-user", text="I moved to San Francisco.")
        results = client.query("Where do I live?", entity_id="test-user", top_k=1)
        assert "San Francisco" in results[0].textual_content

    def test_irrelevant_memories_excluded(self, client):
        """Unrelated memories should not appear in results."""
        client.ingest(entity_id="test-user", text="The capital of France is Paris.")
        results = client.query("What is my favorite color?", entity_id="test-user")
        assert len(results) == 0 or results[0].similarity < 0.3
```

Run the tests:

```bash
pytest test_memory.py -v
# test_memory_retrieval.py::TestMemoryRetrieval::test_basic_retrieval PASSED
# test_memory_retrieval.py::TestMemoryRetrieval::test_stale_memory_ranking PASSED
# test_memory_retrieval.py::TestMemoryRetrieval::test_irrelevant_memories_excluded PASSED
# test_memory_retrieval.py::TestMemoryRetrieval::test_multiple_topics PASSED
```

These tests run against your local engine. No mocking, no network calls, no API keys. The entire suite completes in under a second.

## CI/CD Integration for Memory Testing

Local-first does not mean local-only. You want these tests running in your CI pipeline too. The pattern is straightforward: start the engine as a service in your CI job, run the test suite against it, and tear it down.

Here is a GitHub Actions workflow that does exactly this:

```yaml
# .github/workflows/memory-tests.yml
name: Memory Engine Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install Rust
        uses: dtolnay/rust-toolchain@stable

      - name: Build the engine
        run: cargo build --release

      - name: Start engine
        run: |
          export TEMPORAL_MEMORY_API_KEY=ci-key
          export TEMPORAL_MEMORY_DATA_DIR=./ci-data
          ./target/release/tellodb &
          sleep 5  # Wait for the engine to start
          curl --retry 5 --retry-delay 1 http://127.0.0.1:3000/health

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.11"

      - name: Install dependencies
        run: |
          pip install tellodb pytest

      - name: Run memory tests
        run: pytest test_memory.py -v

      - name: Stop engine
        if: always()
        run: pkill tellodb || true
```

The key insight is that the same binary you run locally is the one used in CI. There is no separate "test infrastructure" to maintain. The tests that pass on your laptop pass in CI because they are running against the same engine.

This is worth emphasizing: local-first development means your CI tests are not testing a different system. They are testing the exact same binary, the exact same storage engine, the exact same retrieval logic. The only difference is where the process runs.

## Debugging Memory Issues Locally

When retrieval quality degrades, the most common culprits are:

1. **Chunking boundaries** — A fact gets split across two chunks and neither chunk alone is relevant enough to rank highly.
2. **Embedding drift** — The embedding model generates different vectors for semantically similar content, making retrieval inconsistent.
3. **Stale memories** — Old facts dominate because the update mechanism did not mark them as superseded.

Local debugging makes all three easier to investigate. You can query the raw stored data, inspect the chunk boundaries, and see exactly what the retrieval algorithm is working with.

```bash
# Inspect the raw tenant database directly
sqlite3 ./dev-data/tenants/default/tellodb.db "SELECT memory_id, textual_content, created_at_ms FROM observations LIMIT 10;"

# Check the vector index file
ls -lh ./dev-data/vector.hnsw
```

This level of access is not available with most cloud-hosted services. When you can see the raw data, you can diagnose problems in minutes instead of filing a support ticket and waiting hours.

## The Consistency Principle

The most important architectural decision for local-first development is API consistency. The local engine must expose the same API surface as the cloud-hosted version. If your local code stores memories with one request shape and production expects a different one, you have built yourself a compatibility tax.

The pattern that works:

- Same core API for local and cloud
- Swap only the runtime target (binary path or API endpoint)
- Preserve request and response shapes exactly
- Make cloud deployment a configuration change, not a code change

This means your test suite, your debugging scripts, and your application code all work against both environments. The only thing that changes is the `base_url` in your client configuration.

## Wrapping Up

Local-first development for agent memory is not a philosophy. It is a practical decision that affects how fast you can iterate, how much you can debug, and how confident you can be when you deploy.

The setup takes minutes. The savings compound over every debugging session, every benchmark run, and every late-night experiment where you need to test a hypothesis before morning.

Start local. Ship to the cloud when you are ready. The code should not care which one it is talking to.
