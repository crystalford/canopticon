import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen px-8 py-16 max-w-2xl mx-auto">
      <h1 className="font-serif text-4xl text-amber mb-2">CANOPTICON</h1>
      <p className="text-cream-dim font-mono text-xs uppercase tracking-widest mb-12">
        Forensic intelligence — operator console
      </p>
      <p className="text-cream mb-8 leading-relaxed">
        Substrate offline. The operator app boots once Phase 1 (database) and Phase 2 (skills) are
        in place and the API at <code className="text-amber font-mono text-sm">/v1</code> responds.
      </p>
      <ul className="space-y-2 text-cream-dim">
        <li>
          <Link
            href="/sign-in"
            className="text-amber hover:text-cream underline-offset-4 hover:underline"
          >
            → sign in
          </Link>
        </li>
      </ul>
    </main>
  );
}
