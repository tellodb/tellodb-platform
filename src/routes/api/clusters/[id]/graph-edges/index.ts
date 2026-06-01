import type { RequestHandler } from "@builder.io/qwik-city";
import { getGraphEdges, getTellodbCoreUrl } from "~/lib/tellodb-core";
import { getCurrentUser } from "~/lib/auth";
import { getAdminSupabaseClient } from "~/lib/supabase";
import { captureError } from "~/lib/sentry";
import type { GraphEdge } from "~/lib/tellodb-core";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Parse facts from the Tellodb observation_block textual_content format */
function parseFactsFromMemory(textualContent: string): Array<{ text: string; terms: string[] }> {
  try {
    // Content format: "## [TELLODB MEMORY CONTEXT]\n### Core State\n{...json...}\n"
    const jsonMatch = textualContent.match(/\{[\s\S]+\}/);
    if (!jsonMatch) return [];
    const parsed = JSON.parse(jsonMatch[0]);
    if (Array.isArray(parsed.facts)) {
      return parsed.facts.map((f: any) => ({
        text: f.text || "",
        terms: Array.isArray(f.terms) ? f.terms.filter((t: string) => t.length > 2) : [],
      }));
    }
  } catch {
    // not parseable, extract terms from plain text
  }
  return [];
}

/** Derive a short entity label from a full namespaced entity_id */
function entityLabel(entityId: string): string {
  // Strip namespace prefix "uuid::entity" → "entity"
  const parts = entityId.split("::");
  return parts[parts.length - 1];
}

/** Build graph edges by co-occurrence: every pair of terms in the same fact shares an edge */
function buildEdgesFromFacts(
  facts: Array<{ text: string; terms: string[] }>,
  entityId: string,
  startIdx: number
): GraphEdge[] {
  const edges: GraphEdge[] = [];
  const label = entityLabel(entityId);

  for (const fact of facts) {
    const terms = fact.terms.filter((t) => t !== "and" && t !== "or" && t !== "the" && t !== "both" && t !== "now");
    if (terms.length < 2) {
      // Single-term fact: connect entity → term
      if (terms.length === 1) {
        edges.push({
          edge_id: `${label}-${terms[0]}-${startIdx++}`,
          source: label,
          target: terms[0],
          edge_type: "mentioned_in",
          label: fact.text.slice(0, 60),
          weight: 0.8,
          timestamp_ms: Date.now(),
          memory_id: `fact-${startIdx}`,
        });
      }
      continue;
    }
    // Co-occurrence edges between every pair of terms
    for (let i = 0; i < terms.length; i++) {
      for (let j = i + 1; j < terms.length; j++) {
        edges.push({
          edge_id: `${terms[i]}-${terms[j]}-${startIdx++}`,
          source: terms[i],
          target: terms[j],
          edge_type: "co_occurs",
          label: fact.text.slice(0, 60),
          weight: 0.9,
          timestamp_ms: Date.now(),
          memory_id: `fact-${startIdx}`,
        });
      }
      // Also connect entity → each term
      edges.push({
        edge_id: `${label}-${terms[i]}-${startIdx++}`,
        source: label,
        target: terms[i],
        edge_type: "entity_term",
        label: `${label} → ${terms[i]}`,
        weight: 0.7,
        timestamp_ms: Date.now(),
        memory_id: `entity-${startIdx}`,
      });
    }
  }
  return edges;
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export const onGet: RequestHandler = async (event) => {
  const user = getCurrentUser(event.cookie);
  if (!user) throw event.error(401, "Unauthorized");

  try {
    const clusterId = event.params.id;
    if (!clusterId) throw event.error(400, "Cluster ID required");

    const supabase = getAdminSupabaseClient(event.env);
    if (!supabase) throw event.error(500, "Database offline");

    const { data: cluster, error } = await supabase
      .from("clusters")
      .select("*")
      .eq("id", clusterId)
      .single();

    if (error && error.code !== "PGRST116") {
      throw event.error(500, `Database error: ${error.message}`);
    }
    if (!cluster) throw event.error(404, `Cluster ${clusterId} not found`);
    if (cluster.user_id !== user.user_id) throw event.error(403, "Forbidden - owner mismatch");

    const isShared = cluster.tier === "fractional";

    if (!isShared) {
      // Dedicated cluster: use admin graph endpoint directly
      const edges = await getGraphEdges(clusterId, cluster.endpoint_url, cluster.engine_key);
      event.json(200, edges || []);
      return;
    }

    // ── Shared/fractional tier ────────────────────────────────────────────────
    // The shared engine uses the user's API key to scope data. We can't use
    // admin graph endpoints (they scope by internal cluster UUID, not user).
    // Strategy: query the user's stored memories and synthesize a graph from
    // the embedded facts/terms in the observation_block content.

    const { data: apiKeys } = await supabase
      .from("api_keys")
      .select("key_value")
      .eq("user_id", user.user_id)
      .eq("is_active", true)
      .limit(5);

    if (!apiKeys?.length) {
      event.json(200, []);
      return;
    }

    const engineUrl = (
      cluster.endpoint_url ||
      event.env.get("TELLODB_URL") ||
      getTellodbCoreUrl()
    ).replace(/\/+$/, "");

    // Use the first active API key for queries
    const apiKey = apiKeys[0].key_value;

    const allEdges: GraphEdge[] = [];
    const seenEdgeIds = new Set<string>();
    let edgeIdx = 0;

    // Single broad query to fetch the user's stored memories.
    // The observation_block format bundles all facts for an entity in one record.
    const queryPayloads = [
      { textual_query: "knowledge facts memories entities", limit: 20 },
      { textual_query: "project work technology preferences", limit: 20 },
    ];

    await Promise.all(
      queryPayloads.map(async (payload) => {
        try {
          const ac = new AbortController();
          const timeout = setTimeout(() => ac.abort(), 8000);
          const res = await fetch(`${engineUrl}/query`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-api-key": apiKey },
            body: JSON.stringify(payload),
            signal: ac.signal,
          });
          clearTimeout(timeout);
          if (!res.ok) return;

          const memories: any[] = await res.json();
          for (const mem of memories) {
            if (!mem.textual_content) continue;
            const facts = parseFactsFromMemory(mem.textual_content);
            const edges = buildEdgesFromFacts(facts, mem.entity_id || "entity", edgeIdx);
            edgeIdx += edges.length;
            for (const edge of edges) {
              if (!seenEdgeIds.has(edge.edge_id)) {
                seenEdgeIds.add(edge.edge_id);
                allEdges.push(edge);
              }
            }
          }
        } catch {
          // individual query failure is non-fatal
        }
      })
    );

    event.json(200, allEdges);
  } catch (e: any) {
    if (e?.headers?.location) throw e;
    if (e?.status) throw e;
    captureError(e, { action: "clusterGraphEdges", clusterId: event.params.id });
    throw event.error(500, "Internal error");
  }
};
