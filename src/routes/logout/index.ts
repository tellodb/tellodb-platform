import type { RequestHandler } from "@builder.io/qwik-city";

import { clearSession } from "~/lib/auth";
import { setPrivateNoStore } from "~/lib/cache";

export const onPost: RequestHandler = (event) => {
  setPrivateNoStore(event);
  clearSession(event.cookie);
  throw event.redirect(302, "/");
};
