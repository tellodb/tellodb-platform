import type { RequestEventCommon } from "@builder.io/qwik-city";
import { getAdminSupabaseClient } from "./supabase";
import { captureError } from "./sentry";

export const PLAN_RATE_LIMITS: Record<string, { rpm: number; daily: number }> = {
  free: { rpm: 60, daily: 10_000 },
  fractional: { rpm: 60, daily: 10_000 },
  pro: { rpm: 300, daily: 100_000 },
  dedicated_l4: { rpm: 300, daily: 100_000 },
  enterprise: { rpm: Infinity, daily: Infinity },
};

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfter: number;
  dailyRemaining: number;
}

const cache = new Map<string, { count: number; resetAt: number; daily: number; dailyResetAt: number }>();

export async function checkRateLimit(env: RequestEventCommon["env"], clusterId: string, tier: string): Promise<RateLimitResult> {
  const limits = PLAN_RATE_LIMITS[tier] || PLAN_RATE_LIMITS.free;
  const now = Date.now();

  let entry = cache.get(clusterId);
  const windowMs = 60_000;
  const dayMs = 86_400_000;

  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + windowMs, daily: 0, dailyResetAt: now + dayMs };
  }
  if (now > entry.dailyResetAt) {
    entry.daily = 0;
    entry.dailyResetAt = now + dayMs;
  }

  entry.count++;
  entry.daily++;

  cache.set(clusterId, entry);

  // Also persist to Supabase periodically (every 10th request)
  if (entry.count % 10 === 0 || entry.count === 1) {
    try {
      const supabase = getAdminSupabaseClient(env);
      await supabase.from("rate_limits").upsert({
        cluster_id: clusterId,
        rpm_used: entry.count,
        rpm_reset_at: new Date(entry.resetAt).toISOString(),
        daily_used: entry.daily,
        daily_reset_at: new Date(entry.dailyResetAt).toISOString(),
      });
    } catch (e) {
      captureError(e, { action: "rateLimitPersist", clusterId });
    }
  }

  return {
    allowed: entry.count <= limits.rpm && entry.daily <= limits.daily,
    remaining: Math.max(0, limits.rpm - entry.count),
    retryAfter: Math.max(0, Math.ceil((entry.resetAt - now) / 1000)),
    dailyRemaining: Math.max(0, limits.daily - entry.daily),
  };
}
