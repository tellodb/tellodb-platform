import { component$ } from "@builder.io/qwik";

import { createHead } from "~/lib/docs";

export default component$(() => {
  return (
    <>
      <div class="eyebrow">Security & Trust</div>
      <h1>Building Trusted Long-Term Memory</h1>
      <p class="doc-lead">
        Tellodb is strongest when security and privacy are treated as foundational elements of the system, not afterthoughts. Here's how we protect the core truth of your users.
      </p>

      <h2>Our Hosted Security Guidance</h2>
      <p>
        Building a trusted AI agent means ensuring that memory is only accessible to the entity that owns it. Tellodb's architecture enforces strict boundaries between tenants and sessions.
      </p>
      <ul>
        <li><strong>Strict Scope Enforcement:</strong> We never trust payload scope alone. Tellodb applies tenant and project claims before any retrieval logic begins, preventing data leaks.</li>
        <li><strong>Immutable Audit Logs:</strong> Every memory operation—ingestion, query, and deletion—is logged. This creates an unchangeable audit trail for your peace of mind.</li>
        <li><strong>End-to-End Traceability:</strong> All requests are assigned a unique ID, making it simple to trace the origin and lifecycle of a specific memory chunk.</li>
      </ul>

      <h2>A commitment to safe releases</h2>
      <p>
        We believe that trust starts with the code itself. We follow industry best practices for every binary release we ship.
      </p>
      <ul>
        <li><strong>Signed Binaries & Checksums:</strong> We publish checksums and use cryptographic signatures for every downloadable binary, ensuring the engine you run is the engine we built.</li>
        <li><strong>Versioned API Contracts:</strong> Our OpenAPI contracts are strictly versioned alongside the engine, so your security logic remains stable as your agent evolves.</li>
      </ul>

      <h2>The Platform Story</h2>
      <p>
        Tellodb's platform is the central hub for your public trust story. We provide all the tools you need to manage your memory security effortlessly:
      </p>
      <ul>
        <li><strong>Secure Onboarding:</strong> Seamless sign-up and login flows that prioritize user protection.</li>
        <li><strong>Dynamic Key Management:</strong> Effortlessly create, rotate, and revoke API keys as your project scales.</li>
        <li><strong>Transparent Changelogs:</strong> Stay informed with clear, human-readable release notes and security updates.</li>
      </ul>
      
      <p>
        Your user's memories are their most personal data. At Tellodb, we build the walls to keep them safe.
      </p>
    </>
  );
});

export const head = createHead(
  "Security Model for AI Memory | Tellodb",
  "Explore Tellodb's security model, from strict tenant scoping to signed Rust binaries and audit logs for AI agent memory.",
  "/docs/security",
  [
    "AI memory security",
    "agent memory encryption",
    "secure memory infrastructure",
    "tenant isolation AI",
    "memory audit logs",
  ]
);
