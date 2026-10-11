// The hand-built pages — About, three concepts and one open problem — ported
// as-is from the prototype (docs/blackbox/README.md §Concept: "port them
// as-is"). Their markup lives in content/pages/ with its own inline styles;
// this only puts it in the shell and fills the one live number.

import type { StaticPage } from "../content/store";
import { libraryItems } from "../content/store";
import { shell } from "../layout";

export function renderStatic(p: StaticPage, opts: { signedIn?: boolean } = {}): string {
  const body = p.body.replace(/\{\{library_count\}\}/g, String(libraryItems().length));
  return shell({
    title: p.title,
    description: p.description,
    path: p.route,
    progress: p.progress === true,
    noindex: p.private === true,
    ...(p.route === "/about" ? { nav: "about" as const } : { nav: "library" as const }),
    signedIn: opts.signedIn ?? false,
    head: p.ld
      .map(
        (o) =>
          `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, "\\u003c")}</script>`,
      )
      .join("\n"),
    body,
  });
}
