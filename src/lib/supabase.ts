import { createClient } from "@supabase/supabase-js";
import type { RequestEventCommon } from "@builder.io/qwik-city";

export function getSupabaseClient() {
  const url = import.meta.env.PUBLIC_SUPABASE_URL;
  const key = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.error(
      "Missing Supabase credentials in environment.\n"
      + "  PUBLIC_SUPABASE_URL: " + (url ? "✓" : "✗") + "\n"
      + "  PUBLIC_SUPABASE_ANON_KEY: " + (key ? "✓" : "✗")
    );
    return null;
  }

  return createClient(url, key);
}

export function getAdminSupabaseClient(env: RequestEventCommon["env"]) {
  const url = import.meta.env.PUBLIC_SUPABASE_URL;
  const adminKey = env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !adminKey) {
    console.error(
      "Missing Supabase admin credentials in environment.\n"
      + "  PUBLIC_SUPABASE_URL: " + (url ? "✓" : "✗") + "\n"
      + "  SUPABASE_SERVICE_ROLE_KEY: " + (adminKey ? "✓" : "✗")
    );
    return null;
  }

  return createClient(url, adminKey);
}
