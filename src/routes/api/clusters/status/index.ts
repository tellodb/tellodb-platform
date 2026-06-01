import type { RequestHandler } from "@builder.io/qwik-city";
import { getCurrentUser } from "~/lib/auth";
import { getAdminSupabaseClient } from "~/lib/supabase";
import { captureError } from "~/lib/sentry";

export const onGet: RequestHandler = async (event) => {
  const user = getCurrentUser(event.cookie);
  if (!user) throw event.error(401, "Unauthorized");

  try {
    const supabase = getAdminSupabaseClient(event.env);
    const { data: clusters } = await supabase
      .from("clusters")
      .select("id, status, endpoint_url, tier")
      .eq("user_id", user.user_id)
      .neq("status", "deleted");

    event.json(200, clusters || []);
  } catch (e: any) {
    if (e?.headers?.location) throw e;
    captureError(e, { action: "clustersStatus" });
    throw e;
  }
};
