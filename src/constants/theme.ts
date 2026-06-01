export const commonHeadLinks: Array<{
  rel: string;
  href: string;
  crossOrigin?: "anonymous" | "";
}> = [
  {
    rel: "preconnect",
    href: "https://fonts.googleapis.com",
  },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;1,100;1,200;1,300;1,400;1,500;1,600;1,700&display=swap",
  },
];

export const commonHeadScripts: Array<{
  key: string;
  props?: Record<string, string | boolean>;
  script?: string;
}> = [];
