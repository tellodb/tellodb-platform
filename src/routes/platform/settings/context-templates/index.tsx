import { type RequestHandler } from "@builder.io/qwik-city";

export const onRequest: RequestHandler = (event) => {
  throw event.redirect(302, "/platform?tab=settings");
};
