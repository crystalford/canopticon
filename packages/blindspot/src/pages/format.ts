// Small formatting helpers for the movements.

/** "$2.1 trillion", "$740 billion", "$45 million" — headline-legible CAD. */
export function formatCadLong(cad: number): string {
  const abs = Math.abs(cad);
  if (abs >= 1e12) return `$${(cad / 1e12).toFixed(1)} trillion`;
  if (abs >= 1e9) return `$${Math.round(cad / 1e9)} billion`;
  if (abs >= 1e6) return `$${Math.round(cad / 1e6)} million`;
  return `$${Math.round(cad).toLocaleString("en-CA")}`;
}

/** "$7.4M", "$169k" — compact CAD for chips + axes. */
export function formatCadShort(cad: number): string {
  const abs = Math.abs(cad);
  if (abs >= 1e9) return `$${(cad / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `$${(cad / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `$${Math.round(cad / 1e3)}k`;
  return `$${Math.round(cad)}`;
}

/** ISO timestamp → "2026-07-21". Empty string for nullish. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}
