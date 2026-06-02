import { $, component$, useSignal, useVisibleTask$ } from "@builder.io/qwik";
import {
  Link,
  type DocumentHead,
  type RequestHandler,
} from "@builder.io/qwik-city";

import {
  CALENDLY_30_MIN_URL,
  CONTACT_EMAIL,
  CONTACT_MAILTO,
  LINKEDIN_COMPANY_URL,
} from "~/constants/contact";
import {
  privateRepositoryNote,
  publicRepositoryLinks,
} from "~/constants/repositories";
import { setPublicEdgeCache } from "~/lib/cache";
import type { HeroDemoResult, HeroWarmupResult } from "~/lib/hero-demo";
import { buildSeoHead } from "~/lib/seo";
import { MemoryLattice } from "~/components/MemoryLattice";
import { captureError } from "~/lib/sentry";
import { capture } from "~/lib/posthog";

import {
  LayersIcon,
  XIcon,
  BotIcon,
  CheckCircleIcon,
  ClockIcon,
  FocusIcon,
  MessageSquareIcon,
  Wand2Icon,
  InfinityIcon,
  RefreshCwIcon,
  ZapIcon,
  CpuIcon,
  PackageIcon,
  GaugeIcon,
  GlobeIcon,
  TerminalIcon,
  UploadIcon,
  NetworkIcon,
  RocketIcon,
  XCircleIcon,
  ArrowRightIcon,
  ShieldCheckIcon,
  LogInIcon,
  FilterIcon,
  GitBranchIcon,
  CalculatorIcon,
  HistoryIcon,
  Settings2Icon,
  DatabaseIcon,
  ExternalLinkIcon,
  EditIcon,
  LinkedinIcon,
  BarChart3Icon,
} from "lucide-qwik";

const IconMap: Record<string, any> = {
  layers_clear: LayersIcon,
  close: XIcon,
  psychology: BotIcon,
  check_circle: CheckCircleIcon,
  schedule: ClockIcon,
  filter_center_focus: FocusIcon,
  chat_bubble: MessageSquareIcon,
  auto_awesome: Wand2Icon,
  all_inclusive: InfinityIcon,
  published_with_changes: RefreshCwIcon,
  bolt: ZapIcon,
  memory: CpuIcon,
  deployed_code: PackageIcon,
  speed: GaugeIcon,
  travel_explore: GlobeIcon,
  terminal: TerminalIcon,
  upload: UploadIcon,
  hub: NetworkIcon,
  rocket_launch: RocketIcon,
  cancel: XCircleIcon,
  trending_flat: ArrowRightIcon,
  verified: ShieldCheckIcon,
  input: LogInIcon,
  filter_list: FilterIcon,
  rebase_edit: GitBranchIcon,
  calculate: CalculatorIcon,
  history: HistoryIcon,
  arrow_forward: ArrowRightIcon,
  settings_input_component: Settings2Icon,
  database: DatabaseIcon,
  open_in_new: ExternalLinkIcon,
  arrow_right_alt: ArrowRightIcon,
  edit_square: EditIcon,
};

export const MaterialIcon = component$(
  ({ name, class: className }: { name: string; class?: string }) => {
    const IconComponent = IconMap[name] || ZapIcon;
    return <IconComponent class={className} />;
  },
);

const topTenFeatures = [
  {
    title: "Rust-Powered Core",
    body: "Built in Rust completely from ground up for maximum performance.",
  },
  {
    title: "Fact Supersession",
    body: "Newer truths automatically invalidate stale context.",
  },
  {
    title: "Deterministic Aggregation",
    body: "Perfect math and counting queries at the engine level.",
  },
  {
    title: "Predict-Calibrate Profiling",
    body: "Lean context windows through continuous delta-tracking.",
  },
  {
    title: "Neural BERT-NER",
    body: "Local entity extraction for people, orgs, and places.",
  },
  {
    title: "Implicit Preference Detection",
    body: "Autonomous discovery of user likes and habits.",
  },
  {
    title: "Autonomous Knowledge Graph",
    body: "Self-organizing relationship lattice of user history.",
  },
  {
    title: "Hybrid Retrieval Kernel",
    body: "Fuses semantic, lexical, and neural reranking signals.",
  },
  {
    title: "OpenAI Proxy (Coming Soon)",
    body: "Drop-in memory for any existing OpenAI agent. In development.",
  },
  {
    title: "Temporal Decay Policy",
    body: "Smart ranking that respects the arrow of time.",
  },
];

export const SentientCheckbox = component$(({ delay }: { delay: string }) => {
  return (
    <div
      class="relative h-6 w-6 flex-shrink-0"
      style={{ animationDelay: delay }}
    >
      <div
        class="active-glow absolute inset-[-4px] rounded-md bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ animationDelay: delay }}
      />
      <div class="absolute inset-0 rounded-md border-2 border-primary/30 bg-black transition-colors group-hover:border-primary/60" />
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="4"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="animate-check absolute inset-0 text-primary p-0.5"
        style={{ animationDelay: `calc(${delay} + 300ms)` }}
      >
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </div>
  );
});

const landingStyles = `
.landing-v2 {
  background: #131314;
  --mouse-x: 52%;
  --mouse-y: 42%;
  --scroll-progress: 0;
  --hero-progress: 0;
}

.landing-v2 .progress-rail {
  position: fixed;
  left: 0;
  top: 4rem;
  z-index: 45;
  width: 100%;
  height: 2px;
  pointer-events: none;
  background: rgba(255, 255, 255, 0.02);
}

.landing-v2 .progress-rail::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, #9b9cff 0%, #5de6ff 100%);
  transform-origin: left center;
  transform: scaleX(var(--scroll-progress));
  transition: transform 100ms linear;
  box-shadow: 0 0 12px rgba(155, 156, 255, 0.4);
}

.landing-v2 .interactive-aurora {
  position: absolute;
  inset: -10%;
  pointer-events: none;
  z-index: 0;
  filter: blur(90px) saturate(140%);
  background:
    radial-gradient(400px circle at var(--mouse-x) var(--mouse-y), rgba(155, 156, 255, 0.18), transparent 60%),
    radial-gradient(500px circle at calc(100% - var(--mouse-x)) calc(110% - var(--mouse-y)), rgba(93, 230, 255, 0.12), transparent 60%);
  opacity: calc(0.4 + (var(--hero-progress) * 0.45));
  transition: opacity 300ms ease;
}

.landing-v2 .hero-orb-left {
  transform: translate3d(calc(var(--hero-progress) * -28px), calc(var(--hero-progress) * -36px), 0);
}

.landing-v2 .hero-orb-right {
  transform: translate3d(calc(var(--hero-progress) * 34px), calc(var(--hero-progress) * 24px), 0);
}

.landing-v2 .tilt-panel {
  position: relative;
  transform-style: preserve-3d;
  will-change: transform;
  transition:
    transform 320ms cubic-bezier(0.16, 1, 0.3, 1),
    box-shadow 320ms ease,
    border-color 220ms ease;
}

.landing-v2 .tilt-panel::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  z-index: 2;
  opacity: 0;
  background: radial-gradient(
    circle at var(--glare-x, 50%) var(--glare-y, 0%),
    rgba(255, 255, 255, 0.08),
    transparent 50%
  );
  transition: opacity 180ms ease;
}

.landing-v2 .tilt-panel[data-tilting="true"]::before {
  opacity: 1;
}

.landing-v2 .glass-panel {
  background: rgba(28, 27, 28, 0.45);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(70, 69, 84, 0.25);
  box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
}

.landing-v2 .glass-panel:hover {
  border-color: rgba(155, 156, 255, 0.45);
  background: rgba(28, 27, 28, 0.65);
  box-shadow: 0 12px 40px 0 rgba(155, 156, 255, 0.12);
}

.landing-v2 .obsidian-gradient {
  background: linear-gradient(135deg, #9b9cff 0%, #6366f1 100%);
}

.landing-v2 .text-gradient-accent {
  background: linear-gradient(135deg, #9b9cff 0%, #5de6ff 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  color: transparent;
}

.landing-v2 .text-glow {
  text-shadow: 0 0 15px rgba(155, 156, 255, 0.55);
}

.landing-v2 .scroll-reveal {
  opacity: 0;
  transform: translateY(20px);
  filter: blur(3px);
  transition: all 0.9s cubic-bezier(0.16, 1, 0.3, 1);
}

.landing-v2 .scroll-reveal.visible {
  opacity: 1;
  transform: translateY(0);
  filter: blur(0);
}

.landing-v2 .distillation-path {
  stroke-dasharray: 8 4;
  animation: flow-line 2s linear infinite;
}

@keyframes pulse-glow {
  0%, 100% { opacity: 0.15; filter: blur(8px); }
  50% { opacity: 0.4; filter: blur(12px); }
}

.landing-v2 .active-glow {
  animation: pulse-glow 2.5s ease-in-out infinite;
}

@keyframes check-draw {
  from { stroke-dashoffset: 30; }
  to { stroke-dashoffset: 0; }
}

.landing-v2 .animate-check {
  stroke-dasharray: 30;
  stroke-dashoffset: 30;
  animation: check-draw 0.5s cubic-bezier(0.65, 0, 0.45, 1) forwards;
}

@keyframes feature-entrance {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.landing-v2 .feature-entrance {
  opacity: 0;
  animation: feature-entrance 0.5s ease-out forwards;
}

@keyframes bar-grow {
  from { transform: scaleY(0); }
  to { transform: scaleY(1); }
}

.landing-v2 .animate-bar {
  transform-origin: bottom;
  animation: bar-grow 1s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

@keyframes line-draw {
  from { stroke-dashoffset: 100; }
  to { stroke-dashoffset: 0; }
}

.landing-v2 .animate-line {
  stroke-dasharray: 100;
  animation: line-draw 1.5s ease-out forwards;
}

@keyframes fade-in-stale {
  0% { opacity: 0; transform: scale(0.85); }
  100% { opacity: 0.35; transform: scale(1); }
}

.landing-v2 .stale-node {
  animation: fade-in-stale 1s ease-out forwards;
}

.landing-v2 ::selection {
  background: rgba(192, 193, 255, 0.25);
  color: #ffffff;
}

.landing-v2 .terminal-header {
  height: 38px;
  background: rgba(255, 255, 255, 0.02);
  border-bottom: 1px solid rgba(70, 69, 84, 0.25);
  display: flex;
  align-items: center;
  padding: 0 16px;
  gap: 6px;
  border-top-left-radius: inherit;
  border-top-right-radius: inherit;
}

.landing-v2 .terminal-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  opacity: 0.6;
}
.landing-v2 .terminal-dot.red { background: #ffb4ab; }
.landing-v2 .terminal-dot.yellow { background: #f59e0b; }
.landing-v2 .terminal-dot.green { background: #10b981; }

.landing-v2 .custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.landing-v2 .custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.landing-v2 .custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.08);
  border-radius: 4px;
}
.landing-v2 .custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.16);
}

@media (prefers-reduced-motion: reduce) {
  .landing-v2 .scroll-reveal {
    opacity: 1;
    transform: none;
    transition: none;
    filter: none;
  }

  .landing-v2 .interactive-aurora {
    display: none;
  }

  .landing-v2 .progress-rail::after {
    transition: none;
  }

  .landing-v2 .tilt-panel {
    transform: none !important;
    transition: none;
  }

  .landing-v2 .tilt-panel::before {
    display: none;
  }

  .landing-v2 .hero-orb-left,
  .landing-v2 .hero-orb-right {
    transform: none;
  }

  .landing-v2 .animate-float,
  .landing-v2 .animate-fade-in-up,
  .landing-v2 .animate-pulse-slow,
  .landing-v2 .animate-pulse,
  .landing-v2 .distillation-path {
    animation: none !important;
  }
}
`;

