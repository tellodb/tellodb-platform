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
    <main class="flex min-h-[calc(100vh-104px)] w-full flex-col md:flex-row bg-background text-on-surface font-body antialiased overflow-x-hidden">
      {/* Brand Side */}
      <div class="relative hidden flex-col justify-between overflow-hidden bg-surface-container-lowest p-12 md:flex md:w-1/2">
        <div class="absolute right-0 top-0 h-96 w-96 translate-x-1/2 -translate-y-1/2 rounded-full bg-secondary/10 blur-[120px]"></div>
        <div class="absolute bottom-0 left-0 h-80 w-80 -translate-x-1/2 translate-y-1/2 rounded-full bg-primary/10 blur-[100px]"></div>


        <div class="relative z-10 max-w-lg">
          <h1 class="mb-6 text-5xl font-extrabold leading-tight tracking-tight">
            Create your <br />
            <span class="italic text-primary">Identity</span> in the Graph.
          </h1>
          <p class="text-lg leading-relaxed text-tertiary">
            Join the decentralized truth layer and start building persistent, secure memory for your agents.
          </p>
        </div>

        <div class="relative z-10">
          <div class="font-mono text-[10px] uppercase tracking-widest text-outline-variant">System Status: Nominal</div>
        </div>
      </div>

      {/* Signup Form Side */}
      <div class="relative flex flex-1 flex-col items-center justify-center bg-surface p-6 md:p-24">
        <div class="w-full max-w-md">
          <div class="mb-10 text-center">
            <h2 class="mb-4 text-3xl font-bold tracking-tight text-on-surface">Under Development</h2>
            <p class="text-tertiary text-lg">
              The TelloDB platform is currently under active development and new signups are temporarily disabled.
              <br/><br/>
              Stay tuned for updates! We are working hard to bring you the best experience.
            </p>
            <div class="mt-8">
              <Link href="/" class="rounded-lg bg-primary px-6 py-3 text-sm font-bold text-on-primary transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-primary/20">
                Return Home
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
});

export const head: DocumentHead = buildSeoHead({
  title: "Sign Up | TelloDB",
  description: "Create your TelloDB account.",
  pathname: "/signup",
  noindex: true
});
