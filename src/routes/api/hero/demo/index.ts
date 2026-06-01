import type { RequestHandler } from "@builder.io/qwik-city";

import { setPrivateNoStore } from "~/lib/cache";
import { captureError } from "~/lib/sentry";
import {
  buildHeroMemoryId,
  formatEngineMs,
  formatHeroTimestamp,
  formatRoundTripMs,
  heroEngineBaseUrl,
  heroRequestHeaders,
  readEngineTotalUs,
  resolveHeroEntityId,
  type HeroDemoResult,
  type HeroMemoryHit
} from "~/lib/hero-demo";

export const onPost: RequestHandler = async (event) => {
  setPrivateNoStore(event);
  event.headers.set("Content-Type", "application/json; charset=utf-8");

  const body = (await event.parseBody()) as Record<string, unknown>;
  const action = String(body.action ?? "store").trim().toLowerCase();
  const message = String(body.message ?? "").trim();

  if (action !== "store" && action !== "recall") {
    const response: HeroDemoResult = {
      ok: false,
      message: "Invalid hero demo action.",
      action: "store"
    };
    event.send(400, JSON.stringify(response));
    return;
  }

  if (!message) {
    const response: HeroDemoResult = {
      ok: false,
      message:
        action === "store"
          ? "Enter a user message so the engine has something real to save."
          : "Enter a query to recall memories for this demo user.",
      action
    };
    event.send(400, JSON.stringify(response));
    return;
  }

  const demoKey = body.demoKey ? String(body.demoKey).trim() : undefined;

  const entityId = resolveHeroEntityId(event, demoKey);
  const now = Date.now();
  const memoryId = buildHeroMemoryId(entityId, now);
  let ingestResponse: Response;
  let queryResponse: Response;
  const response: HeroDemoResult = {
    ok: true,
    action,
    entityId,
    submittedText: message
  };

  if (action === "store") {
    const ingestStartedAt = Date.now();
    const parts = splitMessage(message);
    let totalUs = 0;
    let lastMemoryId = memoryId;
    let lastResponse: Response | null = null;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const partMemoryId = `${memoryId}-${i}`;
      const factKey = inferFactKey(part);
      const isFact = factKey !== undefined;

      try {
        lastResponse = await fetch(`${heroEngineBaseUrl(event)}/ingest`, {
          method: "POST",
          headers: heroRequestHeaders(event, true),
          body: JSON.stringify({
            entity_id: entityId,
            memory_id: partMemoryId,
            timestamp: now + i,
            textual_content: part,
            relations: [],
            kind: isFact ? "fact" : undefined,
            fact_key: factKey
          }),
          signal: AbortSignal.timeout(60_000)
        });
      } catch (error) {
        captureError(error, { action: "heroDemo", context: "ingestFetch" });
        const failed: HeroDemoResult = {
          ok: false,
          action,
          entityId,
          message:
            error instanceof Error
              ? `Ingest transport failed. ${error.message}`
              : "Ingest transport failed."
        };
        event.send(502, JSON.stringify(failed));
        return;
      }

      if (!lastResponse.ok) {
        const failed: HeroDemoResult = {
          ok: false,
          action,
          entityId,
          message: `Ingest failed (${lastResponse.status}). ${await lastResponse.text()}`
        };
        event.send(502, JSON.stringify(failed));
        return;
      }

      const ingestUs = readEngineTotalUs(lastResponse.headers);
      if (ingestUs !== null) {
        totalUs += ingestUs;
      }
      lastMemoryId = partMemoryId;
    }

    response.memoryId = lastMemoryId;
    response.ingestLabel = formatEngineMs(totalUs);
    response.ingestRoundTripLabel = formatRoundTripMs(ingestStartedAt);
    event.send(200, JSON.stringify(response));
    return;
  }

  const queryStartedAt = Date.now();

  try {
    queryResponse = await fetch(`${heroEngineBaseUrl(event)}/query/semantic`, {
      method: "POST",
      headers: heroRequestHeaders(event, true),
      body: JSON.stringify({
        entity_id: entityId,
        textual_query: message,
        limit: 4
      }),
      signal: AbortSignal.timeout(60_000)
    });
  } catch (error) {
    captureError(error, { action: "heroDemo", context: "queryFetch" });
    const failed: HeroDemoResult = {
      ok: false,
      action,
      entityId,
      message:
        error instanceof Error
          ? `Query transport failed. ${error.message}`
          : "Query transport failed."
    };
    event.send(502, JSON.stringify(failed));
    return;
  }

  if (!queryResponse.ok) {
    const failed: HeroDemoResult = {
      ok: false,
      action,
      entityId,
      message: `Query failed (${queryResponse.status}). ${await queryResponse.text()}`
    };
    event.send(502, JSON.stringify(failed));
    return;
  }

  let hits = (await queryResponse.json()) as HeroMemoryHit[];

  // Find observation block and compute latest timestamps per category
  const categoryLatestTs: Record<string, number> = {};
  const obsBlockIndex = hits.findIndex((hit) => hit.memory_id === "observation_block");

  if (obsBlockIndex !== -1) {
    const hit = hits[obsBlockIndex];
    const coreStateHeader = "### Core State\n";
    const idx = hit.textual_content.indexOf(coreStateHeader);
    if (idx !== -1) {
      const jsonStart = idx + coreStateHeader.length;
      const lines = hit.textual_content.slice(jsonStart).split("\n");
      const jsonStr = lines[0].trim();
      try {
        const coreState = JSON.parse(jsonStr);
        if (coreState && Array.isArray(coreState.facts)) {
          // Identify latest timestamps
          for (const fact of coreState.facts) {
            const key = inferFactKey(fact.text);
            if (key) {
              categoryLatestTs[key] = Math.max(categoryLatestTs[key] || 0, fact.timestamp_ms);
            }
          }

          // Filter facts
          coreState.facts = coreState.facts.filter((fact: any) => {
            const key = inferFactKey(fact.text);
            if (key && fact.timestamp_ms < categoryLatestTs[key]) {
              return false;
            }
            return true;
          });

          // Re-serialize
          const newJsonStr = JSON.stringify(coreState);
          const beforeJson = hit.textual_content.slice(0, jsonStart);
          const afterJson = lines.slice(1).join("\n");
          hit.textual_content = beforeJson + newJsonStr + "\n" + afterJson;
        }
      } catch (e: any) {
        captureError(e, { action: "heroDemo", context: "coreStateParse" });
      }
    }
  }

  // Filter hits (exclude stale facts)
  hits = hits.filter((hit) => {
    if (hit.memory_id === "observation_block") {
      return true;
    }
    const key = inferFactKey(hit.textual_content);
    if (key && categoryLatestTs[key]) {
      if (hit.created_at_ms < categoryLatestTs[key]) {
        return false;
      }
    }
    return true;
  });

  // Separate observation block from actual hits
  const obsIndex = hits.findIndex((hit) => hit.memory_id === "observation_block");
  let obsBlock: HeroMemoryHit | null = null;
  if (obsIndex !== -1) {
    obsBlock = hits.splice(obsIndex, 1)[0];
  }

  // Slice actual hits to 3
  const slicedActualHits = hits.slice(0, 3);

  // Combine them back: actual hits first, observation block at the end
  const finalHits = [...slicedActualHits];
  if (obsBlock) {
    finalHits.push(obsBlock);
  }

  const queryUs = readEngineTotalUs(queryResponse.headers);
  response.queryLabel = formatEngineMs(queryUs);
  response.queryRoundTripLabel = formatRoundTripMs(queryStartedAt);
  response.queryUnderBlink = queryUs != null && queryUs / 1000 < 100;
  response.hits = finalHits.map((hit) => ({
    ...hit,
    createdLabel: formatHeroTimestamp(hit.created_at_ms)
  }));

  event.send(200, JSON.stringify(response));
};

function splitMessage(message: string): string[] {
  const parts: string[] = [];
  const sentences = message.split(/[.!?]+/);
  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (!trimmed) continue;

    if (trimmed.toLowerCase().includes(" and ")) {
      const subParts = trimmed.split(/\s+and\s+/i);
      for (const sub of subParts) {
        const subTrimmed = sub.trim();
        if (subTrimmed.length > 5) {
          parts.push(subTrimmed);
        }
      }
    } else if (trimmed.toLowerCase().includes(" but ")) {
      const subParts = trimmed.split(/\s+but\s+/i);
      for (const sub of subParts) {
        const subTrimmed = sub.trim();
        if (subTrimmed.length > 5) {
          parts.push(subTrimmed);
        }
      }
    } else {
      parts.push(trimmed);
    }
  }
  return parts.length > 0 ? parts : [message];
}

function inferFactKey(text: string): string | undefined {
  const lower = text.toLowerCase();
  if (/moved|live|living|reside|residence|tokyo|lahore|city|location|place/i.test(lower)) {
    return "residence";
  }
  if (/prefer|tea|coffee|drink|beverage|jasmine|espresso/i.test(lower)) {
    return "beverage_preference";
  }
  return undefined;
}