const memoryGapCards = [
  {
    title: "Standard Vector DB",
    icon: "layers_clear",
    iconWrapClass: "bg-error/15 border border-error/20",
    iconClass: "text-error",
    panelClass: "border-error/10 bg-error/[0.005]",
    items: [
      {
        title: "Amnesiac & Static",
        body: "Retrieves conflicting data from 2 years ago exactly like data from 2 minutes ago. No concept of evolving truth.",
        icon: "close",
        iconClass: "text-error",
      },
      {
        title: "Fails at Counting",
        body: "Cannot accurately aggregate or count facts (e.g. 'How many cars do I own?'). Relies entirely on the LLM to do math.",
        icon: "close",
        iconClass: "text-error",
      },
      {
        title: "Bloated Storage",
        body: "Stores every single conversational 'uh' and 'um' instead of maintaining a clean, structured user profile.",
        icon: "close",
        iconClass: "text-error",
      },
    ],
  },
  {
    title: "TelloDB Memory Engine",
    icon: "psychology",
    iconWrapClass: "bg-primary/10 border border-primary/20",
    iconClass: "text-primary",
    panelClass:
      "border-primary/30 shadow-[0_0_50px_rgba(192,193,255,0.08)] bg-primary/[0.01]",
    items: [
      {
        title: "Fact Supersession (Temporal Truth)",
        body: "When life changes (e.g. moving from NYC to SF), TelloDB marks the old fact as stale, ensuring the LLM always gets the latest truth.",
        icon: "check_circle",
        iconClass: "text-primary",
      },
      {
        title: "Deterministic Aggregation",
        body: "Built-in execution layer accurately computes numeric and temporal queries before hitting the LLM, fixing benchmark failures.",
        icon: "check_circle",
        iconClass: "text-primary",
      },
      {
        title: "Predict-Calibrate Profile",
        body: "Distills thousands of words into compact, continuous user profiles. We track the deltas, you save on context windows.",
        icon: "check_circle",
        iconClass: "text-primary",
      },
    ],
  },
];

const distillationDetails = [
  {
    icon: "schedule",
    title: "Time-Awareness",
    body: "I used to love coffee, but now I only drink tea. TelloDB does not hallucinate your old preferences. It updates your profile in real time.",
  },
  {
    icon: "filter_center_focus",
    title: "Fact Distillation",
    body: "Our engine automatically discards greetings and filler, keeping only the high-value semantic facts that actually matter for personalization.",
  },
];

const userFlowCards = [
  {
    date: "The First Spark (May 12)",
    quote: "Hey! I just bought a white Mercedes! What should I do first?",
    summary: "GPT-4o detects: User Ownership → Vehicle: Mercedes (White)",
    icon: "chat_bubble",
    iconWrapClass: "bg-primary/10 border border-primary/20",
    iconClass: "text-primary",
    borderClass: "border-l-4 border-l-primary/30",
    delay: "",
  },
  {
    date: "TelloDB Ingests",
    quote: "Fact Integration",
    summary: "",
    icon: "psychology",
    iconWrapClass: "bg-primary text-background",
    iconClass: "text-background",
    borderClass:
      "border-primary/30 shadow-[0_20px_40px_rgba(0,0,0,0.3)] bg-primary/[0.01]",
    delay: "150ms",
    facts: ["Fact: Owns Mercedes", "Context: Initial Purchase"],
  },
  {
    date: "3 Months Later (Aug 20)",
    quote: "What was that maintenance tip for my car?",
    summary: 'Claude 3.5 recalls: "For your white Mercedes, I recommend..."',
    icon: "auto_awesome",
    iconWrapClass: "bg-secondary/10 border border-secondary/20",
    iconClass: "text-secondary",
    borderClass: "border-l-4 border-l-secondary/30",
    delay: "300ms",
  },
];

const coreCapabilities = [
  {
    title: "Rust Performance Core",
    body: "Engineered in Rust with sub-100ms p99 query latencies, zero GC pauses, and compiled as a single air-gapped binary.",
    icon: "memory",
    delay: "",
  },
  {
    title: "Fact Supersession",
    body: "Time-aware rankings and TTL decay policies automatically tag older context as stale when new conflicting facts arrive.",
    icon: "published_with_changes",
    delay: "100ms",
  },
  {
    title: "Deterministic Analytics",
    body: "Built-in arithmetic and count aggregation calculated directly on the database B-Tree indexes before LLM delivery.",
    icon: "calculate",
    delay: "200ms",
  },
  {
    title: "Multi-Model Continuity",
    body: "Switch cognitive backends (GPT-4, Claude 3.5, Llama 3) without losing memory state or query syntax history.",
    icon: "all_inclusive",
    delay: "300ms",
  },
  {
    title: "OpenAI Proxy Path (Coming Soon)",
    body: "Drop-in proxy gateway that automatically injects relevant context into OpenAI-compatible system instructions. In development.",
    icon: "database",
    delay: "400ms",
  },
  {
    title: "Graph Knowledge Base",
    body: "Self-organizing RDF typed graph representations mapping relationships between user sessions and profile history.",
    icon: "hub",
    delay: "500ms",
  },
];

const deliveryTrack = [
  {
    phase: "Phase 01",
    icon: "upload",
    title: "Ingest and Distill",
    body: "Raw events are normalized, deduplicated, and expanded into durable memories with lineage.",
    checkpoints: ["Companion memories", "Dedup table", "Graph relationships"],
  },
  {
    phase: "Phase 02",
    icon: "hub",
    title: "Retrieve and Rerank",
    body: "Semantic and lexical candidates are fused, reranked, then filtered by temporal policy before response.",
    checkpoints: ["HNSW + BM25", "Cross-rerank", "RRF + policy filters"],
  },
  {
    phase: "Phase 03",
    icon: "rocket_launch",
    title: "Ship and Operate",
    body: "Teams deploy one memory engine surface from local bench runs to hosted multi-tenant workloads.",
    checkpoints: ["SDK parity", "Benchmarked quality", "Operational playbooks"],
  },
];

const runtimeSnapshot = `engine: TelloDB
routes: /ingest /query/semantic /query/temporal /memory
indexes: hnsw + bm25 + graph lineage
policy: ttl + decay + supersession
sdk: python + javascript`;

const platformLinks = [
  { label: "Mission Control", href: "/platform" },
  { label: "Pricing", href: "/signup" },
  { label: "Benchmarks", href: "/platform/benchmarks" },
  { label: "Trust Center", href: "/platform/trust" },
  { label: "Self-Hosting", href: "/platform/byoc" },
  { label: "Docs", href: "/docs" },
];

const companyLinks = [
  { label: "Privacy First", href: "/docs/security" },
  { label: "Security Audit", href: "/docs/security" },
  { label: "Open Source", href: "/docs" },
  { label: "Contact", href: CONTACT_MAILTO },
];

export const onRequest: RequestHandler = (event) => {
  setPublicEdgeCache(event);
};

const ecosystemItems = [
  {
    title: "OpenAI Proxy (Coming Soon)",
    body: "An OpenAI-compatible gateway that automatically injects memories into your agent's system prompt. Zero code changes required. In development.",
    icon: "database",
    link: "/docs/memory-proxy",
  },
  {
    title: "TelloDB CLI",
    body: "Unified command-line tool to manage your engine, run local benchmarks, and monitor memory logs in real-time.",
    icon: "terminal",
    link: "/docs/local-engine",
  },
  {
    title: "MCP Server",
    body: "Built-in support for the Model Context Protocol. Connect TelloDB directly to Claude Code, Cursor, and agentic IDEs.",
    icon: "hub",
    link: "/docs",
  },
];

