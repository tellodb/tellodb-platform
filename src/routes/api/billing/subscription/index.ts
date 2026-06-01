import type { RequestHandler } from "@builder.io/qwik-city";
import { getSubscription } from "~/lib/subscriptions";
import { getCurrentUser } from "~/lib/auth";

export const onGet: RequestHandler = async (event) => {
  const user = getCurrentUser(event.cookie);
  if (!user) throw event.error(401, "Unauthorized");

  const sub = await getSubscription(event);
  event.json(200, sub || { tier: "fractional", status: "none" });
};
