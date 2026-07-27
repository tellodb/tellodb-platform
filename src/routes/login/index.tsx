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
  loginUser,
  isAuthenticated
} from "~/lib/auth";
import { setPrivateNoStore } from "~/lib/cache";
import { buildSeoHead } from "~/lib/seo";
import { captureError } from "~/lib/sentry";
import { capture, captureServer } from "~/lib/posthog";

export const useLoginAction = routeAction$(async (data, event) => {
  const email = String(data.email ?? "").trim();
  const password = String(data.password ?? "");

  if (!email || !password) {
    return event.fail(400, {
      message: "Email and password are required."
    });
  }

  let result;
  try {
    result = await loginUser(event, email, password);
  } catch (e) {
    captureError(e, { page: "login" });
    return event.fail(500, {
      message: "An unexpected error occurred. Please try again."
    });
  }

  if (!result.ok) {
    return event.fail(401, {
      message: result.message || "Invalid credentials."
    });
  }

  const userId = event.cookie.get("tellodb_user_id")?.value;
  if (userId) {
    await captureServer("user_login", userId, { method: "password" });
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
  const loginAction = useLoginAction();

  useTask$(({ track }) => {
    const result = track(() => loginAction.value);
    if (result?.message) {
      capture("user_login_failed", { reason: result.message });
    }
  });

  return (
    <main class="auth-shell">
      <section class="auth-brand-panel">
        <Link href="/" class="auth-brand-link">
          <img src="/tellodb-mark-64.png" alt="" width={48} height={48} />
          <span>TelloDB</span>
        </Link>
        <div class="auth-brand-copy">
          <h1>Your agents can pick up where they left off.</h1>
          <p>
            One memory layer for user facts, preferences, relationships, and
            the history behind every answer.
          </p>
        </div>
        <div class="auth-memory-note">
          <span>Current fact</span>
          <strong>Platform access is in private beta.</strong>
        </div>
      </section>

      <section class="auth-action-panel">
        <div class="auth-action-card">
          <p class="auth-kicker">Platform access</p>
          <h2>Sign-in is temporarily limited.</h2>
          <p>
            Existing pilot customers can continue using their direct access
            links. Public account access will reopen after the current platform
            release.
          </p>
          <div class="auth-actions">
            <a href="mailto:sharjeel@tellodb.com" class="auth-primary-action">
              Request access
            </a>
            <Link href="/" class="auth-secondary-action">
              Return home
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
});

export const head: DocumentHead = buildSeoHead({
  title: "Log In | TelloDB",
  description: "Sign in to the TelloDB platform.",
  pathname: "/login",
  noindex: true
});
