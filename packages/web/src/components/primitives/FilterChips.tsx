// Horizontal row of toggle chips for filtering lists. Operator screens
// use these on Live, Graph, Library, Sources.

export interface FilterChip<T extends string = string> {
  value: T;
  label: string;
}

export function FilterChips<T extends string>({
  chips,
  active,
  onChange,
}: {
  chips: FilterChip<T>[];
  active: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2">
      {chips.map((chip) => {
        const isActive = chip.value === active;
        return (
          <button
            key={chip.value}
            type="button"
            onClick={() => onChange(chip.value)}
            className={`whitespace-nowrap border px-3 py-1 font-mono text-[10.5px] uppercase tracking-wider ${
              isActive
                ? "border-cream bg-cream-glow text-cream-bright"
                : "border-border-soft text-text-dim hover:border-cream-dim"
            }`}
          >
            {chip.label}
          </button>
        );
      })}
    </div>
  );
}
