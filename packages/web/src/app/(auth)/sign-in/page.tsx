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
    <main className="min-h-screen px-8 py-16 max-w-md mx-auto">
      <h1 className="font-serif text-3xl text-amber mb-2">Sign in</h1>
      <p className="text-cream-faint font-mono text-xs uppercase tracking-widest mb-12">
        CANOPTICON operator console
      </p>

      {status === "sent" ? (
        <div className="text-cream leading-relaxed">
          <p className="mb-4">
            Magic link sent to <span className="text-amber">{email}</span>.
          </p>
          <p className="text-cream-dim text-sm">
            Open the link from this device. The session will land on the home page.
          </p>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-6">
          <label className="block">
            <span className="block text-cream-dim font-mono text-xs uppercase tracking-widest mb-2">
              email
            </span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-ink-dim text-cream border border-amber-dim px-3 py-2 font-serif focus:border-amber focus:outline-none"
              placeholder="you@example.com"
              disabled={status === "sending"}
            />
          </label>

          <button
            type="submit"
            disabled={status === "sending" || !email}
            className="w-full bg-amber-deep text-ink font-mono text-sm uppercase tracking-widest py-3 hover:bg-amber disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {status === "sending" ? "sending..." : "send magic link"}
          </button>

          {errorMessage && <p className="text-signal-red font-mono text-xs">{errorMessage}</p>}
        </form>
      )}
    </main>
  );
}
