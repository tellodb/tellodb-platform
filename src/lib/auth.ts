import type { RequestEventCommon } from "@builder.io/qwik-city";
import { getSupabaseClient } from "./supabase";
import { captureError } from "./sentry";

type CookieStore = RequestEventCommon["cookie"];

const SESSION_COOKIE = "tellodb_session";
const USER_ID_COOKIE = "tellodb_user_id";
const USERNAME_COOKIE = "tellodb_username";

const cookieBase = {
  path: "/",
  httpOnly: true,
  sameSite: "lax" as const,
  secure: import.meta.env.PROD,
  maxAge: 60 * 60 * 24 * 30
};

export interface AuthUser {
  user_id: string;
  username: string;
}

export async function loginUser(
  event: RequestEventCommon,
  email: string,
  password: string
): Promise<{ ok: boolean; message?: string }> {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return { ok: false, message: "Supabase not configured. Check PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY are set." };

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      if (error.message.includes("Email not confirmed") || error.message.includes("email_not_confirmed")) {
        return { ok: false, message: "Email not confirmed. Check your inbox (and spam) for the confirmation link." };
      }
      if (error.message.includes("Invalid login credentials")) {
        return { ok: false, message: "Invalid email or password." };
      }
      return { ok: false, message: error.message };
    }

    if (!data.user || !data.session) {
      return { ok: false, message: "Login succeeded but no session was created. Try again." };
    }

    const displayName = data.user.user_metadata?.display_name || email.split("@")[0];
    event.cookie.set(SESSION_COOKIE, data.session.access_token, cookieBase);
    event.cookie.set(USER_ID_COOKIE, data.user.id, cookieBase);
    event.cookie.set(USERNAME_COOKIE, displayName, cookieBase);
    return { ok: true };
  } catch (e: any) {
    captureError(e, { action: "loginUser", email });
    console.error("loginUser error:", e);
    return { ok: false, message: e?.message || "Could not connect to authentication server. Check your network or Supabase project URL." };
  }
}

export async function signupUser(
  event: RequestEventCommon,
  email: string,
  password: string,
  displayName?: string
): Promise<{ ok: boolean; message?: string }> {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return { ok: false, message: "Supabase not configured. Check PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY are set." };

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName || email.split("@")[0] }
      }
    });

    if (error) {
      if (error.message.includes("User already registered")) {
        return { ok: false, message: "An account with this email already exists. Try logging in instead." };
      }
      return { ok: false, message: error.message };
    }

    if (data.session) {
      const name = displayName || email.split("@")[0];
      event.cookie.set(SESSION_COOKIE, data.session.access_token, cookieBase);
      event.cookie.set(USER_ID_COOKIE, data.user!.id, cookieBase);
      event.cookie.set(USERNAME_COOKIE, name, cookieBase);
      return { ok: true };
    }

    return {
      ok: false,
      message: "Account created! Check your email (and spam) for a confirmation link before logging in."
        + " To disable this, go to Supabase Dashboard → Authentication → Settings → disable 'Enable email confirmations'."
    };
  } catch (e: any) {
    captureError(e, { action: "signupUser", email });
    console.error("signupUser error:", e);
    return { ok: false, message: e?.message || "Could not connect to authentication server. Check your network or Supabase project URL." };
  }
}

export function clearSession(cookie: CookieStore) {
  cookie.delete(SESSION_COOKIE, { path: "/" });
  cookie.delete(USER_ID_COOKIE, { path: "/" });
  cookie.delete(USERNAME_COOKIE, { path: "/" });
}

export function isAuthenticated(cookie: CookieStore) {
  return !!getCurrentUser(cookie);
}

export function getCurrentUser(cookie: CookieStore): AuthUser | null {
  const session = cookie.get(SESSION_COOKIE)?.value;
  const user_id = cookie.get(USER_ID_COOKIE)?.value;
  const username = cookie.get(USERNAME_COOKIE)?.value;

  if (!session || !user_id || !username) return null;

  return { user_id, username };
}

export function requireAuth(event: RequestEventCommon) {
  const user = getCurrentUser(event.cookie);
  if (!user) {
    throw event.redirect(302, "/login");
  }
  return user;
}
