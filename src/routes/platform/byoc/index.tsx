import { component$ } from "@builder.io/qwik";
import { Link, type DocumentHead } from "@builder.io/qwik-city";
import { buildSeoHead } from "~/lib/seo";
import { setPublicEdgeCache } from "~/lib/cache";
import type { RequestHandler } from "@builder.io/qwik-city";
import {
  ServerIcon,
  CloudIcon,
  TerminalIcon,
  ShieldCheckIcon,
} from "lucide-qwik";

export const onRequest: RequestHandler = (event) => {
  setPublicEdgeCache(event);
};

export default component$(() => {
  return (
    <div class="flex min-h-screen bg-background text-on-surface font-body antialiased">
      <main class="flex-1 overflow-y-auto p-8 lg:p-12 mb-20 max-w-5xl mx-auto w-full pt-[104px]">
        <header class="mb-16 text-center">
          <div class="inline-flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-4 py-2 mb-6">
            <ServerIcon class="w-4 h-4 text-primary" />
            <span class="font-mono text-xs font-bold uppercase tracking-widest text-primary">
              Self-Hosted
            </span>
          </div>
          <h1 class="font-headline text-5xl font-extrabold tracking-tighter">
            Deploy Anywhere
          </h1>
          <p class="text-tertiary mt-4 max-w-2xl mx-auto">
            Run Tellodb in your own infrastructure. One binary, zero
            dependencies, full control.
          </p>
        </header>

        <div class="grid lg:grid-cols-3 gap-6 mb-12">
          <div class="rounded-xl border border-outline-variant/10 bg-surface-container-low p-6">
            <TerminalIcon class="w-8 h-8 text-primary mb-4" />
            <h3 class="font-bold text-lg mb-2">Single Binary</h3>
            <p class="text-sm text-tertiary">
              Download one ~45MB file. No Docker required. Runs on macOS, Linux,
              Windows.
            </p>
          </div>
          <div class="rounded-xl border border-outline-variant/10 bg-surface-container-low p-6">
            <CloudIcon class="w-8 h-8 text-primary mb-4" />
            <h3 class="font-bold text-lg mb-2">Any Cloud</h3>
            <p class="text-sm text-tertiary">
              AWS EC2, GCP Compute Engine, Azure VM, or your own data center.
            </p>
          </div>
          <div class="rounded-xl border border-outline-variant/10 bg-surface-container-low p-6">
            <ShieldCheckIcon class="w-8 h-8 text-primary mb-4" />
            <h3 class="font-bold text-lg mb-2">Air-Gapped Ready</h3>
            <p class="text-sm text-tertiary">
              Embedded embeddings via Candle/ONNX. No external API calls needed.
              Works offline.
            </p>
          </div>
        </div>

        <div class="rounded-xl border border-outline-variant/10 bg-surface-container-low p-8 mb-8">
          <h3 class="text-xl font-bold mb-6">Quick Start</h3>
          <div class="space-y-6">
            <div>
              <p class="text-xs font-bold uppercase tracking-widest text-tertiary mb-2">
                1. Download
              </p>
              <pre class="bg-black/40 rounded-lg p-4 text-sm text-tertiary overflow-x-auto">
                curl -L
                https://github.com/Tellodb/Tellodb/releases/latest/download/tellodb-x86_64-linux
                -o tellodb chmod +x tellodb
              </pre>
            </div>
            <div>
              <p class="text-xs font-bold uppercase tracking-widest text-tertiary mb-2">
                2. Set your API key
              </p>
              <pre class="bg-black/40 rounded-lg p-4 text-sm text-tertiary overflow-x-auto">
                export TELLODB_API_KEY=your-secret-key export
                TELLODB_EMBEDDING_MODEL=BAAI/bge-small-en-v1.5
              </pre>
            </div>
            <div>
              <p class="text-xs font-bold uppercase tracking-widest text-tertiary mb-2">
                3. Run
              </p>
              <pre class="bg-black/40 rounded-lg p-4 text-sm text-tertiary overflow-x-auto">
                ./tellodb Engine listening on http://localhost:3000
              </pre>
            </div>
            <div>
              <p class="text-xs font-bold uppercase tracking-widest text-tertiary mb-2">
                4. Ingest and Query
              </p>
              <pre class="bg-black/40 rounded-lg p-4 text-sm text-tertiary overflow-x-auto">
                curl -X POST http://localhost:3000/ingest -H "Content-Type:
                application/json" -H "x-api-key: your-secret-key" -d 'body'
              </pre>
            </div>
          </div>
        </div>

        <div class="rounded-xl border border-outline-variant/10 bg-surface-container-low p-8">
          <h3 class="text-xl font-bold mb-4">Enterprise BYOC</h3>
          <p class="text-sm text-tertiary mb-4">
            For organizations requiring dedicated infrastructure with full data
            sovereignty. We provide Terraform modules for provisioning in your
            AWS/GCP/Azure account.
          </p>
          <div class="flex gap-4">
            <a
              href="mailto:enterprise@tellodb.com"
              class="rounded-xl bg-primary px-6 py-3 text-sm font-bold text-white hover:opacity-90 transition-opacity"
            >
              Contact Enterprise Sales
            </a>
            <Link
              href="/docs/core"
              class="rounded-xl border border-outline-variant/20 px-6 py-3 text-sm font-bold text-tertiary hover:bg-surface-container-high"
            >
              Full Documentation
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
});

export const head: DocumentHead = buildSeoHead({
  title: "Deploy Anywhere | TELLODB",
  description:
    "Run Tellodb in your own infrastructure. Single binary, zero dependencies, air-gapped ready. Self-hosted AI memory engine.",
  pathname: "/platform/byoc",
  keywords: [
    "self-hosted memory engine",
    "BYOC memory infrastructure",
    "air-gapped AI memory",
    "on-premise memory for agents",
    "private memory deployment",
  ],
});
