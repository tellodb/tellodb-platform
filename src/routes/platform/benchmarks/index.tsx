import { component$ } from "@builder.io/qwik";
import { Link, type DocumentHead } from "@builder.io/qwik-city";
import { buildSeoHead } from "~/lib/seo";
import { setPublicEdgeCache } from "~/lib/cache";
import type { RequestHandler } from "@builder.io/qwik-city";
import {
  BarChart3Icon,
  TrophyIcon,
  ClockIcon,
  ZapIcon,
  ExternalLinkIcon,
} from "lucide-qwik";

export const onRequest: RequestHandler = (event) => {
  setPublicEdgeCache(event);
};

const labels = [
  "Overall",
  "Single Session",
  "Temporal",
  "Preferences",
  "Knowledge Updates",
  "Multi-Session",
];
const datasets = [
  {
    name: "TelloDB",
    color: "bg-primary",
    values: [90.5, 98.0, 88.3, 95.2, 96.1, 74.8],
  },
  {
    name: "HydraDB",
    color: "bg-orange-500",
    values: [90.8, 100, 91.0, 96.7, 97.4, 76.7],
  },
  {
    name: "Zep",
    color: "bg-blue-500",
    values: [71.2, 92.9, 62.4, 56.7, 83.3, 57.9],
  },
  {
    name: "Mem0",
    color: "bg-purple-500",
    values: [29.1, 38.7, 25.6, 40.0, 52.6, 20.3],
  },
];

