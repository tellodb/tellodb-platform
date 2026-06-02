import type { RequestHandler } from "@builder.io/qwik-city";
import { getTellodbCoreUrl } from "~/lib/tellodb-core";
import { getCurrentUser } from "~/lib/auth";
import { getAdminSupabaseClient } from "~/lib/supabase";
import { captureError } from "~/lib/sentry";

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

    const engineUrl = (
      event.env.get("TELLODB_URL") || getTellodbCoreUrl()
    ).replace(/\/+$/, "");

    const adminKey =
      event.env.get("TELLODB_ADMIN_KEY") ||
      event.env.get("TELLODB_API_KEY") ||
      "";

    const entityIds = new Set<string>();

    // ── Strategy 1: Fetch from admin entity-list endpoint ────────────────────
    if (adminKey) {
      try {
        const ac = new AbortController();
        const to = setTimeout(() => ac.abort(), 6000);
        const res = await fetch(
          `${engineUrl}/admin/clusters/${encodeURIComponent(user.user_id)}/entities`,
          {
            headers: { "x-api-key": adminKey },
            signal: ac.signal,
          }
        );
        clearTimeout(to);
        if (res.ok) {
          const data = await res.json();
          // Engine may return an array of entity objects or strings
          if (Array.isArray(data)) {
            for (const item of data) {
              const id: string =
                typeof item === "string"
                  ? item
                  : item?.entity_id || item?.id || "";
              if (id) {
                // Strip the namespace prefix (user_id::) if present
                const stripped = id.includes("::")
                  ? id.split("::").slice(1).join("::")
                  : id;
                if (stripped) entityIds.add(stripped);
              }
            }
          }
        }
      } catch {
        /* non-fatal */
      }
    }

    // ── Strategy 2: Parse entity IDs from graph edges ────────────────────────
    // Fetch graph edges from the admin endpoint and collect unique source nodes
    // that look like entity IDs (heuristic: contain a dash or underscore,
    // not generic terms).
    if (adminKey && entityIds.size === 0) {
      try {
        const ac = new AbortController();
        const to = setTimeout(() => ac.abort(), 6000);
        const res = await fetch(
          `${engineUrl}/admin/clusters/${encodeURIComponent(user.user_id)}/graph-edges`,
          {
            headers: { "x-api-key": adminKey },
            signal: ac.signal,
          }
        );
        clearTimeout(to);
        if (res.ok) {
          const edges: Array<{ source?: string; target?: string; entity_id?: string }> =
            await res.json();
          if (Array.isArray(edges)) {
            for (const e of edges) {
              // entity_id field if present
              if (e.entity_id) {
                const stripped = e.entity_id.includes("::")
                  ? e.entity_id.split("::").slice(1).join("::")
                  : e.entity_id;
                if (stripped) entityIds.add(stripped);
              }
            }
          }
        }
      } catch {
        /* non-fatal */
      }
    }

    // ── Strategy 3: Fetch from Supabase memories table ───────────────────────
    // If we have a `memories` table with an entity_id column, use it.
    if (entityIds.size === 0) {
      try {
        const { data } = await supabase
          .from("memories")
          .select("entity_id")
          .eq("user_id", user.user_id)
          .not("entity_id", "is", null)
          .limit(200);

        if (data) {
          for (const row of data) {
            const id: string = row.entity_id || "";
            // Strip namespace prefix if present
            const stripped = id.includes("::")
              ? id.split("::").slice(1).join("::")
              : id;
            if (stripped) entityIds.add(stripped);
          }
        }
      } catch {
        /* table may not exist */
      }
    }

    event.json(200, Array.from(entityIds).sort());
  } catch (e: any) {
    if (e?.headers?.location) throw e;
    if (e?.status) throw e;
    captureError(e, { action: "sharedEntityIds" });
    throw event.error(500, "Internal error");
  }
};
