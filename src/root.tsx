import { component$, useVisibleTask$ } from "@builder.io/qwik";
import {
  QwikCityProvider,
  RouterOutlet
} from "@builder.io/qwik-city";
import { inject } from "@vercel/analytics";
import { FlowbiteProvider, FlowbiteProviderHeader } from "flowbite-qwik";

import { RouterHead } from "./components/router-head/router-head";
import { commonHeadLinks, commonHeadScripts } from "./constants/theme";
import { NavigationProgress } from "./components/NavigationProgress";
import { initPostHog } from "./lib/posthog";
import "./global.css";

const SENTRY_DSN = import.meta.env.PUBLIC_SENTRY_DSN || "";

function sendToSentry(error: Error | string, extra?: Record<string, unknown>) {
  if (!SENTRY_DSN) return;
  const err = error instanceof Error ? error : new Error(String(error));
  const payload = {
    event_id: crypto.randomUUID().replace(/-/g, "").slice(0, 32),
    timestamp: Date.now() / 1000,
    level: "error",
    platform: "javascript",
    exception: { values: [{ type: err.name, value: err.message }] },
    extra: extra || {},
    tags: { environment: import.meta.env.PROD ? "production" : "development" },
  };
  const body =
    JSON.stringify({ event_id: payload.event_id, sent_at: new Date().toISOString(), dsn: SENTRY_DSN }) +
    "\n" +
    JSON.stringify({ type: "event", content_type: "application/json", length: JSON.stringify(payload).length }) +
    "\n" +
    JSON.stringify(payload);
  navigator.sendBeacon("/api/sentry", new Blob([body], { type: "text/plain" }));
}

export default component$(() => {
  useVisibleTask$(() => {
    inject({ framework: "qwik" });
    initPostHog();

    window.addEventListener("error", (e) => {
      sendToSentry(e.error || e.message, { source: "onerror", filename: e.filename, lineno: e.lineno });
    });
    window.addEventListener("unhandledrejection", (e) => {
      sendToSentry(e.reason, { source: "unhandledrejection" });
    });
  });

  return (
    <QwikCityProvider>
      <head>
        <meta charSet="utf-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
        <meta name="theme-color" content="#101117" />
        <link rel="icon" href="/icon.png" type="image/png" />
        <link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32" />
        <link rel="icon" href="/icon-64.png" type="image/png" sizes="64x64" />
        <link rel="icon" href="/icon-192.png" type="image/png" sizes="192x192" />
        <link rel="shortcut icon" href="/icon.png" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        {commonHeadLinks.map((link) => (
          <link key={`global-link-${link.rel}-${link.href}`} {...link} />
        ))}
        {commonHeadScripts.map((script) => {
          const { key, props, script: content } = script;
          return (
            <script
              key={`global-script-${key}`}
              {...props}
              dangerouslySetInnerHTML={content}
            />
          );
        })}
        <RouterHead />
        <FlowbiteProviderHeader />
      </head>
      <body lang="en">
        <FlowbiteProvider toastPosition="top-right" theme="purple">
          <RouterOutlet />
          <NavigationProgress />
        </FlowbiteProvider>
      </body>
    </QwikCityProvider>
  );
});
