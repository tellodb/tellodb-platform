import { component$, useSignal } from "@builder.io/qwik";
import { routeLoader$, Link, type DocumentHead } from "@builder.io/qwik-city";
import { ArrowLeftIcon, BarChart3Icon, DatabaseIcon, ActivityIcon, RefreshCwIcon } from "lucide-qwik";
import { buildSeoHead } from "~/lib/seo";
import { setPrivateNoStore } from "~/lib/cache";
import type { RequestHandler } from "@builder.io/qwik-city";
import { requireAuth } from "~/lib/auth";
import { getAdminSupabaseClient } from "~/lib/supabase";
import { getCoreClusterStats } from "~/lib/tellodb-core";
import { captureError } from "~/lib/sentry";

export const onRequest: RequestHandler = (event) => {
  setPrivateNoStore(event);
};

export const useClusterData = routeLoader$(async (event) => {
  try {
    const user = requireAuth(event);
    const clusterId = event.params.id;
    const supabase = getAdminSupabaseClient(event.env);
    if (!supabase) throw event.error(500, "Database connection offline");

    const { data: cluster } = await supabase.from("clusters").select("*").eq("id", clusterId).single();
    if (!cluster || cluster.user_id !== user.user_id) throw event.error(404, "Not found");

    const { data: usage } = await supabase
      .from("usage_daily")
      .select("*")
      .eq("cluster_id", clusterId)
      .order("date", { ascending: false })
      .limit(30);

    // Fetch real-time total usage from the cluster directly
    const coreStats = await getCoreClusterStats(cluster.id, cluster.endpoint_url, cluster.engine_key);

    const totals = coreStats && typeof coreStats.request_count !== "undefined"
      ? {
          request_count: coreStats.request_count || 0,
          ingest_count: coreStats.ingest_count || 0,
          query_count: coreStats.query_count || 0,
          graph_ops: (coreStats as any).temporal_query_count || 0,
        }
      : (usage || []).reduce(
          (acc: any, d: any) => ({
            request_count: acc.request_count + (d.request_count || 0),
            ingest_count: acc.ingest_count + (d.ingest_count || 0),
            query_count: acc.query_count + (d.query_count || 0),
            graph_ops: acc.graph_ops + (d.graph_ops || 0),
          }),
          { request_count: 0, ingest_count: 0, query_count: 0, graph_ops: 0 }
        );

    return { cluster, usage: (usage || []).reverse(), totals, user };
  } catch (e) {
    captureError(e, { page: "cluster_analytics" });
    throw e;
  }
});

