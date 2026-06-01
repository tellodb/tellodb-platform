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
    <main class="flex min-h-[calc(100vh-104px)] w-full flex-col md:flex-row bg-background text-on-surface font-body antialiased overflow-x-hidden">
      {/* Brand Side */}
      <div class="relative hidden flex-col justify-between overflow-hidden bg-surface-container-lowest p-12 md:flex md:w-1/2">
        <div class="absolute right-0 top-0 h-96 w-96 translate-x-1/2 -translate-y-1/2 rounded-full bg-secondary/10 blur-[120px]"></div>
        <div class="absolute bottom-0 left-0 h-80 w-80 -translate-x-1/2 translate-y-1/2 rounded-full bg-primary/10 blur-[100px]"></div>


        <div class="relative z-10 max-w-lg">
          <h1 class="mb-6 text-5xl font-extrabold leading-tight tracking-tight">
            Step into the <br />
            <span class="italic text-primary">Intelligence</span> Epoch.
          </h1>
          <p class="text-lg leading-relaxed text-tertiary">
            Access the most advanced neural engine designed for security, precision, and sentient-grade interaction.
          </p>
        </div>

        <div class="relative z-10">
          <div class="font-mono text-[10px] uppercase tracking-widest text-outline-variant">System Status: Nominal</div>
        </div>
      </div>

      {/* Login Form Side */}
      <div class="relative flex flex-1 flex-col items-center justify-center bg-surface p-6 md:p-24">
        <div class="w-full max-w-md">
          <div class="mb-10">
            <h2 class="mb-2 text-3xl font-bold tracking-tight text-on-surface">Welcome Back</h2>
            <p class="text-tertiary">Access your persistent memory console.</p>
          </div>

          <Form action={loginAction} class="space-y-6">
            <div class="space-y-1">
              <label class="text-[10px] font-bold uppercase tracking-widest text-tertiary" for="email">Email</label>
              <input
                id="email"
                name="email"
                type="email"
                class="w-full rounded-lg border border-outline-variant/20 bg-surface-container-highest px-4 py-3 text-on-surface outline-none focus:border-primary transition-colors"
                placeholder="you@example.com"
                required
              />
            </div>

            <div class="space-y-1">
              <label class="text-[10px] font-bold uppercase tracking-widest text-tertiary" for="password">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                class="w-full rounded-lg border border-outline-variant/20 bg-surface-container-highest px-4 py-3 text-on-surface outline-none focus:border-primary transition-colors"
                placeholder="••••••••"
                required
              />
            </div>

            {loginAction.value?.message && (
              <p class="text-sm text-red-400">{loginAction.value.message}</p>
            )}

            <button
              type="submit"
              disabled={loginAction.isRunning}
              class="w-full rounded-lg bg-primary py-4 font-bold text-on-primary shadow-xl shadow-primary/20 transition-all hover:scale-[1.01] active:scale-[0.98] disabled:opacity-70 disabled:grayscale disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loginAction.isRunning ? (
                <>
                  <Loader2Icon class="w-5 h-5 animate-spin" />
                  Signing In...
                </>
              ) : (
                "Sign In"
              )}
            </button>
          </Form>

          <p class="mt-8 text-center text-sm text-tertiary">
            Don't have an account?
            <Link href="/signup" class="ml-1 text-primary font-bold hover:underline">Create one</Link>
          </p>
        </div>
      </div>
    </main>
  );
});

export const head: DocumentHead = buildSeoHead({
  title: "Log In | TELLODB",
  description: "Sign in to the Tellodb platform.",
  pathname: "/login",
  noindex: true
});
