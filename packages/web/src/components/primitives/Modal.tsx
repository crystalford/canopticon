"use client";

// Full-viewport modal with scrim. Used for cost-approval, publish-prep,
// and confirmation dialogs.

import { useEffect } from "react";

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg-deeper/80 p-4">
      <div className="flex max-h-[90vh] w-full max-w-xl flex-col border border-border-bright bg-bg-elevated shadow-2xl">
        {title && (
          <div className="border-b border-border-soft px-4 py-3 font-mono text-[10.5px] uppercase tracking-wider text-cream-bright">
            {title}
          </div>
        )}
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 border-t border-border-soft p-3">{footer}</div>
        )}
      </div>
    </div>
  );
}
