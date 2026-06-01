import { component$ } from "@builder.io/qwik";
import { useDocumentHead, useLocation } from "@builder.io/qwik-city";
import { absoluteUrl } from "~/lib/site";

export const RouterHead = component$(() => {
  const head = useDocumentHead();
  const location = useLocation();

  return (
    <>
      <title>{head.title}</title>
      <link rel="canonical" href={absoluteUrl(location.url.pathname)} />
      {head.meta.map((meta) => (
        <meta key={meta.key || `${meta.name || meta.property || "meta"}-${meta.content}`} {...meta} />
      ))}
      {head.links.map((link) => (
        <link key={link.key || `${link.rel}-${link.href}`} {...link} />
      ))}
      {head.styles.map((style) => (
        <style key={style.key} dangerouslySetInnerHTML={style.style} />
      ))}
      {head.scripts?.map((script) => (
        <script
          key={script.key}
          {...script.props}
          dangerouslySetInnerHTML={script.script}
        />
      ))}
    </>
  );
});
