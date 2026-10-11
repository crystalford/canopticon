// Sending mail.
//
// The mailing list has collected addresses and been able to unsubscribe since
// it shipped, and has never sent anything — so `pub_subscriptions.confirmed`
// has been stuck at 0 for every row, and the confirmation_token column has
// been written and never used. This is the missing half.
//
// RESEND, chosen not arbitrarily: it is an HTTP API, which is all a Worker
// can do (no SMTP sockets), it needs no SDK, and its free tier covers a list
// this size. Swapping provider means changing `post()` below and nothing else
// — everything above it is provider-agnostic on purpose.
//
// NOTHING SENDS WITHOUT A KEY. `RESEND_API_KEY` absent means every call
// returns `{ ok: false, reason: "no RESEND_API_KEY" }` and writes nothing.
// That is deliberate rather than a TODO: an unconfigured deploy must be inert,
// not half-working, and the operator can see the reason rather than watching
// mail silently not arrive.

import type { Env } from "../env";

const API = "https://api.resend.com/emails";

/**
 * Who mail comes from.
 *
 * Must be a domain verified in the provider's dashboard or every send is
 * rejected. Kept next to the code that uses it rather than in env, because a
 * wrong value here fails loudly at the provider and there is nothing to tune.
 */
const FROM = "Canopticon <hello@canopticon.com>";

export interface SendResult {
  ok: boolean;
  reason: string | null;
}

async function post(env: Env, body: Record<string, unknown>): Promise<SendResult> {
  const key = env.RESEND_API_KEY;
  if (!key) return { ok: false, reason: "no RESEND_API_KEY — nothing was sent" };
  // CASL: a mailing address in every message, or no message. The author has
  // not set one yet (docs/blackbox/README.md §Follow), so this stays inert
  // even once a key exists.
  if (!env.MAILING_ADDRESS) {
    return { ok: false, reason: "no MAILING_ADDRESS — CASL requires one; nothing was sent" };
  }
  try {
    const res = await fetch(API, {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      // Sender identification in every message (CASL): who, where, how to
      // reach them. Appended here so no message can be built without it.
      body: JSON.stringify({
        from: FROM,
        ...body,
        text: `${String(body.text ?? "")}\n\n—\nCanopticon · Chris Telford\n${env.MAILING_ADDRESS}\nhttps://canopticon.com/about`,
      }),
    });
    if (!res.ok) {
      // The provider's own message, trimmed. Far more useful than "failed" —
      // an unverified sending domain and a bad key look identical otherwise.
      const detail = (await res.text().catch(() => "")).slice(0, 200);
      return { ok: false, reason: `provider ${res.status}: ${detail}` };
    }
    return { ok: true, reason: null };
  } catch (e) {
    return { ok: false, reason: String(e).slice(0, 200) };
  }
}

/**
 * Ask a new subscriber to confirm.
 *
 * Double opt-in, and not only for etiquette: anyone can type anyone's address
 * into a public form, so an unconfirmed row is an assertion about someone who
 * has not agreed to anything. Confirming is what makes the list real, and it
 * is why `confirmed` exists in a schema that never set it.
 */
export function sendConfirmation(env: Env, email: string, token: string): Promise<SendResult> {
  const url = `https://canopticon.com/confirm?token=${encodeURIComponent(token)}`;
  return post(env, {
    to: [email],
    subject: "Confirm your Canopticon subscription",
    text: `You asked for new work from Canopticon.

Confirm here: ${url}

If that was not you, ignore this — nothing is sent until you confirm, and
this address will not be written to again.`,
  });
}

/** Tell a confirmed subscriber about one new piece. */
export function sendAnnouncement(
  env: Env,
  email: string,
  args: { title: string; url: string; subtitle?: string | null; unsubscribeToken: string },
): Promise<SendResult> {
  const unsub = `https://canopticon.com/unsubscribe?token=${encodeURIComponent(args.unsubscribeToken)}`;
  return post(env, {
    to: [email],
    subject: args.title,
    text: `${args.title}
${args.subtitle ? `${args.subtitle}\n` : ""}
${args.url}

—
Unsubscribe: ${unsub}`,
    // The header that lets a mail client offer one-click unsubscribe. Without
    // it the only way out is the footer link, and readers who cannot find it
    // press "spam" instead, which costs the sending domain far more than the
    // subscriber was worth.
    headers: {
      "List-Unsubscribe": `<${unsub}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  });
}
