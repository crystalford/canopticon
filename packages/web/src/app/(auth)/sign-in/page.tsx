"use client";

import { Button, FieldError, Input, Label } from "@/components/primitives";
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
      <p className="text-text-faint font-mono text-xs uppercase tracking-widest mb-12">
        CANOPTICON operator console
      </p>

      {status === "sent" ? (
        <div className="text-text leading-relaxed">
          <p className="mb-4">
            Magic link sent to <span className="text-amber">{email}</span>.
          </p>
          <p className="text-text-dim text-sm">
            Open the link from this device. The session will land on the home page.
          </p>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-6">
          <div>
            <Label htmlFor="email">email</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              disabled={status === "sending"}
            />
          </div>

          <Button
            type="submit"
            tone="primary"
            size="lg"
            fullWidth
            disabled={status === "sending" || !email}
          >
            {status === "sending" ? "sending..." : "send magic link"}
          </Button>

          <FieldError message={errorMessage} />
        </form>
      )}
    </main>
  );
}
