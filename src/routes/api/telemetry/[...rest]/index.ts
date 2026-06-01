import type { RequestHandler } from "@builder.io/qwik-city";

const POSTHOG_HOST = "https://us.i.posthog.com";

export const onRequest: RequestHandler = async ({ request, params, url, send }) => {
  const restPath = params.rest || "";
  const targetUrl = `${POSTHOG_HOST}/${restPath}${url.search}`;

  const forwardedHeaders: Record<string, string> = {
    "User-Agent": "tellodb-posthog-proxy",
  };

  const ct = request.headers.get("Content-Type");
  if (ct) forwardedHeaders["Content-Type"] = ct;

  const body = request.method !== "GET" && request.method !== "HEAD"
    ? new Uint8Array(await request.arrayBuffer())
    : undefined;

  const res = await fetch(targetUrl, {
    method: request.method,
    headers: forwardedHeaders,
    body,
  });

  send(new Response(res.body, {
    status: res.status,
    headers: { "Content-Type": res.headers.get("Content-Type") || "text/plain" }
  }));
};
