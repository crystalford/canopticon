"use client";

import { useState } from "react";

export default function SubscribePage() {
  const [email, setEmail] = useState("");
  const [channels, setChannels] = useState<string[]>(["articles"]);
  const [status, setStatus] = useState<"idle" | "submitting" | "ok" | "error">("idle");

  function toggleChannel(c: string) {
    setChannels((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
      const res = await fetch(`${apiBase}/v1/public/subscribe`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, channels }),
      });
      setStatus(res.ok ? "ok" : "error");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="mb-2 font-serif text-4xl text-[var(--ink)]">Subscribe</h1>
      <p className="mb-8 font-serif italic text-[var(--ink-3)]">
        Email + RSS. No tracking. No sharing. Unsubscribe in every email.
      </p>

      <form onSubmit={submit} className="space-y-6">
        <div>
          <label
            htmlFor="email"
            className="block font-mono text-[10.5px] uppercase tracking-wider text-[var(--ink-mute)]"
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full border border-[var(--rule)] bg-[var(--paper)] px-3 py-2 font-serif text-lg text-[var(--ink)] focus:border-[var(--signal)] focus:outline-none"
          />
        </div>

        <div>
          <p className="mb-2 font-mono text-[10.5px] uppercase tracking-wider text-[var(--ink-mute)]">
            Channels
          </p>
          {["articles", "theses", "predictions", "contradictions", "weekly_digest"].map((c) => (
            <label key={c} className="flex items-center gap-2 py-1 font-serif">
              <input
                type="checkbox"
                checked={channels.includes(c)}
                onChange={() => toggleChannel(c)}
                className="accent-[#9c2333]"
              />
              {c.replace(/_/g, " ")}
            </label>
          ))}
        </div>

        <button
          type="submit"
          disabled={status === "submitting"}
          className="border border-[var(--ink)] bg-[var(--ink)] px-6 py-2 font-mono text-[10.5px] uppercase tracking-wider text-[var(--paper)] hover:bg-[var(--signal)] hover:border-[var(--signal)] disabled:opacity-50"
        >
          {status === "submitting" ? "Subscribing…" : status === "ok" ? "Subscribed" : "Subscribe"}
        </button>
        {status === "error" && (
          <p className="font-serif italic text-[var(--signal)]">Subscription failed. Try again.</p>
        )}
        {status === "ok" && (
          <p className="font-serif italic text-[var(--verified)]">Check your email to confirm.</p>
        )}
      </form>

      <div className="mt-12 border-t border-[var(--rule)] pt-6">
        <h2 className="mb-2 font-mono text-[11px] uppercase tracking-wider text-[var(--ink-mute)]">
          RSS feeds
        </h2>
        <ul className="space-y-1 font-mono text-sm text-[var(--ink)]">
          <li>/feeds/articles.xml — all articles</li>
          <li>/feeds/theses.xml — thesis updates</li>
          <li>/feeds/predictions.xml — banked & resolved predictions</li>
          <li>/feeds/contradictions.xml — contradiction posture changes</li>
        </ul>
      </div>
    </div>
  );
}
