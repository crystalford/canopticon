// Operator sidebar — ports the design archive's op-side + op-nav structure.
// Wordmark + nav (with icon + optional count) + signed-in footer.

import Link from "next/link";
import { SidebarConversations } from "./SidebarConversations";

export interface NavItem {
  href: string;
  label: string;
  icon: string;
}

// Order matches the design archive's operator console. Posts is new
// (CMS admin — the design archive didn't have it; the spec needed one).
// Studio is a placeholder per the system spec.
export const NAV_ITEMS: NavItem[] = [
  { href: "/chat", label: "Chat", icon: "▤" },
  { href: "/posts", label: "Posts", icon: "✎" },
  { href: "/live", label: "Dashboard", icon: "◐" },
  { href: "/graph", label: "Graph", icon: "◇" },
  { href: "/sources", label: "Sources", icon: "◫" },
  { href: "/monitors", label: "Monitors", icon: "◎" },
  { href: "/library", label: "Library", icon: "☐" },
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
    <>
      <div className="op-brand">
        <Link
          href="/"
          className="block font-sans text-[22px] font-semibold tracking-tight text-[var(--ink)]"
        >
          canopticon<span className="text-[var(--signal)]">.</span>
        </Link>
        <div className="mono mt-1" style={{ fontSize: 11, color: "var(--ink-mute)" }}>
          operator console
        </div>
      </div>

      <nav className="op-nav">
        {NAV_ITEMS.map((item) => {
          const isActive = active === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              {...(onNavigate ? { onClick: onNavigate } : {})}
              className={isActive ? "on" : ""}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span
                  style={{
                    color: "var(--ink-mute)",
                    width: 14,
                    display: "inline-block",
                  }}
                >
                  {item.icon}
                </span>
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      <SidebarConversations {...(onNavigate ? { onNavigate } : {})} />

      <div className="op-side-foot">
        {email ? (
          <>
            <div>Signed in · {email}</div>
            <a
              href="/cdn-cgi/access/logout"
              className="mono"
              style={{ color: "var(--ink-3)", textDecoration: "none" }}
            >
              Sign out →
            </a>
          </>
        ) : (
          <>
            <div>Not signed in</div>
            <a href="/" className="mono" style={{ color: "var(--signal)", textDecoration: "none" }}>
              Sign in →
            </a>
          </>
        )}
      </div>
    </>
  );
}
