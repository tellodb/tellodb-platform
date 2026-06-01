import { type RequestHandler } from "@builder.io/qwik-city";

export const onRequest: RequestHandler = (event) => {
  const search = event.url.search;
  throw event.redirect(302, `/platform?tab=settings${search}`);
};
