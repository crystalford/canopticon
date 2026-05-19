"use client";

// Operator app shell — ports the design archive's op-shell + op-side +
// op-main + op-header structure. Sticky sidebar on left (collapses to
// a bottom-bar on mobile via the CSS), sticky header on top with the
// screen title + activity coord.
//
// Sets data-mode="operator" on <html> so the dark zinc token set
// applies. The public site keeps the default near-white tokens.

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { Sidebar } from "./Sidebar";

const SCREEN_TITLES: Record<string, string> = {
  "/chat": "Chat",
  "/posts": "Posts",
  "/live": "Dashboard",
  "/graph": "Knowledge graph",
  "/sources": "Sources",
  "/monitors": "Monitors",
  "/library": "Library",
  "/system": "System",
  "/studio": "Studio",
};

export function OperatorShell({
  email,
  children,
}: {
  email: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "";
  const active = `/${pathname.split("/")[1] ?? ""}`;
  const title = SCREEN_TITLES[active] ?? "Operator";

  useEffect(() => {
    document.documentElement.dataset.mode = "operator";
    return () => {
      delete document.documentElement.dataset.mode;
    };
  }, []);

  return (
    <div className="op-shell">
      <aside className="op-side">
        <Sidebar active={active} email={email} />
      </aside>
      <main className="op-main">
        <div className="op-header">
          <div className="op-header-title">{title}</div>
          <div className="op-header-coord">
            <span
              style={{
                display: "inline-block",
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "var(--verified)",
                marginRight: 8,
                verticalAlign: "middle",
              }}
            />
            online
          </div>
        </div>
        <div className="op-content fade-up" key={active}>
          {children}
        </div>
      </main>
    </div>
  );
}
