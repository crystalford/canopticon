// The three notice pages the newsletter form can land on.
//
// Deliberately small. There is no sending infrastructure yet and this does
// not pretend otherwise — the point is to start collecting addresses now,
// honestly, with a working way out, rather than to build a campaign system
// nobody has asked for.

import { renderPage } from "../layout";

const CANONICAL = "https://canopticon.com";

interface NoticeOpts {
  /** The mono eyebrow above the heading. */
  eyebrow?: string;
  /** Omitted deliberately by pages that are not a canonical destination. */
  canonical?: string;
  description?: string;
  /** A dead-end page needs a way out. Off only where the body has its own. */
  back?: boolean;
}

/**
 * A one-message page.
 *
 * Every field here used to be hardcoded for the mailing list, and the sign-in
 * page borrowed the helper — so it announced itself as "Mailing list", and
 * declared `canonical` pointing at /subscribed, telling every crawler that
 * the sign-in page was a duplicate of the newsletter confirmation. Whatever a
 * caller does not set is now simply absent rather than inherited wrong.
 */
function notice(title: string, heading: string, body: string, opts: NoticeOpts = {}): string {
  return renderPage({
    title,
    description: opts.description ?? "Canopticon mailing list.",
    body: `<header class="phead">
  ${opts.eyebrow ? `<div class="eyebrow">${opts.eyebrow}</div>` : ""}
  <h1>${heading}</h1>
</header>
<section class="sec">
${body}
  ${opts.back === false ? "" : `<p><a href="/essays">Back to the essays →</a></p>`}
</section>`,
    activeNav: "",
    zone: "about",
    ...(opts.canonical ? { canonical: opts.canonical } : {}),
  });
}

export function renderSubscribed(alreadyOnList: boolean): string {
  return notice(
    alreadyOnList ? "Already on the list" : "Check your email",
    alreadyOnList ? "You were already on the list" : "Check your email",
    `  <p class="lead">${
      alreadyOnList
        ? "That address is already subscribed, so nothing changed."
        : "We have sent you a link to confirm. Nothing is sent until you click it."
    }</p>
  <p>New essays and research documents go out when they're published, which is
  irregular by design. Nothing else is ever sent, and every email carries an
  unsubscribe link.</p>`,
    {
      eyebrow: "Mailing list",
      canonical: `${CANONICAL}/subscribed`,
    },
  );
}

export function renderUnsubscribed(found: boolean): string {
  return notice(
    found ? "Unsubscribed" : "Link not recognised",
    found ? "Unsubscribed" : "That link didn't work",
    found
      ? `  <p class="lead">Your address has been removed. Nothing further will be sent.</p>`
      : `  <p class="lead">That unsubscribe link is no longer valid — the address may already have been removed.</p>`,
    {
      eyebrow: "Mailing list",
      canonical: `${CANONICAL}/subscribed`,
    },
  );
}

export function renderConfirmed(found: boolean): string {
  return notice(
    found ? "Confirmed" : "Link not recognised",
    found ? "Confirmed" : "That link didn't work",
    found
      ? `  <p class="lead">Your subscription is confirmed.</p>`
      : `  <p class="lead">That confirmation link is no longer valid.</p>`,
    {
      eyebrow: "Mailing list",
      canonical: `${CANONICAL}/subscribed`,
    },
  );
}

export function renderSubscribeError(message: string): string {
  return notice("Mailing list", "That didn't work", `  <p class="lead">${message}</p>`, {
    eyebrow: "Mailing list",
    canonical: `${CANONICAL}/subscribed`,
  });
}

/**
 * The operator's way back in.
 *
 * `/desk/workbench` is where uploading happens and it is session-gated. It used to
 * redirect a signed-out visitor to `/research`, which meant a lapsed cookie
 * looked exactly like the page not existing. Saying so, and pointing at the
 * door, costs one page and removes the only genuinely blocking bug on the site.
 */
export function renderSignedOut(): string {
  return notice(
    "Sign in",
    "Sign in to continue",
    // /op/login, NOT /auth/login. Minting a session needs Cloudflare Access to
    // have verified the visitor and injected their email header, and Access is
    // scoped to a path: it covers /op/* and cannot cover /*, because the
    // publication is meant to be publicly readable. /auth/login therefore sits
    // outside the gate it depends on, so this link — the one link on the one
    // page a locked-out operator reaches — was the one that could never work.
    `  <p class="lead">The library is where documents are uploaded and reviewed. It needs an
  operator session.</p>
  <p><a href="/op/login">Sign in →</a></p>
  <p>If you are not the operator, the published documents are at
  <a href="/research">Research</a> and the essays at <a href="/essays">Essays</a>.</p>`,
    // No "back to the essays" — the body already points at both public
    // indexes, and no canonical, because a sign-in page is not a destination
    // any crawler should be led to.
    { eyebrow: "Operator", description: "Sign in to the Canopticon library.", back: false },
  );
}
