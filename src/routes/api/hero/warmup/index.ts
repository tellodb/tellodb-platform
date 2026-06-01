import type { RequestHandler } from "@builder.io/qwik-city";

import {
  formatEngineMs,
  formatRoundTripMs,
  heroEngineBaseUrl,
  heroRequestHeaders,
  readEngineTotalUs,
  type HeroWarmupResult
} from "~/lib/hero-demo";
import { setPrivateNoStore } from "~/lib/cache";
import { captureError } from "~/lib/sentry";

export const onPost: RequestHandler = async (event) => {
  setPrivateNoStore(event);
  event.headers.set("Content-Type", "application/json; charset=utf-8");

  const startedAt = Date.now();
  let response: Response;

  try {
    response = await fetch(`${heroEngineBaseUrl(event)}/health`, {
      method: "GET",
      headers: heroRequestHeaders(event),
      signal: AbortSignal.timeout(60_000)
    });
  } catch (error) {
    captureError(error, { action: "heroWarmup", context: "healthCheck" });
    const body: HeroWarmupResult = {
      ok: false,
      message:
        error instanceof Error
          ? `Warm-up transport failed. ${error.message}`
          : "Warm-up transport failed."
    };
    event.send(502, JSON.stringify(body));
    return;
  }

  if (!response.ok) {
    const body: HeroWarmupResult = {
      ok: false,
      message: `Warm-up failed (${response.status}). ${await response.text()}`
    };
    event.send(502, JSON.stringify(body));
    return;
  }

  const body: HeroWarmupResult = {
    ok: true,
    status: "Warm",
    roundTripLabel: formatRoundTripMs(startedAt),
    engineLabel: formatEngineMs(readEngineTotalUs(response.headers))
  };
  event.send(200, JSON.stringify(body));
};
