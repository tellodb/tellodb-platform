---
title: "Self-Hosting AI Memory with Rust: A Step-by-Step Guide"
description: "Run your own AI memory engine on your infrastructure. One Rust binary, zero dependencies, full control over user data."
excerpt: "Self-hosting your AI memory engine gives you full control over user data, zero vendor lock-in, and predictable costs. This guide walks through building and deploying a Rust memory engine from source."
publishedAt: 2026-05-28T00:00:00.000Z
updatedAt: 2026-05-28T00:00:00.000Z
author: "Sharjeel"
tags:
  - Self-Hosting
  - Rust
  - AI Memory
  - Open Source
  - Docker
  - Privacy
image: /screen.png
featured: false
---

When you build an AI agent that remembers user preferences, conversation history, and learned facts, you are building something with real privacy implications. Every memory stored is personal data — the kind of data that users trust you with, that regulations like GDPR govern, and that a data breach turns into headlines.

Most teams reach for hosted memory services by default. A managed vector database, a cloud API, a third-party abstraction layer. It works. But it also means your users' memories live on someone else's server, billed per request, subject to their uptime and their policies.

Self-hosting your AI memory engine is not a nostalgic return to running servers in a closet. It is a deliberate architectural decision: you keep full control over user data, you pay predictable costs regardless of scale, and you eliminate vendor lock-in at the infrastructure layer. This guide walks through building and deploying a Rust memory engine from source — the binary is called Tellodb — and connecting it to your Python-based AI agent.

## Why Self-Host Your AI Memory

### Privacy and Data Sovereignty

AI memory systems store sensitive information: user names, preferences, medical notes, financial details, personal opinions. When this data lives on a third-party service, you are trusting their security practices, their compliance certifications, and their incident response. Self-hosting puts that data on hardware you control, under policies you define.

For teams building in regulated industries — healthcare, finance, education — this is not optional. Compliance frameworks often require that you know exactly where personal data lives and who can access it. A self-hosted memory engine behind your firewall gives you that visibility.

### Cost Predictability

Hosted memory services charge per request, per GB stored, and per embedding generated. For a small project with a few hundred users, this is negligible. For a production system handling millions of memory operations, costs become unpredictable. A self-hosted Rust binary running on your own infrastructure has a flat cost — the server you already pay for. No per-request fees, no surprise bills when usage spikes.

### No Vendor Lock-in

When your memory layer is a managed service, migrating means rewriting ingestion pipelines, reformatting stored data, and rebuilding retrieval logic. When your memory layer is a single binary you compiled from source, migrating means copying a SQLite file and updating a connection string. The difference matters when you need to move between cloud providers, consolidate infrastructure, or simply negotiate better terms.

### Full Control Over the Stack

Self-hosting means you can modify behavior at every level. Need a custom ranking function for retrieval? Fork and compile. Want to change the chunking strategy for conversations? Edit the source. Need to add a new API endpoint for your specific use case? Build it. You are not limited by what a managed service exposes through its API.

## Prerequisites

Before building the memory engine, make sure you have the following installed.

