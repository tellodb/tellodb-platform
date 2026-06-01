import type { RequestHandler } from "@builder.io/qwik-city";

export const onPost: RequestHandler = async ({ request, send }) => {
  const body = await request.text();
  const res = await fetch(
    `https://${new URL(import.meta.env.PUBLIC_SENTRY_DSN || "").host}/api/${(import.meta.env.PUBLIC_SENTRY_DSN || "").split("/").pop()}/envelope/`,
    {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body,
    }
  );
  send(new Response(await res.text(), { status: res.status, headers: { "Content-Type": "text/plain" } }));
};
