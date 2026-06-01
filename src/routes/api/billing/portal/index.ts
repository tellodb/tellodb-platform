import type { RequestHandler } from "@builder.io/qwik-city";
import { getCurrentUser } from "~/lib/auth";
import { createPortalSession } from "~/lib/stripe";
import { getAdminSupabaseClient } from "~/lib/supabase";
import { captureError } from "~/lib/sentry";

export const onPost: RequestHandler = async (event) => {
  const user = getCurrentUser(event.cookie);
  if (!user) throw event.error(401, "Unauthorized");

  try {
    const supabase = getAdminSupabaseClient(event.env);
    if (!supabase) throw new Error("Database connection offline");
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.user_id)
      .single();

    if (!sub?.stripe_customer_id) throw new Error("No subscription found");

    const origin = event.url.origin;
    const session = await createPortalSession(event.env, sub.stripe_customer_id, `${origin}/platform/billing`);
    throw event.redirect(302, session.url!);
  } catch (e: any) {
    if (!(e instanceof Error)) throw e;
    const errMsg = e.message || "(no message)";
    captureError(e, { action: "billingPortal" });
    console.error("[BillingPortal] Error:", errMsg);
    throw event.error(500, errMsg);
  }
};