export default component$(() => {
  return (
    <div class="flex min-h-screen bg-background text-on-surface font-body antialiased relative overflow-hidden">
      {/* Background glow effects */}
      <div class="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[600px] bg-[radial-gradient(circle_at_top,rgba(192,193,255,0.08),transparent_65%)] pointer-events-none z-0"></div>
      <div class="absolute top-[20%] left-[10%] w-[400px] h-[400px] bg-[radial-gradient(circle,rgba(93,230,255,0.03),transparent_70%)] pointer-events-none z-0"></div>

      <main class="flex-1 overflow-y-auto p-6 lg:p-12 mb-20 max-w-6xl mx-auto w-full pt-[104px] relative z-10">
        <header class="mb-14 text-center">
          <div class="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 mb-6 backdrop-blur-sm">
            <TrophyIcon class="w-4 h-4 text-primary animate-pulse" />
            <span class="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-primary">LongMemEval-S Benchmark</span>
          </div>
          <h1 class="font-headline text-5xl lg:text-6xl font-black tracking-tight text-white mb-4">
            Public Benchmarks
          </h1>
          <p class="text-muted text-base lg:text-lg max-w-2xl mx-auto leading-relaxed">
             Transparent, reproducible evaluation of TelloDB against industry leaders on standard agent memory benchmarks.
          </p>
        </header>

        {/* Highlight Stats Grid */}
        <div class="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {/* Card 1 */}
          <div class="group rounded-2xl backdrop-blur-md bg-surface-container-low/40 border border-outline-variant/15 p-6 text-center transition-all duration-300 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-[2px]">
            <div class="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4 border border-primary/10 transition-colors group-hover:bg-primary/20">
              <ZapIcon class="w-6 h-6 text-primary" />
            </div>
            <p class="text-4xl font-headline font-black text-white">90.5%</p>
            <p class="text-xs text-muted font-medium mt-1">Overall Accuracy</p>
          </div>

          {/* Card 2 */}
          <div class="group rounded-2xl backdrop-blur-md bg-surface-container-low/40 border border-outline-variant/15 p-6 text-center transition-all duration-300 hover:border-secondary/30 hover:shadow-lg hover:shadow-secondary/5 hover:-translate-y-[2px]">
            <div class="w-12 h-12 rounded-xl bg-secondary/10 flex items-center justify-center mx-auto mb-4 border border-secondary/10 transition-colors group-hover:bg-secondary/20">
              <ClockIcon class="w-6 h-6 text-secondary" />
            </div>
            <p class="text-4xl font-headline font-black text-white">&lt;100ms</p>
            <p class="text-xs text-muted font-medium mt-1">P95 Retrieval Latency</p>
          </div>

          {/* Card 3 */}
          <div class="group rounded-2xl backdrop-blur-md bg-surface-container-low/40 border border-outline-variant/15 p-6 text-center transition-all duration-300 hover:border-amber-500/30 hover:shadow-lg hover:shadow-amber-500/5 hover:-translate-y-[2px]">
            <div class="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center mx-auto mb-4 border border-amber-500/10 transition-colors group-hover:bg-amber-500/20">
              <BarChart3Icon class="w-6 h-6 text-amber-400" />
            </div>
            <p class="text-4xl font-headline font-black text-white">+61pt</p>
            <p class="text-xs text-muted font-medium mt-1">vs Mem0 Overall</p>
          </div>

          {/* Card 4 */}
          <div class="group rounded-2xl backdrop-blur-md bg-surface-container-low/40 border border-outline-variant/15 p-6 text-center transition-all duration-300 hover:border-amber-400/30 hover:shadow-lg hover:shadow-amber-400/5 hover:-translate-y-[2px]">
            <div class="w-12 h-12 rounded-xl bg-amber-400/10 flex items-center justify-center mx-auto mb-4 border border-amber-400/10 transition-colors group-hover:bg-amber-400/20">
              <TrophyIcon class="w-6 h-6 text-amber-400" />
            </div>
            <p class="text-4xl font-headline font-black text-white">#2</p>
            <p class="text-xs text-muted font-medium mt-1">Overall Ranking</p>
          </div>
        </div>

        {/* Detailed Table */}
        <div class="rounded-2xl backdrop-blur-md bg-surface-container-low/40 border border-outline-variant/15 p-6 mb-8 overflow-hidden shadow-xl">
          <div class="flex items-center gap-3 mb-6">
            <div class="w-1.5 h-6 rounded-full bg-primary"></div>
            <h3 class="text-xl font-headline font-bold text-white">LongMemEval-S Results (%)</h3>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b border-outline-variant/15">
                  <th class="py-4 text-left font-bold text-muted text-xs uppercase tracking-widest">Model</th>
                  {labels.map((l) => (
                    <th key={l} class="py-4 px-3 text-right font-bold text-muted text-xs uppercase tracking-wider">{l}</th>
                  ))}
                </tr>
              </thead>
              <tbody class="divide-y divide-outline-variant/5">
                {datasets.map((ds) => {
                  const isTellodb = ds.name === "TelloDB";
                  return (
                    <tr 
                      key={ds.name} 
                      class={`transition-colors duration-200 ${
                        isTellodb 
                          ? "bg-primary/5 hover:bg-primary/8 font-bold" 
                          : "hover:bg-surface-container-highest/20"
                      }`}
                    >
                      <td class="py-4 font-headline text-sm font-bold text-white">
                        {isTellodb ? <span class="text-primary flex items-center gap-1.5">★ {ds.name}</span> : ds.name}
                      </td>
                      {ds.values.map((v, i) => (
                        <td key={i} class="py-4 px-3 text-right font-mono text-sm">
                          <span class={isTellodb ? "text-primary font-bold drop-shadow-[0_0_8px_rgba(192,193,255,0.4)]" : "text-muted"}>
                            {v.toFixed(1)}%
                          </span>
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Visual Charts Section */}
        <div class="rounded-2xl backdrop-blur-md bg-surface-container-low/40 border border-outline-variant/15 p-6 mb-8 shadow-xl">
          <div class="flex items-center gap-3 mb-6">
            <div class="w-1.5 h-6 rounded-full bg-secondary"></div>
            <h3 class="text-xl font-headline font-bold text-white">Overall Score Comparison</h3>
          </div>
          <div class="space-y-6">
            {datasets.map((ds) => {
              const isTellodb = ds.name === "TelloDB";
              // Custom gradient color mapping for progress bars
              const gradientClass = ds.name === "TelloDB" 
                ? "bg-gradient-to-r from-[#8083ff] to-[#9b9cff] shadow-[0_0_12px_rgba(155,156,255,0.3)]"
                : ds.name === "HydraDB"
                ? "bg-gradient-to-r from-orange-600 to-amber-400"
                : ds.name === "Zep"
                ? "bg-gradient-to-r from-blue-600 to-cyan-400"
                : "bg-gradient-to-r from-purple-600 to-pink-400";

              return (
                <div key={ds.name} class="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
                  <span class={`w-28 text-sm font-headline font-bold ${isTellodb ? "text-primary" : "text-white"}`}>
                    {ds.name}
                  </span>
                  <div class="flex-1 h-9 rounded-xl bg-black/40 border border-outline-variant/10 p-0.5 overflow-hidden flex items-center">
                    <div 
                      class={`h-full rounded-lg transition-all duration-1000 flex items-center px-4 text-xs font-headline font-black text-black ${gradientClass}`} 
                      style={{ width: `${ds.values[0]}%` }}
                    >
                      <span class={isTellodb ? "text-white drop-shadow-md" : "text-white drop-shadow-sm"}>
                        {ds.values[0].toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Methodology Grid */}
        <div class="rounded-2xl backdrop-blur-md bg-surface-container-low/40 border border-outline-variant/15 p-6 shadow-xl">
          <div class="flex items-center gap-3 mb-6">
            <div class="w-1.5 h-6 rounded-full bg-amber-400"></div>
            <h3 class="text-xl font-headline font-bold text-white">Methodology</h3>
          </div>
          <div class="grid md:grid-cols-2 gap-6">
            {/* Box 1 */}
            <div class="flex gap-4 p-4 rounded-xl bg-surface-container-low/30 border border-outline-variant/10">
              <div class="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                <svg class="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <div>
                <h4 class="text-sm font-headline font-bold text-white mb-1">Dataset Specification</h4>
                <p class="text-xs text-muted leading-relaxed">
                  LongMemEval-S benchmark containing 6 categories evaluating single/multi-session recall, temporal updates, and profile matching.
                </p>
              </div>
            </div>

            {/* Box 2 */}
            <div class="flex gap-4 p-4 rounded-xl bg-surface-container-low/30 border border-outline-variant/10">
              <div class="w-10 h-10 rounded-lg bg-secondary/10 border border-secondary/20 flex items-center justify-center flex-shrink-0">
                <svg class="w-5 h-5 text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                </svg>
              </div>
              <div>
                <h4 class="text-sm font-headline font-bold text-white mb-1">Standard Infrastructure</h4>
                <p class="text-xs text-muted leading-relaxed">
                  All benchmarks execute on matching single-node cloud environments (4 vCPU, 16 GB RAM) to enforce latency isolation.
                </p>
              </div>
            </div>

            {/* Box 3 */}
            <div class="flex gap-4 p-4 rounded-xl bg-surface-container-low/30 border border-outline-variant/10">
              <div class="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
                <svg class="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
              </div>
              <div>
                <h4 class="text-sm font-headline font-bold text-white mb-1">Open Source & Auditable</h4>
                <p class="text-xs text-muted leading-relaxed">
                  Evaluation code is open and reproducible. Access the harness at 
                  <a href="https://github.com/sharjeel619/tellodb" target="_blank" rel="noreferrer" class="text-primary hover:underline ml-1">
                    github.com/sharjeel619/tellodb <ExternalLinkIcon class="w-3 h-3 inline mb-0.5" />
                  </a>
                </p>
              </div>
            </div>

            {/* Box 4 */}
            <div class="flex gap-4 p-4 rounded-xl bg-surface-container-low/30 border border-outline-variant/10">
              <div class="w-10 h-10 rounded-lg bg-amber-400/10 border border-amber-400/20 flex items-center justify-center flex-shrink-0">
                <svg class="w-5 h-5 text-amber-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
              </div>
              <div>
                <h4 class="text-sm font-headline font-bold text-white mb-1">Baseline Sources</h4>
                <p class="text-xs text-muted leading-relaxed font-medium">
                  Competitor score baselines are extracted directly from public published results and verified in our own local test rig. Last updated May 2026. Run locally with: <code class="text-primary font-bold">cargo run --release --bench longmemeval</code>.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
});

export const head: DocumentHead = buildSeoHead({
  title: "Benchmarks | TelloDB",
  description:
    "TelloDB benchmark results against Mem0, Zep, and HydraDB on LongMemEval-S. See how our memory engine performs on temporal reasoning and retrieval.",
  pathname: "/platform/benchmarks",
  keywords: [
    "AI memory benchmarks",
    "memory engine comparison",
    "LongMemEval results",
    "temporal memory evaluation",
    "agent memory performance",
    "Mem0 alternative",
    "Zep alternative",
  ],
});
