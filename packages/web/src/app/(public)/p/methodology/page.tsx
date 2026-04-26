export const runtime = "edge";

export default function MethodologyPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12 font-serif text-lg leading-relaxed text-[#1a1410]">
      <h1 className="mb-8 font-serif text-4xl">Methodology</h1>

      <Section title="What is CANOPTICON">
        A forensic intelligence platform for Canadian political and economic structure analysis. It
        surfaces structural patterns by integrating primary documents, named entities, and
        verifiable claims into theses with explicit predictions, falsifying observations, and public
        correction logs.
      </Section>

      <Section title="Source grading (Admiralty Code)">
        Sources are graded A through F. A is primary documents (Hansard, OIC, SEDAR+ filings,
        peer-reviewed papers) with named authors and verifiable provenance. B is secondary reports
        with traceable sourcing. C is opinion or single-sourced reporting. D, E, F are progressively
        less reliable. Each thesis lists the grade distribution of its supporting evidence.
      </Section>

      <Section title="Toulmin claim structure">
        Every claim carries six fields: data (the evidence), claim (the assertion), warrant (the
        rule connecting them), backing (broader support for the warrant), qualifier (the calibrated
        language), and rebuttal (conditions under which the claim fails).
      </Section>

      <Section title="Calibrated language (IPCC scale)">
        Probabilistic claims use the IPCC verbal scale: virtually certain (≥99%), very likely
        (≥90%), likely (≥66%), about as likely as not (33–66%), unlikely (≤33%), very unlikely
        (≤10%), exceptionally unlikely (≤1%). When in doubt between adjacent qualifiers, the weaker
        is correct.
      </Section>

      <Section title="Root-striking discipline">
        Every investigation identifies its intervention level: symptom (managing effects), mechanism
        (proximate causes), or structural (root design). Theses cannot publish until they reach Why
        #4 or #5 in the Five Whys protocol — the structural condition or root design choice.
      </Section>

      <Section title="Editorial standards">
        Every published thesis ships with a methodology appendix listing sources used, grades, roles
        run, contradictions considered, coined phrase definition. The trail is the moat; critics
        must engage the evidence.
      </Section>

      <Section title="Corrections process">
        Every correction is public. The Corrections page lists what changed, when, why, and which
        item was affected. The Brier score on the prediction ledger is the operator's calibration
        track record.
      </Section>

      <Section title="Credibility-positive practices">
        We preserve contradictions rather than resolve them prematurely (machloket as legitimate
        posture). We bank predictions before outcomes. We name our operator. We publish the graph
        artifact behind every thesis so the evidence trail is independently traversable.
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8 border-t border-[#1a1410]/15 pt-6">
      <h2 className="mb-3 font-mono text-[11px] uppercase tracking-wider text-[#5c4a3d]">
        {title}
      </h2>
      <p>{children}</p>
    </section>
  );
}
