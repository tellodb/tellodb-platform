import { component$ } from "@builder.io/qwik";

import { privateRepositoryNote, publicRepositoryLinks } from "~/constants/repositories";
import { createHead } from "~/lib/docs";

export default component$(() => {
  return (
    <>
      <div class="eyebrow">Overview</div>
      <h1>Tellodb Memory Engine Overview</h1>
      <p class="doc-lead">
        Tellodb is the purpose-built memory infrastructure for AI agents and applications that need to understand time, state, and evolving user truth—moving far beyond the limitations of a flat vector index.
      </p>

      <h2>What Tellodb is built to do</h2>
      <p>
        Building AI agents that remember users over long periods of time is hard. Standard RAG (Retrieval-Augmented Generation) approaches dump raw chat logs into vector databases, which quickly leads to bloated context windows, contradictory facts, and terrible performance on counting or math queries. Tellodb solves this by acting as an intelligent memory controller.
      </p>
      <ul>
        <li><strong>Adaptive Hybrid Retrieval:</strong> We fuse semantic search with lexical search and neural reranking, dynamically shifting weights based on whether you are asking for a concept or a specific number.</li>
        <li><strong>Temporal Awareness:</strong> Tellodb keeps fresh context visible through time-aware ranking algorithms, ensuring old memories decay gracefully.</li>
        <li><strong>Fact Supersession:</strong> We track when facts change (e.g., moving to a new city) so stale claims stop competing with the updated truth in your LLM's context window.</li>
        <li><strong>Deterministic Aggregation:</strong> Counting and math queries are resolved deterministically before they reach the LLM, ensuring perfect accuracy.</li>
        <li><strong>Seamless Developer Experience:</strong> Run the exact same Rust-powered engine locally as a sidecar during development, and deploy it to the cloud for production.</li>
      </ul>

      <h2>Why engineering teams choose Tellodb</h2>
      <p>
        Most memory systems on the market can retrieve chunks of text. Very few can update beliefs cleanly, handle mixed factual and episodic recall, or ship a local-first workflow that matches production performance.
      </p>
      <p>
        Tellodb is designed to fill that exact gap. It distills noisy chat logs into clean, queryable facts, saving you tokens and preventing your AI from hallucinating about past interactions.
      </p>

      <h2>Core design principles</h2>

      <h3>1. Hybrid retrieval is mandatory</h3>
      <p>
        Approximate Nearest Neighbor (ANN) search alone is not enough for human-like memory. Tellodb combines semantic search, BM25-style lexical search, and cross-encoder reranking so both exact phrases and latent meaning are respected.
      </p>

      <h3>2. Not all memories are equal (Memory Classes)</h3>
      <p>
        A passing thought shouldn't be ranked the same way as a core user preference. Tellodb categorizes memories into classes (Facts, Summaries, Preferences, Episodic traces) and applies different Time-To-Live (TTL) and decay policies to each.
      </p>

      <h3>3. Local-first development accelerates shipping</h3>
      <p>
        You shouldn't need a cloud API key just to run your test suite. Developers can run the Tellodb Rust engine locally as a lightweight binary before pointing their Python or Node.js SDK at a hosted environment.
      </p>

      <h2>Repositories</h2>
      <p>Explore our public repositories for the core platform, SDKs, and model adapter surfaces:</p>
      <ul>
        {publicRepositoryLinks.map((repo) => (
          <li key={repo.href}>
            <a href={repo.href} target="_blank" rel="noreferrer">
              {repo.label}
            </a>
          </li>
        ))}
      </ul>
      <p>{privateRepositoryNote}</p>
    </>
  );
});

export const head = createHead(
  "Overview | Tellodb Memory Engine",
  "Discover how Tellodb provides persistent, time-aware memory for AI agents, surpassing the limits of standard vector databases.",
  "/docs",
  [
    "memory engine",
    "AI agent memory",
    "temporal memory database",
    "hybrid retrieval",
    "vector database alternative",
    "fact supersession",
  ]
);
