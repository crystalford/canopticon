// The hand-built pages — About, three concepts and one open problem — ported
// as-is from the prototype (docs/blackbox/README.md §Concept: "port them
// as-is"). Their markup lives in content/pages/ with its own inline styles;
// this only puts it in the shell and fills the one live number.

import { AUTHOR } from "../author";
import type { StaticPage } from "../content/store";
import { libraryItems } from "../content/store";
import { shell } from "../layout";

/** Which section of the top bar a hand-built page belongs to. */
function navFor(route: string): "papers" | "lexicon" | "open" | "library" {
  if (route.startsWith("/papers/")) return "papers";
  if (route.startsWith("/concepts/")) return "lexicon";
  if (route.startsWith("/open/")) return "open";
  return "library";
}

export function renderStatic(
  p: StaticPage,
  opts: { signedIn?: boolean; head?: string } = {},
): string {
  const body = p.body.replace(
    /\{\{library_count\}\}/g,
    String(libraryItems().filter((r) => r.shelf !== "investigation").length),
  );
  return shell({
    title: p.title,
    description: p.description,
    path: p.route,
    progress: p.progress === true,
    noindex: p.private === true,
    ...(p.route === "/about" ? { nav: "about" as const } : { nav: navFor(p.route) }),
    signedIn: opts.signedIn ?? false,
    head: [
      opts.head ?? "",
      ...p.ld
        .map(withAuthor)
        .map(
          (o) =>
            `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, "\\u003c")}</script>`,
        ),
    ]
      .filter(Boolean)
      .join("\n"),
    body,
  });
}

/** Hand-built pages name the author in their own JSON-LD; every Person named
 *  Chris Telford becomes the one author entity, so all pages join up. */
function withAuthor(o: unknown): unknown {
  if (Array.isArray(o)) return o.map(withAuthor);
  if (!o || typeof o !== "object") return o;
  const rec = o as Record<string, unknown>;
  if (rec["@type"] === "Person" && rec.name === "Chris Telford") return { ...rec, ...AUTHOR };
  return Object.fromEntries(Object.entries(rec).map(([k, v]) => [k, withAuthor(v)]));
}
