import type { RequestHandler } from "@builder.io/qwik-city";
import { getTeamMembers, inviteMember } from "~/lib/team";
import { getCurrentUser } from "~/lib/auth";
import { captureError } from "~/lib/sentry";

export const onGet: RequestHandler = async (event) => {
  const user = getCurrentUser(event.cookie);
  if (!user) throw event.error(401, "Unauthorized");
  try {
    const members = await getTeamMembers(event);
    event.json(200, members);
  } catch (e: any) {
    if (e?.headers?.location) throw e;
    captureError(e, { action: "teamGet" });
    throw e;
  }
};

export const onPost: RequestHandler = async (event) => {
  const user = getCurrentUser(event.cookie);
  if (!user) throw event.error(401, "Unauthorized");
  try {
    const body = await event.parseBody<{ email?: string; role?: string }>();
    if (!body?.email) throw event.error(400, "Email required");
    const ok = await inviteMember(event, body.email, body.role || "member");
    if (!ok) throw event.error(403, "Cannot invite");
    event.json(200, { success: true });
  } catch (e: any) {
    if (e?.headers?.location) throw e;
    captureError(e, { action: "teamPost" });
    throw e;
  }
};
