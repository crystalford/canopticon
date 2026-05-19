export const runtime = "edge";

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12 font-serif text-lg leading-relaxed text-[var(--ink)]">
      <h1 className="mb-8 font-serif text-4xl">About</h1>
      <p>
        CANOPTICON is a forensic intelligence platform built and operated by a single named human
        editor. It analyzes Canadian political and economic structure using calibrated language,
        provenance discipline, root-striking analysis, and explicit falsifiability.
      </p>
      <p className="mt-4">
        The system holds no autonomous publishing power. Every public output passes through an
        operator review with explicit gates: coined phrase declared, predictions banked, teachable
        diagram linked, methodology appendix written, public graph artifact wired, named
        accountability declared.
      </p>
      <p className="mt-4">
        The operator's identity, contact, and editorial standards are visible. Corrections are
        public. The Brier score on the prediction ledger is the track record. There is no anonymous
        publishing here.
      </p>
      <h2 className="mt-12 mb-3 font-mono text-[11px] uppercase tracking-wider text-[var(--ink-mute)]">
        Funding
      </h2>
      <p>
        Self-funded. No advertising, no sponsorship, no subscriber-paid editorial influence. If that
        changes, this section will reflect it.
      </p>
      <h2 className="mt-12 mb-3 font-mono text-[11px] uppercase tracking-wider text-[var(--ink-mute)]">
        Contact
      </h2>
      <p>Subscribe via the Subscribe page. For corrections, see the Corrections page.</p>
    </div>
  );
}
