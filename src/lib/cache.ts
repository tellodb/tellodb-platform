import type { RequestEventCommon } from "@builder.io/qwik-city";

const PUBLIC_EDGE_CACHE = {
  public: true,
  maxAge: 0,
  sMaxAge: 300,
  staleWhileRevalidate: 86400
} as const;

const PRIVATE_NO_STORE = {
  private: true,
  noStore: true
} as const;

export function setPublicEdgeCache(event: RequestEventCommon) {
  event.cacheControl(PUBLIC_EDGE_CACHE);
  event.cacheControl(PUBLIC_EDGE_CACHE, "Vercel-CDN-Cache-Control");
}

export function setPrivateNoStore(event: RequestEventCommon) {
  event.cacheControl(PRIVATE_NO_STORE);
  event.cacheControl(PRIVATE_NO_STORE, "Vercel-CDN-Cache-Control");
}
