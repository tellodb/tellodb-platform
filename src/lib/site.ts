export const SITE_NAME = "TelloDB";
export const SITE_ORIGIN = "https://tellodb.com";
export const DEFAULT_SOCIAL_IMAGE = "/screen.png";
export const DEFAULT_SOCIAL_IMAGE_ALT =
  "TelloDB dashboard and marketing experience";

function normalizePath(pathname: string): string {
  if (!pathname || pathname === "/") {
    return "/";
  }

  const withLeadingSlash = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return withLeadingSlash.endsWith("/")
    ? withLeadingSlash.slice(0, -1)
    : withLeadingSlash;
}

export function absoluteUrl(pathname: string): string {
  return new URL(normalizePath(pathname), SITE_ORIGIN).toString();
}

export function absoluteAssetUrl(pathname: string): string {
  if (/^https?:\/\//.test(pathname)) {
    return pathname;
  }

  const normalized = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return new URL(normalized, SITE_ORIGIN).toString();
}
