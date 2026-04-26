// Public site layout: paper-on-ink editorial register, EB Garamond serif,
// drop caps, dotted citations. Distinct from operator dark cockpit.

import Link from "next/link";

export const runtime = "edge";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f4ede0] text-[#1a1410]">
      <header className="border-b border-[#1a1410]/15 bg-[#f4ede0]">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <Link href="/p" className="font-serif text-2xl tracking-tight text-[#1a1410]">
            CANOPTICON
          </Link>
          <nav className="flex gap-4 font-mono text-[10.5px] uppercase tracking-wider text-[#5c4a3d]">
            <Link href="/p/articles">Articles</Link>
            <Link href="/p/theses">Theses</Link>
            <Link href="/p/predictions">Predictions</Link>
            <Link href="/p/contradictions">Contradictions</Link>
            <Link href="/p/methodology">Method</Link>
            <Link href="/p/about">About</Link>
          </nav>
        </div>
      </header>
      <main>{children}</main>
      <footer className="border-t border-[#1a1410]/15 bg-[#ede4d2]">
        <div className="mx-auto max-w-4xl px-6 py-8 font-mono text-[10.5px] uppercase tracking-wider text-[#5c4a3d]">
          <div className="flex flex-wrap gap-6">
            <Link href="/p/glossary">Glossary</Link>
            <Link href="/p/search">Search</Link>
            <Link href="/p/subscribe">Subscribe</Link>
            <Link href="/p/corrections">Corrections</Link>
          </div>
          <p className="mt-4 font-serif text-sm text-[#1a1410]/70">
            Calibrated forensic intelligence on Canadian political and economic structure.
          </p>
        </div>
      </footer>
    </div>
  );
}
