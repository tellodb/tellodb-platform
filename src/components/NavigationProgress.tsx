import { component$ } from "@builder.io/qwik";
import { useLocation } from "@builder.io/qwik-city";

export const NavigationProgress = component$(() => {
  const location = useLocation();

  return (
    <div
      aria-hidden="true"
      class={`navigation-progress${location.isNavigating ? " navigation-progress-active" : ""}`}
    >
      <div class="navigation-progress-indicator" />
    </div>
  );
});
