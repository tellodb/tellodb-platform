---
title: "How to Add Persistent Memory to Any OpenAI Agent (Without Rewriting Your Code)"
description: "A step-by-step tutorial showing how to add cross-session memory to existing OpenAI agents using a proxy-based approach—no SDK changes required."
excerpt: "Most memory solutions require deep integration work. This tutorial walks through adding persistent, time-aware memory to an existing OpenAI agent using a transparent proxy that intercepts API calls."
publishedAt: 2026-05-28T00:00:00.000Z
updatedAt: 2026-05-28T00:00:00.000Z
author: "Tellodb Team"
tags:
  - OpenAI Proxy
  - Integration
  - Tutorial
image: /screen.png
featured: true
---

> **Note:** The OpenAI-compatible proxy described in this post is a **planned feature** currently in development. The proxy endpoint is not yet available in the Tellodb engine. This post describes the architecture and design — check back for implementation status.

# How to Add Persistent Memory to Any OpenAI Agent (Without Rewriting Your Code)

If you have an existing AI agent built on the OpenAI API, you have probably hit this wall: every conversation starts from scratch. The agent does not remember the user's name, preferences, or what happened five minutes ago—let alone last week.

Adding memory is the obvious fix. But most memory solutions demand a rewrite. You need a new SDK, custom retrieval logic, and significant changes to your data flow. That might be acceptable for a greenfield project, but it is a hard sell when you have production agents running today.

This tutorial shows a different approach. You will add persistent, cross-session memory to an existing OpenAI agent by changing a single configuration value. No new dependencies. No refactored retrieval layer. Just a transparent proxy that sits between your application and the OpenAI API.

## What you will build

By the end of this tutorial, you will have:

- An existing OpenAI agent augmented with persistent memory
- Cross-session recall so the agent remembers users across conversations
- Time-aware retrieval that surfaces the most recent facts, not stale ones
- Custom scoping to prevent memory leakage between users
- A test suite verifying the integration works correctly
- An understanding of when this approach fits versus alternatives

