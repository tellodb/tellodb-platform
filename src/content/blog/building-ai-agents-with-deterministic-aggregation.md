---
title: "How to Fix LLM Math Errors in AI Agents: A Practical Guide"
description: "LLMs hallucinate numbers. Learn why AI agents fail at counting and aggregation, and build a deterministic arithmetic layer to fix it."
excerpt: "LLMs fail at basic arithmetic tasks like counting and summing. This guide shows you how to build a deterministic aggregation layer that gives your AI agent reliable math."
publishedAt: 2026-05-28T00:00:00.000Z
updatedAt: 2026-05-28T00:00:00.000Z
author: "Sharjeel"
tags:
  - LLM Math Errors
  - AI Agents
  - Deterministic Aggregation
  - Vector Databases
image: /screen.png
featured: true
---

# How to Fix LLM Math Errors in AI Agents: A Practical Guide

Your AI agent just told a user they visited the gym 23 times last month. The real number is 8. The user knows it, and now they don't trust your product.

This isn't a hypothetical. It's the most common failure mode when LLM-powered agents try to answer numeric questions. The model sees a pile of retrieval chunks, each containing a number, and attempts to reason through the arithmetic. Sometimes it counts duplicates. Sometimes it ignores distractors. Sometimes it hallucinates a number entirely.

If you're building an AI agent that needs to answer questions like "how many times...", "what's the total...", or "what's the average...", this guide will show you exactly why LLMs fail at these tasks and how to fix it with a deterministic computation layer.

## The Proof: Give GPT-4 a Counting Task

Let's start with a concrete failure. We'll give GPT-4 a simple counting task and watch it break.

Imagine you're building a habit tracker. The user asks: *"How many times did I go to the gym this month?"*

The system retrieves these memory entries:

```python
memories = [
    {"date": "2026-03-01", "text": "Went to the gym, did chest and triceps."},
    {"date": "2026-03-03", "text": "Went to the gym, ran 5k on the treadmill."},
    {"date": "2026-03-05", "text": "Skipped the gym, felt tired."},
    {"date": "2026-03-08", "text": "Went to the gym, back and biceps day."},
    {"date": "2026-03-10", "text": "Went to the gym, legs day."},
    {"date": "2026-03-12", "text": "Thought about going to the gym but didn't."},
    {"date": "2026-03-15", "text": "Went to the gym, full body workout."},
    {"date": "2026-03-18", "text": "Went to the gym, cardio session."},
    {"date": "2026-03-20", "text": "Rest day, no gym."},
    {"date": "2026-03-22", "text": "Went to the gym, pushed hard on shoulders."},
    {"date": "2026-03-25", "text": "Went to the gym, light session."},
    {"date": "2026-03-28", "text": "Went to the gym, arms and abs."},
]

prompt = f"""Based on the following memories, how many times did the user go to the gym in March 2026?

Memories:
{chr(10).join(m['text'] for m in memories)}

Answer with a single number and a brief explanation."""

response = client.chat.completions.create(
    model="gpt-4",
    messages=[{"role": "user", "content": prompt}],
)

print(response.choices[0].message.content)
```

You can run this yourself. The correct answer is **9**. GPT-4 will often return 10, 11, or some other number because it counts the entries that mention "gym" regardless of whether the person actually went. "Skipped the gym" and "Thought about going to the gym but didn't" both contain the word "gpt-4" but describe the opposite of going.

This is the core problem: **LLMs pattern-match on language, they don't parse semantics around negation and context reliably.** When you feed them a list of text chunks with numbers, they do their best to approximate — but approximation isn't accuracy.

## Why LLMs Are Bad at Math

This isn't a surprise to anyone who has studied transformer architecture. There are a few compounding reasons:

