"use client";

// Mobile-only top bar with a hamburger that toggles the drawer.
// Hidden on md+.

export function MobileTopBar({
  open,
  onToggle,
}: {
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border-soft bg-bg-deeper px-4 py-3 md:hidden">
      <button
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        onClick={onToggle}
        className="grid h-8 w-8 place-items-center border border-border-soft text-cream-bright"
      >
        {open ? (
          <svg
            viewBox="0 0 16 16"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <title>Close</title>
            <path d="M3 3 L13 13 M13 3 L3 13" />
          </svg>
        ) : (
          <svg
            viewBox="0 0 16 16"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <title>Open menu</title>
            <path d="M2 4 H14 M2 8 H14 M2 12 H14" />
          </svg>
        )}
      </button>
      <div className="flex items-center gap-2 text-cream-bright">
        <svg viewBox="0 0 48 16" fill="currentColor" className="h-4 w-12" aria-hidden="true">
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
        <span className="font-sans text-sm font-extrabold uppercase tracking-tight">
          Canopticon
        </span>
      </div>
    </header>
  );
}
