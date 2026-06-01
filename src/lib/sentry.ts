const SENTRY_DSN = import.meta.env.PUBLIC_SENTRY_DSN || "";
const SENTRY_PROJECT_ID = SENTRY_DSN ? SENTRY_DSN.split("/").pop() : "";

const ENVELOPE_ENDPOINT = SENTRY_DSN
  ? `https://${new URL(SENTRY_DSN).host}/api/${SENTRY_PROJECT_ID}/envelope/`
  : "";

export function captureError(error: Error | unknown, extra?: Record<string, unknown>) {
  if (!SENTRY_DSN) {
    console.error("[sentry]", error, extra);
    return;
  }

  const err = error instanceof Error ? error : new Error(String(error));

  try {
    const eventId = crypto.randomUUID().replace(/-/g, "");
    const payload = {
      event_id: eventId,
      timestamp: Date.now() / 1000,
      level: "error",
      platform: "javascript",
      exception: {
        values: [
          {
            type: err.name || "Error",
            value: err.message || String(error),
            stacktrace: {
              frames: parseStackFrames(err.stack || ""),
            },
          },
        ],
      },
      extra: extra || {},
      tags: {
        environment: import.meta.env.PROD ? "production" : "development",
      },
    };

    const envelope = buildEnvelope(payload);
    fetch(ENVELOPE_ENDPOINT, {
      method: "POST",
      body: envelope,
    }).catch(() => {});
  } catch {
    console.error("[sentry] failed to send:", err.message);
  }
}

function buildEnvelope(payload: Record<string, unknown>): string {
  const eventJson = JSON.stringify(payload);
  const envelopeHeader = JSON.stringify({ event_id: payload.event_id, sent_at: new Date().toISOString(), dsn: SENTRY_DSN });
  const itemHeader = JSON.stringify({ type: "event", content_type: "application/json", length: eventJson.length });
  return `${envelopeHeader}\n${itemHeader}\n${eventJson}`;
}

function parseStackFrames(stack: string): { filename: string; function: string; lineno: number; colno: number }[] {
  return stack
    .split("\n")
    .slice(1)
    .map((line) => {
      const match = line.match(/at\s+(.+?)\s+\((.+?):(\d+):(\d+)\)/) || line.match(/at\s+(.+?):(\d+):(\d+)/);
      return match
        ? { filename: match[2] || match[1] || "", function: match[1] || "", lineno: parseInt(match[3] || match[2] || "0"), colno: parseInt(match[4] || match[3] || "0") }
        : { filename: line.trim(), function: "", lineno: 0, colno: 0 };
    });
}
