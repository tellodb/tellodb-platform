import { component$ } from "@builder.io/qwik";
import { Link, type DocumentHead } from "@builder.io/qwik-city";
import { buildSeoHead } from "~/lib/seo";
import { setPublicEdgeCache } from "~/lib/cache";
import type { RequestHandler } from "@builder.io/qwik-city";
import {
  ShieldCheckIcon,
  LockIcon,
  FileTextIcon,
  ServerIcon,
  EyeIcon,
} from "lucide-qwik";

export const onRequest: RequestHandler = (event) => {
  setPublicEdgeCache(event);
};

const sections = [
  {
    title: "Security Overview",
    icon: ShieldCheckIcon,
    items: [
      "All data encrypted at rest (AES-256) and in transit (TLS 1.3)",
      "API key authentication with SHA-256 hashed storage",
      "Constant-time key comparison to prevent timing attacks",
      "Row-Level Security (RLS) enforced at the database layer",
      "Multi-tenant data isolation via cluster_id namespace prefixing",
      "No plaintext secrets in logs, environment variables, or client-side code",
    ],
  },
  {
    title: "Infrastructure",
    icon: ServerIcon,
    items: [
      "Core engine: Rust binary with zero runtime dependencies — no npm, no pip, no system libraries",
      "Embedded database (redb): MVCC, crash-safe, no external database to configure or secure",
      "Platform: Deployed on Vercel Edge + Supabase (SOC 2 certified infrastructure)",
      "All connections to the core engine are outbound-only from the platform proxy",
      "Rate limiting at the API gateway layer prevents resource exhaustion",
    ],
  },
  {
    title: "Data Privacy",
    icon: EyeIcon,
    items: [
      "Your data never leaves your TelloDB instance. For the self-hosted core engine, no telemetry is sent anywhere.",
      "For Platform users: data is stored in your dedicated cluster with namespace isolation. No cross-tenant access.",
      "We never use customer data for training, benchmarking, or product improvement without explicit opt-in.",
      "GDPR compliant: data export and deletion available via API. Contact for Data Processing Agreement (DPA).",
    ],
  },
  {
    title: "Compliance",
    icon: FileTextIcon,
    items: [
      "SOC 2 Type 2 certification in progress (auditor: Vanta). Expected completion Q3 2026.",
      "GDPR compliant data processing. Standard Contractual Clauses available.",
      "HIPAA: Configurable for HIPAA compliance via self-hosted deployment. BAAs available for enterprise.",
      "Open source core engine (Apache 2.0): full code auditability. No black boxes.",
    ],
  },
  {
    title: "Data Protection",
    icon: LockIcon,
    items: [
      "Data Processing Agreement (DPA): Available on request for all paid plans. Contact trust@tellodb.com.",
      "Data export: Full data export via API or engine CLI tools. No lock-in.",
      "Data deletion: Hard delete via API. Soft delete with retention period configurable per cluster.",
      "Breach notification: 72-hour SLA for enterprise customers. Public status page at status.tellodb.com.",
    ],
  },
];

export default component$(() => {
  return (
    <div class="flex min-h-screen bg-background text-on-surface font-body antialiased">
      <main class="flex-1 overflow-y-auto p-8 lg:p-12 mb-20 max-w-5xl mx-auto w-full pt-[104px]">
        <header class="mb-16 text-center">
          <div class="inline-flex items-center gap-2 rounded-full border border-green-500/30 bg-green-500/10 px-4 py-1.5 mb-6">
            <ShieldCheckIcon class="w-4 h-4 text-green-400" />
            <span class="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-green-400">
              Enterprise Grade
            </span>
          </div>
          <h1 class="font-headline text-5xl font-extrabold tracking-tighter">
            Trust Center
          </h1>
          <p class="text-tertiary mt-4 max-w-2xl mx-auto">
            Security, privacy, and compliance information for the TelloDB
            platform. For detailed questions, contact{" "}
            <a
              href="mailto:trust@tellodb.com"
              class="text-primary hover:underline"
            >
              trust@tellodb.com
            </a>
            .
          </p>
        </header>

        <div class="space-y-8">
          {sections.map(({ title, icon: Icon, items }) => (
            <div
              key={title}
              class="rounded-2xl border border-outline-variant/10 bg-surface-container-low p-8"
            >
              <h3 class="flex items-center gap-3 text-xl font-bold mb-6">
                <Icon class="w-6 h-6 text-primary" />
                {title}
              </h3>
              <ul class="space-y-3">
                {items.map((item) => (
                  <li
                    key={item}
                    class="flex items-start gap-2 text-sm text-tertiary"
                  >
                    <span class="text-green-400 text-xs mt-0.5 shrink-0">
                      ✓
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div class="mt-12 rounded-2xl border border-primary/20 bg-primary/5 p-8 text-center">
          <h3 class="text-xl font-bold mb-3">Need a Security Review?</h3>
          <p class="text-tertiary mb-6">
            We provide security questionnaires, penetration test summaries, and
            architecture diagrams for enterprise procurement.
          </p>
          <a
            href="mailto:trust@tellodb.com"
            class="inline-block rounded-xl bg-primary px-8 py-3 font-bold text-white hover:opacity-90 transition-opacity"
          >
            Request Security Package
          </a>
        </div>
      </main>
    </div>
  );
});

export const head: DocumentHead = buildSeoHead({
  title: "Trust Center | TelloDB",
  description:
    "Security, privacy, and compliance information for TelloDB. SOC 2, GDPR, HIPAA, encryption details.",
  pathname: "/trust",
  keywords: [
    "AI memory security",
    "agent memory compliance",
    "SOC 2 AI infrastructure",
    "GDPR memory storage",
    "encrypted memory engine",
  ],
});
