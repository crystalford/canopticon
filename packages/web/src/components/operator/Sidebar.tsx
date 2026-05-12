// Shared vertical nav. Rendered in both the desktop fixed sidebar and
// the mobile slide-in drawer. Conversations live inside the same panel
// (ChatGPT / Claude style) so the chat page doesn't need its own rail.

import Link from "next/link";
import { SidebarConversations } from "./SidebarConversations";

export interface NavItem {
  href: string;
  label: string;
  icon: string;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/chat", label: "Chat", icon: "▤" },
  { href: "/live", label: "Live", icon: "○" },
  { href: "/graph", label: "Graph", icon: "◇" },
  { href: "/studio", label: "Studio", icon: "▷" },
  { href: "/library", label: "Library", icon: "≡" },
  { href: "/sources", label: "Sources", icon: "◆" },
  { href: "/system", label: "System", icon: "⚙" },
];

export function Sidebar({
  active,
  email,
  onNavigate,
}: {
  active: string;
  email: string | null;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex h-full w-full flex-col bg-bg-deeper">
      <div className="border-b border-border-soft px-4 py-4">
        <div className="flex items-center gap-2 text-cream-bright">
          <svg
            viewBox="0 0 48 16"
            fill="currentColor"
            className="h-4 w-12 shrink-0"
            aria-hidden="true"
          >
            <title>Canopticon eye mark</title>
            <path d="M0 8 L4 4 L4 12 Z" />
            <path d="M48 8 L44 4 L44 12 Z" />
            <ellipse
              cx="24"
              cy="8"
              rx="12"
              ry="6"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <circle cx="24" cy="8" r="2.5" />
          </svg>
          <span className="font-sans text-base font-extrabold uppercase tracking-tight">
            Canopticon
          </span>
        </div>
        <div className="mt-1 font-mono text-[10px] uppercase tracking-wider text-text-faint">
          Operator
        </div>
      </div>

      <ul className="shrink-0 py-2">
        {NAV_ITEMS.map((item) => {
          const isActive = active === item.href;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                {...(onNavigate ? { onClick: onNavigate } : {})}
                className={`flex items-center gap-3 border-l-2 px-4 py-2 font-mono text-[11px] uppercase tracking-wider ${
                  isActive
                    ? "border-cream bg-cream-glow text-cream-bright"
                    : "border-transparent text-text-dim hover:border-cream-dim hover:text-cream"
                }`}
              >
                <span className="text-base leading-none">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>

      <SidebarConversations {...(onNavigate ? { onNavigate } : {})} />

      <div className="shrink-0 border-t border-border-soft px-4 py-3">
        {email ? (
          <>
            <div className="font-mono text-[9px] uppercase tracking-wider text-text-faint">
              Signed in as
            </div>
            <div className="mt-1 truncate font-mono text-[11px] text-cream-dim" title={email}>
              {email}
            </div>
            <a
              href="/cdn-cgi/access/logout"
              className="mt-2 inline-block border border-border-soft px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-cream-dim hover:border-cream-dim hover:text-cream-bright"
            >
              Sign out
            </a>
          </>
        ) : (
          <>
            <div className="font-mono text-[9px] uppercase tracking-wider text-text-faint">
              Not signed in
            </div>
            <a
              href="/"
              className="mt-2 inline-block border border-amber bg-amber/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-amber hover:bg-amber/20"
            >
              Sign in
            </a>
          </>
        )}
      </div>
    </nav>
  );
}