This tutorial targets developers who already have working agents—customer support bots, coding assistants, data analysis tools—and want to layer on memory without disrupting what works today. We will use [Tellodb](https://tellodb.com) as the memory backend, but the proxy pattern applies to any OpenAI-compatible memory service.

> **Note:** The interactive code examples below use `https://memory-proxy.example.com/v1` as a placeholder URL. When the proxy feature ships, the actual endpoint will be documented at `/docs/proxy`.

## Prerequisites

- Python 3.10 or later
- An [OpenAI API key](https://platform.openai.com/docs/api-reference/authentication)
- Familiarity with the OpenAI Python client and chat completions API
- A terminal and a text editor

## How the proxy works

The core idea is simple: instead of pointing your OpenAI client at `https://api.openai.com`, you point it at a memory proxy. The proxy exposes the same OpenAI-compatible interface, so your application does not know the difference.

This works because the [OpenAI chat completions API](https://platform.openai.com/docs/api-reference/chat/create) is a well-defined HTTP interface. Any proxy that speaks the same protocol can sit in front of it. The proxy does not modify your messages, alter the model parameter, or change the response format. It adds memory retrieval and ingestion as transparent side effects.

Here is what happens on every request:

1. Your application sends a chat completion request to the proxy (the same request it would send to OpenAI)
2. The proxy extracts the user identifier from the request headers
3. It queries its memory engine for relevant context about that user—facts, preferences, past interactions
4. Retrieved memories are injected into the system prompt as structured context
5. The augmented request is forwarded to OpenAI's actual API endpoint
6. The response is returned to your application unchanged—the model's output looks like it came directly from OpenAI
7. The conversation turn is ingested into long-term memory in the background, asynchronously

The key insight is that memory becomes an infrastructure concern, not an application concern. Your code sends standard OpenAI API calls. The proxy handles retrieval and ingestion transparently. If the proxy goes down, your agent still works—it just temporarily loses memory until the proxy comes back.

This also means you can test your agent against OpenAI directly (no memory) or against the proxy (with memory) by changing one URL. The behavior is identical except for the presence of recalled context.

## Step-by-step tutorial

### Step 1: Install the OpenAI SDK

If you do not already have the OpenAI Python client, install it:

```bash
pip install openai
```

### Step 2: Basic setup (minimal change)

The simplest integration changes exactly one parameter. Here is a typical OpenAI agent before adding memory:

```python
from openai import OpenAI

# Standard OpenAI client - no memory
client = OpenAI(api_key="sk-your-key-here")

response = client.chat.completions.create(
    model="gpt-4o",
    messages=[
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "My name is Alice and I prefer dark mode."}
    ]
)

print(response.choices[0].message.content)
# "Nice to meet you, Alice! I'll keep your dark mode preference in mind..."
```

Now add memory by swapping the base URL:

```python
from openai import OpenAI

# Same client, same code - just a different endpoint
client = OpenAI(
    api_key="sk-your-key-here",
    base_url="https://memory-proxy.example.com/v1"
)

response = client.chat.completions.create(
    model="gpt-4o",
    messages=[
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "My name is Alice and I prefer dark mode."}
    ]
)

print(response.choices[0].message.content)
# "Nice to meet you, Alice! I'll keep your dark mode preference in mind..."
```

The response looks identical. But the proxy has now stored the facts about Alice's name and dark mode preference. In the next conversation—even hours or days later—the agent will recall them.

Here is what a follow-up session looks like:

```python
# New session, new conversation
response = client.chat.completions.create(
    model="gpt-4o",
    messages=[
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "What theme should I use?"}
    ]
)

print(response.choices[0].message.content)
# "Based on your previous preference, you prefer dark mode."
```

No code changes between sessions. The proxy retrieved the relevant memory and injected it into the system prompt before forwarding to OpenAI.

### Step 3: Custom memory scoping

In production, you need to isolate memory per user. The proxy supports this through custom headers:

```python
from openai import OpenAI

client = OpenAI(
    api_key="sk-your-key-here",
    base_url="https://memory-proxy.example.com/v1",
    default_headers={
        "X-Memory-Entity-Id": "user-abc-123",
    }
)

# This conversation is scoped to user-abc-123
response = client.chat.completions.create(
    model="gpt-4o",
    messages=[
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "I'm vegetarian and allergic to nuts."}
    ]
)
```

Later, a different user connects:

```python
client = OpenAI(
    api_key="sk-your-key-here",
    base_url="https://memory-proxy.example.com/v1",
    default_headers={
        "X-Memory-Entity-Id": "user-def-456",
    }
)

response = client.chat.completions.create(
    model="gpt-4o",
    messages=[
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "What are my dietary restrictions?"}
    ]
)

# "I don't have any dietary restrictions on file for you yet."
# (user-def-456's memory is isolated from user-abc-123)
```

Each entity ID gets its own memory namespace. There is no cross-contamination between users.

### Step 4: Using with LangChain and CrewAI

If your agent uses a framework like [LangChain](https://python.langchain.com/docs/modules/memory/) or [CrewAI](https://docs.crewai.com/), the proxy approach still works. Both frameworks use the OpenAI client under the hood, so you can apply the same base URL change.

Here is how it works with LangChain's `ChatOpenAI`:

```python
from langchain_openai import ChatOpenAI

# LangChain respects the base_url parameter
llm = ChatOpenAI(
    model="gpt-4o",
    base_url="https://memory-proxy.example.com/v1",
    api_key="sk-your-key-here",
)

# Use in a chain as normal
from langchain_core.messages import HumanMessage
response = llm.invoke([HumanMessage(content="My name is Bob.")])
```

For CrewAI, the pattern is similar since CrewAI's `Agent` accepts an LLM instance configured with the same parameters:

```python
from crewai import Agent, Task, Crew

llm = ChatOpenAI(
    model="gpt-4o",
    base_url="https://memory-proxy.example.com/v1",
    api_key="sk-your-key-here",
)

researcher = Agent(
    role="Research Analyst",
    goal="Find relevant information",
    llm=llm,
    # ... other params
)
```

The framework does not need to know about memory. The proxy handles everything at the HTTP layer.

## Testing the integration

You should verify that memory works correctly before shipping to production. There are several failure modes to check: facts not being stored, facts leaking between users, and stale facts not being superseded.

Here is a practical test script that covers all three:

```python
import time
from openai import OpenAI

PROXY_URL = "https://memory-proxy.example.com/v1"
API_KEY = "sk-your-key-here"
TEST_ENTITY = f"test-user-{int(time.time())}"  # unique per run

def create_client(entity_id=None):
    headers = {}
    if entity_id:
        headers["X-Memory-Entity-Id"] = entity_id
    return OpenAI(
        api_key=API_KEY,
        base_url=PROXY_URL,
        default_headers=headers,
    )

def chat(client, message):
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": message},
        ],
    )
    return response.choices[0].message.content

# Test 1: Store a fact
client = create_client(TEST_ENTITY)
chat(client, "My favorite color is teal.")
print("Stored fact: favorite color is teal")

# Test 2: Recall the fact in a new session
client2 = create_client(TEST_ENTITY)  # new client, same entity
response = chat(client2, "What is my favorite color?")
assert "teal" in response.lower(), f"Expected 'teal' in response: {response}"
print(f"PASS - Recall: {response}")

# Test 3: Verify isolation between entities
client3 = create_client("different-entity")
response = chat(client3, "What is my favorite color?")
assert "teal" not in response.lower(), f"Leakage detected: {response}"
print(f"PASS - Isolation: {response}")

# Test 4: Temporal awareness - update the fact
chat(client, "Actually, my favorite color is now coral.")
time.sleep(5)  # wait for ingestion
response = chat(create_client(TEST_ENTITY), "What is my favorite color?")
assert "coral" in response.lower(), f"Expected 'coral' (updated): {response}"
print(f"PASS - Temporal update: {response}")

print("\nAll tests passed.")
```

Run this script to confirm:

1. Facts are stored and recalled across sessions
2. Memory is isolated between different entity IDs
3. Updated facts supersede old ones

You can extend this pattern into your CI pipeline by treating it as a smoke test against a staging proxy. If any assertion fails, the memory layer has a regression.

### What to test in your own agent

Beyond the basic tests above, consider adding:

- **Context injection verification**: Log or inspect the actual request the proxy sends to OpenAI. Confirm that retrieved memories appear in the system prompt in the expected format.
- **Graceful degradation**: Temporarily disable the memory engine and verify your agent still responds (just without memory). The proxy should degrade to a pass-through.
- **Concurrent sessions**: Run multiple conversations in parallel with different entity IDs and confirm no cross-contamination under load.
- **Large memory sets**: After storing many facts for a single user, verify that retrieval still returns the most relevant ones and does not blow up the context window.

## Comparing memory approaches

There are three main ways to add persistent memory to an OpenAI-based agent. Here is how they compare.

### 1. Proxy-based memory (this tutorial)

The proxy intercepts your existing API calls and adds memory transparently.

**Pros:**
- Zero code changes to your existing agent
- Works with any framework that uses the OpenAI API (LangChain, CrewAI, LlamaIndex, custom code)
- Model-agnostic: swap between GPT-4, GPT-4o, or future models without touching memory logic
- Easy to remove: just point the base URL back at OpenAI

**Cons:**
- Less control over retrieval parameters (top-k, similarity thresholds)
- Adds a network hop between your app and OpenAI
- Requires running or hosting the proxy service

**Best for:** Teams with existing production agents that need memory now, without a refactor.

### 2. SDK integration

Directly integrate a memory SDK into your agent's code. This typically means importing a library and calling store/retrieve methods explicitly.

**Pros:**
- Full control over retrieval, ingestion, and memory lifecycle
- Can combine memory with knowledge graphs, analytics, or custom logic
- No extra network hop at inference time

**Cons:**
- Requires code changes throughout your agent
- Tied to a specific SDK and memory provider
- More maintenance burden as your agent evolves

**Best for:** New agents where memory is a first-class architectural concern from day one.

### 3. Framework-native memory (LangChain, CrewAI)

Both [LangChain](https://python.langchain.com/docs/modules/memory/) and [CrewAI](https://docs.crewai.com/) offer built-in memory abstractions. These typically store conversation history in memory or on disk.

**Pros:**
- Integrated with the framework's chain/agent abstraction
- No external services required for basic implementations
- Well-documented patterns within each framework

**Cons:**
- Usually limited to in-memory or simple file-based storage (not persistent across restarts)
- Framework-specific: switching frameworks means rewriting memory logic
- No built-in temporal awareness or fact supersession
- Limited to conversational memory—does not extract structured facts

**Best for:** Prototyping or agents that only need short-term conversational memory.

### Summary table

| Feature | Proxy | SDK | Framework-native |
|---|---|---|---|
| Code changes required | None | Significant | Moderate |
| Persistent across restarts | Yes | Yes | Depends |
| Temporal awareness | Built-in | Manual | No |
| Framework-agnostic | Yes | No | No |
| Control over retrieval | Limited | Full | Framework-dependent |
| Latency overhead | One network hop | None | None |
| Works with existing agents | Immediately | Requires refactor | Requires refactor |

The right choice depends on your situation. If you have existing agents and need memory fast, the proxy is the path of least resistance. If you are building from scratch and want full control, use the SDK. If you are prototyping within LangChain or CrewAI, start with their native memory and upgrade later when you need persistence or cross-session recall.

## Advanced usage: combining with custom system prompts

The proxy injects retrieved memories into the system prompt. You can still use your own system prompt alongside injected memories. The proxy prepends memory context before your prompt, so your instructions take precedence:

```python
from openai import OpenAI

client = OpenAI(
    api_key="sk-your-key-here",
    base_url="https://memory-proxy.example.com/v1",
    default_headers={
        "X-Memory-Entity-Id": "user-abc-123",
    }
)

response = client.chat.completions.create(
    model="gpt-4o",
    messages=[
        {
            "role": "system",
            "content": (
                "You are a financial advisor. "
                "Always include disclaimers about investment risk. "
                "Never give specific tax advice."
            )
        },
        {
            "role": "user",
            "content": "What should I invest in based on my goals?"
        }
    ]
)
```

The proxy will prepend any relevant memories (investment goals, risk tolerance, previous discussions) before your system prompt. The model sees both the retrieved context and your instructions, with your instructions taking priority.

### Using with tool-calling agents

If your agent uses OpenAI's [function calling](https://platform.openai.com/docs/guides/function-calling) or tool-use features, the proxy works the same way. Memory is injected at the system prompt level, so tool definitions and function schemas are unaffected:

```python
tools = [
    {
        "type": "function",
        "function": {
            "name": "get_portfolio",
            "description": "Get the user's investment portfolio",
            "parameters": {
                "type": "object",
                "properties": {
                    "account_type": {"type": "string", "enum": ["savings", "investment"]}
                }
            }
        }
    }
]

response = client.chat.completions.create(
    model="gpt-4o",
    messages=[
        {"role": "system", "content": "You are a financial advisor."},
        {"role": "user", "content": "Show me my investment portfolio."}
    ],
    tools=tools
)
# Memory about the user's portfolio preferences is injected transparently
# The tool call proceeds normally
```

The model can reference recalled context when deciding which tools to call and what arguments to pass.

## Production considerations

### Latency

The proxy adds one network hop. In practice, this adds 20-50ms depending on geographic proximity. If this is a concern, you can deploy the proxy in the same region as your application or use the SDK approach instead. For most conversational agents, this overhead is imperceptible to users.

### Error handling

The proxy is designed to be transparent. If the memory engine is unavailable, the proxy forwards the request to OpenAI without memory injection. Your agent continues to work—it just loses memory temporarily until the proxy comes back. No error handling changes are needed in your application code. This fail-open design means a memory outage does not become a total agent outage.

### Rate limiting

The proxy respects OpenAI's rate limits and passes through any rate limit headers. If you are concerned about the additional load, monitor your usage through the proxy's dashboard or logs. The retrieval step is lightweight and typically adds negligible overhead compared to the model inference itself.

### Data considerations

When using a hosted proxy, your conversation data passes through the proxy service. Review the provider's data retention and privacy policies. If your application handles sensitive data, consider self-hosting the proxy or using the direct SDK integration where data stays within your infrastructure.

## What to do next

1. Start with the basic setup from Step 2—change one URL and test it
2. Add custom scoping with entity IDs for multi-user applications
3. Run the test script from the testing section to verify behavior
4. Deploy to staging and measure the latency impact
5. Once validated, point your production agents at the proxy

The [OpenAI API reference](https://platform.openai.com/docs/api-reference/chat/create) documents all the parameters your existing code already uses. The proxy passes them through unchanged, so nothing in your current integration needs to change.

If you want to go deeper, explore the [Python SDK](https://github.com/openai/openai-python) source to understand exactly how the client constructs requests—this helps when debugging proxy-related issues or when you need to customize headers programmatically.

## Recap

Adding persistent memory to an existing OpenAI agent does not have to mean a rewrite. By routing API calls through a compatible proxy, you get cross-session recall, temporal awareness, and user isolation—without touching your application code. The proxy is easy to add and easy to remove, making it a low-risk way to bring memory to production agents today.

The tradeoff is control. You get zero friction setup in exchange for limited visibility into how retrieval works. For most teams, that is the right tradeoff when the goal is shipping memory to users quickly. When you need more control later, the direct SDK integration is there as the next step.
