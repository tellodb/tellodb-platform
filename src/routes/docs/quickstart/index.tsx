import { component$ } from "@builder.io/qwik";

import { createHead } from "~/lib/docs";

export default component$(() => {
  return (
    <>
      <div class="eyebrow">Quickstart</div>
      <h1>Quickstart: Add AI Memory in Minutes</h1>
      <p class="doc-lead">
        Get the TelloDB engine running, connect your application using our SDK, and start giving your AI agents persistent, time-aware memory.
      </p>

      <h2>The Local-First Development Path</h2>
      <p>
        We believe developers should be able to build and test without relying on external cloud services. TelloDB is built in Rust, meaning it compiles to a blazing-fast, single binary you can run right on your machine.
      </p>
      <p>First, build and run the engine locally:</p>
      <pre class="docs-code">
        <code>{`cargo build --release\ncargo run --release`}</code>
      </pre>

      <p>Next, point our Python SDK at your local instance. In just three lines of code, you can ingest a new fact and retrieve it:</p>

      <pre class="docs-code">
        <code>{`from tellodb import TellodbClient

# Connect to the local TelloDB binary
client = TellodbClient.from_local(auto_start=True)

# Give your agent a permanent memory
client.ingest(entity_id="user-123", text="I prefer pourover coffee.")

# Retrieve the exact truth when you need it
hits = client.query("What coffee do I prefer?", entity_id="user-123")`}</code>
      </pre>

      <h2>Seamless Cloud Deployment</h2>
      <p>
        When you are ready to ship to production, you don't need to rewrite your memory logic. Simply create an API key in the TelloDB platform dashboard, and switch your SDK constructor to point to the cloud.
      </p>

      <pre class="docs-code">
        <code>{`client = TellodbClient.from_cloud(
    "https://api.tellodb.com", # Your hosted endpoint
    api_key="YOUR_PRODUCTION_API_KEY",
)`}</code>
      </pre>

      <p>
        Our goal is zero friction: the developer API surface remains completely stable whether you are running a test script on your laptop or serving millions of users in production. 
      </p>
      
      <p>
        Ready to dive deeper? Check out our guides on <strong>Fact Supersession</strong> and <strong>Temporal Retrieval</strong> to see what makes TelloDB smarter than a standard vector database.
      </p>
    </>
  );
});

export const head = createHead(
  "Quickstart | TelloDB AI Memory",
  "Learn how to quickly add persistent, long-term memory to your AI agents using the TelloDB SDK and Rust engine.",
  "/docs/quickstart",
  [
    "AI agent memory quickstart",
    "persistent memory for LLMs",
    "Rust memory engine setup",
    "long-term memory SDK",
    "agent memory tutorial",
  ]
);
