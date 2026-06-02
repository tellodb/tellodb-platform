import { component$, useSignal } from "@builder.io/qwik";
import { Link, useLocation } from "@builder.io/qwik-city";
import type { AuthUser } from "~/lib/auth";
import { LayoutDashboardIcon, LogOutIcon, MenuIcon, XIcon } from "lucide-qwik";

export interface HeaderProps {
  user?: AuthUser | null;
}

export const Header = component$((props: HeaderProps) => {
  const location = useLocation();
  const pathname = location.url.pathname;
  const mobileOpen = useSignal(false);

  const isDocs = pathname.startsWith("/docs");
  const isBlog = pathname.startsWith("/blog");

  return (
    <header class="app-topbar fixed top-0 z-50 w-full font-body text-sm tracking-tight shadow-[0px_24px_48px_rgba(0,0,0,0.8)] antialiased">
      <div class="flex h-16 w-full items-center justify-between px-4 md:px-6">
        <div class="flex items-center gap-8">
          <Link
            href="/"
            class="inline-flex items-center gap-2 font-headline text-xl font-bold tracking-tighter text-[#E5E2E3]"
            onClick$={() => {
              mobileOpen.value = false;
            }}
          >
            <div class="flex h-10 w-10 items-center justify-center">
              <img
                src="/icon-64.png"
                alt=""
                width={40}
                height={40}
                loading="eager"
                decoding="async"
                class="object-contain"
              />
            </div>
            <span>Tellodb</span>
          </Link>
          <nav class="hidden items-center gap-6 md:flex">
            <Link
              href="/docs"
              class={`transition-colors duration-200 ${
                isDocs
                  ? "border-b-2 border-primary pb-1 text-primary"
                  : "text-tertiary hover:text-on-surface"
              }`}
            >
              Docs
            </Link>
            <Link
              href="/blog"
              class={`transition-colors duration-200 ${
                isBlog
                  ? "border-b-2 border-primary pb-1 text-primary"
                  : "text-tertiary hover:text-on-surface"
              }`}
            >
              Blog
            </Link>
          </nav>
        </div>

        <div class="flex items-center gap-3">
          <button
            type="button"
            aria-label={
              mobileOpen.value
                ? "Close navigation menu"
                : "Open navigation menu"
            }
            aria-expanded={mobileOpen.value ? "true" : "false"}
            class="app-topbar-menu-button md:hidden"
            onClick$={() => {
              mobileOpen.value = !mobileOpen.value;
            }}
          >
            {mobileOpen.value ? (
              <XIcon class="w-6 h-6" />
            ) : (
              <MenuIcon class="w-6 h-6" />
            )}
          </button>

          <div class="hidden items-center gap-4 md:flex">
            {props.user ? (
              <>
                <Link
                  href="/platform"
                  class="text-xs font-bold text-tertiary transition-colors hover:text-on-surface flex items-center gap-2"
                >
                  <LayoutDashboardIcon class="w-4 h-4" />
                  Console
                </Link>
                <form action="/logout" method="post">
                  <button
                    type="submit"
                    class="text-tertiary hover:text-on-surface transition-colors mt-1"
                  >
                    <LogOutIcon class="w-4 h-4" />
                  </button>
                </form>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  class="text-xs font-bold text-tertiary transition-colors hover:text-on-surface"
                  onClick$={() => {
                    mobileOpen.value = false;
                  }}
                >
                  Log in
                </Link>
                <Link
                  href="/signup"
                  class="rounded-lg bg-primary px-4 py-2 text-xs font-bold text-on-primary transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-primary/20"
                  onClick$={() => {
                    mobileOpen.value = false;
                  }}
                >
                  Sign up
                </Link>
              </>
            )}
          </div>

          <div class="md:hidden">
            {!props.user && (
              <Link
                href="/signup"
                class="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-on-primary shadow-lg"
                onClick$={() => {
                  mobileOpen.value = false;
                }}
              >
                Sign up
              </Link>
            )}
          </div>
        </div>
      </div>

      {mobileOpen.value ? (
        <div class="app-topbar-mobile-nav md:hidden">
          <nav
            class="app-topbar-mobile-nav-links"
            aria-label="Mobile site navigation"
          >
            <Link
              href="/docs"
              class={`app-topbar-mobile-link ${isDocs ? "app-topbar-mobile-link-active" : ""}`}
              onClick$={() => {
                mobileOpen.value = false;
              }}
            >
              Docs
            </Link>
            <Link
              href="/blog"
              class={`app-topbar-mobile-link ${isBlog ? "app-topbar-mobile-link-active" : ""}`}
              onClick$={() => {
                mobileOpen.value = false;
              }}
            >
              Blog
            </Link>
            <div class="h-px w-full bg-outline-variant/10 my-2" />

            {props.user ? (
              <>
                <Link
                  href="/platform"
                  class="app-topbar-mobile-link font-bold text-primary"
                  onClick$={() => {
                    mobileOpen.value = false;
                  }}
                >
                  Console
                </Link>
                <form action="/logout" method="post" class="p-4">
                  <button
                    type="submit"
                    class="text-tertiary flex items-center gap-2"
                  >
                    <LogOutIcon class="w-4 h-4" />
                    Log out
                  </button>
                </form>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  class="app-topbar-mobile-link text-tertiary"
                  onClick$={() => {
                    mobileOpen.value = false;
                  }}
                >
                  Log in
                </Link>
                <Link
                  href="/signup"
                  class="app-topbar-mobile-link font-bold text-primary"
                  onClick$={() => {
                    mobileOpen.value = false;
                  }}
                >
                  Sign up
                </Link>
              </>
            )}
          </nav>
        </div>
      ) : null}
    </header>
  );
});
