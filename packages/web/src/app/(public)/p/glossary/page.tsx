export const runtime = "edge";

interface GlossaryEntry {
  term: string;
  definition: string;
  category: "epistemic" | "system" | "operational" | "regional";
}

const entries: GlossaryEntry[] = [
  {
    term: "Admiralty Code",
    definition:
      "Six-grade source reliability scale (A best, F lowest) used by the Ingestion Critic role.",
    category: "epistemic",
  },
  {
    term: "Backing",
    definition: "In Toulmin structure, the broader support for the warrant.",
    category: "epistemic",
  },
  {
    term: "BLUF",
    definition: "Bottom Line Up Front. The single-sentence tier of a thesis.",
    category: "system",
  },
  {
    term: "Brier score",
    definition: "A measure of probabilistic forecast calibration; lower is better.",
    category: "epistemic",
  },
  {
    term: "Cascade",
    definition:
      "The orchestrated 16-step run that ingests sources, extracts claims, and refreshes thesis tiers.",
    category: "operational",
  },
  {
    term: "Coined phrase",
    definition:
      "A short transmissible label compressing a thesis's structural finding. Required before publication.",
    category: "epistemic",
  },
  {
    term: "Cynefin",
    definition:
      "A sense-making framework distinguishing simple, complicated, complex, and chaotic domains.",
    category: "epistemic",
  },
  {
    term: "Falsifying observation",
    definition: "A specific observable outcome that, if seen, would refute the thesis.",
    category: "epistemic",
  },
  {
    term: "IPCC scale",
    definition:
      "Verbal probability scale: virtually certain, very likely, likely, about as likely as not, unlikely, very unlikely, exceptionally unlikely.",
    category: "epistemic",
  },
  {
    term: "Linchpin",
    definition: "An assumption or claim whose collapse would invalidate the thesis.",
    category: "system",
  },
  {
    term: "Machloket",
    definition:
      "A productive disagreement preserved as legitimate posture rather than resolved prematurely.",
    category: "epistemic",
  },
  {
    term: "OSFI",
    definition: "Office of the Superintendent of Financial Institutions (Canada).",
    category: "regional",
  },
  {
    term: "Premortem",
    definition:
      "Analysis imagining the thesis has failed and reasoning backward to identify falsifying conditions.",
    category: "operational",
  },
  {
    term: "Red Team",
    definition: "Adversarial role producing severity-graded objections from one of six vantages.",
    category: "operational",
  },
  {
    term: "Root-striking",
    definition:
      "Discipline of identifying intervention levels (symptom, mechanism, structural) and refusing to publish theses that haven't reached the structural level.",
    category: "epistemic",
  },
  { term: "SEDAR+", definition: "Canadian securities filings repository.", category: "regional" },
  {
    term: "Steelman",
    definition: "Constructing the strongest version of an opposing position before evaluating it.",
    category: "operational",
  },
  {
    term: "Toulmin",
    definition:
      "Argumentation framework with six elements: data, claim, warrant, backing, qualifier, rebuttal.",
    category: "epistemic",
  },
  {
    term: "Watch set",
    definition:
      "The list of entities pinned to a thesis that route incoming claims to the thesis inbox.",
    category: "system",
  },
];

export default function GlossaryPage() {
  const sorted = [...entries].sort((a, b) => a.term.localeCompare(b.term));
  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="mb-8 font-serif text-4xl text-[#1a1410]">Glossary</h1>
      <dl className="space-y-4">
        {sorted.map((e) => (
          <div key={e.term}>
            <dt className="font-mono text-[10.5px] uppercase tracking-wider text-[#5c4a3d]">
              {e.category}
            </dt>
            <dt className="font-serif text-xl text-[#1a1410]">{e.term}</dt>
            <dd className="mt-1 font-serif text-base leading-relaxed text-[#1a1410]/80">
              {e.definition}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
