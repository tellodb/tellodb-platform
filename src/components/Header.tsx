import { component$, useSignal } from "@builder.io/qwik";
import { Link, useLocation } from "@builder.io/qwik-city";
import type { AuthUser } from "~/lib/auth";
import { GithubIcon, LayoutDashboardIcon, LogOutIcon, MenuIcon, XIcon } from "lucide-qwik";

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
    <header class="app-topbar fixed top-0 z-50 w-full font-body text-sm tracking-tight antialiased">
      <div class="site-notice w-full px-4 py-2 flex items-center justify-center text-xs font-medium text-center">
        <span>
          New from TelloDB:
          {" "}
          <a href="https://debate.tellodb.com" target="_blank" rel="noopener noreferrer" class="font-bold underline underline-offset-4 transition-colors">adversarial review for consequential AI work</a>
          {" "}
          <span aria-hidden="true">↗</span>
        </span>
      </div>
      <div class="mx-auto flex h-16 w-full max-w-[1440px] items-center justify-between px-4 md:px-8">
        <div class="flex items-center gap-8">
          <Link
            href="/"
            class="inline-flex items-center gap-2.5 font-headline text-lg font-bold tracking-[-0.025em] text-on-surface"
            onClick$={() => {
              mobileOpen.value = false;
            }}
          >
            <div class="flex h-9 w-9 items-center justify-center">
              <img
                src="/tellodb-mark-64.png"
                alt=""
                width={36}
                height={36}
                loading="eager"
                decoding="async"
                class="object-contain"
              />
            </div>
            <span>TelloDB</span>
          </Link>
          <nav class="hidden items-center gap-6 md:flex">
            <Link
              href="/docs"
              class={`nav-item transition-colors duration-200 ${
                isDocs
                  ? "nav-item-active"
                  : "text-tertiary hover:text-on-surface"
              }`}
            >
              Docs
            </Link>
            <Link
              href="/blog"
              class={`nav-item transition-colors duration-200 ${
                isBlog
                  ? "nav-item-active"
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
            <a
              href="https://github.com/tellodb/tellodb"
              target="_blank"
              rel="noopener noreferrer"
              class="header-icon-button"
              aria-label="GitHub"
            >
              <GithubIcon class="h-4 w-4" />
            </a>
            {props.user?.user_id ? (
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
                  class="header-primary-action"
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
            {!props.user?.user_id && (
              <Link
                href="/signup"
                class="header-primary-action px-3 py-2"
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
            <a
              href="https://github.com/tellodb/tellodb"
              target="_blank"
              rel="noopener noreferrer"
              class="app-topbar-mobile-link text-tertiary inline-flex items-center gap-2"
              aria-label="GitHub"
              onClick$={() => {
                mobileOpen.value = false;
              }}
            >
              <GithubIcon class="w-4 h-4" />
              GitHub
            </a>
            <div class="h-px w-full bg-outline-variant/10 my-2" />

            {props.user?.user_id ? (
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
