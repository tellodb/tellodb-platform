import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

async function reportError(
  error: Error | unknown,
  context: Record<string, unknown> = {},
) {
  const dsn = Deno.env.get("SENTRY_DSN") || "";
  if (!dsn) {
    console.error("[sentry]", error, context);
    return;
  }
  const projectId = dsn.split("/").pop();
  const host = new URL(dsn).host;
  try {
    const err = error instanceof Error ? error : new Error(String(error));
    const eventId = crypto.randomUUID().replace(/-/g, "");
    const payload = {
      event_id: eventId,
      timestamp: Date.now() / 1000,
      level: "error",
      platform: "deno",
      exception: { values: [{ type: err.name, value: err.message }] },
      extra: context,
      tags: { environment: "edge" },
    };
    const envelope =
      JSON.stringify({
        event_id: eventId,
        sent_at: new Date().toISOString(),
        dsn,
      }) +
      "\n" +
      JSON.stringify({
        type: "event",
        content_type: "application/json",
        length: JSON.stringify(payload).length,
      }) +
      "\n" +
      JSON.stringify(payload);
    await fetch(`https://${host}/api/${projectId}/envelope/`, {
      method: "POST",
      body: envelope,
      signal: AbortSignal.timeout(3000),
    });
  } catch {}
}

const SLACK_WEBHOOK_URL = Deno.env.get("SLACK_WEBHOOK_URL") || "";

serve(async (req) => {
  let payload: any = {};
  try {
    payload = await req.json();

    const { type, table, record } = payload;

    let text = "";
    if (table === "users" && type === "INSERT") {
      const email =
        record?.email || record?.raw_user_meta_data?.email || "unknown";
      text = `:bust_in_silhouette: New signup: *${email}*`;
    } else if (table === "clusters" && type === "INSERT") {
      const clusterId = record?.id?.slice(0, 8) || "unknown";
      const tier = record?.tier || "unknown";
      text = `:rocket: New cluster created: *${clusterId}* (tier: ${tier})`;
    } else {
      text = `:bell: Event: \`${type}\` on \`${table}\`\n\`\`\`${JSON.stringify(record, null, 2)}\`\`\``;
    }

    if (SLACK_WEBHOOK_URL) {
      await fetch(SLACK_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    reportError(err, { source: "notify-slack", table: payload.table });
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
