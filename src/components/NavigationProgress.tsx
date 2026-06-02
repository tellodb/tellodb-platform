import { component$, useSignal, useVisibleTask$ } from "@builder.io/qwik";
import { useLocation } from "@builder.io/qwik-city";

export const NavigationProgress = component$(() => {
  const loc = useLocation();
  const loading = useSignal(false);
  const prevPath = useSignal(loc.url.pathname);

  useVisibleTask$(({ track }) => {
    track(() => loc.url.pathname);

    if (prevPath.value !== loc.url.pathname) {
      prevPath.value = loc.url.pathname;
      loading.value = false;
    }
  });

  useVisibleTask$(() => {
    const handler = (e: MouseEvent) => {
      const link = (e.target as HTMLElement).closest("a");
      if (!link) return;
      const href = link.getAttribute("href");
      if (!href || href.startsWith("http") || href.startsWith("#") || href.startsWith("mailto:")) return;
      loading.value = true;
    };

    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  });

  return (
    <div class="fixed top-16 left-0 z-50 w-full h-[2px]">
      <div
        class="h-full bg-gradient-to-r from-primary via-secondary to-primary transition-all duration-300 ease-out"
        style={{
          width: loading.value ? "100%" : "0%",
          opacity: loading.value ? 1 : 0,
          transition: loading.value
            ? "width 30s cubic-bezier(0.1, 0.8, 0.3, 1), opacity 0.15s"
            : "width 0.2s ease-in, opacity 0.3s 0.1s",
          boxShadow: loading.value ? "0 0 12px rgba(155, 156, 255, 0.6)" : "none",
        }}
      />
    </div>
  );
});
