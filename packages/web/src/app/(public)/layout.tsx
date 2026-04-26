import Link from "next/link";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border-soft px-6 py-3 flex items-center justify-between">
        <div className="flex items-baseline gap-6">
          <Link href="/p" className="font-serif text-xl text-amber hover:text-cream-bright">
            CANOPTICON
          </Link>
          <nav className="flex gap-4 text-text-dim font-mono text-xs uppercase tracking-widest">
            <PublicNavLink href="/p" label="theses" />
            <PublicNavLink href="/p/findings" label="findings" />
            <PublicNavLink href="/p/predictions" label="predictions" />
            <PublicNavLink href="/p/contradictions" label="contradictions" />
            <PublicNavLink href="/p/articles" label="articles" />
            <PublicNavLink href="/p/methodology" label="methodology" />
          </nav>
        </div>
        <div className="text-text-faint font-mono text-xs">public</div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-border-soft px-6 py-4 text-text-faint font-mono text-xs">
        public-facing surface · internal substrate is operator-only ·{" "}
        <Link href="/sign-in" className="hover:text-amber">
          operator sign in
        </Link>
      </footer>
    </div>
  );
}

function PublicNavLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="hover:text-amber">
      {label}
    </Link>
  );
}
