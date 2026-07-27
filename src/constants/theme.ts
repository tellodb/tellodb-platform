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
    href: "https://fonts.googleapis.com/css2?family=Onest:wght@400;500;600;700;800&display=swap",
  },
];

export const commonHeadScripts: Array<{
  key: string;
  props?: Record<string, string | boolean>;
  script?: string;
}> = [];
