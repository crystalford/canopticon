import { ScreenHeader } from "@/components/primitives";

export const revalidate = 3600;

export default function MethodologyPage() {
  return (
    <div className="px-6 py-12 max-w-3xl mx-auto">
      <ScreenHeader title="Methodology" subtitle="how claims, theses, and predictions get made" />

      <section className="mt-8 space-y-6 text-text leading-relaxed">
        <h2 className="font-serif text-xl text-cream mt-8">Substrate</h2>
        <p>
          Every public-facing claim is stored as a substrate row with a version history. Claims
          carry an Admiralty grade (A–F) for source reliability and a verification status drawn from
          a documentary check by an independent model. Nothing is published from memory.
        </p>

        <h2 className="font-serif text-xl text-cream mt-8">Theses</h2>
        <p>
          A thesis is a structured argument: a single sentence claim, a BLUF (bottom line up front),
          and three progressively longer renderings (80, 800, full). Claims integrated into a thesis
          are tagged by layer — factual, framing, architectural, distributive — so a reader can see
          where the load-bearing weight sits.
        </p>
        <p>When a thesis is published, three roles fire on it before it goes live:</p>
        <ul className="list-disc list-inside space-y-1 text-text-dim">
          <li>
            <span className="text-text">Tier Projector</span> — regenerates the BLUF / 80 / 800 /
            full from current claim state.
          </li>
          <li>
            <span className="text-text">Red Team</span> — surfaces the strongest objections; each
            becomes a tracked contradiction.
          </li>
          <li>
            <span className="text-text">Steelman</span> — articulates the strongest opposing
            position; its load-bearing assumptions are recorded as linchpins.
          </li>
        </ul>

        <h2 className="font-serif text-xl text-cream mt-8">Predictions</h2>
        <p>
          Forecasts attached to a thesis are scored against outcomes using Brier (squared-error)
          loss. Before any forecast is committed, a Premortem run imagines the prediction is wrong
          on the resolution date and surfaces the failure modes that would explain it. Any
          load-bearing assumption it depends on is added to the assumptions ledger. Operators are
          encouraged to revise probabilities downward when the Premortem flags a calibration
          mismatch.
        </p>
        <p>
          The rolling Brier average is published. It includes resolved-incorrect outcomes. We do not
          silently retire predictions.
        </p>

        <h2 className="font-serif text-xl text-cream mt-8">IPCC qualifiers</h2>
        <p>
          BLUFs and predictions can carry an IPCC-style likelihood qualifier (virtually certain,
          extremely likely, very likely, likely, more likely than not, about as likely as not,
          unlikely, very unlikely, extremely unlikely, exceptionally unlikely). These map to
          probability bands and are constrained by the underlying claim grades — a thesis built on
          grade-D evidence cannot honestly carry a &quot;virtually certain&quot; qualifier.
        </p>

        <h2 className="font-serif text-xl text-cream mt-8">Contradictions and machloket</h2>
        <p>
          Contradictions surfaced by Red Team — or noticed by readers — are tracked open until
          resolved or marked machloket (a documented disagreement that the evidence does not
          settle). Dismissing a contradiction requires a written note. Resolution and dismissal are
          both logged.
        </p>

        <h2 className="font-serif text-xl text-cream mt-8">Articles and corrections</h2>
        <p>
          Articles draw on the substrate but are written separately. Each carries a version history;
          corrections are appended below the body and never edited away. A retracted article remains
          visible with a retraction notice — the substrate it cited stays accessible.
        </p>
      </section>
    </div>
  );
}
