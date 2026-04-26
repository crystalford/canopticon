"use client";

import { browserClient } from "@/lib/supabase";
import { useState } from "react";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("sending");
    setErrorMessage(null);

    const supabase = browserClient();
    const redirectTo = `${window.location.origin}/auth/callback`;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });

    if (error) {
      setStatus("error");
      setErrorMessage(error.message);
      return;
    }
    setStatus("sent");
  }

  return (
    <main className="mx-auto min-h-screen max-w-md px-8 py-16">
      <h1 className="mb-2 font-serif text-3xl text-amber">Sign in</h1>
      <p className="mb-12 font-mono text-xs uppercase tracking-widest text-text-faint">
        CANOPTICON operator console
      </p>

      {status === "sent" ? (
        <div className="leading-relaxed text-text">
          <p className="mb-4">
            Magic link sent to <span className="text-amber">{email}</span>.
          </p>
          <p className="text-sm text-text-dim">
            Open the link from this device. The session will land on the Live screen.
          </p>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-6">
          <div>
            <label
              htmlFor="email"
              className="block font-mono text-[10.5px] uppercase tracking-wider text-text-dim"
            >
              email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              disabled={status === "sending"}
              className="mt-1 w-full border border-border-soft bg-bg-card px-3 py-2 font-serif text-base text-text placeholder:text-text-faint focus:border-amber focus:outline-none disabled:opacity-50"
            />
          </div>

          <button
            type="submit"
            disabled={status === "sending" || !email}
            className="w-full border border-amber bg-amber-glow py-3 font-mono text-[11px] uppercase tracking-wider text-amber-bright hover:bg-amber-dim hover:text-bg disabled:opacity-50"
          >
            {status === "sending" ? "sending…" : "send magic link"}
          </button>

          {errorMessage && <p className="font-serif italic text-signal">{errorMessage}</p>}
        </form>
      )}
    </main>
  );
}
