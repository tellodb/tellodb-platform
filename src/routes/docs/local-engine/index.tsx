import { component$ } from "@builder.io/qwik";

import { createHead } from "~/lib/docs";

export default component$(() => {
  return (
    <>
      <div class="eyebrow">Local Engine</div>
      <h1>The Local-First Memory Engine</h1>
      <p class="doc-lead">
        Development shouldn't stop when the internet does. Tellodb's local engine allows you to build, test, and refine your AI agent's memory right on your laptop.
      </p>

      <h2>Why we built a local sidecar</h2>
      <p>
        Most AI memory solutions force you to send every test query to a distant cloud server. This is slow, expensive, and makes integration testing a nightmare. We built the Tellodb engine in Rust so it can run as a lightweight sidecar directly in your development environment.
      </p>
      
      <h3>What this means for your workflow:</h3>
      <ul>
        <li><strong>Instant Iteration:</strong> Test your memory schemas and retrieval quality with sub-10ms latency. No network round-trips required.</li>
        <li><strong>Robust Integration Testing:</strong> Run your entire agentic flow in a CI/CD pipeline or locally without needing a cloud API key.</li>
        <li><strong>Privacy by Default:</strong> Keep sensitive user data on your machine while you are in the "lab" phase of your project.</li>
        <li><strong>Benchmark Readiness:</strong> Evaluate how your agent handles thousands of memories using our local benchmark harness before you ever ship to production.</li>
      </ul>

      <h2>Best practices for local development</h2>
      <p>
        To get the most out of the local engine, we recommend a few simple habits:
      </p>
      <ul>
        <li><strong>Isolate Your Data:</strong> Use a dedicated cache directory for your local development memories so they don't interfere with your production state.</li>
        <li><strong>Mirror Production:</strong> The local engine uses the exact same HTTP API surface as our cloud deployment. This means you can switch from local to cloud by changing a single environment variable—no code changes needed.</li>
      </ul>

      <h2>How the SDK finds the engine</h2>
      <p>
        The Tellodb SDK is smart about finding your local binary. It follows a clear resolution path:
      </p>
      <ol>
        <li><strong>Explicit Path:</strong> You can tell the SDK exactly where your binary lives.</li>
        <li><strong>Environment Variables:</strong> Set <code>ALETHEIADB_BINARY_PATH</code> to override defaults.</li>
        <li><strong>Repo-Local:</strong> It looks in <code>target/release/tellodb</code> if you've just finished a fresh build.</li>
        <li><strong>SDK Cache:</strong> If no binary is found, the SDK can automatically download and cache the latest signed release for your architecture.</li>
      </ol>
      
      <p>
        Ready to see it in action? Head over to the [Quickstart](/docs/quickstart) to launch your first local instance.
      </p>
    </>
  );
});

export const head = createHead(
  "Local-First AI Memory Engine | Tellodb",
  "Run the Tellodb Rust engine locally as a sidecar for faster AI agent development and testing without cloud dependencies.",
  "/docs/local-engine",
  [
    "local AI memory engine",
    "Rust sidecar for AI agents",
    "local-first agent development",
    "offline memory testing",
    "self-hosted AI memory",
  ]
);
