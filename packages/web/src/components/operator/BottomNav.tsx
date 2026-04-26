// Six-screen bottom navigation. Mobile-first; sticky to viewport bottom.

import Link from "next/link";

export interface NavItem {
  href: string;
  label: string;
  icon: string; // single ASCII glyph for now; SVG later
}

const items: NavItem[] = [
  { href: "/live", label: "Live", icon: "○" },
  { href: "/graph", label: "Graph", icon: "◇" },
  { href: "/studio", label: "Studio", icon: "▷" },
  { href: "/library", label: "Library", icon: "≡" },
  { href: "/sources", label: "Sources", icon: "◆" },
  { href: "/system", label: "System", icon: "⚙" },
];

export function BottomNav({ active }: { active: string }) {
  return (
    <nav className="fixed bottom-0 left-1/2 z-40 w-full max-w-[440px] -translate-x-1/2 border-t border-border bg-bg-deeper">
      <ul className="grid grid-cols-6">
        {items.map((item) => {
          const isActive = active === item.href;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`flex flex-col items-center justify-center gap-1 py-2 font-mono text-[9px] uppercase tracking-wider ${
                  isActive ? "text-cream-bright" : "text-text-faint hover:text-cream-dim"
                }`}
              >
                <span className="text-base leading-none">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