export default component$(() => {
  const pageRef = useSignal<HTMLElement>();
  const heroMessage = useSignal(
    "I moved to Tokyo and I still prefer jasmine tea over coffee.",
  );
  const heroQuery = useSignal("Where do I live?");
  const heroDemoResult = useSignal<HeroDemoResult | null>(null);
  const heroWarmupResult = useSignal<HeroWarmupResult | null>(null);
  const heroDemoRunning = useSignal(false);
  const heroWarmupRunning = useSignal(false);
  const demoKey = useSignal("");
  const heroDemoMode = useSignal<"store" | "recall" | null>(null);

  useVisibleTask$(() => {
    let key = localStorage.getItem("tellodb_demo_key");
    if (!key) {
      const randomPart = Math.random().toString(36).substring(2, 8);
      key = `demo_${randomPart}`;
      localStorage.setItem("tellodb_demo_key", key);
    }
    demoKey.value = key;
  });

  const readJsonResponse = $(
    async (
      response: Response,
      fallbackPrefix: string,
    ): Promise<HeroWarmupResult | HeroDemoResult> => {
      const raw = await response.text();
      try {
        return JSON.parse(raw) as HeroWarmupResult | HeroDemoResult;
      } catch {
        return {
          ok: false,
          message: `${fallbackPrefix} ${raw.trim() || response.statusText}`,
        };
      }
    },
  );

  const runHeroWarmup = $(async () => {
    heroWarmupRunning.value = true;
    heroWarmupResult.value = null;

    try {
      const response = await fetch("/api/hero/warmup", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
      });
      heroWarmupResult.value = (await readJsonResponse(
        response,
        "Warm-up failed.",
      )) as HeroWarmupResult;
    } catch (error) {
      captureError(error, { page: "landing", action: "heroWarmup" });
      heroWarmupResult.value = {
        ok: false,
        message:
          error instanceof Error
            ? `Warm-up transport failed. ${error.message}`
            : "Warm-up transport failed.",
      };
    } finally {
      heroWarmupRunning.value = false;
    }
  });

  const runHeroDemo = $(async (action: "store" | "recall") => {
    const message =
      action === "store" ? heroMessage.value.trim() : heroQuery.value.trim();
    if (!message) {
      heroDemoResult.value = {
        ok: false,
        action,
        message:
          action === "store"
            ? "Enter a user message so the engine has something real to save."
            : "Enter a query to recall memories for this demo user.",
      };
      return;
    }

    heroDemoRunning.value = true;
    heroDemoMode.value = action;
    capture("hero_demo_action", { action });

    try {
      const response = await fetch("/api/hero/demo", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          action,
          message,
          demoKey: demoKey.value,
        }),
      });
      const nextResult = (await readJsonResponse(
        response,
        "Demo failed.",
      )) as HeroDemoResult;
      heroDemoResult.value = nextResult.ok
        ? {
            ...(heroDemoResult.value ?? {}),
            ...nextResult,
            message: undefined,
          }
        : {
            ...(heroDemoResult.value ?? {}),
            ...nextResult,
          };
    } catch (error) {
      captureError(error, { page: "landing", action: "heroDemo" });
      heroDemoResult.value = {
        ok: false,
        action,
        message:
          error instanceof Error
            ? `Demo transport failed. ${error.message}`
            : "Demo transport failed.",
      };
    } finally {
      heroDemoRunning.value = false;
      heroDemoMode.value = null;
    }
  });

  const regenerateKey = $(() => {
    const randomPart = Math.random().toString(36).substring(2, 8);
    const key = `demo_${randomPart}`;
    demoKey.value = key;
    localStorage.setItem("tellodb_demo_key", key);
  });

  useVisibleTask$(({ cleanup }) => {
    const root = pageRef.value;

    if (!root) {
      return;
    }

    const revealItems = Array.from(
      root.querySelectorAll<HTMLElement>(".scroll-reveal"),
    );
    const tiltPanels = Array.from(
      root.querySelectorAll<HTMLElement>("[data-tilt]"),
    );
    const heroSection = root.querySelector<HTMLElement>("[data-hero]");
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const supportsHover = window.matchMedia("(hover: hover)").matches;

    const clamp = (value: number, min: number, max: number) =>
      Math.min(max, Math.max(min, value));

    const updateScrollProgress = () => {
      const doc = document.documentElement;
      const scrollTop = window.scrollY || doc.scrollTop;
      const maxScroll = Math.max(doc.scrollHeight - window.innerHeight, 1);
      root.style.setProperty(
        "--scroll-progress",
        (scrollTop / maxScroll).toFixed(4),
      );

      if (!heroSection) {
        return;
      }

      const heroRect = heroSection.getBoundingClientRect();
      const rawProgress =
        (window.innerHeight - heroRect.top) /
        (window.innerHeight + heroRect.height);
      root.style.setProperty(
        "--hero-progress",
        clamp(rawProgress, 0, 1).toFixed(4),
      );
    };

    const updatePointer = (clientX: number, clientY: number) => {
      if (!heroSection) {
        return;
      }

      const rect = heroSection.getBoundingClientRect();
      if (clientY < rect.top - 80 || clientY > rect.bottom + 80) {
        return;
      }

      const x = ((clientX - rect.left) / rect.width) * 100;
      const y = ((clientY - rect.top) / rect.height) * 100;
      root.style.setProperty("--mouse-x", `${clamp(x, 0, 100).toFixed(2)}%`);
      root.style.setProperty("--mouse-y", `${clamp(y, 0, 100).toFixed(2)}%`);
    };

    if (prefersReducedMotion) {
      revealItems.forEach((item) => item.classList.add("visible"));
      updateScrollProgress();
      return;
    }

    updateScrollProgress();

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            (entry.target as HTMLElement).classList.add("visible");
          }
        });
      },
      {
        threshold: 0.1,
        rootMargin: "0px 0px -50px 0px",
      },
    );

    revealItems.forEach((item) => observer.observe(item));

    const removePanelListeners: Array<() => void> = [];

    if (supportsHover) {
      tiltPanels.forEach((panel) => {
        const onPointerMove = (event: PointerEvent) => {
          const rect = panel.getBoundingClientRect();
          const px = clamp(
            ((event.clientX - rect.left) / rect.width) * 100,
            0,
            100,
          );
          const py = clamp(
            ((event.clientY - rect.top) / rect.height) * 100,
            0,
            100,
          );
          const rotateY = (px - 50) * 0.12;
          const rotateX = (50 - py) * 0.12;

          panel.dataset.tilting = "true";
          panel.style.setProperty("--glare-x", `${px.toFixed(2)}%`);
          panel.style.setProperty("--glare-y", `${py.toFixed(2)}%`);
          panel.style.transform = `perspective(1100px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) translateY(-4px)`;
        };

        const resetPanel = () => {
          panel.dataset.tilting = "false";
          panel.style.transform =
            "perspective(1100px) rotateX(0deg) rotateY(0deg) translateY(0)";
        };

        panel.addEventListener("pointermove", onPointerMove);
        panel.addEventListener("pointerleave", resetPanel);

        removePanelListeners.push(() => {
          panel.removeEventListener("pointermove", onPointerMove);
          panel.removeEventListener("pointerleave", resetPanel);
        });
      });
    }

    const onPointerMove = (event: PointerEvent) => {
      updatePointer(event.clientX, event.clientY);
    };

    const onScroll = () => {
      updateScrollProgress();
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    cleanup(() => {
      observer.disconnect();
      removePanelListeners.forEach((remove) => remove());
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    });
  });

  return (
    <div ref={pageRef} class="landing-v2 bg-surface text-on-surface font-body">
      <div aria-hidden="true" class="progress-rail" />
      <main class="pt-4">
        <section class="relative min-h-[90vh] flex items-center px-6 border-b border-white/5 overflow-hidden">
          {/* Background Aurora Effect */}
          <div aria-hidden="true" class="interactive-aurora" />

          <div class="container mx-auto grid grid-cols-1 items-center gap-16 lg:grid-cols-2 relative z-10 py-16 md:py-24">
            <div>
              <div class="mb-6 inline-flex items-center gap-2 border border-primary/20 bg-primary/5 px-4 py-1.5 rounded-full backdrop-blur-md">
                <span class="relative flex h-2 w-2">
                  <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                  <span class="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                </span>
                <span class="font-mono text-[10px] font-bold uppercase tracking-widest text-primary">
                  v0.1.0 — Now Open Source
                </span>
              </div>

              <h1 class="mb-6 text-5xl font-extrabold tracking-tight md:text-7xl text-on-surface font-headline leading-[1.05]">
                Memory Engine
                <br />
                <span class="text-gradient-accent">for AI Agents</span>
              </h1>

              <p class="mb-8 max-w-xl text-lg leading-relaxed text-tertiary">
                Hybrid vector + BM25 search, knowledge graphs, deterministic
                analytics, and fact supersession in a single Rust binary.
                Self-host or deploy on our platform with one click.
              </p>

              <div class="flex flex-wrap gap-4">
                <Link
                  href="/signup"
                  onClick$={() => capture("cta_signup_clicked")}
                  class="inline-flex items-center gap-2 px-6 py-3 bg-primary text-black font-extrabold rounded-xl hover:opacity-90 transition-opacity shadow-lg shadow-primary/10"
                >
                  Get Started Free
                  <ArrowRightIcon class="w-4 h-4" />
                </Link>
                <Link
                  href="/login"
                  onClick$={() => capture("cta_login_clicked")}
                  class="inline-flex items-center gap-2 px-6 py-3 border border-white/10 text-on-surface font-bold rounded-xl hover:bg-white/5 transition-colors"
                >
                  Sign In
                </Link>
                <a
                  href={CALENDLY_30_MIN_URL}
                  target="_blank"
                  rel="noreferrer"
                  onClick$={() => capture("cta_demo_clicked")}
                  class="inline-flex items-center gap-2 px-6 py-3 border border-white/10 text-tertiary font-bold rounded-xl hover:bg-white/5 transition-colors text-sm"
                >
                  Book a Demo
                  <ExternalLinkIcon class="w-3 h-3" />
                </a>
              </div>
            </div>

            {/* Simulated Rust Memory Engine Console */}
            <div class="glass-panel rounded-2xl border border-white/10 shadow-2xl relative overflow-hidden">
              <div class="terminal-header">
                <span class="terminal-dot red" />
                <span class="terminal-dot yellow" />
                <span class="terminal-dot green" />
                <span class="text-[10px] font-mono text-tertiary ml-2">
                  tellodb serve --port 5001
                </span>
              </div>
              <div class="p-6 font-mono text-xs space-y-4">
                <div class="flex items-center justify-between text-green-400">
                  <span>● ENGINE: tellodb_core v0.1.0 [Active]</span>
                  <span class="animate-pulse">ONLINE</span>
                </div>

                <div class="grid grid-cols-2 gap-3 text-secondary">
                  <div class="p-3 bg-white/[0.02] border border-white/5 rounded-xl">
                    <span class="block text-[9px] text-tertiary font-bold uppercase tracking-wider">
                      Retrieval p99
                    </span>
                    <span class="text-lg font-bold text-white">4.2ms</span>
                  </div>
                  <div class="p-3 bg-white/[0.02] border border-white/5 rounded-xl">
                    <span class="block text-[9px] text-tertiary font-bold uppercase tracking-wider">
                      Memory Blocks
                    </span>
                    <span class="text-lg font-bold text-white">142,850</span>
                  </div>
                </div>

                <div class="border-t border-white/5 pt-4 space-y-2">
                  <span class="block text-[9px] text-tertiary font-bold uppercase tracking-wider mb-2">
                    Memory Substrates Loaded
                  </span>
                  <div class="grid grid-cols-2 gap-x-4 gap-y-2 text-[11px]">
                    {[
                      { name: "HNSW Vector Index" },
                      { name: "BM25F Full-Text Search" },
                      { name: "Knowledge Graph Engine" },
                      { name: "Temporal Truth Decay" },
                      { name: "Metric Vault (Math)" },
                      { name: "Air-Gapped Proxy Gateway" },
                    ].map((sub) => (
                      <div key={sub.name} class="flex items-center gap-2">
                        <span class="text-green-400">✓</span>
                        <span class="text-on-surface/90">{sub.name}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div class="border-t border-white/5 pt-4">
                  <div class="bg-black/30 rounded-lg p-3 text-[10px] text-tertiary/90 leading-relaxed border border-white/5">
                    <span class="text-primary">$</span> tellodb query "user
                    preferences"
                    <br />
                    <span class="text-white">
                      &gt; Ingesting fact... "prefer jasmine tea over coffee"
                    </span>
                    <br />
                    <span class="text-green-400">
                      &gt; Fact supersession resolved. Invalidation complete.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-1 rounded-full border border-white/5 bg-white/[0.02] backdrop-blur-md whitespace-nowrap">
            <a
              href="/docs"
              class="text-xs font-mono text-tertiary hover:text-primary transition-colors whitespace-nowrap"
            >
              Learn how the engine works →
            </a>
          </div>
        </section>

        <section
          id="interactive-tester"
          class="px-6 py-24 md:py-32 border-b border-white/5 bg-transparent"
        >
          <div class="container mx-auto">
            <div class="scroll-reveal mb-16 text-center">
              <h2 class="mb-4 text-sm font-bold uppercase tracking-widest text-primary font-mono">
                Interactive Demo
              </h2>
              <h3 class="text-4xl font-extrabold tracking-tight md:text-5xl font-headline">
                Live Memory{" "}
                <span class="text-gradient-accent italic">Simulation.</span>
              </h3>
              <p class="mt-6 mx-auto max-w-2xl text-base text-tertiary leading-relaxed">
                Experience TelloDB's real-time ingestion and recall loop. Store
                a fact, then retrieve it across model contexts.
              </p>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
              {/* Left Side: Store/Warmup */}
              <div class="space-y-6">
                <div class="flex items-center justify-center gap-4 mb-2">
                  <div class="h-px w-8 sm:w-16 bg-gradient-to-l from-primary/40 to-transparent"></div>
                  <span class="text-sm font-mono font-bold px-2.5 py-1 rounded-md border border-primary/25 bg-primary/10 text-primary shadow-[0_0_8px_rgba(155,156,255,0.15)] whitespace-nowrap">
                    01
                  </span>
                  <h3 class="text-2xl md:text-3xl font-extrabold tracking-widest font-headline text-primary uppercase text-glow whitespace-nowrap">
                    STEP 1
                  </h3>
                  <div class="h-px w-8 sm:w-16 bg-gradient-to-r from-primary/40 to-transparent"></div>
                </div>
                <div class="glass-panel relative rounded-2xl p-6 md:p-8 overflow-hidden">
                  <div class="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(192,193,255,0.04),transparent_50%)]" />
                  <div class="relative z-10 space-y-6">
                    <div class="flex items-center gap-3 border-b border-white/5 pb-4">
                      <div class="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
                        <MaterialIcon name="input" class="text-xl" />
                      </div>
                      <div>
                        <h4 class="text-lg font-bold font-headline text-on-surface">
                          Ingestion Layer
                        </h4>
                        <p class="text-[9px] font-mono uppercase tracking-widest text-tertiary font-bold">
                          Write Pipeline
                        </p>
                      </div>
                    </div>

                    <div class="rounded-xl border border-white/5 bg-black/25 p-5">
                      <div class="flex items-center justify-between mb-3">
                        <p class="text-[9px] font-mono font-bold uppercase tracking-widest text-primary">
                          Demo Memory Session Key
                        </p>
                        <button
                          type="button"
                          class="text-[9px] font-mono text-tertiary hover:text-primary transition-colors flex items-center gap-1 disabled:opacity-50"
                          onClick$={regenerateKey}
                        >
                          <MaterialIcon
                            name="published_with_changes"
                            class="text-[10px]"
                          />
                          Regenerate
                        </button>
                      </div>
                      <div class="relative flex items-center">
                        <input
                          type="text"
                          class="w-full rounded-lg border border-white/5 bg-black/35 px-3 py-2 text-xs text-on-surface outline-none transition-all placeholder:text-tertiary/40 focus:border-primary/45 font-mono"
                          value={demoKey.value}
                          onInput$={(_, currentTarget) => {
                            const cleanKey = currentTarget.value.trim();
                            demoKey.value = cleanKey;
                            localStorage.setItem("tellodb_demo_key", cleanKey);
                          }}
                          placeholder="Enter custom session key..."
                        />
                      </div>
                      <p class="mt-2 text-[10px] text-tertiary leading-relaxed">
                        Memories are stored and queried using this unique key.
                        It isolates your demo session and persists across
                        reloads.
                      </p>
                    </div>

                    <div class="space-y-3">
                      <label class="block text-[9px] font-mono font-bold uppercase tracking-widest text-tertiary">
                        Raw Memory Input string
                      </label>
                      <textarea
                        class="min-h-[120px] w-full rounded-xl border border-white/5 bg-black/35 px-4 py-3 text-xs md:text-sm text-on-surface outline-none transition-all placeholder:text-tertiary/40 focus:border-primary/45 shadow-inner"
                        placeholder="I moved to Tokyo and I still prefer jasmine tea over coffee."
                        value={heroMessage.value}
                        onInput$={(_, currentTarget) => {
                          heroMessage.value = currentTarget.value;
                        }}
                        required
                      />
                      <button
                        type="button"
                        class="obsidian-gradient w-full inline-flex items-center justify-center gap-2 rounded-xl py-3.5 text-xs md:text-sm font-bold text-white transition-all hover:shadow-[0_0_24px_rgba(192,193,255,0.25)] active:scale-[0.98] disabled:opacity-50 shadow-lg"
                        disabled={heroDemoRunning.value}
                        onClick$={() => runHeroDemo("store")}
                      >
                        {heroDemoRunning.value && heroDemoMode.value === "store"
                          ? "Writing to disk..."
                          : "Commit to Long-Term Memory"}
                        <MaterialIcon
                          name="published_with_changes"
                          class="text-sm"
                        />
                      </button>

                      <div class="grid grid-cols-2 gap-4 pt-1">
                        <div class="rounded-xl border border-white/5 bg-black/25 p-3">
                          <p class="text-[8px] font-mono font-bold uppercase tracking-wider text-tertiary">
                            Ingest Latency (Engine)
                          </p>
                          <p class="mt-1 text-sm font-mono font-extrabold text-on-surface">
                            {heroDemoResult.value?.ingestLabel ?? "---"}
                          </p>
                        </div>
                        <div class="rounded-xl border border-white/5 bg-black/25 p-3">
                          <p class="text-[8px] font-mono font-bold uppercase tracking-wider text-tertiary">
                            Ingest Latency (Network RTT)
                          </p>
                          <p class="mt-1 text-sm font-mono font-extrabold text-on-surface">
                            {heroDemoResult.value?.ingestRoundTripLabel ??
                              "---"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Side: Recall & Results */}
              <div class="space-y-6">
                <div class="flex items-center justify-center gap-4 mb-2">
                  <div class="h-px w-8 sm:w-16 bg-gradient-to-l from-secondary/40 to-transparent"></div>
                  <span class="text-sm font-mono font-bold px-2.5 py-1 rounded-md border border-secondary/25 bg-secondary/10 text-secondary shadow-[0_0_8px_rgba(93,230,255,0.12)] whitespace-nowrap">
                    02
                  </span>
                  <h3 class="text-2xl md:text-3xl font-extrabold tracking-widest font-headline text-secondary uppercase text-glow whitespace-nowrap">
                    STEP 2
                  </h3>
                  <div class="h-px w-8 sm:w-16 bg-gradient-to-r from-secondary/40 to-transparent"></div>
                </div>
                <div class="glass-panel relative rounded-2xl p-6 md:p-8 overflow-hidden">
                  <div class="absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,rgba(93,230,255,0.04),transparent_50%)]" />
                  <div class="relative z-10 space-y-5">
                    <div class="flex items-center gap-3 border-b border-white/5 pb-4">
                      <div class="h-10 w-10 rounded-xl obsidian-gradient flex items-center justify-center text-white shadow-lg">
                        <MaterialIcon name="travel_explore" class="text-xl" />
                      </div>
                      <div>
                        <h4 class="text-lg font-bold font-headline text-white">
                          Truth Retrieval
                        </h4>
                        <p class="text-[9px] font-mono uppercase tracking-widest text-primary font-bold">
                          Read Substrate
                        </p>
                      </div>
                    </div>

                    <div class="space-y-3">
                      <label class="block text-[9px] font-mono font-bold uppercase tracking-widest text-tertiary">
                        Memory Query (Semantic Search)
                      </label>
                      <textarea
                        class="min-h-[80px] w-full rounded-xl border border-white/5 bg-black/35 px-4 py-3 text-xs md:text-sm text-on-surface outline-none transition-all placeholder:text-tertiary/40 focus:border-primary/45 shadow-inner"
                        placeholder="Where do I live?"
                        value={heroQuery.value}
                        onInput$={(_, currentTarget) => {
                          heroQuery.value = currentTarget.value;
                        }}
                        required
                      />
                    </div>

                    <button
                      type="button"
                      class="glass-panel w-full inline-flex items-center justify-center gap-2 rounded-xl py-3.5 text-xs md:text-sm font-bold text-on-surface transition-all hover:bg-white/5 active:scale-[0.98] disabled:opacity-50"
                      disabled={heroDemoRunning.value}
                      onClick$={() => runHeroDemo("recall")}
                    >
                      {heroDemoRunning.value && heroDemoMode.value === "recall"
                        ? "Retrieving..."
                        : "Retrieve Memory"}
                      <MaterialIcon name="speed" class="text-sm text-primary" />
                    </button>

                    <div class="grid grid-cols-2 gap-4">
                      <div class="rounded-xl border border-white/5 bg-black/25 p-3">
                        <p class="text-[8px] font-mono font-bold uppercase tracking-wider text-tertiary">
                          Query Latency (Engine)
                        </p>
                        <p class="mt-1 text-sm font-mono font-extrabold text-primary text-glow">
                          {heroDemoResult.value?.queryLabel ?? "---"}
                        </p>
                      </div>
                      <div class="rounded-xl border border-white/5 bg-black/25 p-3">
                        <p class="text-[8px] font-mono font-bold uppercase tracking-wider text-tertiary">
                          Query Latency (Network RTT)
                        </p>
                        <p class="mt-1 text-sm font-mono font-extrabold text-on-surface">
                          {heroDemoResult.value?.queryRoundTripLabel ?? "---"}
                        </p>
                      </div>
                    </div>

                    <div class="rounded-xl border border-white/5 bg-black/35 p-4 shadow-inner">
                      <div class="flex items-center justify-between mb-3">
                        <p class="text-[8px] font-mono font-bold uppercase tracking-wider text-tertiary">
                          Retrieved Memory Hits
                        </p>
                        {heroDemoResult.value?.memoryId && (
                          <span class="px-2 py-0.5 rounded bg-primary/10 text-[8px] font-mono text-primary border border-primary/20">
                            {heroDemoResult.value.entityId}
                          </span>
                        )}
                      </div>
                      <div class="space-y-2 max-h-[160px] overflow-y-auto pr-2 custom-scrollbar">
                        {heroDemoResult.value?.ok &&
                        heroDemoResult.value.hits &&
                        heroDemoResult.value.hits.length > 0 ? (
                          heroDemoResult.value.hits.map((hit, idx) => (
                            <div
                              key={idx}
                              class="p-2.5 rounded-lg bg-white/[0.01] border border-white/5 text-xs text-tertiary leading-relaxed animate-fade-in font-mono"
                            >
                              {hit.textual_content}
                            </div>
                          ))
                        ) : (
                          <p class="text-xs text-tertiary italic text-center py-6">
                            No memories retrieved yet. Ingest a fact first.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {heroDemoResult.value?.queryUnderBlink && (
                  <div class="feature-entrance rounded-xl border border-secondary/25 bg-secondary/5 p-5 flex items-start gap-3 shadow-lg shadow-secondary/5">
                    <MaterialIcon
                      name="verified"
                      class="text-secondary mt-0.5 text-sm"
                    />
                    <div>
                      <h5 class="text-xs font-bold text-white font-headline">
                        Sub-100ms In-Memory Verified
                      </h5>
                      <p class="text-[11px] text-tertiary mt-0.5 leading-relaxed">
                        This session query was resolved faster than a human
                        blink at the database layer.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <section
          id="memory-gap"
          class="border-y border-outline-variant/10 bg-surface-container-high/20 px-6 py-32"
        >
          <div class="container mx-auto">
            <div class="scroll-reveal mx-auto mb-20 max-w-3xl text-center">
              <h2 class="mb-4 text-sm font-bold uppercase tracking-widest text-primary">
                The Cognition Problem
              </h2>
              <h3 class="mb-6 text-4xl font-black tracking-tight md:text-5xl">
                Standard RAG is{" "}
                <span class="italic text-tertiary">amnesiac.</span>
              </h3>
              <p class="text-lg text-tertiary">
                Vector databases are giant warehouses of static text. They find
                words, but they do not understand life. They lose context,
                ignore the passage of time, and drown in their own noise.
              </p>
            </div>

            <div class="grid grid-cols-1 gap-12 lg:grid-cols-2">
              {memoryGapCards.map((card, cardIndex) => (
                <div
                  key={card.title}
                  class={`glass-panel scroll-reveal tilt-panel rounded-2xl p-8 md:p-10 ${card.panelClass}`}
                  data-tilt
                  style={{
                    transitionDelay: cardIndex === 1 ? "150ms" : undefined,
                  }}
                >
                  <div class="mb-8 flex items-center gap-4">
                    <div
                      class={`flex h-10 w-10 items-center justify-center rounded-xl ${card.iconWrapClass}`}
                    >
                      <MaterialIcon
                        name={card.icon}
                        class={`${card.iconClass}`.trim()}
                      />
                    </div>
                    <h4 class="text-xl font-bold font-headline">
                      {card.title}
                    </h4>
                  </div>

                  <ul class="space-y-6">
                    {card.items.map((item) => (
                      <li key={item.title} class="flex gap-4">
                        <MaterialIcon
                          name={item.icon}
                          class={`shrink-0 mt-0.5 ${item.iconClass}`.trim()}
                        />
                        <div>
                          <span class="mb-1 block font-bold text-sm text-on-surface">
                            {item.title}
                          </span>
                          <p class="text-xs md:text-sm text-tertiary leading-relaxed">
                            {item.body}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div class="mt-16 grid grid-cols-1 gap-8 lg:grid-cols-2">
              {/* Precision Benchmark Widget */}
              <div class="glass-panel scroll-reveal rounded-2xl p-8">
                <div class="flex items-center justify-between mb-8">
                  <h4 class="text-lg font-bold font-headline">
                    Recall Precision Benchmarks
                  </h4>
                  <span class="text-[10px] font-mono text-tertiary uppercase tracking-wider">
                    LongMemEval-S Suite
                  </span>
                </div>

                <div class="flex items-end gap-8 h-48 border-b border-white/5 pb-2 px-4 relative">
                  <div class="absolute left-0 top-0 h-full w-px bg-white/[0.02] flex flex-col justify-between text-[9px] text-tertiary font-mono -translate-x-full pr-3">
                    <span>100%</span>
                    <span>75%</span>
                    <span>50%</span>
                    <span>25%</span>
                    <span>0%</span>
                  </div>

                  {/* Standard RAG Bar */}
                  <div class="flex-1 h-full flex flex-col justify-end items-center gap-3">
                    <div
                      class="w-full bg-black/40 border border-error/15 rounded-t-xl relative overflow-hidden group transition-all"
                      style="height: 68%;"
                    >
                      <div class="absolute inset-0 bg-gradient-to-t from-error/25 to-error/85 rounded-t-xl transition-all animate-bar" />
                      <span class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-xs font-mono font-bold text-error z-10 text-glow">
                        68%
                      </span>
                    </div>
                    <span class="text-[9px] font-mono uppercase font-bold tracking-widest text-tertiary">
                      Standard RAG
                    </span>
                  </div>

                  {/* Tellodb Bar */}
                  <div class="flex-1 h-full flex flex-col justify-end items-center gap-3">
                    <div
                      class="w-full bg-black/40 border border-primary/30 rounded-t-xl relative overflow-hidden group transition-all"
                      style="height: 95.4%;"
                    >
                      <div class="absolute inset-0 bg-gradient-to-t from-primary/35 to-secondary/90 rounded-t-xl transition-all animate-bar shadow-[0_0_20px_rgba(155,156,255,0.35)]" />
                      <span class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-xs font-mono font-bold text-white z-10 text-glow">
                        95%+
                      </span>
                    </div>
                    <span class="text-[9px] font-mono uppercase font-bold tracking-widest text-primary font-bold">
                      TelloDB
                    </span>
                  </div>
                </div>

                <p class="mt-6 text-xs leading-relaxed text-tertiary">
                  TelloDB resolves standard vector search failures. In memory
                  tasks with high fact-density, the local hybrid architecture
                  ensures precise recall.
                </p>
              </div>

              {/* Temporal Fact Evolution Widget */}
              <div class="glass-panel scroll-reveal rounded-2xl p-8 bg-white/[0.01]">
                <div class="flex items-center justify-between mb-8">
                  <h4 class="text-lg font-bold font-headline">
                    Temporal Fact Evolution
                  </h4>
                  <span class="text-[10px] font-mono text-tertiary uppercase tracking-wider">
                    Supersession State
                  </span>
                </div>

                <div class="relative pt-8 pb-16 px-4">
                  <div class="absolute left-0 top-[40%] h-[1px] w-full border-t border-dashed border-white/5 -translate-y-1/2 z-0" />
                  <div class="relative z-10 flex justify-between items-center h-20">
                    {/* State 2025 (Stale) */}
                    <div class="flex flex-col items-center gap-2">
                      <div class="h-8 w-8 rounded-full bg-error/15 border border-error/20 flex items-center justify-center stale-node">
                        <MaterialIcon
                          name="cancel"
                          class="text-xs text-error"
                        />
                      </div>
                      <div class="text-center font-mono whitespace-nowrap">
                        <span class="block text-[9px] uppercase tracking-widest text-error/70 font-semibold whitespace-nowrap">
                          2025 (STALE)
                        </span>
                        <span class="block text-[10px] text-error/50 line-through whitespace-nowrap">
                          "Living in NYC"
                        </span>
                      </div>
                    </div>

                    {/* Connection Arrow */}
                    <div class="flex h-8 w-8 items-center justify-center">
                      <MaterialIcon
                        name="trending_flat"
                        class="text-primary animate-pulse"
                      />
                    </div>

                    {/* State Today (Active) */}
                    <div class="flex flex-col items-center gap-2">
                      <div class="h-8 w-8 rounded-full bg-primary/10 border border-primary/25 flex items-center justify-center shadow-[0_0_15px_rgba(192,193,255,0.25)]">
                        <MaterialIcon
                          name="verified"
                          class="text-xs text-primary"
                        />
                      </div>
                      <div class="text-center font-mono whitespace-nowrap">
                        <span class="block text-[9px] uppercase tracking-widest text-primary font-bold whitespace-nowrap">
                          Today (ACTIVE)
                        </span>
                        <span class="block text-[10px] font-bold text-white whitespace-nowrap">
                          "Moving to SF"
                        </span>
                      </div>
                    </div>
                  </div>

                  <div class="absolute bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-primary/10 border border-primary/25 whitespace-nowrap z-20">
                    <span class="text-[8px] font-mono uppercase tracking-[0.15em] text-primary font-bold whitespace-nowrap">
                      Fact Invalidation Complete
                    </span>
                  </div>
                </div>

                <p class="mt-8 text-xs leading-relaxed text-tertiary">
                  When newer truths supersede older context, the engine
                  automatically tags prior states as stale, filtering them out
                  from active agent context.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section class="overflow-hidden px-6 py-24 md:py-32 border-b border-white/5">
          <div class="container mx-auto">
            <div class="grid grid-cols-1 items-center gap-16 lg:grid-cols-2">
              <div class="scroll-reveal">
                <h2 class="mb-4 text-sm font-bold uppercase tracking-widest text-primary font-mono">
                  The Distillation Loop
                </h2>
                <h3 class="mb-8 text-4xl font-extrabold leading-tight md:text-5xl font-headline">
                  We do not store text.
                  <br />
                  We extract{" "}
                  <span class="text-gradient-accent italic">truth.</span>
                </h3>
                <p class="mb-8 text-base text-tertiary leading-relaxed">
                  Raw chat logs are noise. TelloDB acts as a cognitive filter,
                  distilling human rambling into a clean, queryable lattice of
                  facts.
                </p>

                <div class="space-y-6">
                  {distillationDetails.map((item) => (
                    <div key={item.title} class="flex items-start gap-4">
                      <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/5">
                        <MaterialIcon name={item.icon} class="text-primary" />
                      </div>
                      <div>
                        <h4 class="mb-1 font-bold text-sm text-on-surface font-headline">
                          {item.title}
                        </h4>
                        <p class="text-xs md:text-sm text-tertiary leading-relaxed">
                          {item.body}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Distillation Pipeline Visual */}
              <div
                class="glass-panel scroll-reveal relative rounded-2xl border border-white/5 p-8 md:p-10 bg-white/[0.01]"
                style={{ transitionDelay: "200ms" }}
              >
                <div class="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.03),transparent_70%)]" />

                <div class="relative z-10 flex flex-col items-center gap-8">
                  {/* Step 1: Input Raw Chat */}
                  <div class="flex w-full items-center justify-between gap-4">
                    <div class="flex-1 rounded-xl border border-white/5 bg-white/[0.02] p-4 font-mono text-[11px] text-tertiary">
                      <span class="text-primary/60 mr-1">User:</span> "Hey! I
                      just bought a white Mercedes!"
                    </div>
                    <div class="shrink-0 flex items-center gap-2">
                      <MaterialIcon
                        name="arrow_forward"
                        class="animate-pulse text-primary text-sm"
                      />
                      <span class="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-tertiary">
                        Raw Chat
                      </span>
                    </div>
                  </div>

                  {/* Step 2: Processing Core */}
                  <div class="flex w-full flex-col items-center border-y border-white/5 py-6">
                    <div class="obsidian-gradient mb-3 flex h-16 w-16 items-center justify-center rounded-2xl shadow-[0_0_20px_rgba(192,193,255,0.25)]">
                      <MaterialIcon
                        name="settings_input_component"
                        class="text-3xl text-white"
                      />
                    </div>
                    <div class="text-xs font-bold uppercase tracking-widest font-headline">
                      Distillation Kernel
                    </div>
                    <div class="mt-1 font-mono text-[9px] text-tertiary">
                      Rust Semantic Filter v0.1.0
                    </div>
                  </div>

                  {/* Step 3: Extracted Facts */}
                  <div class="w-full space-y-3">
                    <div class="flex items-center gap-3 rounded-xl border border-green-500/20 bg-green-950/10 p-3">
                      <MaterialIcon
                        name="verified"
                        class="text-sm text-green-400"
                      />
                      <span class="font-mono text-xs text-on-surface">
                        Fact: User owns Mercedes (White)
                      </span>
                    </div>
                    <div class="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3 opacity-60">
                      <MaterialIcon
                        name="database"
                        class="text-sm text-primary"
                      />
                      <span class="font-mono text-xs text-tertiary">
                        Committed to memory lattice
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="memory" class="bg-surface-container/30 px-6 py-32">
          <div class="container mx-auto">
            <div class="scroll-reveal mb-20 max-w-2xl">
              <h2 class="mb-4 text-sm font-bold uppercase tracking-widest text-primary">
                The Human Touch
              </h2>
              <h3 class="text-4xl font-black tracking-tight md:text-5xl">
                One brain,
                <br />
                infinite applications.
              </h3>
              <p class="mt-6 text-tertiary">
                Our White Mercedes engine ensures your user's identity is not
                locked inside a single chat window.
              </p>
            </div>

            <div class="grid grid-cols-1 gap-8 md:grid-cols-3">
              {userFlowCards.map((card) => (
                <div
                  key={card.date}
                  class={`glass-panel scroll-reveal tilt-panel rounded-2xl p-8 ${card.borderClass}`}
                  data-tilt
                  style={{
                    transitionDelay: card.delay || undefined,
                  }}
                >
                  <div
                    class={`mb-6 flex h-12 w-12 items-center justify-center rounded-lg ${card.iconWrapClass}`}
                  >
                    <MaterialIcon
                      name={card.icon}
                      class={`${card.iconClass}`.trim()}
                    />
                  </div>

                  <div
                    class={`mb-3 font-mono text-xs uppercase tracking-wider ${
                      card.date === "TelloDB Ingests"
                        ? "text-primary"
                        : "text-tertiary"
                    }`}
                  >
                    {card.date}
                  </div>

                  <p
                    class={`mb-6 text-lg leading-relaxed ${
                      card.facts
                        ? "font-bold"
                        : "font-medium italic text-on-surface/90"
                    }`}
                  >
                    {card.quote}
                  </p>

                  {card.facts ? (
                    <div class="space-y-3">
                      {card.facts.map((fact) => (
                        <div
                          key={fact}
                          class="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-3"
                        >
                          <MaterialIcon
                            name="check_circle"
                            class=" text-sm text-green-400"
                          />
                          <span class="font-mono text-xs">{fact}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <>
                      <div class="mb-6 h-[1px] w-full bg-outline-variant/20" />
                      <p class="font-mono text-sm text-tertiary">
                        {card.summary.includes("recalls:") ? (
                          <>
                            Claude 3.5 recalls:{" "}
                            <span class="text-indigo-400">
                              "For your white Mercedes, I recommend..."
                            </span>
                          </>
                        ) : (
                          <>
                            GPT-4o detects:{" "}
                            <span class="text-primary">
                              User Ownership → Vehicle: Mercedes (White)
                            </span>
                          </>
                        )}
                      </p>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section
          id="capabilities"
          class="px-6 py-24 md:py-32 border-b border-white/5 bg-white/[0.01]"
        >
          <div class="container mx-auto">
            <div class="scroll-reveal mb-16 text-center lg:text-left lg:max-w-2xl">
              <h2 class="mb-4 text-sm font-bold uppercase tracking-widest text-primary font-mono">
                Core Capabilities
              </h2>
              <h3 class="mb-6 text-4xl font-extrabold md:text-5xl font-headline leading-tight">
                Engineered for{" "}
                <span class="text-gradient-accent italic">AI Scale.</span>
              </h3>
              <p class="text-base text-tertiary leading-relaxed">
                TelloDB replaces complex, slow orchestration chains with a
                unified, high-performance cognitive database engine.
              </p>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-3 gap-12 items-start">
              {/* Left & Middle: 6 Capabilities Grid */}
              <div class="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                {coreCapabilities.map((item) => (
                  <div
                    key={item.title}
                    class="glass-panel scroll-reveal p-6 rounded-2xl border border-white/5 hover:border-primary/20 transition-all duration-300"
                    style={{
                      transitionDelay: item.delay || undefined,
                    }}
                  >
                    <div class="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/5 border border-primary/20">
                      <MaterialIcon
                        name={item.icon}
                        class="text-xl text-primary"
                      />
                    </div>
                    <h4 class="mb-2 text-base font-bold font-headline text-on-surface">
                      {item.title}
                    </h4>
                    <p class="text-xs md:text-sm text-tertiary leading-relaxed">
                      {item.body}
                    </p>
                  </div>
                ))}
              </div>

              {/* Right: Technical Stats Card & Build Profile */}
              <div class="space-y-6">
                {/* Latency Visual Card */}
                <div class="glass-panel rounded-2xl border border-white/5 p-6 relative overflow-hidden bg-gradient-to-br from-indigo-950/20 to-transparent">
                  <div class="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
                  <p class="font-mono text-[9px] uppercase tracking-wider text-primary mb-2">
                    Recall Engine Latency
                  </p>
                  <div class="my-6 text-center">
                    <div class="text-5xl font-extrabold tracking-tighter text-white font-headline text-glow">
                      &lt;100ms
                    </div>
                    <div class="font-mono text-[10px] uppercase tracking-[0.2em] text-primary mt-1">
                      Average p99 Recall
                    </div>
                  </div>
                  <p class="text-xs text-tertiary leading-relaxed text-center">
                    Built natively in Rust. Delivers sub-100ms queries under
                    heavy semantic and full-text loads.
                  </p>
                </div>

                {/* Build Profile Card */}
                <div class="glass-panel rounded-2xl border border-white/5 p-6">
                  <p class="font-mono text-[9px] uppercase tracking-wider text-primary mb-4">
                    Runtime Configuration
                  </p>
                  <pre class="overflow-x-auto rounded-xl border border-white/5 bg-black/45 p-4 font-mono text-[11px] leading-relaxed text-secondary custom-scrollbar">
                    {runtimeSnapshot}
                  </pre>

                  <div class="mt-4 flex flex-wrap gap-1.5">
                    <span class="rounded-full border border-primary/25 bg-primary/5 px-2.5 py-0.5 text-[9px] font-mono uppercase tracking-wider text-primary">
                      Production
                    </span>
                    <span class="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[9px] font-mono uppercase tracking-wider text-tertiary">
                      Local-First
                    </span>
                    <span class="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[9px] font-mono uppercase tracking-wider text-tertiary">
                      Model-Agnostic
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          id="architecture"
          class="bg-surface-container-high/10 px-6 py-32 border-t border-outline-variant/10"
        >
          <div class="container mx-auto">
            <div class="scroll-reveal mb-20 text-center">
              <h2 class="mb-4 text-sm font-bold uppercase tracking-widest text-primary">
                The Architecture of Truth
              </h2>
              <h3 class="text-4xl font-black tracking-tight md:text-5xl">
                Sentient Memory{" "}
                <span class="italic text-primary">Pipeline.</span>
              </h3>
              <p class="mt-6 mx-auto max-w-2xl text-tertiary">
                TelloDB is not just storage; it is a multi-stage cognitive
                processor that transforms raw noise into reliable agentic state.
              </p>
            </div>

            <div class="relative glass-panel rounded-[2.5rem] border border-primary/25 p-8 md:p-16 overflow-hidden">
              <div class="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(192, 193, 255, 0.05),transparent_70%)]" />

              <div class="relative z-10 grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
                <div class="flex flex-col items-center text-center gap-4">
                  <div class="h-16 w-16 rounded-2xl bg-surface-container-highest flex items-center justify-center border border-outline-variant/20 shadow-xl">
                    <MaterialIcon
                      name="input"
                      class=" text-3xl text-tertiary"
                    />
                  </div>
                  <div>
                    <span class="block text-sm font-black">Ingest</span>
                    <span class="block text-[10px] uppercase tracking-widest text-tertiary font-bold mt-1">
                      Raw Events
                    </span>
                  </div>
                </div>

                <div class="hidden md:flex justify-center">
                  <svg
                    width="40"
                    height="20"
                    viewBox="0 0 40 20"
                    fill="none"
                    class="text-primary/40"
                  >
                    <path
                      d="M0 10H38M38 10L30 2M38 10L30 18"
                      stroke="currentColor"
                      stroke-width="2"
                      class="animate-line"
                    />
                  </svg>
                </div>

                <div class="flex flex-col items-center text-center gap-4 p-6 rounded-3xl bg-primary/10 border border-primary/35 shadow-[0_0_40px_rgba(192,193,255,0.15)]">
                  <div class="h-16 w-16 rounded-2xl obsidian-gradient flex items-center justify-center shadow-xl">
                    <MaterialIcon
                      name="psychology"
                      class=" text-3xl text-white"
                    />
                  </div>
                  <div>
                    <span class="block text-sm font-black">
                      Distill & Store
                    </span>
                    <span class="block text-[10px] uppercase tracking-widest text-primary font-black mt-1">
                      Cognitive Controller
                    </span>
                  </div>
                  <div class="mt-2 flex flex-wrap justify-center gap-1">
                    <span class="text-[8px] px-1.5 py-0.5 rounded-full bg-primary/25 text-white font-bold border border-primary/30">
                      HNSW
                    </span>
                    <span class="text-[8px] px-1.5 py-0.5 rounded-full bg-primary/25 text-white font-bold border border-primary/30">
                      BM25
                    </span>
                    <span class="text-[8px] px-1.5 py-0.5 rounded-full bg-primary/25 text-white font-bold border border-primary/30">
                      GRAPH
                    </span>
                  </div>
                </div>

                <div class="hidden md:flex justify-center">
                  <svg
                    width="40"
                    height="20"
                    viewBox="0 0 40 20"
                    fill="none"
                    class="text-primary/40"
                  >
                    <path
                      d="M0 10H38M38 10L30 2M38 10L30 18"
                      stroke="currentColor"
                      stroke-width="2"
                      class="animate-line"
                    />
                  </svg>
                </div>

                <div class="flex flex-col items-center text-center gap-4">
                  <div class="h-16 w-16 rounded-2xl bg-surface-container-highest flex items-center justify-center border border-outline-variant/20 shadow-xl">
                    <MaterialIcon
                      name="verified"
                      class=" text-3xl text-primary"
                    />
                  </div>
                  <div>
                    <span class="block text-sm font-black">Final Truth</span>
                    <span class="block text-[10px] uppercase tracking-widest text-tertiary font-bold mt-1">
                      Grounded Context
                    </span>
                  </div>
                </div>
              </div>

              <div class="mt-16 pt-16 border-t border-outline-variant/10 grid grid-cols-1 md:grid-cols-3 gap-8">
                <div class="flex gap-4">
                  <MaterialIcon name="filter_list" class=" text-primary" />
                  <div>
                    <h4 class="font-bold text-sm text-white">
                      Intent-Aware Filtering
                    </h4>
                    <p class="text-xs text-tertiary mt-2">
                      Automatically detects if the user is asking for numbers,
                      preferences, or narrative history.
                    </p>
                  </div>
                </div>
                <div class="flex gap-4">
                  <MaterialIcon name="rebase_edit" class=" text-primary" />
                  <div>
                    <h4 class="font-bold text-sm text-white">
                      Neural Reranking
                    </h4>
                    <p class="text-xs text-tertiary mt-2">
                      Applies a secondary precision pass to ensure the top-k
                      candidates are semantically perfect.
                    </p>
                  </div>
                </div>
                <div class="flex gap-4">
                  <MaterialIcon name="calculate" class=" text-primary" />
                  <div>
                    <h4 class="font-bold text-sm text-white">
                      Deterministic Compute
                    </h4>
                    <p class="text-xs text-tertiary mt-2">
                      Computes aggregates (sums, counts) before delivery,
                      preventing LLM arithmetic errors.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="lattice" class="px-6 py-32 bg-transparent">
          <div class="container mx-auto">
            <div class="scroll-reveal mb-20">
              <h2 class="mb-4 text-sm font-bold uppercase tracking-widest text-primary font-mono">
                Interactive Graph
              </h2>
              <h3 class="text-4xl font-black tracking-tight md:text-5xl">
                Sentient{" "}
                <span class="text-gradient-accent italic">Memory Lattice.</span>
              </h3>
              <p class="mt-6 max-w-2xl text-tertiary">
                Experience how TelloDB organizes memories. Drag nodes to
                interact with the underlying graph logic where new facts
                supersede the old.
              </p>
            </div>

            <div class="glass-panel relative rounded-[3rem] border border-primary/25 bg-surface-container-low/10 overflow-hidden">
              <div class="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(192, 193, 255, 0.08),transparent_50%)]" />
              <MemoryLattice />
            </div>

            <div class="mt-12 grid grid-cols-1 md:grid-cols-2 gap-8 text-sm text-tertiary">
              <div class="flex gap-4 p-6 rounded-2xl border border-white/5 bg-white/[0.02]">
                <MaterialIcon name="hub" class="text-primary" />
                <p>
                  Nodes represent discrete semantic facts, preferences, and
                  entities stored within the Rust engine.
                </p>
              </div>
              <div class="flex gap-4 p-6 rounded-2xl border border-white/5 bg-white/[0.02]">
                <MaterialIcon name="history" class="text-error" />
                <p>
                  Red nodes indicate **superseded memories**—stale data that has
                  been automatically invalidated by more recent truths.
                </p>
              </div>
            </div>
          </div>
        </section>
        <section class="px-6 py-24 md:py-32 border-b border-white/5 bg-white/[0.01]">
          <div class="container mx-auto">
            <div class="scroll-reveal mb-14 max-w-3xl text-center lg:text-left">
              <h2 class="mb-4 text-sm font-bold uppercase tracking-widest text-primary font-mono">
                Delivery Path
              </h2>
              <h3 class="text-4xl font-extrabold tracking-tight md:text-5xl font-headline">
                From prototype to
                <br />
                <span class="text-gradient-accent italic">
                  production memory.
                </span>
              </h3>
              <p class="mt-6 text-base text-tertiary leading-relaxed">
                The product has a clear progression: ingest fidelity, retrieval
                intelligence, and operational reliability.
              </p>
            </div>

            <div class="grid grid-cols-1 gap-8 lg:grid-cols-3">
              {deliveryTrack.map((step, index) => (
                <article
                  key={step.phase}
                  class="glass-panel scroll-reveal tilt-panel rounded-2xl border border-white/5 p-8"
                  data-tilt
                  style={{ transitionDelay: `${index * 120}ms` }}
                >
                  <div class="mb-5 flex items-center justify-between">
                    <span class="font-mono text-[9px] uppercase tracking-widest text-primary font-bold">
                      {step.phase}
                    </span>
                    <MaterialIcon
                      name={step.icon}
                      class="text-2xl text-primary"
                    />
                  </div>
                  <h4 class="mb-3 text-xl font-bold font-headline text-on-surface">
                    {step.title}
                  </h4>
                  <p class="mb-5 text-xs md:text-sm leading-relaxed text-tertiary">
                    {step.body}
                  </p>
                  <ul class="space-y-2">
                    {step.checkpoints.map((checkpoint) => (
                      <li
                        key={checkpoint}
                        class="flex items-center gap-2 text-xs text-on-surface/90"
                      >
                        <MaterialIcon
                          name="arrow_right_alt"
                          class="text-sm text-primary"
                        />
                        <span class="font-mono text-[11px]">{checkpoint}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="calendly" class="px-6 py-16 md:py-24">
          <div class="container mx-auto">
            <div class="glass-panel scroll-reveal rounded-2xl p-8 md:p-12">
              <p class="font-mono text-[9px] uppercase tracking-widest text-primary font-bold">
                Book A Session
              </p>
              <h3 class="mt-4 text-3xl md:text-4xl font-extrabold tracking-tight font-headline">
                Schedule a 30-minute{" "}
                <span class="text-gradient-accent italic">walkthrough.</span>
              </h3>
              <p class="mt-3 max-w-2xl text-xs md:text-sm text-tertiary leading-relaxed">
                Discuss database architecture, memory integration, and private
                deployment setups for your agentic applications.
              </p>
              <div class="mt-8 flex flex-col gap-4 sm:flex-row">
                <a
                  href={CALENDLY_30_MIN_URL}
                  target="_blank"
                  rel="noreferrer"
                  class="obsidian-gradient inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-xs md:text-sm font-bold text-white shadow-lg shadow-primary/10 transition-all hover:shadow-[0_0_20px_rgba(192, 193, 255, 0.25)] active:scale-[0.98]"
                >
                  Open Calendly
                  <MaterialIcon name="open_in_new" class="text-xs" />
                </a>
                <a
                  href={CONTACT_MAILTO}
                  class="glass-panel inline-flex items-center justify-center rounded-xl px-6 py-3 text-xs md:text-sm font-bold text-on-surface hover:bg-white/5 transition-all"
                >
                  Email Instead
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA Banner */}
        <section class="px-6 py-16 md:py-24">
          <div class="container mx-auto max-w-4xl">
            <div class="glass-panel rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/5 via-transparent to-primary/5 p-10 text-center md:p-16 shadow-2xl relative overflow-hidden">
              <div class="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(192, 193, 255, 0.05),transparent_70%)]" />
              <div class="relative z-10">
                <h2 class="mb-4 text-3xl font-extrabold tracking-tight md:text-5xl text-on-surface font-headline leading-tight">
                  Build Agents That
                  <br />
                  <span class="text-gradient-accent">Actually Remember.</span>
                </h2>
                <p class="mx-auto mb-8 max-w-xl text-xs md:text-sm leading-relaxed text-tertiary">
                  One binary, five memory substrates, zero lock-in. Start
                  building persistent, self-improving agents today.
                </p>
                <div class="flex flex-col justify-center gap-4 sm:flex-row">
                  <Link
                    href="/signup"
                    onClick$={() => capture("cta_signup_clicked")}
                    class="px-6 py-3 bg-primary text-black font-bold rounded-xl hover:opacity-90 transition-opacity shadow-lg shadow-primary/15 text-sm animate-pulse-slow"
                  >
                    Get Started Free
                  </Link>
                  <a
                    href={CALENDLY_30_MIN_URL}
                    target="_blank"
                    rel="noreferrer"
                    onClick$={() => capture("cta_demo_clicked")}
                    class="px-6 py-3 border border-white/10 text-on-surface font-bold rounded-xl hover:bg-white/5 transition-colors text-sm"
                  >
                    Book a Demo
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Core vs Platform */}
        <section
          id="core-vs-platform"
          class="px-6 py-16 md:py-24 border-t border-white/5"
        >
          <div class="container mx-auto max-w-5xl">
            <div class="text-center mb-16">
              <h2 class="mb-3 text-[9px] font-mono font-bold uppercase tracking-widest text-primary">
                Two Ways to Remember
              </h2>
              <h3 class="text-3xl md:text-4xl font-extrabold tracking-tight font-headline">
                Engine <span class="text-gradient-accent">and</span> Platform
              </h3>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Core (OSS) Card */}
              <div class="glass-panel rounded-2xl p-8 transition-all duration-300 hover:border-primary/25">
                <div class="mb-5 flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 border border-white/10">
                  <CpuIcon class="text-lg text-tertiary" />
                </div>
                <h4 class="mb-2 text-2xl font-bold text-on-surface font-headline">
                  <span class="text-primary">TelloDB</span> Core
                </h4>
                <p class="mb-1 text-[9px] font-mono font-bold uppercase tracking-widest text-tertiary/60">
                  Open Source Engine
                </p>
                <p class="mb-6 text-xs md:text-sm leading-relaxed text-tertiary">
                  The Rust-powered temporal memory engine that runs anywhere.
                  Hybrid vector + BM25 search, knowledge graph traversal,
                  deterministic analytics, and fact supersession — all in a
                  single binary. No vendor lock-in.
                </p>
                <ul class="mb-8 space-y-2.5 text-xs text-tertiary">
                  {[
                    "Single binary — download and run locally",
                    "4 HNSW indexes + BM25F + redb KV + typed graph",
                    "Candle / ONNX embeddings, CPU or GPU targets",
                    "Embed directly in your custom agent architecture",
                  ].map((bullet) => (
                    <li key={bullet} class="flex items-start gap-2">
                      <span class="text-primary font-bold">▸</span>
                      <span class="text-on-surface/90">{bullet}</span>
                    </li>
                  ))}
                </ul>
                <div class="flex gap-3">
                  <Link
                    href="/docs/core"
                    class="rounded-xl bg-primary/10 px-5 py-2.5 text-xs font-bold text-primary transition-colors hover:bg-primary/20"
                  >
                    Read the Docs
                  </Link>
                  <a
                    href={CALENDLY_30_MIN_URL}
                    target="_blank"
                    rel="noreferrer"
                    class="glass-panel border border-white/5 rounded-xl px-5 py-2.5 text-xs font-bold text-tertiary transition-colors hover:text-on-surface"
                  >
                    Contact Us
                  </a>
                </div>
              </div>

              {/* Platform (SaaS) Card */}
              <div class="glass-panel rounded-2xl border border-primary/25 bg-primary/[0.01] p-8 transition-all duration-300 hover:border-primary/45 shadow-[0_0_40px_rgba(192,193,255,0.08)]">
                <div class="mb-5 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
                  <GlobeIcon class="text-lg text-primary" />
                </div>
                <h4 class="mb-2 text-2xl font-bold text-white font-headline">
                  <span class="text-primary">TelloDB</span> Platform
                </h4>
                <p class="mb-1 text-[9px] font-mono font-bold uppercase tracking-widest text-primary">
                  Managed Cloud Service
                </p>
                <p class="mb-6 text-xs md:text-sm leading-relaxed text-tertiary">
                  A full SaaS experience on top of the core engine. Deploy
                  clusters in one click, manage your team, track usage with
                  analytics, explore knowledge graphs visually, and never worry
                  about infrastructure.
                </p>
                <ul class="mb-8 space-y-2.5 text-xs text-tertiary">
                  {[
                    "One-click cluster provisioning — no config files",
                    "Stripe integration — pay-as-you-go or flat-rates",
                    "Team management with invites and RBAC roles",
                    "Graph explorer, telemetry, and visual playground",
                  ].map((bullet) => (
                    <li key={bullet} class="flex items-start gap-2">
                      <span class="text-primary font-bold">▸</span>
                      <span class="text-white">{bullet}</span>
                    </li>
                  ))}
                </ul>
                <div class="flex gap-3">
                  <Link
                    href="/signup"
                    onClick$={() => capture("cta_signup_clicked")}
                    class="rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-black transition-colors hover:opacity-90 shadow-md animate-pulse-slow"
                  >
                    Get Started Free
                  </Link>
                  <Link
                    href="/docs/platform"
                    class="glass-panel border border-white/5 rounded-xl px-5 py-2.5 text-xs font-bold text-tertiary transition-colors hover:text-on-surface"
                  >
                    Explore Platform Documentation
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Ecosystem */}
        <section
          id="ecosystem"
          class="px-6 py-16 md:py-24 bg-white/[0.005] border-t border-white/5"
        >
          <div class="container mx-auto">
            <div class="scroll-reveal mb-16 text-center">
              <h2 class="mb-4 text-sm font-bold uppercase tracking-widest text-primary font-mono">
                The TelloDB Ecosystem
              </h2>
              <h3 class="text-3xl md:text-4xl font-extrabold tracking-tight md:text-5xl font-headline">
                Integrate Memory{" "}
                <span class="text-gradient-accent italic">Anywhere.</span>
              </h3>
              <p class="mt-6 mx-auto max-w-2xl text-xs md:text-sm text-tertiary leading-relaxed">
                We provide the tooling to make persistent memory a first-class
                citizen in your development workflow, from local testing to
                global scale.
              </p>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
              {ecosystemItems.map((item) => (
                <Link
                  key={item.title}
                  href={item.link}
                  class="glass-panel rounded-2xl p-8 transition-all hover:border-primary/35"
                >
                  <div class="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/5 border border-primary/20">
                    <MaterialIcon
                      name={item.icon}
                      class="text-xl text-primary"
                    />
                  </div>
                  <h4 class="mb-3 text-lg font-bold font-headline text-on-surface">
                    {item.title}
                  </h4>
                  <p class="mb-6 text-xs md:text-sm leading-relaxed text-tertiary">
                    {item.body}
                  </p>
                  <div class="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-primary">
                    Explore Docs
                    <MaterialIcon name="arrow_forward" class="text-xs" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer class="border-t border-white/5 bg-black px-8 py-16 md:py-24">
        <div class="container mx-auto grid grid-cols-1 gap-12 md:grid-cols-5">
          <div class="col-span-1 md:col-span-2">
            <span class="mb-4 block text-xl font-extrabold uppercase tracking-tighter text-on-surface font-headline">
              TelloDB
            </span>
            <p class="mb-6 max-w-sm text-xs md:text-sm leading-relaxed text-tertiary">
              The persistent memory layer for advanced AI agents. Built for
              humans, powered by Rust, dedicated to the truth.
            </p>
            <p class="mb-6 text-xs md:text-sm text-tertiary">
              Contact:{" "}
              <a href={CONTACT_MAILTO} class="text-primary hover:underline">
                {CONTACT_EMAIL}
              </a>
            </p>
            <div class="flex gap-3">
              <Link
                href="/docs"
                aria-label="Documentation"
                class="glass-panel border border-white/5 flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-white/5"
              >
                <MaterialIcon name="hub" class="text-sm text-tertiary" />
              </Link>
              <Link
                href="/blog"
                aria-label="Blog"
                class="glass-panel border border-white/5 flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-white/5"
              >
                <MaterialIcon
                  name="edit_square"
                  class="text-sm text-tertiary"
                />
              </Link>
            </div>
          </div>

          <div>
            <h4 class="mb-4 text-xs font-mono font-bold uppercase tracking-wider text-primary">
              Platform
            </h4>
            <ul class="space-y-3 text-xs md:text-sm text-tertiary">
              {platformLinks.map((item) => (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    class="transition-colors hover:text-on-surface"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 class="mb-4 text-xs font-mono font-bold uppercase tracking-wider text-primary">
              Company
            </h4>
            <ul class="space-y-3 text-xs md:text-sm text-tertiary">
              {companyLinks.map((item) => (
                <li key={item.label}>
                  {item.href.startsWith("http") ||
                  item.href.startsWith("mailto:") ? (
                    <a
                      href={item.href}
                      target={
                        item.href.startsWith("http") ? "_blank" : undefined
                      }
                      rel={
                        item.href.startsWith("http") ? "noreferrer" : undefined
                      }
                      class="transition-colors hover:text-on-surface"
                    >
                      {item.label}
                    </a>
                  ) : (
                    <Link
                      href={item.href}
                      class="transition-colors hover:text-on-surface"
                    >
                      {item.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 class="mb-4 text-xs font-mono font-bold uppercase tracking-wider text-primary">
              Social
            </h4>
            <ul class="space-y-3 text-xs md:text-sm text-tertiary">
              <li>
                <a
                  href={LINKEDIN_COMPANY_URL}
                  target="_blank"
                  rel="noreferrer"
                  class="inline-flex items-center gap-2.5 transition-colors hover:text-on-surface"
                >
                  <span class="flex h-8 w-8 items-center justify-center rounded-lg border border-white/5 bg-white/[0.02] text-primary">
                    <LinkedinIcon class="h-3.5 w-3.5" />
                  </span>
                  <span>LinkedIn</span>
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div class="container mx-auto mt-16 border-t border-white/5 pt-8 text-center font-mono text-[9px] uppercase tracking-widest text-tertiary/75">
          © 2026 TelloDB Systems. All human memories preserved. Truth disclosed.
        </div>
      </footer>
    </div>
  );
});

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://tellodb.com/#organization",
      name: "TelloDB",
      url: "https://tellodb.com",
      logo: "https://tellodb.com/icon-192.png",
      description:
        "The persistent memory layer for AI agents. Hybrid vector + BM25 search, knowledge graphs, deterministic analytics, and fact supersession in a single Rust binary.",
      sameAs: [
        "https://github.com/tellodb/tellodb",
        "https://linkedin.com/company/tellodb",
      ],
    },
    {
      "@type": "WebSite",
      "@id": "https://tellodb.com/#website",
      url: "https://tellodb.com",
      name: "TelloDB",
      publisher: { "@id": "https://tellodb.com/#organization" },
    },
    {
      "@type": "SoftwareApplication",
      "@id": "https://tellodb.com/#software",
      name: "TelloDB Memory Engine",
      applicationCategory: "DeveloperApplication",
      operatingSystem: "Linux, macOS, Windows",
      description:
        "Temporal memory database for AI agents with hybrid retrieval, fact supersession, and deterministic analytics.",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
    },
  ],
};

export const head: DocumentHead = buildSeoHead({
  title: "TelloDB | Agents That Remember",
  description:
    "TelloDB is the persistent memory layer for AI agents that need temporal awareness, truth extraction, and continuity across models.",
  pathname: "/",
  keywords: [
    "agent memory",
    "temporal memory",
    "AI memory layer",
    "persistent memory for agents",
    "vector database alternative",
    "memory for AI agents",
    "AI agent memory management",
  ],
  structuredData,
  styles: [
    {
      key: "landing-template-styles",
      style: landingStyles,
    },
  ],
});
