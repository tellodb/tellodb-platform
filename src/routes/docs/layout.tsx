import { Slot, component$ } from "@builder.io/qwik";
import { Link, type RequestHandler, useLocation } from "@builder.io/qwik-city";
import { 
  RocketIcon, 
  ZapIcon, 
  LayoutDashboardIcon, 
  DatabaseIcon, 
  LayersIcon, 
  HashIcon, 
  NetworkIcon, 
  CpuIcon, 
  FileTextIcon, 
  ClockIcon, 
  RotateCcwIcon, 
  Code2Icon, 
  SearchIcon, 
  HistoryIcon, 
  Trash2Icon, 
  TerminalIcon, 
  CodeIcon, 
  PackageIcon, 
  BarChart3Icon, 
  ShieldCheckIcon, 
  WrenchIcon,
  ExternalLinkIcon 
} from "lucide-qwik";

import {
  CONTACT_EMAIL,
  CONTACT_MAILTO,
  LINKEDIN_COMPANY_URL,
} from "~/constants/contact";
import { privateRepositoryNote, publicRepositoryLinks } from "~/constants/repositories";
import { setPublicEdgeCache } from "~/lib/cache";
import { docsNavigation } from "~/lib/docs";

export const onRequest: RequestHandler = (event) => {
  setPublicEdgeCache(event);
};

const IconResolver = component$((props: { name?: string }) => {
  const cn = "w-4 h-4";
  switch (props.name) {
    case "rocket_launch": return <RocketIcon class={cn} />;
    case "bolt": return <ZapIcon class={cn} />;
    case "psychology": return <RocketIcon class={cn} />;
    case "dashboard": return <LayoutDashboardIcon class={cn} />;
    case "dataset": return <DatabaseIcon class={cn} />;
    case "category": return <LayersIcon class={cn} />;
    case "tag": return <HashIcon class={cn} />;
    case "hub": return <NetworkIcon class={cn} />;
    case "memory": return <CpuIcon class={cn} />;
    case "text_snippet": return <FileTextIcon class={cn} />;
    case "auto_awesome": return <ZapIcon class={cn} />;
    case "schedule": return <ClockIcon class={cn} />;
    case "published_with_changes": return <RotateCcwIcon class={cn} />;
    case "api": return <Code2Icon class={cn} />;
    case "database": return <DatabaseIcon class={cn} />;
    case "travel_explore": return <SearchIcon class={cn} />;
    case "history": return <HistoryIcon class={cn} />;
    case "delete": return <Trash2Icon class={cn} />;
    case "terminal": return <TerminalIcon class={cn} />;
    case "code": return <CodeIcon class={cn} />;
    case "deployed_code": return <PackageIcon class={cn} />;
    case "bar_chart": return <BarChart3Icon class={cn} />;
    case "verified_user": return <ShieldCheckIcon class={cn} />;
    case "build": return <WrenchIcon class={cn} />;
    default: return <FileTextIcon class={cn} />;
  }
});

export default component$(() => {
  const location = useLocation();
  const rawPath = location.url.pathname;
  const pathname =
    rawPath.length > 1 && rawPath.endsWith("/")
      ? rawPath.slice(0, -1)
      : rawPath;

  const allItems = docsNavigation.flatMap((category) =>
    category.items.map((item) => ({ ...item, category: category.category }))
  );

  const activeItem = allItems.find((item) => item.href === pathname);
  const activeCategory =
    docsNavigation.find((category) => category.category === activeItem?.category) ??
    docsNavigation[0];

  return (
    <div class="docs-shell">
      <aside class="docs-shell-left">
        <div class="docs-shell-left-inner">
          <div class="docs-brand">
            <div class="docs-brand-icon">
               <LayersIcon class="w-5 h-5 text-primary" />
            </div>
            <div>
              <p class="docs-brand-title">Docs</p>
              <p class="docs-brand-subtitle">TelloDB Guide</p>
            </div>
          </div>

          <nav class="docs-nav-groups" aria-label="Documentation navigation">
            {docsNavigation.map((category) => (
              <section key={category.category}>
                <h3 class="docs-nav-heading">{category.category}</h3>
                <div class="docs-nav-items">
                  {category.items.map((item) => {
                    const isActive = item.href === pathname;

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        class={`docs-nav-link ${isActive ? "docs-nav-link-active" : ""}`}
                      >
                        <div class="docs-nav-icon">
                          <IconResolver name={item.icon} />
                        </div>
                        <span class="docs-nav-text-wrap">
                          <span class="docs-nav-text-title">{item.title}</span>
                          {item.description ? (
                            <span class="docs-nav-text-description">{item.description}</span>
                          ) : null}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </section>
            ))}
          </nav>
        </div>
      </aside>

      <main class="docs-shell-main">
        <div class="docs-main-gradient" aria-hidden="true" />
        <div class="docs-mobile-nav">
          <div class="docs-mobile-nav-header">
            <p class="docs-mobile-nav-kicker">Section</p>
            <h2 class="docs-mobile-nav-title">{activeCategory.category}</h2>
          </div>
          <div class="docs-mobile-nav-links">
            {activeCategory.items.map((item) => {
              const isActive = item.href === pathname;
              return (
                <Link
                  key={`mobile-${item.href}`}
                  href={item.href}
                  class={`docs-mobile-nav-link ${isActive ? "docs-mobile-nav-link-active" : ""}`}
                >
                  {item.title}
                </Link>
              );
            })}
          </div>
        </div>
        <article class="docs-article docs-prose">
          <Slot />
        </article>
      </main>

      <aside class="docs-shell-right">
        <div class="docs-shell-right-inner">
          <h3 class="docs-right-heading">In This Section</h3>
          <div class="docs-right-links">
            {activeCategory.items.map((item) => {
              const isActive = item.href === pathname;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  class={`docs-right-link ${isActive ? "docs-right-link-active" : ""}`}
                >
                  {item.title}
                </Link>
              );
            })}
          </div>

          <div class="docs-right-card">
            <p class="docs-right-card-title">Need a full architecture walkthrough?</p>
            <p class="docs-right-card-copy">
              Start with System Architecture, then move to Ingestion Pipeline and Time Ranking.
            </p>
            <Link href="/docs/architecture" class="docs-right-card-link">
              Start Here
            </Link>
            <p class="docs-right-private-note">
              Contact:{" "}
              <a href={CONTACT_MAILTO} target="_blank" rel="noreferrer">
                {CONTACT_EMAIL}
              </a>
              {" · "}
              <a href={LINKEDIN_COMPANY_URL} target="_blank" rel="noreferrer">
                LinkedIn
              </a>
            </p>
          </div>

          <div class="docs-right-card">
            <p class="docs-right-card-title">Public Repositories</p>
            <p class="docs-right-card-copy">
              Platform, SDK, and model adapter repositories.
            </p>
            <div class="docs-repo-links">
              {publicRepositoryLinks.map((repo) => (
                <a
                  key={repo.href}
                  href={repo.href}
                  target="_blank"
                  rel="noreferrer"
                  class="docs-repo-link"
                >
                  <span>{repo.label}</span>
                  <ExternalLinkIcon class="w-4 h-4 ml-auto text-tertiary" />
                </a>
              ))}
            </div>
            <p class="docs-right-private-note">{privateRepositoryNote}</p>
          </div>
        </div>
      </aside>
    </div>
  );
});
