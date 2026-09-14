// The three notice pages the newsletter form can land on.
//
// Deliberately small. There is no sending infrastructure yet and this does
// not pretend otherwise — the point is to start collecting addresses now,
// honestly, with a working way out, rather than to build a campaign system
// nobody has asked for.

import { renderPage } from "../layout";

const CANONICAL = "https://canopticon.com";

function notice(title: string, heading: string, body: string): string {
  return renderPage({
    title,
    description: "Canopticon mailing list.",
    body: `<header class="phead">
  <div class="eyebrow">Mailing list</div>
  <h1>${heading}</h1>
</header>
<section class="sec">
${body}
  <p><a href="/essays">Back to the essays →</a></p>
</section>`,
    activeNav: "",
    zone: "about",
    canonical: `${CANONICAL}/subscribed`,
  });
}

export function renderSubscribed(alreadyOnList: boolean): string {
  return notice(
    "You're on the list",
    alreadyOnList ? "You were already on the list" : "You're on the list",
    `  <p class="lead">${
      alreadyOnList
        ? "That address is already subscribed, so nothing changed."
        : "Thanks — your address is stored."
    }</p>
  <p>New essays and research documents go out when they're published, which is
  irregular by design. Nothing else is ever sent, and every email carries an
  unsubscribe link.</p>`,
  );
}

export function renderUnsubscribed(found: boolean): string {
  return notice(
    found ? "Unsubscribed" : "Link not recognised",
    found ? "Unsubscribed" : "That link didn't work",
    found
      ? `  <p class="lead">Your address has been removed. Nothing further will be sent.</p>`
      : `  <p class="lead">That unsubscribe link is no longer valid — the address may already have been removed.</p>`,
  );
}

export function renderConfirmed(found: boolean): string {
  return notice(
    found ? "Confirmed" : "Link not recognised",
    found ? "Confirmed" : "That link didn't work",
    found
      ? `  <p class="lead">Your subscription is confirmed.</p>`
      : `  <p class="lead">That confirmation link is no longer valid.</p>`,
  );
}

export function renderSubscribeError(message: string): string {
  return notice("Mailing list", "That didn't work", `  <p class="lead">${message}</p>`);
}
