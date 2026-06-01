import posthog from "posthog-js";

const POSTHOG_KEY = import.meta.env.PUBLIC_POSTHOG_KEY || "";
const POSTHOG_HOST = import.meta.env.PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

let initialized = false;

export function initPostHog(): typeof posthog | null {
  if (!POSTHOG_KEY || initialized) return null;
  try {
    posthog.init(POSTHOG_KEY, {
      api_host: "/api/telemetry",
      persistence: "localStorage",
      autocapture: false,
      disable_session_recording: true,
      disable_persistence: false,
      advanced_disable_decide: true,
      loaded: () => {},
    });
    initialized = true;
  } catch {}
  return posthog;
}

export function getPostHog(): typeof posthog | null {
  return POSTHOG_KEY ? posthog : null;
}

export function capture(
  event: string,
  properties?: Record<string, unknown>
) {
  const ph = getPostHog();
  if (!ph) return;
  try {
    ph.capture(event, properties || {});
  } catch {}
}

export function identify(
  userId: string,
  traits?: Record<string, unknown>
) {
  const ph = getPostHog();
  if (!ph) return;
  try {
    ph.identify(userId, traits || {});
  } catch {}
}

export function reset() {
  const ph = getPostHog();
  if (!ph) return;
  try {
    ph.reset();
  } catch {}
}

// Server-side capture via PostHog HTTP API
const POSTHOG_PROJECT_KEY = POSTHOG_KEY;

export async function captureServer(
  event: string,
  distinctId: string,
  properties?: Record<string, unknown>
) {
  if (!POSTHOG_PROJECT_KEY) return;
  try {
    await fetch(`${POSTHOG_HOST}/capture/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: POSTHOG_PROJECT_KEY,
        event,
        distinct_id: distinctId,
        properties: {
          ...properties,
          $lib: "tellodb-platform",
        },
        timestamp: new Date().toISOString(),
      }),
      signal: AbortSignal.timeout(3000),
    });
  } catch {}
}
