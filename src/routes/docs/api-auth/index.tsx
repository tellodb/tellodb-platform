import { component$ } from "@builder.io/qwik";

import { createHead } from "~/lib/docs";

export default component$(() => {
  return (
    <>
      <div class="eyebrow">API Authentication</div>
      <h1>Securing Your TelloDB Instance</h1>
      <p class="doc-lead">
        When you move from local development to a hosted environment, authentication becomes a top priority. TelloDB's API key management ensures your user's memories are protected.
      </p>

      <h2>A simple path to security</h2>
      <p>
        By default, the engine and SDKs use a shared testing key (<code>XXX1111AAA</code>). This is perfect for quick demos, but for real-world production, you'll need to use platform-issued keys.
      </p>

      <h3>How API keys keep you safe:</h3>
      <ul>
        <li><strong>App Isolation:</strong> Each key identifies exactly which application or workspace is making a request.</li>
        <li><strong>Server-Side Enclosure:</strong> TelloDB enforces tenant and project scopes at the engine level, so memories from different apps never leak.</li>
        <li><strong>Audit Logging:</strong> Every ingest and query is logged with request IDs and actor context, giving you a full trail of how memory is used.</li>
        <li><strong>Traffic Control:</strong> We apply rate limits per key, ensuring your production instances are protected from accidental (or intentional) spikes in usage.</li>
      </ul>

      <h2>A quick example request</h2>
      <p>
        Using your API key is as simple as adding a header. Here's how you'd perform a semantic query using standard curl:
      </p>
      <pre class="docs-code">
        <code>{`curl https://api.tellodb.com/query/semantic \\
  -H "x-api-key: YOUR_PRODUCTION_API_KEY" \\
  -H "content-type: application/json" \\
  -d '{
    "textual_query": "What has changed in the user's profile?",
    "entity_id": "user-123",
    "limit": 5
  }'`}</code>
      </pre>

      <h2>The Platform Experience</h2>
      <p>
        The TelloDB Platform UI makes managing your security effortless. In just a few clicks, you can:
      </p>
      <ul>
        <li><strong>Login and Sign Up:</strong> Securely manage your account and workspaces.</li>
        <li><strong>Provision New Keys:</strong> Generate keys for different staging or production environments.</li>
        <li><strong>Full Token Visibility:</strong> View and copy your keys for use in your SDKs.</li>
        <li><strong>Revoke & Rotate:</strong> Instantly disable a key if it's been compromised.</li>
      </ul>

      <p>
        Ready to secure your instance? Check out our [Quickstart](/docs/quickstart) to see how to point your SDK to a hosted TelloDB engine.
      </p>
    </>
  );
});

export const head = createHead(
  "API Authentication for AI Memory | TelloDB",
  "Learn how to secure your hosted TelloDB memory engine with API keys and scoped access controls for AI agents.",
  "/docs/api-auth",
  [
    "AI memory API authentication",
    "memory engine API keys",
    "secure memory retrieval",
    "API access control agents",
    "memory infrastructure security",
  ]
);
