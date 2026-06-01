import type { RequestEventCommon } from "@builder.io/qwik-city";
import { getAdminSupabaseClient } from "./supabase";
import { getCurrentUser } from "./auth";
import { captureError } from "./sentry";

export interface SubscriptionInfo {
  id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  tier: string;
  status: string;
  token_balance?: number;
  free_tokens_granted_at?: string;
  current_period_start: string | null;
  current_period_end: string | null;
}

export async function getSubscription(event: RequestEventCommon): Promise<SubscriptionInfo | null> {
  const user = getCurrentUser(event.cookie);
  if (!user) return null;
  const supabase = getAdminSupabaseClient(event.env);
  if (!supabase) return null;
  try {
    const { data } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", user.user_id)
      .single();
    return data as any;
  } catch (e) {
    captureError(e, { action: "getSubscription" });
    return null;
  }
}

export async function upsertSubscription(
  env: RequestEventCommon["env"],
  userId: string,
  info: {
    stripe_customer_id?: string;
    stripe_subscription_id?: string;
    stripe_price_id?: string;
    tier: string;
    status: string;
    current_period_start?: string;
    current_period_end?: string;
    vm_size?: string;
    vm_monthly_price?: number;
    storage_gb?: number;
  }
) {
  const supabase = getAdminSupabaseClient(env);
  if (!supabase) throw new Error("Database connection offline");
  try {
    const { data: existing } = await supabase
      .from("subscriptions")
      .select("id")
      .eq("user_id", userId)
      .single();
    if (existing) {
      await supabase.from("subscriptions").update({ ...info, updated_at: new Date().toISOString() }).eq("id", existing.id);
    } else {
      await supabase.from("subscriptions").insert({ user_id: userId, ...info });
    }
  } catch (e) {
    captureError(e, { action: "upsertSubscription", userId });
    throw e;
  }
}
