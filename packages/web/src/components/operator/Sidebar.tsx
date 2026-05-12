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
            viewBox="0 0 96 16"
            fill="currentColor"
            className="h-5 w-24 shrink-0"
            aria-hidden="true"
          >
            <title>Canopticon eye mark</title>
            {/* Left arrow ▶ */}
            <polygon points="0,1 0,15 11,8" />
            {/* Connector bar — left */}
            <rect x="13" y="7" width="14" height="2" />
            {/* Eye outline (almond / lens shape) */}
            <path
              d="M 30 8 Q 48 -1 66 8 Q 48 17 30 8 Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            />
            {/* Pupil */}
            <circle cx="48" cy="8" r="3" />
            {/* Connector bar — right */}
            <rect x="69" y="7" width="14" height="2" />
            {/* Right arrow ◀ */}
            <polygon points="96,1 96,15 85,8" />
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