export default component$(() => {
  const data = useClusterData();
  const cluster = data.value.cluster as any;
  const usage = data.value.usage as any[];
  const totals = data.value.totals as any;
  const days = useSignal(14);
  const hoveredIndex = useSignal<number>(-1);

  // Filter usage for selected period
  const selectedUsage = usage.slice(-days.value);

  // Calculate totals for selected period
  const periodTotals = selectedUsage.reduce(
    (acc: any, d: any) => ({
      request_count: acc.request_count + (d.request_count || 0),
      ingest_count: acc.ingest_count + (d.ingest_count || 0),
      query_count: acc.query_count + (d.query_count || 0),
      graph_ops: acc.graph_ops + (d.graph_ops || 0),
    }),
    { request_count: 0, ingest_count: 0, query_count: 0, graph_ops: 0 }
  );

  // SVG Chart Config
  const width = 600;
  const height = 240;
  const padding = { top: 20, right: 20, bottom: 30, left: 45 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  // Max values for auto-scaling
  const maxRequests = Math.max(...selectedUsage.map((d: any) => d.request_count || 0), 1);
  const maxQueries = Math.max(...selectedUsage.map((d: any) => d.query_count || 0), 1);
  const maxIngests = Math.max(...selectedUsage.map((d: any) => d.ingest_count || 0), 1);
  const maxOps = Math.max(maxRequests, maxQueries, maxIngests, 1);

  // Bezier curve calculations or fallback polyline
  let pathReq = "";
  let pathQue = "";
  let pathIng = "";
  let areaReq = "";
  let areaQue = "";
  let areaIng = "";

  if (selectedUsage.length > 0) {
    selectedUsage.forEach((d: any, i: number) => {
      const x = padding.left + (i / Math.max(selectedUsage.length - 1, 1)) * innerWidth;
      const yReq = padding.top + (1 - (d.request_count || 0) / maxOps) * innerHeight;
      const yQue = padding.top + (1 - (d.query_count || 0) / maxOps) * innerHeight;
      const yIng = padding.top + (1 - (d.ingest_count || 0) / maxOps) * innerHeight;

      if (i === 0) {
        pathReq = `M ${x} ${yReq}`;
        pathQue = `M ${x} ${yQue}`;
        pathIng = `M ${x} ${yIng}`;
        areaReq = `M ${x} ${padding.top + innerHeight} L ${x} ${yReq}`;
        areaQue = `M ${x} ${padding.top + innerHeight} L ${x} ${yQue}`;
        areaIng = `M ${x} ${padding.top + innerHeight} L ${x} ${yIng}`;
      } else {
        pathReq += ` L ${x} ${yReq}`;
        pathQue += ` L ${x} ${yQue}`;
        pathIng += ` L ${x} ${yIng}`;
        areaReq += ` L ${x} ${yReq}`;
        areaQue += ` L ${x} ${yQue}`;
        areaIng += ` L ${x} ${yIng}`;
      }
    });

    areaReq += ` L ${padding.left + innerWidth} ${padding.top + innerHeight} Z`;
    areaQue += ` L ${padding.left + innerWidth} ${padding.top + innerHeight} Z`;
    areaIng += ` L ${padding.left + innerWidth} ${padding.top + innerHeight} Z`;
  }

  // Donut Config
  const donutR = 40;
  const donutC = 2 * Math.PI * donutR; // 251.327
  const totalPeriodOps = periodTotals.query_count + periodTotals.ingest_count + periodTotals.graph_ops;

  const qPct = totalPeriodOps > 0 ? periodTotals.query_count / totalPeriodOps : 0;
  const iPct = totalPeriodOps > 0 ? periodTotals.ingest_count / totalPeriodOps : 0;
  const gPct = totalPeriodOps > 0 ? periodTotals.graph_ops / totalPeriodOps : 0;

  const hoveredData = hoveredIndex.value !== -1 ? selectedUsage[hoveredIndex.value] : null;
  const tooltipX = hoveredIndex.value !== -1
    ? padding.left + (hoveredIndex.value / Math.max(selectedUsage.length - 1, 1)) * innerWidth
    : 0;

  return (
    <div class="flex min-h-screen bg-background text-on-surface font-body antialiased">
      <main class="flex-1 overflow-y-auto p-6 md:p-8 lg:p-12 mb-20 max-w-7xl mx-auto w-full pt-[104px]">
        {/* Navigation & Header */}
        <header class="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link href={`/platform/clusters/${cluster?.id}`} class="text-tertiary hover:text-primary flex items-center gap-1 text-xs font-bold uppercase tracking-wider transition-colors w-fit">
              <ArrowLeftIcon class="w-4 h-4" />
              Back to {cluster?.name || "Cluster"}
            </Link>
            <h1 class="font-headline text-3xl font-extrabold tracking-tight text-on-surface mt-2">substrate analytics</h1>
          </div>
          <div class="inline-flex rounded-xl border border-outline-variant/10 bg-surface-container-low p-1 select-none">
            {[7, 14, 30].map(val => (
              <button
                key={val}
                type="button"
                onClick$={() => { days.value = val; hoveredIndex.value = -1; }}
                class={`rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] transition-all ${
                  days.value === val ? "bg-primary text-on-primary shadow-sm" : "text-tertiary hover:text-on-surface"
                }`}
              >
                {val}d
              </button>
            ))}
          </div>
        </header>

        {/* Totals Cards */}
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div class="relative overflow-hidden rounded-2xl border border-outline-variant/10 bg-surface-container-low p-5 shadow-sm hover:border-primary/20 transition-all">
            <div class="absolute top-0 right-0 w-24 h-24 bg-slate-500/[0.04] rounded-bl-full" />
            <div class="flex items-center gap-3 text-tertiary mb-3">
              <ActivityIcon class="w-4 h-4 text-slate-400" />
              <p class="text-[10px] font-bold uppercase tracking-widest">Total Requests</p>
            </div>
            <p class="text-3xl font-black tracking-tight">{periodTotals.request_count.toLocaleString()}</p>
            <p class="text-[10px] text-tertiary/70 mt-1">during selected period ({totals.request_count.toLocaleString()} lifetime)</p>
          </div>

          <div class="relative overflow-hidden rounded-2xl border border-outline-variant/10 bg-surface-container-low p-5 shadow-sm hover:border-indigo-500/20 transition-all">
            <div class="absolute top-0 right-0 w-24 h-24 bg-indigo-500/[0.04] rounded-bl-full" />
            <div class="flex items-center gap-3 text-tertiary mb-3">
              <BarChart3Icon class="w-4 h-4 text-indigo-400" />
              <p class="text-[10px] font-bold uppercase tracking-widest text-indigo-400">Semantic Queries</p>
            </div>
            <p class="text-3xl font-black tracking-tight text-indigo-400">{periodTotals.query_count.toLocaleString()}</p>
            <p class="text-[10px] text-tertiary/70 mt-1">during selected period ({totals.query_count.toLocaleString()} lifetime)</p>
          </div>

          <div class="relative overflow-hidden rounded-2xl border border-outline-variant/10 bg-surface-container-low p-5 shadow-sm hover:border-cyan-500/20 transition-all">
            <div class="absolute top-0 right-0 w-24 h-24 bg-cyan-500/[0.04] rounded-bl-full" />
            <div class="flex items-center gap-3 text-tertiary mb-3">
              <DatabaseIcon class="w-4 h-4 text-cyan-400" />
              <p class="text-[10px] font-bold uppercase tracking-widest text-cyan-400">Memories Ingested</p>
            </div>
            <p class="text-3xl font-black tracking-tight text-cyan-400">{periodTotals.ingest_count.toLocaleString()}</p>
            <p class="text-[10px] text-tertiary/70 mt-1">during selected period ({totals.ingest_count.toLocaleString()} lifetime)</p>
          </div>

          <div class="relative overflow-hidden rounded-2xl border border-outline-variant/10 bg-surface-container-low p-5 shadow-sm hover:border-amber-500/20 transition-all">
            <div class="absolute top-0 right-0 w-24 h-24 bg-amber-500/[0.04] rounded-bl-full" />
            <div class="flex items-center gap-3 text-tertiary mb-3">
              <RefreshCwIcon class="w-4 h-4 text-amber-400" />
              <p class="text-[10px] font-bold uppercase tracking-widest text-amber-400">Graph Operations</p>
            </div>
            <p class="text-3xl font-black tracking-tight text-amber-400">{periodTotals.graph_ops.toLocaleString()}</p>
            <p class="text-[10px] text-tertiary/70 mt-1">during selected period ({totals.graph_ops.toLocaleString()} lifetime)</p>
          </div>
        </div>

        {/* Charts Section */}
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Main Line Chart */}
          <div class="lg:col-span-2 rounded-2xl border border-outline-variant/10 bg-surface-container-low p-6 shadow-sm flex flex-col">
            <div class="flex items-center justify-between mb-6">
              <h3 class="text-base font-extrabold tracking-tight">Operations Over Time</h3>
              <div class="flex flex-wrap gap-4 text-[10px] font-bold uppercase tracking-wider select-none">
                <span class="flex items-center gap-1.5 text-slate-400">
                  <span class="w-2.5 h-2.5 rounded-full bg-slate-400/30 border border-slate-400" />
                  Requests
                </span>
                <span class="flex items-center gap-1.5 text-indigo-400">
                  <span class="w-2.5 h-2.5 rounded-full bg-indigo-500/30 border border-indigo-400" />
                  Queries
                </span>
                <span class="flex items-center gap-1.5 text-cyan-400">
                  <span class="w-2.5 h-2.5 rounded-full bg-cyan-500/30 border border-cyan-400" />
                  Ingests
                </span>
              </div>
            </div>

            {selectedUsage.length === 0 ? (
              <div class="flex-1 flex items-center justify-center py-20 text-sm text-tertiary">
                No activity logged for this time frame.
              </div>
            ) : (
              <div class="relative flex-1">
                {/* SVG Chart */}
                <svg viewBox={`0 0 ${width} ${height}`} class="w-full h-auto overflow-visible select-none">
                  {/* Grid Lines */}
                  {[0, 0.33, 0.66, 1].map((ratio, index) => {
                    const y = padding.top + ratio * innerHeight;
                    const val = Math.round(maxOps * (1 - ratio));
                    return (
                      <g key={index} class="opacity-20 hover:opacity-40 transition-opacity">
                        <line
                          x1={padding.left}
                          y1={y}
                          x2={padding.left + innerWidth}
                          y2={y}
                          stroke="var(--outline-variant)"
                          stroke-dasharray="4,4"
                          stroke-width="1"
                        />
                        <text
                          x={padding.left - 10}
                          y={y + 4}
                          text-anchor="end"
                          class="fill-tertiary font-mono text-[9px] font-semibold"
                        >
                          {val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val}
                        </text>
                      </g>
                    );
                  })}

                  {/* Areas (Underneath lines) */}
                  <path d={areaReq} fill="url(#gradReq)" class="opacity-15" />
                  <path d={areaQue} fill="url(#gradQue)" class="opacity-15" />
                  <path d={areaIng} fill="url(#gradIng)" class="opacity-15" />

                  {/* Lines */}
                  <path d={pathReq} fill="none" stroke="rgb(148, 163, 184)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                  <path d={pathQue} fill="none" stroke="rgb(99, 102, 241)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
                  <path d={pathIng} fill="none" stroke="rgb(6, 182, 212)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />

                  {/* X Axis Labels */}
                  {selectedUsage.map((d: any, i: number) => {
                    // Show 5-6 labels depending on range size
                    const stride = Math.max(Math.floor(selectedUsage.length / 5), 1);
                    if (i % stride !== 0 && i !== selectedUsage.length - 1) return null;

                    const x = padding.left + (i / Math.max(selectedUsage.length - 1, 1)) * innerWidth;
                    return (
                      <text
                        key={d.date}
                        x={x}
                        y={height - 8}
                        text-anchor="middle"
                        class="fill-tertiary/75 font-mono text-[8px] font-bold uppercase tracking-wider"
                      >
                        {new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </text>
                    );
                  })}

                  {/* Vertical Interactive Line & Dots */}
                  {hoveredIndex.value !== -1 && (() => {
                    const i = hoveredIndex.value;
                    const d = selectedUsage[i];
                    const x = padding.left + (i / Math.max(selectedUsage.length - 1, 1)) * innerWidth;
                    const yReq = padding.top + (1 - (d.request_count || 0) / maxOps) * innerHeight;
                    const yQue = padding.top + (1 - (d.query_count || 0) / maxOps) * innerHeight;
                    const yIng = padding.top + (1 - (d.ingest_count || 0) / maxOps) * innerHeight;

                    return (
                      <g>
                        <line
                          x1={x}
                          y1={padding.top}
                          x2={x}
                          y2={padding.top + innerHeight}
                          stroke="var(--primary)"
                          stroke-dasharray="3,3"
                          stroke-width="1.5"
                        />
                        {/* Dots */}
                        <circle cx={x} cy={yReq} r="4" fill="rgb(148, 163, 184)" stroke="var(--background)" stroke-width="2" />
                        <circle cx={x} cy={yQue} r="4" fill="rgb(99, 102, 241)" stroke="var(--background)" stroke-width="2" />
                        <circle cx={x} cy={yIng} r="4" fill="rgb(6, 182, 212)" stroke="var(--background)" stroke-width="2" />
                      </g>
                    );
                  })()}

                  {/* Hover Interceptor Slices */}
                  {selectedUsage.map((d: any, i: number) => {
                    const x = padding.left + (i / Math.max(selectedUsage.length - 1, 1)) * innerWidth;
                    const widthSlice = innerWidth / Math.max(selectedUsage.length, 1);
                    return (
                      <rect
                        key={d.date}
                        x={x - widthSlice / 2}
                        y={padding.top}
                        width={widthSlice}
                        height={innerHeight}
                        fill="transparent"
                        style={{ cursor: "crosshair" }}
                        onMouseOver$={() => { hoveredIndex.value = i; }}
                        onMouseLeave$={() => { hoveredIndex.value = -1; }}
                      />
                    );
                  })}

                  {/* Definitions for Gradients */}
                  <defs>
                    <linearGradient id="gradReq" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stop-color="rgb(148, 163, 184)" />
                      <stop offset="100%" stop-color="rgb(148, 163, 184)" stop-opacity="0" />
                    </linearGradient>
                    <linearGradient id="gradQue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stop-color="rgb(99, 102, 241)" />
                      <stop offset="100%" stop-color="rgb(99, 102, 241)" stop-opacity="0" />
                    </linearGradient>
                    <linearGradient id="gradIng" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stop-color="rgb(6, 182, 212)" />
                      <stop offset="100%" stop-color="rgb(6, 182, 212)" stop-opacity="0" />
                    </linearGradient>
                  </defs>
                </svg>

                {/* HTML Floating Tooltip */}
                {hoveredData && (
                  <div
                    class="absolute bg-surface-container-high/95 backdrop-blur border border-outline-variant/35 rounded-xl p-3 shadow-xl z-10 text-xs pointer-events-none transition-all duration-75 min-w-[140px]"
                    style={{
                      left: `${Math.min(Math.max((tooltipX / width) * 100, 15), 85)}%`,
                      top: "10px",
                      transform: "translateX(-50%)",
                    }}
                  >
                    <p class="font-bold text-on-surface mb-2 border-b border-outline-variant/20 pb-1">
                      {new Date(hoveredData.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                    </p>
                    <div class="space-y-1.5">
                      <div class="flex items-center gap-4 justify-between">
                        <span class="text-tertiary flex items-center gap-1.5">
                          <span class="w-2 h-2 rounded-full bg-slate-400" />
                          Requests:
                        </span>
                        <span class="font-bold font-mono text-[11px]">{hoveredData.request_count || 0}</span>
                      </div>
                      <div class="flex items-center gap-4 justify-between">
                        <span class="text-tertiary flex items-center gap-1.5">
                          <span class="w-2 h-2 rounded-full bg-indigo-500" />
                          Queries:
                        </span>
                        <span class="font-bold font-mono text-[11px] text-indigo-400">{hoveredData.query_count || 0}</span>
                      </div>
                      <div class="flex items-center gap-4 justify-between">
                        <span class="text-tertiary flex items-center gap-1.5">
                          <span class="w-2 h-2 rounded-full bg-cyan-500" />
                          Ingests:
                        </span>
                        <span class="font-bold font-mono text-[11px] text-cyan-400">{hoveredData.ingest_count || 0}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Donut Chart Breakdown */}
          <div class="rounded-2xl border border-outline-variant/10 bg-surface-container-low p-6 shadow-sm flex flex-col justify-between">
            <div>
              <h3 class="text-base font-extrabold tracking-tight mb-2">Operation Mix</h3>
              <p class="text-xs text-tertiary leading-relaxed mb-6">Structural breakdown of requests over the chosen period.</p>
            </div>

            {totalPeriodOps === 0 ? (
              <div class="flex-1 flex flex-col items-center justify-center py-10">
                <svg width="120" height="120" viewBox="0 0 120 120" class="rotate-[-90deg]">
                  <circle cx="60" cy="60" r={donutR} fill="transparent" stroke="var(--outline-variant)" stroke-width="12" class="opacity-10" />
                </svg>
                <p class="text-xs text-tertiary mt-4 text-center">No operations logged.</p>
              </div>
            ) : (
              <div class="flex-1 flex flex-col items-center justify-center">
                {/* Donut SVG */}
                <div class="relative w-36 h-36">
                  <svg width="100%" height="100%" viewBox="0 0 120 120" class="rotate-[-90deg] overflow-visible">
                    {/* Background circle */}
                    <circle cx="60" cy="60" r={donutR} fill="transparent" stroke="var(--surface-container-high)" stroke-width="12" />

                    {/* Queries segment */}
                    {qPct > 0 && (
                      <circle
                        cx="60"
                        cy="60"
                        r={donutR}
                        fill="transparent"
                        stroke="rgb(99, 102, 241)"
                        stroke-width="12"
                        stroke-dasharray={`${qPct * donutC} ${donutC}`}
                        stroke-dashoffset="0"
                        class="transition-all duration-300"
                      />
                    )}

                    {/* Ingests segment */}
                    {iPct > 0 && (
                      <circle
                        cx="60"
                        cy="60"
                        r={donutR}
                        fill="transparent"
                        stroke="rgb(6, 182, 212)"
                        stroke-width="12"
                        stroke-dasharray={`${iPct * donutC} ${donutC}`}
                        stroke-dashoffset={`-${qPct * donutC}`}
                        class="transition-all duration-300"
                      />
                    )}

                    {/* Graph Ops segment */}
                    {gPct > 0 && (
                      <circle
                        cx="60"
                        cy="60"
                        r={donutR}
                        fill="transparent"
                        stroke="rgb(245, 158, 11)"
                        stroke-width="12"
                        stroke-dasharray={`${gPct * donutC} ${donutC}`}
                        stroke-dashoffset={`-${(qPct + iPct) * donutC}`}
                        class="transition-all duration-300"
                      />
                    )}
                  </svg>

                  {/* Absolute Center Content */}
                  <div class="absolute inset-0 flex flex-col items-center justify-center select-none text-center pointer-events-none">
                    <span class="text-[9px] font-bold uppercase tracking-wider text-tertiary">Total Ops</span>
                    <span class="text-lg font-black leading-tight text-on-surface">{totalPeriodOps.toLocaleString()}</span>
                  </div>
                </div>

                {/* Donut Legend */}
                <div class="w-full mt-6 space-y-2">
                  <div class="flex items-center justify-between text-xs p-2 rounded-lg hover:bg-surface-container-high transition-colors">
                    <span class="flex items-center gap-2 font-medium">
                      <span class="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                      Semantic Queries
                    </span>
                    <span class="font-mono font-bold text-tertiary">
                      {periodTotals.query_count.toLocaleString()} ({Math.round(qPct * 100)}%)
                    </span>
                  </div>

                  <div class="flex items-center justify-between text-xs p-2 rounded-lg hover:bg-surface-container-high transition-colors">
                    <span class="flex items-center gap-2 font-medium">
                      <span class="w-2.5 h-2.5 rounded-full bg-cyan-500" />
                      Memories Ingested
                    </span>
                    <span class="font-mono font-bold text-tertiary">
                      {periodTotals.ingest_count.toLocaleString()} ({Math.round(iPct * 100)}%)
                    </span>
                  </div>

                  <div class="flex items-center justify-between text-xs p-2 rounded-lg hover:bg-surface-container-high transition-colors">
                    <span class="flex items-center gap-2 font-medium">
                      <span class="w-2.5 h-2.5 rounded-full bg-amber-500" />
                      Graph Operations
                    </span>
                    <span class="font-mono font-bold text-tertiary">
                      {periodTotals.graph_ops.toLocaleString()} ({Math.round(gPct * 100)}%)
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Audit Log / Table */}
        <section class="rounded-2xl border border-outline-variant/10 bg-surface-container-low p-6 shadow-sm">
          <h3 class="text-base font-extrabold tracking-tight mb-4">Daily Activity Audit</h3>
          {selectedUsage.length === 0 ? (
            <p class="text-xs text-tertiary text-center py-8">No audit logs available for this period.</p>
          ) : (
            <div class="overflow-x-auto">
              <table class="w-full text-left text-xs">
                <thead>
                  <tr class="border-b border-outline-variant/20 text-[10px] font-bold uppercase tracking-widest text-tertiary/70">
                    <th class="py-3 font-semibold">Date</th>
                    <th class="py-3 font-semibold text-right">Requests</th>
                    <th class="py-3 font-semibold text-right">Ingests</th>
                    <th class="py-3 font-semibold text-right">Queries</th>
                    <th class="py-3 font-semibold text-right">Graph Ops</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-outline-variant/10 font-medium">
                  {selectedUsage.slice().reverse().map((d: any) => (
                    <tr key={d.date} class="hover:bg-surface-container-high/40 transition-colors">
                      <td class="py-3.5 font-mono text-tertiary">
                        {new Date(d.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                      </td>
                      <td class="py-3.5 text-right font-mono text-on-surface">{d.request_count || 0}</td>
                      <td class="py-3.5 text-right font-mono text-cyan-400">{d.ingest_count || 0}</td>
                      <td class="py-3.5 text-right font-mono text-indigo-400">{d.query_count || 0}</td>
                      <td class="py-3.5 text-right font-mono text-amber-500">{d.graph_ops || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
});

export const head: DocumentHead = buildSeoHead({
  title: "Analytics | TELLODB",
  description: "View usage analytics for your cluster.",
  pathname: "/platform/clusters/[id]/analytics",
  noindex: true
});