**1. Tokenization destroys numbers.** Numbers like `42,195` might be tokenized as `4`, `2,195` or `42`, `19`, `5`. The model never sees the number as a coherent entity. This is well-documented in research on [arithmetic benchmarks for LLMs](https://arxiv.org/abs/2305.14975).

**2. Embeddings don't capture numeric relationships.** When you store memories in a vector database, the embedding encodes semantic meaning, not quantitative relationships. The embedding for "I spent $50 on coffee" and "I spent $150 on coffee" are nearly identical in vector space. Semantic similarity can't distinguish between them.

**3. Context window limits force summarization.** Even if you could retrieve every relevant chunk, passing 200 text fragments to an LLM to count gym visits is expensive and error-prone. The model has to hold all the numbers in working memory simultaneously — something it was never designed to do.

**4. Arithmetic is sequential and precise.** LLMs generate tokens in parallel, using attention mechanisms that are fundamentally approximate. Arithmetic requires exact sequential operations: addition, multiplication, comparison. These are the operations CPUs were literally invented to do.

The [OpenAI Cookbook](https://cookbook.openai.com/examples/how_to_call_functions_with_chat_models) and the [LangChain agents documentation](https://python.langchain.com/docs/agents/) both acknowledge this limitation. When you build an agent that needs to answer numeric questions, you need to move computation out of the LLM and into deterministic code.

## The Naive Fix: Better Prompting

The first thing most developers try is prompting harder. You can improve accuracy by adding explicit instructions:

```python
# Naive fix: better prompting
prompt = f"""Based on the following memories, count how many times the user ACTUALLY WENT to the gym in March 2026.

Rules:
- Only count entries where the user explicitly went to the gym
- Do NOT count entries where the user skipped, thought about going, or rested
- Do NOT count entries that just mention the gym without going

Memories:
{chr(10).join(m['text'] for m in memories)}

Answer with a single number and list each entry you counted."""

response = client.chat.completions.create(
    model="gpt-4",
    messages=[{"role": "user", "content": prompt}],
)

print(response.choices[0].message.content)
```

This helps. You'll get the right answer more often. But it has three serious problems:

- **It doesn't scale.** Adding more rules for every edge case makes the prompt fragile. What about "went to the gym but left early"? What about "gym session was only 10 minutes"? Every new scenario needs a new rule.
- **It's still probabilistic.** Even with perfect rules, the model might miscount in a long list. You've reduced the error rate from ~30% to ~10%, but 10% wrong answers are still unacceptable when a user is tracking their finances or health.
- **It's expensive.** Longer prompts cost more tokens. A detailed reasoning prompt for 50 memory chunks can easily blow through your context budget.

Better prompting is a band-aid. You need surgery.

## The Real Fix: Deterministic Aggregation

The solution is to stop asking the LLM to do math. Instead:

1. **Retrieve** the relevant memories
2. **Extract** the structured data (dates, amounts, counts) using the LLM as a parser
3. **Compute** the answer deterministically using regular code
4. **Return** the result to the LLM to format into natural language

Here's what that looks like in practice:

```python
import re
from datetime import datetime

def extract_gym_visits(memories: list[dict]) -> list[dict]:
    """Use the LLM to extract structured facts from raw memories."""
    prompt = f"""For each memory entry below, extract:
- date: the date in YYYY-MM-DD format
- went_to_gym: true if the user actually went to the gym, false otherwise
- activity: what they did (if they went)

Be precise. "Skipped the gym" means went_to_gym=false. "Thought about going but didn't" means went_to_gym=false.

Return a JSON array. Example:
[{{"date": "2026-03-01", "went_to_gym": true, "activity": "chest and triceps"}}]

Memories:
{chr(10).join(f"{m['date']}: {m['text']}" for m in memories)}"""

    response = client.chat.completions.create(
        model="gpt-4",
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"},
    )

    import json
    return json.loads(response.choices[0].message.content)["visits"]


def compute_gym_stats(extracted_visits: list[dict]) -> dict:
    """Pure deterministic computation. No LLM involved."""
    gym_visits = [v for v in extracted_visits if v["went_to_gym"]]
    total_visits = len(gym_visits)

    # Count by week
    weekly = {}
    for visit in gym_visits:
        week = datetime.strptime(visit["date"], "%Y-%m-%d").isocalendar()[1]
        weekly[week] = weekly.get(week, 0) + 1

    return {
        "total_visits": total_visits,
        "visits_per_week": weekly,
        "missed_days": len(extracted_visits) - total_visits,
    }


def answer_gym_question(memories: list[dict]) -> str:
    """Full pipeline: extract, compute, then let LLM format the answer."""
    extracted = extract_gym_visits(memories)
    stats = compute_gym_stats(extracted)

    prompt = f"""The user asked how many times they went to the gym this month.

Here are the computed results (deterministic, not estimated):
- Total gym visits: {stats['total_visits']}
- Visits per week: {stats['visits_per_week']}
- Days they didn't go: {stats['missed_days']}

Compose a natural, friendly response. You may reference specific dates from the source memories, but do NOT recompute the numbers — use the provided stats exactly."""

    response = client.chat.completions.create(
        model="gpt-4",
        messages=[{"role": "user", "content": prompt}],
    )

    return response.choices[0].message.content


# Run it
result = answer_gym_question(memories)
print(result)
```

The LLM is used exactly once — to classify each memory entry. The actual counting happens in Python with a simple list comprehension. The LLM then formats the pre-computed answer into natural language. It never touches the arithmetic.

This is the pattern. It works for counts, sums, averages, percentages, and any other aggregation you can think of.

## Scaling This: Handling Larger Datasets

The approach above works for small datasets. But what if you have thousands of memory entries?

You need to batch the extraction calls and use a structured extraction pipeline:

```python
from typing import Optional
import json

def batch_extract_facts(
    memories: list[dict],
    batch_size: int = 50,
    model: str = "gpt-4",
) -> list[dict]:
    """Extract facts from memories in batches to handle large datasets."""
    all_facts = []

    for i in range(0, len(memories), batch_size):
        batch = memories[i : i + batch_size]

        prompt = f"""Extract structured facts from these memory entries.
Return a JSON object with a "facts" array. Each fact should have:
- date (string, YYYY-MM-DD)
- went_to_gym (boolean)
- activity (string or null)
- duration_minutes (integer or null, if mentioned)

Be precise about negation: "skipped", "didn't go", "thought about but didn't" all mean went_to_gym=false.

Entries:
{chr(10).join(f"{m['date']}: {m['text']}" for m in batch)}"""

        response = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
        )

        facts = json.loads(response.choices[0].message.content)["facts"]
        all_facts.extend(facts)

    return all_facts


def aggregate_deterministically(facts: list[dict]) -> dict:
    """Perform all numeric aggregation in pure Python. Zero LLM calls."""
    gym_visits = [f for f in facts if f.get("went_to_gym")]

    visits_by_month = {}
    for visit in gym_visits:
        month = visit["date"][:7]  # YYYY-MM
        visits_by_month[month] = visits_by_month.get(month, 0) + 1

    avg_per_week = 0
    if gym_visits:
        weeks = len(set(
            datetime.strptime(v["date"], "%Y-%m-%d").isocalendar()[:2]
            for v in gym_visits
        ))
        avg_per_week = len(gym_visits) / max(weeks, 1)

    return {
        "total": len(gym_visits),
        "by_month": visits_by_month,
        "avg_per_week": round(avg_per_week, 1),
    }
```

Now you can handle thousands of memory entries, batch them through the LLM for extraction, and compute the final numbers deterministically. The LLM's job is limited to natural language understanding (what counts as "going to the gym"), and the computer does the math.

## LLM Arithmetic vs Deterministic Computation

Here's a direct comparison based on benchmarks and practical experience:

| Dimension | LLM Arithmetic | Deterministic Code |
|---|---|---|
| **Accuracy** | 70-90% on simple counts, <50% on complex aggregation | 100% for well-defined operations |
| **Latency** | 2-8 seconds (depends on chain-of-thought length) | <10ms for in-memory computation |
| **Cost** | ~$0.01-0.05 per query (context tokens) | ~$0.001 per query (trivial compute) |
| **Scalability** | Degrades with more items (context limits) | Linear, bounded only by memory |
| **Reproducibility** | Non-deterministic (temperature, sampling) | Fully deterministic |
| **Edge Cases** | Misses negation, double-counts, hallucinates | Handled by explicit logic |

The tradeoff is clear. Deterministic computation wins on every dimension except one: the LLM is better at understanding *what* to extract from messy natural language. That's why the hybrid approach — LLM for extraction, code for computation — gives you the best of both worlds.

## When to Use This Pattern

This pattern applies any time your agent needs to answer numeric questions:

- **Financial tracking:** "How much did I spend this week?" / "What's my total balance?"
- **Habit tracking:** "How many times did I exercise?" / "What's my streak?"
- **Analytics:** "How many users signed up?" / "What's the conversion rate?"
- **Memory systems:** "How many meetings did I have about Project X?"
- **Knowledge bases:** "How many papers cite this method?" / "What's the average score?"

If the question starts with "how many", "what's the total", "what's the average", or "what's the difference" — do not let the LLM do the math.

## Integrating with Your Memory Stack

Deterministic aggregation solves the math problem. But production AI agents have other challenges: memory freshness, contradictions, and context management.

When you're building a memory layer for your agent, you'll likely also need to handle [fact supersession](/blog/fact-supersession-for-agent-memory) — what happens when two memories contradict each other — and [temporal memory](/blog/temporal-memory-vs-vector-databases) — how to prioritize recent information over stale facts.

A memory system that can count accurately but returns outdated information isn't useful. Neither is one that's always fresh but can't do basic arithmetic. You need both.

## Key Takeaways

1. **LLMs cannot reliably do arithmetic.** Tokenization, attention mechanisms, and probabilistic generation all conspire against accuracy. Don't trust them with numbers.
2. **Better prompting helps but doesn't solve the problem.** You're reducing error rates, not eliminating them. For production systems, "usually right" isn't good enough.
3. **The fix is straightforward.** Use the LLM to *extract* structured facts from text. Use deterministic code to *compute* the answer. Use the LLM to *format* the result into natural language.
4. **This pattern scales.** Batch your extraction calls, compute in pure Python, and you can handle thousands of memories with 100% accuracy on the numeric output.
5. **Your users will notice.** When your habit tracker says they went to the gym 23 times instead of 9, they lose trust. Getting the math right isn't a nice-to-have — it's table stakes for any agent that touches numbers.

The next time your AI agent gives a user a wrong number, don't blame the model. It was never designed to be a calculator. Build the calculator, and let the model do what it's good at: understanding and communicating.
