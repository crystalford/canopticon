import { publicGet } from "@/lib/public-api";

export const runtime = "edge";

interface PubPrediction {
  slug: string;
  statement: string;
  confidence_pct: number;
  ipcc_likelihood?: string | null;
  resolution_criterion: string;
  resolution_horizon: string;
  domain?: string | null;
  status: string;
  resolved_at?: string | null;
  resolved_outcome?: string | null;
  brier_contribution?: number | null;
}

export default async function PredictionsPage() {
  const r = await publicGet<{ predictions: PubPrediction[] }>("/v1/public/predictions", 60).catch(
    () => ({ predictions: [] }),
  );
  const active = r.predictions.filter((p) => p.status === "active");
  const resolved = r.predictions.filter((p) => p.status !== "active");
  const brierTotal = resolved.reduce((s, p) => s + (p.brier_contribution ?? 0), 0);
  const rolling = resolved.length > 0 ? brierTotal / resolved.length : null;

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="mb-2 font-serif text-4xl text-[#1a1410]">Prediction Ledger</h1>
      <p className="mb-8 font-serif italic text-[#1a1410]/70">
        Every probabilistic call we've banked, and how they've resolved.
      </p>

      <div className="mb-8 grid grid-cols-3 gap-4 border border-[#1a1410]/15 bg-[#ede4d2] p-4 font-mono text-[10.5px] uppercase tracking-wider">
        <div>
          <div className="text-3xl font-normal text-[#1a1410]">{active.length}</div>
          <div className="text-[#5c4a3d]">Active</div>
        </div>
        <div>
          <div className="text-3xl font-normal text-[#1a1410]">{resolved.length}</div>
          <div className="text-[#5c4a3d]">Resolved</div>
        </div>
        <div>
          <div className="text-3xl font-normal text-[#9c2333]">
            {rolling !== null ? rolling.toFixed(3) : "—"}
          </div>
          <div className="text-[#5c4a3d]">Brier (rolling)</div>
        </div>
      </div>

      <h2 className="mb-3 font-mono text-[11px] uppercase tracking-wider text-[#5c4a3d]">Active</h2>
      <table className="mb-12 w-full border-collapse border border-[#1a1410]/15 font-serif text-sm">
        <thead className="bg-[#ede4d2] font-mono text-[10.5px] uppercase tracking-wider text-[#5c4a3d]">
          <tr>
            <th className="border border-[#1a1410]/15 p-2 text-left">Statement</th>
            <th className="border border-[#1a1410]/15 p-2">Conf</th>
            <th className="border border-[#1a1410]/15 p-2">By</th>
            <th className="border border-[#1a1410]/15 p-2">Domain</th>
          </tr>
        </thead>
        <tbody>
          {active.map((p) => (
            <tr key={p.slug}>
              <td className="border border-[#1a1410]/15 p-2">{p.statement}</td>
              <td className="border border-[#1a1410]/15 p-2 text-center">{p.confidence_pct}%</td>
              <td className="border border-[#1a1410]/15 p-2 text-center">{p.resolution_horizon}</td>
              <td className="border border-[#1a1410]/15 p-2 text-center">{p.domain ?? "—"}</td>
            </tr>
          ))}
          {active.length === 0 && (
            <tr>
              <td colSpan={4} className="p-4 text-center italic text-[#1a1410]/50">
                No active predictions.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <h2 className="mb-3 font-mono text-[11px] uppercase tracking-wider text-[#5c4a3d]">
        Resolved
      </h2>
      <table className="w-full border-collapse border border-[#1a1410]/15 font-serif text-sm">
        <thead className="bg-[#ede4d2] font-mono text-[10.5px] uppercase tracking-wider text-[#5c4a3d]">
          <tr>
            <th className="border border-[#1a1410]/15 p-2 text-left">Statement</th>
            <th className="border border-[#1a1410]/15 p-2">Conf</th>
            <th className="border border-[#1a1410]/15 p-2">Outcome</th>
            <th className="border border-[#1a1410]/15 p-2">Brier</th>
          </tr>
        </thead>
        <tbody>
          {resolved.map((p) => (
            <tr key={p.slug}>
              <td className="border border-[#1a1410]/15 p-2">{p.statement}</td>
              <td className="border border-[#1a1410]/15 p-2 text-center">{p.confidence_pct}%</td>
              <td className="border border-[#1a1410]/15 p-2 text-center">
                {p.resolved_outcome ?? p.status}
              </td>
              <td className="border border-[#1a1410]/15 p-2 text-center">
                {p.brier_contribution?.toFixed(3) ?? "—"}
              </td>
            </tr>
          ))}
          {resolved.length === 0 && (
            <tr>
              <td colSpan={4} className="p-4 text-center italic text-[#1a1410]/50">
                No resolved predictions yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
