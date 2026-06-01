import { component$, useSignal, useVisibleTask$ } from "@builder.io/qwik";
import * as d3 from "d3";

interface Node extends d3.SimulationNodeDatum {
  id: string;
  group: number;
  label: string;
  stale?: boolean;
}

interface Link extends d3.SimulationLinkDatum<Node> {
  value: number;
}

export const MemoryLattice = component$(() => {
  const containerRef = useSignal<HTMLDivElement>();

  useVisibleTask$(({ cleanup }) => {
    if (!containerRef.value) return;

    const width = containerRef.value.clientWidth;
    const height = 400;

    const nodes: Node[] = [
      { id: "user", group: 1, label: "User entity: active" },
      { id: "pref1", group: 2, label: "Preference: Tea", stale: false },
      { id: "pref1_old", group: 2, label: "Preference: Coffee", stale: true },
      { id: "loc1", group: 3, label: "Location: SF", stale: false },
      { id: "loc1_old", group: 3, label: "Location: NYC", stale: true },
      { id: "car1", group: 4, label: "Car: Mercedes", stale: false },
      { id: "task1", group: 5, label: "Task: Gym", stale: false },
    ];

    const links: Link[] = [
      { source: "user", target: "pref1", value: 2 },
      { source: "user", target: "loc1", value: 2 },
      { source: "user", target: "car1", value: 2 },
      { source: "user", target: "task1", value: 2 },
      { source: "pref1", target: "pref1_old", value: 1 },
      { source: "loc1", target: "loc1_old", value: 1 },
    ];

    const svg = d3.select(containerRef.value)
      .append("svg")
      .attr("width", "100%")
      .attr("height", height)
      .attr("viewBox", `0 0 ${width} ${height}`)
      .style("overflow", "visible");

    const simulation = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(links).id((d: any) => d.id).distance(100))
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2));

    const link = svg.append("g")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke", (d: any) => d.target.stale ? "rgba(255, 180, 171, 0.15)" : "rgba(192, 193, 255, 0.25)")
      .attr("stroke-width", (d) => Math.sqrt(d.value))
      .attr("stroke-dasharray", (d: any) => d.target.stale ? "4" : "0");

    const node = svg.append("g")
      .selectAll("g")
      .data(nodes)
      .join("g")
      .call(d3.drag<any, Node>()
        .on("start", (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on("drag", (event, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on("end", (event, d) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        }) as any);

    node.append("circle")
      .attr("r", (d) => d.id === "user" ? 12 : 8)
      .attr("fill", (d) => d.stale ? "rgba(255, 180, 171, 0.15)" : (d.id === "user" ? "#9b9cff" : "#5de6ff"))
      .attr("stroke", (d) => d.stale ? "#ffb4ab" : (d.id === "user" ? "#9b9cff" : "#5de6ff"))
      .attr("stroke-width", 2)
      .style("filter", (d) => d.stale ? "none" : "drop-shadow(0 0 8px rgba(155, 156, 255, 0.65))");

    node.append("text")
      .attr("dy", 20)
      .attr("text-anchor", "middle")
      .attr("fill", (d) => d.stale ? "rgba(255, 255, 255, 0.3)" : "rgba(255, 255, 255, 0.8)")
      .style("font-size", "10px")
      .style("font-family", "'JetBrains Mono', ui-monospace, SFMono-Regular, monospace")
      .style("pointer-events", "none")
      .text((d) => d.label);

    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      node.attr("transform", (d) => `translate(${d.x},${d.y})`);
    });

    cleanup(() => simulation.stop());
  });

  return (
    <div ref={containerRef} class="w-full h-[400px] cursor-grab active:cursor-grabbing">
      <div class="absolute top-4 right-4 flex flex-col gap-2 text-[10px] uppercase font-bold tracking-widest text-tertiary">
         <div class="flex items-center gap-2">
            <div class="w-3 h-3 rounded-full bg-primary shadow-[0_0_8px_rgba(155,156,255,0.7)]" />
            Active Truth
         </div>
         <div class="flex items-center gap-2">
            <div class="w-3 h-3 rounded-full bg-error/20 border border-error opacity-60" />
            <span class="text-tertiary">Superseded Memory</span>
         </div>
      </div>
    </div>
  );
});
