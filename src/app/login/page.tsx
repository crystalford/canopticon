'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { login } from './actions'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {pending ? 'Authenticating...' : 'Access Intelligence Shell'}
    </button>
  )
}

export default function LoginPage() {
  const [error, formAction] = useFormState(login, null)

  return (
    <main className="min-h-screen bg-void flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-1">
          <h1 className="font-display text-2xl font-bold text-brand tracking-widest">
            CANOPTICON
          </h1>
          <p className="font-mono text-text-muted text-xs">
            Intelligence Platform — Admin Access
          </p>
        </div>

        <form action={formAction} className="glass-panel p-6 space-y-4">
          <div className="space-y-1">
            <label className="font-mono text-xs text-text-secondary block">
              EMAIL
            </label>
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              className="input-field"
              placeholder="operator@canopticon.com"
            />
          </div>

          <div className="space-y-1">
            <label className="font-mono text-xs text-text-secondary block">
              PASSWORD
            </label>
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="input-field"
            />
          </div>

          {error && (
            <p className="font-mono text-xs text-disputed bg-disputed/10 border border-disputed/30 px-3 py-2 rounded-sm">
              {error}
            </p>
          )}

          <SubmitButton />
        </form>

        <p className="font-mono text-text-muted text-xs text-center">
          Unauthorized access is monitored and logged.
        </p>
      </div>
    </main>
  )
}
