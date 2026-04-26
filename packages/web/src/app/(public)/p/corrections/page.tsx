import { publicGet } from "@/lib/public-api";

export const runtime = "edge";

interface Correction {
  id: string;
  article_id: string;
  original_text: string | null;
  corrected_text: string;
  reason: string;
  corrected_at: string;
}

export default async function CorrectionsPage() {
  const r = await publicGet<{ corrections: Correction[] }>("/v1/public/corrections", 60).catch(
    () => ({ corrections: [] }),
  );
  const thisYear = new Date().getFullYear();
  const yearCount = r.corrections.filter(
    (c) => new Date(c.corrected_at).getFullYear() === thisYear,
  ).length;

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="mb-2 font-serif text-4xl text-[#1a1410]">Corrections</h1>
      <p className="mb-8 font-serif italic text-[#1a1410]/70">
        Every correction we've ever made, publicly. The trail is the moat.
      </p>

      <div className="mb-8 grid grid-cols-2 gap-4 border border-[#1a1410]/15 bg-[#ede4d2] p-4">
        <div>
          <div className="font-mono text-3xl text-[#1a1410]">{r.corrections.length}</div>
          <div className="font-mono text-[10.5px] uppercase tracking-wider text-[#5c4a3d]">
            Total
          </div>
        </div>
        <div>
          <div className="font-mono text-3xl text-[#1a1410]">{yearCount}</div>
          <div className="font-mono text-[10.5px] uppercase tracking-wider text-[#5c4a3d]">
            {thisYear}
          </div>
        </div>
      </div>

      <ul className="space-y-6">
        {r.corrections.map((c) => (
          <li key={c.id} className="border-b border-[#1a1410]/15 pb-4">
            <p className="font-mono text-[10.5px] uppercase tracking-wider text-[#5c4a3d]">
              {new Date(c.corrected_at).toLocaleDateString()}
            </p>
            {c.original_text && (
              <p className="mt-2 font-serif italic text-[#1a1410]/60 line-through">
                {c.original_text}
              </p>
            )}
            <p className="mt-1 font-serif text-[#1a1410]">{c.corrected_text}</p>
            <p className="mt-2 font-serif text-sm italic text-[#1a1410]/70">Why: {c.reason}</p>
          </li>
        ))}
        {r.corrections.length === 0 && (
          <li className="font-serif italic text-[#1a1410]/50">No corrections yet.</li>
        )}
      </ul>
    </div>
  );
}
