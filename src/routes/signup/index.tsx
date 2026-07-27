import { component$, useTask$ } from "@builder.io/qwik";
import {
  Form,
  routeAction$,
  routeLoader$,
  type RequestHandler,
  type DocumentHead,
  Link
} from "@builder.io/qwik-city";
import { Loader2Icon } from "lucide-qwik";

import {
  signupUser,
  isAuthenticated
} from "~/lib/auth";
import { setPrivateNoStore } from "~/lib/cache";
import { buildSeoHead } from "~/lib/seo";
import { captureError } from "~/lib/sentry";
import { capture, captureServer } from "~/lib/posthog";

export const useSignupAction = routeAction$(async (data, event) => {
  const email = String(data.email ?? "").trim();
  const displayName = String(data.display_name ?? "").trim();
  const password = String(data.password ?? "");

  if (!email || !password) {
    return event.fail(400, {
      message: "Email and password are required."
    });
  }

  if (password.length < 8) {
    return event.fail(400, {
      message: "Password must be at least 8 characters long."
    });
  }

  let result;
  try {
    result = await signupUser(event, email, password, displayName || undefined);
  } catch (e) {
    captureError(e, { page: "signup" });
    return event.fail(500, {
      message: "An unexpected error occurred. Please try again."
    });
  }

  if (!result.ok) {
    return event.fail(400, {
      message: result.message || "Failed to create account."
    });
  }

  const userId = event.cookie.get("tellodb_user_id")?.value;
  if (userId) {
    await captureServer("user_signup_completed", userId);
  }

  throw event.redirect(302, "/platform");
});

export const useAuthGuard = routeLoader$((event) => {
  const authenticated = isAuthenticated(event.cookie);
  if (authenticated) {
    throw event.redirect(302, "/platform");
  }
});

export const onRequest: RequestHandler = (event) => {
  setPrivateNoStore(event);
};

export default component$(() => {
  useAuthGuard();
  const signupAction = useSignupAction();

  useTask$(({ track }) => {
    const result = track(() => signupAction.value);
    if (result?.message) {
      capture("user_signup_failed", { reason: result.message });
    }
  });

  return (
    <main class="auth-shell">
      <section class="auth-brand-panel auth-brand-panel-coral">
        <Link href="/" class="auth-brand-link">
          <img src="/tellodb-mark-64.png" alt="" width={48} height={48} />
          <span>TelloDB</span>
        </Link>
        <div class="auth-brand-copy">
          <h1>Build with memory from the first conversation.</h1>
          <p>
            Start on the shared engine, then move to dedicated infrastructure
            when your workload needs it.
          </p>
        </div>
        <div class="auth-memory-note">
          <span>Deployment paths</span>
          <strong>Managed cloud · dedicated VM · self-hosted</strong>
        </div>
      </section>

      <section class="auth-action-panel">
        <div class="auth-action-card">
          <p class="auth-kicker">Private beta</p>
          <h2>New accounts are opening in batches.</h2>
          <p>
            Tell us what you are building and we will send access when the next
            pilot cohort opens.
          </p>
          <div class="auth-actions">
            <a href="mailto:sharjeel@tellodb.com?subject=TelloDB%20beta%20access" class="auth-primary-action">
              Join the beta
            </a>
            <Link href="/docs/quickstart" class="auth-secondary-action">
              Explore the docs
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
});

export const head: DocumentHead = buildSeoHead({
  title: "Sign Up | TelloDB",
  description: "Create your TelloDB account.",
  pathname: "/signup",
  noindex: true
});