**Rust toolchain** — The engine is written in Rust. Install it with [rustup](https://rustup.rs/):

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

After installation, verify:

```bash
rustc --version
# rustc 1.78.0 (9b00956e5 2024-04-29)

cargo --version
# cargo 1.78.0 (54d8815d0 2024-03-26)
```

**Python 3.10+** — The Python SDK requires 3.10 or later:

```bash
python3 --version
# Python 3.11.7
```

**Docker** (optional) — For containerized deployment:

```bash
docker --version
# Docker version 25.0.3, build 4debf41

docker compose version
# Docker Compose version v2.24.5
```

**SQLite** — The engine uses [SQLite](https://www.sqlite.org/) for persistent storage. No separate database server is required — SQLite is embedded directly into the binary.

That is the full list. No database server to install, no background services to manage, no configuration files to write before the first run.

## Building the Engine from Source

The memory engine compiles to a single binary. Here is the complete build process.

Clone the repository and enter the project directory:

```bash
git clone https://github.com/Tellodb/Tellodb.git
cd tellodb
```

Build in release mode for production use. The default debug build works for testing but runs significantly slower:

```bash
cargo build --release
```

On a modern laptop (Apple M2, 16GB RAM), the first build can take 10-20 minutes due to compiling dependencies like Candle and ONNX Runtime. Subsequent builds only recompile changed files, usually finishing in under 30 seconds.

You will see compiler warnings during the build. These are expected — the project uses some nightly features and allows warnings for certain experimental modules. Focus on whether the build succeeds (exit code 0), not on the warnings.

After the build completes, the binary is at `target/release/tellodb`:

```bash
ls -lh target/release/tellodb
# -rwxr-xr-x  1 sharjeel  staff  45M May 28 00:00 target/release/tellodb
```

The binary is approximately 45MB. It includes the full memory engine, embedding support, and the HTTP server. No runtime dependencies — copy this single file to any Linux or macOS system and it runs.

## Running Locally

Start the engine with default settings:

```bash
./target/release/tellodb
```

The output shows the server initializing and binding to a port:

```
 INFO tellodb: Initializing Temporal Multi-Model Memory Engine...
 INFO tellodb: Runtime data root
 INFO tellodb: Initializing Semantic Pipeline (embedder + MiniLM + BERT-NER)...
 INFO tellodb: Semantic embedder initialized model_id=BAAI/bge-small-en-v1.5 dims=384
 INFO tellodb: Semantic device selected device=CPU executors=4
 INFO tellodb: Initializing Vector Substrate (HNSW)...
 INFO tellodb: Initializing Tenant Database Manager (Sharded SQLite)...
 INFO tellodb: Initializing Platform Substrate...
 INFO tellodb: Initializing Analytics Substrate (Numeric Vault)...
 INFO tellodb: Memory Engine live address=0.0.0.0:3000
```

The engine stores data in `./data` (or whatever `TEMPORAL_MEMORY_DATA_DIR` points to) by default. The first time you run it, this directory and database file are created automatically. On subsequent runs, existing data is loaded and preserved.

Verify the server is running with a health check:

```bash
curl http://127.0.0.1:3000/health
# {"status":"ok"}
```

To stop the engine, press `Ctrl+C`. The server shuts down gracefully, flushing any pending writes to disk.

### Custom Configuration

The engine is configured entirely through environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `TEMPORAL_MEMORY_HOST` / `ALETHEIA_HOST` | `0.0.0.0` | Bind address |
| `PORT` / `TEMPORAL_MEMORY_PORT` | `3000` | Listen port |
| `TEMPORAL_MEMORY_DATA_DIR` / `ALETHEIA_DATA_DIR` | `.` | Root data directory |
| `TEMPORAL_MEMORY_API_KEY` / `ALETHEIA_API_KEY` | `XXX1111AAA` (debug) | API key for request auth |
| `TEMPORAL_MEMORY_EMBEDDING_BACKEND` | `ort` | Embedding backend (`candle` or `ort`) |
| `TEMPORAL_MEMORY_EMBEDDING_MODEL` | `BAAI/bge-small-en-v1.5` | HuggingFace model ID |
| `TEMPORAL_MEMORY_DEVICE` | CPU | Device label (informational) |
| `ALETHEIA_HNSW_CONNECTIVITY` | `16` | HNSW M parameter |
| `ALETHEIA_HNSW_EF_SEARCH` | `64` | HNSW ef_search parameter |

The engine also reads optional ranking config from `ranking_config.json` in the data directory.

## Connecting with the Python SDK

The Python SDK wraps the HTTP API. Install it with pip:

```bash
pip install tellodb
```

Initialize the client:

```python
from tellodb import TellodbClient

# Run the engine locally (auto-downloads and manages the binary)
client = TellodbClient.from_local(
    api_key="XXX1111AAA",
)

# Or connect to a running engine instance:
# client = TellodbClient.from_cloud(
#     base_url="http://127.0.0.1:3000",
#     api_key="XXX1111AAA",
# )

# Verify the connection
version = client.engine_version()
print(f"Connected to the memory engine, version {version.engine_version}")
# Connected to the memory engine, version 0.1.0
```

## Storing and Querying Memories

The core operations are ingest, query, inspect, and delete. Here is how each works.

### Ingesting a Memory

A memory consists of entity_id, text, and optional metadata:

```python
from tellodb import TellodbClient

client = TellodbClient.from_local(api_key="XXX1111AAA")

# Ingest a memory for a specific user
client.ingest(
    entity_id="user:sarah",
    text="User prefers dark mode and uses a screen reader",
)

# Ingest another memory
client.ingest(
    entity_id="user:sarah",
    text="User works at Acme Corp as a software engineer",
)
```

The `entity_id` field scopes memories to individual users, teams, or projects. All queries are scoped by entity_id to ensure isolation.

### Querying Memories

Query retrieves the most relevant memories for a given question. The engine uses hybrid vector+lexical retrieval with built-in ranking:

```python
hits = client.query(
    "What are the user's accessibility preferences?",
    entity_id="user:sarah",
    top_k=5,
)

for hit in hits:
    print(f"[{hit.similarity:.3f}] {hit.textual_content}")
    # [0.912] User prefers dark mode and uses a screen reader
    # [0.421] User works at Acme Corp as a software engineer
```

The `similarity` field is a score between 0 and 1. Higher means more relevant. The engine returns results sorted by score.

### Inspecting and Deleting Memories

Inspect a specific memory by its ID:

```python
details = client.inspect_memory(memory_id="user:sarah::session-1::0")
print(details)
```

Delete a memory when it is no longer needed:

```python
result = client.delete_memory(memory_id="user:sarah::session-1::0")
```

### Integrating with an Agent Loop

In a typical agent setup, you store memories after each interaction and retrieve relevant context before each response:

```python
from tellodb import TellodbClient

client = TellodbClient.from_local(api_key="XXX1111AAA")

def agent_respond(user_id: str, user_message: str) -> str:
    # 1. Retrieve relevant memories
    hits = client.query(
        user_message,
        entity_id=user_id,
        top_k=5,
    )
    context = "\n".join(f"- {h.textual_content}" for h in hits)

    # 2. Build the prompt with memory context
    system_prompt = f"""You are a helpful assistant.
    
Relevant user context:
{context}
"""
    # 3. Call your LLM with the context
    # response = call_llm(system_prompt, user_message)

    # 4. Store the interaction as a new memory
    client.ingest(entity_id=user_id, text=user_message)

    return "response from your LLM"
```

This pattern gives your agent persistent memory across sessions without modifying the LLM itself. The memory engine handles storage, retrieval, and relevance ranking.

## Docker Deployment

For environments where you prefer containerized deployment, here is a Dockerfile and docker-compose configuration.

### Dockerfile

```dockerfile
FROM rust:1.78-slim as builder

WORKDIR /app
COPY . .
RUN cargo build --release

FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/target/release/tellodb /usr/local/bin/

RUN useradd -r -s /bin/false tellodb
USER tellodb

EXPOSE 3000

VOLUME ["/data"]

ENV TEMPORAL_MEMORY_DATA_DIR=/data
ENV TEMPORAL_MEMORY_HOST=0.0.0.0
ENV TEMPORAL_MEMORY_PORT=3000
CMD ["tellodb"]
```

Build the image:

```bash
docker build -t tellodb:latest .
```

### Docker Compose

For a production-ready setup with persistent storage:

```yaml
services:
  tellodb:
    build: .  # build from Dockerfile in repo
    container_name: tellodb
    restart: unless-stopped
    ports:
      - "127.0.0.1:3000:3000"
    volumes:
      - tellodb-data:/data
    environment:
      - TEMPORAL_MEMORY_DATA_DIR=/data
      - TEMPORAL_MEMORY_API_KEY=my-secret-key
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 5s
      retries: 3

volumes:
  tellodb-data:
    driver: local
```

Start the service:

```bash
docker compose up -d
```

Check the logs:

```bash
docker compose logs -f
# tellodb  |  INFO tellodb: Memory Engine live address=0.0.0.0:3000
```

The `ports` binding uses `127.0.0.1:3000:3000` so the engine is only accessible from the local machine. For remote access, change this to `3000:3000` and add TLS in front (covered in the next section).

### Connecting from Python to Docker

No changes needed. The Python SDK connects to the same host and port:

```python
from tellodb import TellodbClient

# Works identically whether the engine runs locally or in Docker
client = TellodbClient.from_cloud(
    base_url="http://127.0.0.1:3000",
    api_key="my-secret-key",
)
```

## Production Hardening

Running the engine on your laptop is fine for development. For production, you need to add a few layers.

### Backups

SQLite supports online backups. The simplest approach is to copy the database file while the engine is running (SQLite's WAL mode ensures consistency):

```bash
# Stop the engine, copy, restart — safest for critical backups
docker compose stop tellodb
cp /var/lib/tellodb/tellodb.db /backups/tellodb-$(date +%Y%m%d).db
docker compose start tellodb
```

For zero-downtime backups, use SQLite's backup API or a filesystem snapshot:

```bash
# LVM snapshot example (Linux)
lvcreate --size 1G --snapshot --name tellodb-snap /dev/vg0/tellodb-data
mount /dev/vg0/tellodb-snap /mnt/snapshot
cp /mnt/snapshot/tellodb.db /backups/
umount /mnt/snapshot
lvremove /dev/vg0/tellodb-snap
```

Automate this with a cron job or a systemd timer. Keep at least 7 daily backups and 4 weekly backups.

### Monitoring

The engine exposes a `/metrics` endpoint in Prometheus format:

```bash
curl http://127.0.0.1:3000/metrics
# tellodb_ingest_total 14523
# tellodb_query_total 8901
# tellodb_query_duration_seconds_bucket{le="0.005"} 7200
# tellodb_query_duration_seconds_bucket{le="0.01"} 8800
# tellodb_query_duration_seconds_bucket{le="0.05"} 8900
```

Add this to your Prometheus scrape config and set up alerts for:

- **High latency** — search latency p99 above 50ms indicates the database needs indexing
- **Disk usage** — database file growing beyond expected size
- **Error rate** — failed store or search operations

### TLS Termination

The engine listens on plain HTTP. Put a reverse proxy in front for TLS:

```nginx
# /etc/nginx/sites-available/tellodb
server {
    listen 443 ssl http2;
    server_name memory.example.com;

    ssl_certificate /etc/letsencrypt/live/memory.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/memory.example.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

For Docker environments, use Caddy or Traefik for automatic TLS:

```yaml
services:
  caddy:
    image: caddy:2
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy-data:/data

  tellodb:
    build: .  # build from Dockerfile in repo
    expose:
      - "3000"

volumes:
  caddy-data:
```

```caddyfile
memory.example.com {
    reverse_proxy tellodb:3000
}
```

### Firewall Rules

Restrict access to the engine. Even with TLS, you should limit who can connect:

```bash
# Allow only your application servers
ufw allow from 10.0.1.0/24 to any port 3000
ufw deny 3000
```

## Self-Hosted vs. Cloud: A Comparison

| Factor | Self-Hosted Memory Engine | Cloud Memory Service |
|--------|------------------------|---------------------|
| **Data location** | Your servers, your jurisdiction | Third-party data centers |
| **Cost model** | Fixed (server + bandwidth) | Per-request, per-GB |
| **Latency** | Sub-millisecond (local) | 50-200ms (network) |
| **Scaling** | Manual (vertical + horizontal) | Automatic |
| **Maintenance** | You handle updates, backups | Managed by provider |
| **Customization** | Full source access | Limited to API |
| **Vendor lock-in** | None | High |
| **Compliance** | You control certifications | Provider's certifications |
| **High availability** | You build it (replication, failover) | Built-in SLA |
| **Time to first deployment** | ~10 minutes (build + run) | ~5 minutes (sign up + API key) |

The right choice depends on your priorities. If you need to ship in an afternoon and do not mind trusting a third party, cloud is faster. If you need control over data, predictable costs, and the ability to customize behavior, self-hosting is the better long-term investment.

Many teams start with self-hosting for development and testing, then deploy the same binary to production. The engine runs identically in both environments, so there is no code change when you move from your laptop to a server.

## Conclusion

Self-hosting your AI memory engine is a practical decision, not a philosophical one. You get full control over user data, predictable costs, and the ability to customize every layer of the stack. The tradeoff is that you are responsible for operations — backups, monitoring, scaling. But with a single binary that embeds its own database, the operational surface is small.

This guide covered the complete path from building the engine to deploying it in production. You started with a Rust binary, ran it locally, connected it with Python, stored and queried memories, containerized it with Docker, and hardened it for production use. Every step used the same engine with the same API.

The memory engine you built today scales horizontally — run multiple instances behind a load balancer, each with its own SQLite database, and route users to specific instances by namespace. Or run a single instance on a Raspberry Pi for a personal AI assistant that lives in your home network.

For more details, check the [GitHub repository](https://github.com/SharjeelAbbas014/Tellodb) and the [Python SDK reference](https://pypi.org/project/tellodb/). The source code is open — read it, modify it, contribute back.
