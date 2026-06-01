import type { RequestHandler } from "@builder.io/qwik-city";
import { getTellodbCoreUrl } from "~/lib/tellodb-core";
import { getCurrentUser } from "~/lib/auth";
import { getAdminSupabaseClient } from "~/lib/supabase";
import { captureError } from "~/lib/sentry";
import type { GraphEdge } from "~/lib/tellodb-core";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STOP_WORDS = new Set([
  "and", "or", "the", "both", "now", "with", "for", "are", "was",
  "has", "had", "not", "but", "that", "this", "from", "also", "into"
]);

function parseFactsFromMemory(textualContent: string): Array<{ text: string; terms: string[] }> {
  try {
    const jsonMatch = textualContent.match(/\{[\s\S]+\}/);
    if (!jsonMatch) return [];
    const parsed = JSON.parse(jsonMatch[0]);
    if (Array.isArray(parsed.facts)) {
      return parsed.facts.map((f: any) => ({
        text: f.text || "",
        terms: Array.isArray(f.terms) ? f.terms.filter((t: string) => t.length > 2 && !STOP_WORDS.has(t)) : [],
      }));
    }
  } catch { /* not parseable */ }
  return [];
}

function entityLabel(entityId: string): string {
  const parts = entityId.split("::");
  return parts[parts.length - 1];
}

function buildEdgesFromFacts(
  facts: Array<{ text: string; terms: string[] }>,
  entityId: string,
  startIdx: number
): GraphEdge[] {
  const edges: GraphEdge[] = [];
  const label = entityLabel(entityId);
  for (const fact of facts) {
    const terms = fact.terms;
    for (let i = 0; i < terms.length; i++) {
      edges.push({
        edge_id: `${label}-${terms[i]}-${startIdx++}`,
        source: label,
        target: terms[i],
        edge_type: "entity_term",
        label: `${label} → ${terms[i]}`,
        weight: 0.7,
        timestamp_ms: Date.now(),
        memory_id: `et-${startIdx}`,
      });
      for (let j = i + 1; j < terms.length; j++) {
        edges.push({
          edge_id: `${terms[i]}-${terms[j]}-${startIdx++}`,
          source: terms[i],
          target: terms[j],
          edge_type: "co_occurs",
          label: fact.text.slice(0, 60),
          weight: 0.9,
          timestamp_ms: Date.now(),
          memory_id: `co-${startIdx}`,
        });
      }
    }
  }
  return edges;
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export const onGet: RequestHandler = async (event) => {
  let user = getCurrentUser(event.cookie);
  if (!user) {
    const devUserId = event.url.searchParams.get("dev_user_id");
    if (devUserId) {
      user = { user_id: devUserId, username: "dev-user" };
    }
  }
  if (!user) throw event.error(401, "Unauthorized");

  try {
    const supabase = getAdminSupabaseClient(event.env);
    if (!supabase) throw event.error(500, "Database offline");

    // Optional entity_id from query param — the user can specify which entity to visualize
    const entityId = event.url.searchParams.get("entity_id") || null;

    // Fetch ALL API keys for this user (no is_active filter — keys are deleted not deactivated)
    const { data: apiKeys } = await supabase
      .from("api_keys")
      .select("key_value")
      .eq("user_id", user.user_id)
      .order("created_at", { ascending: false })
      .limit(5);

    const engineUrl = (
      event.env.get("TELLODB_URL") ||
      getTellodbCoreUrl()
    ).replace(/\/+$/, "");

    const adminKey = event.env.get("TELLODB_ADMIN_KEY") ||
      event.env.get("TELLODB_API_KEY") || "";

    const allEdges: GraphEdge[] = [];
    const seenEdgeIds = new Set<string>();
    let edgeIdx = 0;

    const addEdges = (edges: GraphEdge[]) => {
      for (const e of edges) {
        if (!seenEdgeIds.has(e.edge_id)) {
          seenEdgeIds.add(e.edge_id);
          allEdges.push(e);
        }
      }
    };

    // ── Strategy 1: Admin graph-edges for this user's namespace ──────────────
    // The user's Supabase user_id IS their namespace UUID on the shared engine.
    // The admin endpoint /admin/clusters/{uuid}/graph-edges returns native graph edges.
    if (adminKey) {
      try {
        const ac = new AbortController();
        const to = setTimeout(() => ac.abort(), 6000);
        const res = await fetch(`${engineUrl}/admin/clusters/${encodeURIComponent(user.user_id)}/graph-edges`, {
          headers: { "x-api-key": adminKey },
          signal: ac.signal,
        });
        clearTimeout(to);
        if (res.ok) {
          const nativeEdges: GraphEdge[] = await res.json();
          if (Array.isArray(nativeEdges)) addEdges(nativeEdges);
        }
      } catch { /* non-fatal */ }
    }

    // ── Strategy 2: Query with entity_id to get fact-based graph ─────────────
    // The query API returns observation_block content which contains NLP-extracted facts.
    // Queries WITHOUT entity_id only return the root namespace entity (no facts).
    // Queries WITH entity_id return the actual user data.
    if (apiKeys?.length && adminKey) {
      const namespacedEntityId = entityId ? `${user.user_id}::${entityId}` : user.user_id;
      const queriesToRun: Array<{ textual_query: string; limit: number; entity_id: string }> = [];

      if (entityId) {
        // User specified entity_id — query specifically for that entity
        queriesToRun.push(
          { textual_query: "knowledge facts work project", limit: 20, entity_id: namespacedEntityId },
          { textual_query: "people relationships technology", limit: 20, entity_id: namespacedEntityId },
        );
      } else {
        // No entity_id — query without it (returns root entity which may have no facts,
        // but we try anyway in case the engine's behaviour changes)
        queriesToRun.push(
          { textual_query: "knowledge facts work project technology", limit: 20, entity_id: namespacedEntityId },
        );
      }

      await Promise.all(
        queriesToRun.map(async (payload) => {
          try {
            const ac = new AbortController();
            const to = setTimeout(() => ac.abort(), 8000);
            const res = await fetch(`${engineUrl}/query`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "x-api-key": adminKey },
              body: JSON.stringify(payload),
              signal: ac.signal,
            });
            clearTimeout(to);
            if (!res.ok) return;

            const memories: any[] = await res.json();
            for (const mem of memories) {
              if (!mem.textual_content) continue;
              const facts = parseFactsFromMemory(mem.textual_content);
              if (!facts.length) continue;
              const edges = buildEdgesFromFacts(facts, mem.entity_id || "entity", edgeIdx);
              edgeIdx += edges.length;
              addEdges(edges);
            }
          } catch { /* non-fatal */ }
        })
      );
    }

    event.json(200, allEdges);
  } catch (e: any) {
    if (e?.headers?.location) throw e;
    if (e?.status) throw e;
    captureError(e, { action: "sharedGraphEdges" });
    throw event.error(500, "Internal error");
  }
};
