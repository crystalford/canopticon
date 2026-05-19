// Public site layout: D1+D4 Vercel-pro near-white. Geist sans throughout,
// hairline borders, single rose accent on the wordmark dot. The previous
// cream/burgundy editorial chrome is gone.

import Link from "next/link";

export const runtime = "edge";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--paper)] text-[var(--ink)]">
      <header className="border-b border-[var(--rule)] bg-[var(--paper)]">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link
            href="/"
            className="font-sans text-[22px] font-semibold tracking-tight text-[var(--ink)]"
          >
            canopticon<span className="text-[var(--signal)]">.</span>
          </Link>
          <nav className="mono flex gap-5 text-[11px] uppercase tracking-[0.04em] text-[var(--ink-3)]">
            <Link href="/p/articles" className="hover:text-[var(--ink)]">
              Articles
            </Link>
            <Link href="/p/theses" className="hover:text-[var(--ink)]">
              Theses
            </Link>
            <Link href="/p/predictions" className="hover:text-[var(--ink)]">
              Predictions
            </Link>
            <Link href="/p/contradictions" className="hover:text-[var(--ink)]">
              Contradictions
            </Link>
            <Link href="/p/methodology" className="hover:text-[var(--ink)]">
              Method
            </Link>
            <Link href="/p/about" className="hover:text-[var(--ink)]">
              About
            </Link>
          </nav>
        </div>
      </header>
      <main>{children}</main>
      <footer className="border-t border-[var(--rule)] bg-[var(--paper-2)]">
        <div className="mx-auto max-w-5xl px-6 py-10">
          <div className="mono flex flex-wrap gap-6 text-[11px] uppercase tracking-[0.04em] text-[var(--ink-3)]">
            <Link href="/p/glossary" className="hover:text-[var(--ink)]">
              Glossary
            </Link>
            <Link href="/p/search" className="hover:text-[var(--ink)]">
              Search
            </Link>
            <Link href="/p/subscribe" className="hover:text-[var(--ink)]">
              Subscribe
            </Link>
            <Link href="/p/corrections" className="hover:text-[var(--ink)]">
              Corrections
            </Link>
          </div>
          <p className="mt-5 max-w-2xl text-[14px] leading-relaxed text-[var(--ink-3)]">
            Forensic intelligence on Canadian political and economic structure.
          </p>
        </div>
      </footer>
    </div>
  );
}
