"use client";

// Client wrapper that holds the mobile drawer state and renders the
// shared Sidebar in two places: fixed-position on desktop, slide-in
// overlay on mobile.
//
// Sets data-mode="operator" on <html> so the D1+D4 dark-zinc token set
// applies under (operator)/*. The public site keeps the default near-
// white tokens.

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { MobileTopBar } from "./MobileTopBar";
import { Sidebar } from "./Sidebar";

export function OperatorShell({
  email,
  children,
}: {
  email: string | null;
  children: React.ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname() ?? "";
  const active = `/${pathname.split("/")[1] ?? ""}`;

  useEffect(() => {
    document.documentElement.dataset.mode = "operator";
    return () => {
      delete document.documentElement.dataset.mode;
    };
  }, []);

  return (
    <div className="flex min-h-screen bg-bg text-text">
      {/* Desktop sidebar — fixed on left, always visible md+ */}
      <aside className="hidden w-56 shrink-0 border-r border-border-soft md:flex md:flex-col">
        <Sidebar active={active} email={email} />
      </aside>

      {/* Mobile drawer — slides in when open */}
      {drawerOpen && (
        <>
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setDrawerOpen(false)}
            className="fixed inset-0 z-40 bg-bg-deeper/80 md:hidden"
          />
          <aside className="fixed inset-y-0 left-0 z-50 w-64 border-r border-border-soft md:hidden">
            <Sidebar active={active} email={email} onNavigate={() => setDrawerOpen(false)} />
          </aside>
        </>
      )}

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileTopBar open={drawerOpen} onToggle={() => setDrawerOpen(!drawerOpen)} />
        <main className="flex-1">
          <div className="mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
