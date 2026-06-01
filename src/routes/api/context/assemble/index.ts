import type { RequestHandler } from "@builder.io/qwik-city";
import { getCurrentUser } from "~/lib/auth";
import { getAdminSupabaseClient } from "~/lib/supabase";
import { assembleContext } from "~/lib/context-templates";
import { captureError } from "~/lib/sentry";

export const onPost: RequestHandler = async (event) => {
  const user = getCurrentUser(event.cookie);
  if (!user) throw event.error(401, "Unauthorized");

  try {
    const body = await event.parseBody<{ cluster_id?: string; template_id?: string; template?: string; query?: string }>();
    const clusterId = body?.cluster_id;
    if (!clusterId) throw event.error(400, "cluster_id required");

    const supabase = getAdminSupabaseClient(event.env);
    const { data: cluster } = await supabase.from("clusters").select("user_id").eq("id", clusterId).single();
    if (!cluster || cluster.user_id !== user.user_id) throw event.error(403, "Forbidden");

    let template = body?.template || "";

    if (body?.template_id) {
      const { data: tmpl } = await supabase.from("context_templates").select("template").eq("id", body.template_id).single();
      if (tmpl) template = (tmpl as any).template;
    }

    if (!template) throw event.error(400, "template or template_id required");

    const result = await assembleContext(template, { clusterId, query: body?.query, event });
    event.json(200, { context: result });
  } catch (e: any) {
    if (e?.headers?.location) throw e;
    captureError(e, { action: "contextAssemble" });
    throw e;
  }
};
