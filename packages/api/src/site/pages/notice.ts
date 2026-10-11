// Short pages that say one thing: not found, confirmed, unsubscribed.
// Same shell as everything else, so no corner of the site falls back to the
// old design.

import { esc, shell } from "../layout";

export function renderNotice(args: {
  title: string;
  body: string;
  path: string;
  links?: Array<{ href: string; label: string }>;
  signedIn?: boolean;
}): string {
  const links = (args.links ?? [])
    .map((l) => `<a href="${esc(l.href)}" class="btn">${esc(l.label)}</a>`)
    .join("");
  return shell({
    title: args.title,
    description: args.body,
    path: args.path,
    noindex: true,
    signedIn: args.signedIn ?? false,
    body: `<div style="max-width:720px;padding:48px 0 24px"><h1 class="h-page">${esc(args.title)}</h1><p class="lede" style="font-size:17px;line-height:1.6;color:var(--body)">${esc(args.body)}</p>${links ? `<div class="pills" style="gap:8px;margin-top:22px">${links}</div>` : ""}</div>`,
  });
}

export function renderNotFound(path: string, signedIn = false): string {
  return renderNotice({
    title: "Nothing here",
    body: "There is no page at this address. It may have moved when the site was rebuilt — the Library lists everything, and search reads the full text of every document.",
    path,
    signedIn,
    links: [
      { href: "/library", label: "Open the Library" },
      {
        href: `/search?q=${encodeURIComponent(path.split("/").pop()?.replace(/-/g, " ") ?? "")}`,
        label: "Search for it",
      },
    ],
  });
}
