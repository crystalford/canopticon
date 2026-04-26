import type { ReactNode } from "react";

export function ScreenHeader({
  title,
  subtitle,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex items-baseline justify-between gap-6 mb-6">
      <div>
        <h1 className="font-serif text-2xl text-amber leading-tight">{title}</h1>
        {subtitle && (
          <p className="text-text-dim font-mono text-xs uppercase tracking-widest mt-1">
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </header>
  );
}

export function StatList({
  stats,
}: {
  stats: Array<{ label: string; value: ReactNode }>;
}) {
  return (
    <div className="grid gap-2 grid-cols-2 sm:grid-cols-4">
      {stats.map((s) => (
        <div key={s.label}>
          <p className="text-text-faint font-mono text-xs uppercase tracking-widest">{s.label}</p>
          <p className="text-cream font-serif">{s.value}</p>
        </div>
      ))}
    </div>
  );
}
