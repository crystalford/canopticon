// Seed corpus — distilled from the PROBE design build's data.js.
// Topics + entities + canonical investigations + capsule bios.
// The 65-report library content stays in R2 (separate ingest path);
// this module bootstraps the structural skeleton so the public
// surfaces and the operator console light up immediately.

export interface SeedTopic {
  slug: string;
  label: string;
  overview_md: string;
  sort_order: number;
}

export interface SeedEntity {
  slug: string;
  canonical_name: string;
  kind: "person" | "org" | "institution" | "concept";
  entity_type: string; // legacy column constraint
  current_role: string | null;
  bio_md: string;
}

export interface SeedPiece {
  slug: string;
  title: string;
  subtitle: string;
  kind: "essay" | "research-report" | "documented-record" | "thesis" | "synthesis" | "brief";
  publication_status: "published" | "canonical";
  body_md: string;
  byline: string;
  topics: string[];
}

export const SEED_TOPICS: SeedTopic[] = [
  {
    slug: "monetary-power",
    label: "Monetary power",
    overview_md:
      "Monetary power is the quietest kind of power: it moves through rate decisions and prudential rules that almost no one reads, and it redistributes wealth before anyone votes on anything. This hub gathers the investigations and entities that trace how Canada's monetary architecture works, who staffs it, and whose balance sheets it protects.",
    sort_order: 10,
  },
  {
    slug: "housing",
    label: "Housing & financialization",
    overview_md:
      'The Canadian housing debate runs on a frame: "we have a supply problem." This hub follows where that frame came from, who it serves, and the quieter levers — credit rules like B-20, the wealth effects of monetary policy — that the frame keeps off the table.',
    sort_order: 20,
  },
  {
    slug: "capital-capture",
    label: "Capital & capture",
    overview_md:
      "Infrastructure and pension capital sit at the seam between public money and private returns. This hub tracks the funds, the executives, and the federal contracts that move through that seam — and the personnel who move with them.",
    sort_order: 30,
  },
];

export const SEED_ENTITIES: SeedEntity[] = [
  {
    slug: "mark-carney",
    canonical_name: "Mark Carney",
    kind: "person",
    entity_type: "person",
    current_role: "Prime Minister of Canada (2025–)",
    bio_md:
      "Mark Carney is the Prime Minister of Canada, sworn in March 2025. A career central banker, he led the Bank of Canada (2008–2013) and the Bank of England (2013–2020) before serving as chair of Brookfield Asset Management (2020–2025). He is the first Canadian prime minister to arrive directly from the senior ranks of global finance rather than electoral politics.",
  },
  {
    slug: "dana-whitfield",
    canonical_name: "Dana Whitfield",
    kind: "person",
    entity_type: "person",
    current_role: "Minister of Finance",
    bio_md:
      "Dana Whitfield serves as Minister of Finance under Prime Minister Mark Carney. The Finance portfolio holds the parliamentary instrument for OSFI and the Bank of Canada Act.",
  },
  {
    slug: "devin-rourke",
    canonical_name: "Devin Rourke",
    kind: "person",
    entity_type: "person",
    current_role: 'Political-economy commentator · "The Through-Line"',
    bio_md:
      "Devin Rourke is a Canadian political-economy commentator whose work centres on monetary architecture, prudential regulation, and the housing-supply frame.",
  },
  {
    slug: "lena-maddox",
    canonical_name: "Lena Maddox",
    kind: "person",
    entity_type: "person",
    current_role: "Executive · Meridian Capital",
    bio_md:
      "Lena Maddox is an executive at Meridian Capital, a private-credit and infrastructure firm that co-invests with Brookfield on Canadian regulated-utility platforms.",
  },
  {
    slug: "brookfield",
    canonical_name: "Brookfield Asset Management",
    kind: "institution",
    entity_type: "corporation",
    current_role: "Global alternative-asset manager",
    bio_md:
      "Brookfield Asset Management is a Toronto-headquartered alternative-asset manager with significant infrastructure, renewable-power, and private-credit platforms. Mark Carney served as chair from 2020 to 2025.",
  },
  {
    slug: "bank-of-canada",
    canonical_name: "Bank of Canada",
    kind: "institution",
    entity_type: "institution",
    current_role: "Central bank · monetary policy",
    bio_md:
      "Canada's central bank, statutory operator of monetary policy. Carney served as Governor 2008–2013; the institution is co-regulated with OSFI on prudential matters.",
  },
  {
    slug: "osfi",
    canonical_name: "OSFI",
    kind: "institution",
    entity_type: "institution",
    current_role: "Office of the Superintendent of Financial Institutions",
    bio_md:
      "The federal prudential regulator. Owns the B-20 stress test framework; reports to the Minister of Finance; co-regulates the banking system with the Bank of Canada.",
  },
  {
    slug: "b-20-stress-test",
    canonical_name: "B-20 stress test",
    kind: "concept",
    entity_type: "concept",
    current_role: "OSFI residential-mortgage stress test",
    bio_md:
      "The OSFI prudential guideline that requires federally regulated lenders to qualify uninsured borrowers at a stressed rate. Revisions and the political pressure around them are the most-tracked piece of Canada's housing-credit architecture.",
  },
];

export const SEED_PIECES: SeedPiece[] = [
  {
    slug: "the-carney-pattern",
    title: "The Carney Pattern",
    subtitle:
      "The same pattern, documented four times — across four institutions, over seventeen years.",
    kind: "documented-record",
    publication_status: "canonical",
    body_md:
      "Mark Carney has built his entire career on one argument: without strict rules, people in power will always choose what benefits them now over what is right for the future.\n\nEvery major job he has held was given to him in large part because of that argument. Every institution he has built since has operated without those rules. This is the documented record of that pattern.\n\nA structural record: the same pattern, documented four times, across four institutions, over seventeen years. Built only from dated, public, primary sources — every claim links to one. The pattern holds whether or not any of it was intentional.\n\n_This is the seed entry. A fuller version of this piece is in the design build's documented-record exemplar (see canopticon-sample-documented-record.html in the handoff package); subsequent edits will replace this stub with the full body._",
    byline: "the operator",
    topics: ["monetary-power", "capital-capture"],
  },
  {
    slug: "monetary-architecture",
    title: "Canada's monetary architecture is structurally captured",
    subtitle: "How prudential rules and personnel together protect incumbent balance sheets.",
    kind: "research-report",
    publication_status: "published",
    body_md:
      "Canada's monetary architecture — the Bank of Canada, OSFI, and the prudential rules they jointly operate — is structurally captured by the financial sector it regulates.\n\nThis is the research-report version of the argument: the institutions, the personnel pipeline, and the rule-set that together produce a regulatory environment more solicitous of incumbent bank balance sheets than of either credit access or systemic risk.\n\n_Seed stub — replaced with the full v1.7 research-report body in a follow-up commit._",
    byline: "the operator",
    topics: ["monetary-power"],
  },
  {
    slug: "rear-view-mirror",
    title: "The rear-view-mirror government",
    subtitle:
      "The apex argument — a central-banker prime minister, a captured monetary architecture, a housing frame that absolves it.",
    kind: "thesis",
    publication_status: "canonical",
    body_md:
      "The rear-view-mirror government is the flagship thesis: a central-banker prime minister, a captured monetary architecture, a housing frame that absolves it, and a capital class that loops public money through private hands — read together, one disposition seen from four angles.\n\n_Seed stub — replaced with the full thesis body in a follow-up commit._",
    byline: "the operator",
    topics: ["monetary-power", "capital-capture", "housing"],
  },
  {
    slug: "housing-supply-frame",
    title: "The housing-supply frame",
    subtitle: "How a single framing came to dominate the housing debate.",
    kind: "research-report",
    publication_status: "published",
    body_md:
      'The Canadian housing debate runs on a frame: "we have a supply problem." This piece follows where that frame came from, who it serves, and the quieter levers — credit rules like B-20, the wealth effects of monetary policy — that the frame keeps off the table.\n\n_Seed stub — replaced with the full brief body in a follow-up commit._',
    byline: "the operator",
    topics: ["housing"],
  },
  {
    slug: "revolving-door-brookfield",
    title: "Brookfield contract concentration tracks personnel movement",
    subtitle: "Federal infrastructure contracts and the executives that move alongside them.",
    kind: "research-report",
    publication_status: "published",
    body_md:
      "Brookfield-controlled entities held $847M in federal contracts over 2020–2025, a 312% step-change from the prior window. The concentration tracks the executive pipeline between Brookfield, the federal infrastructure vehicle, and senior cabinet positions.\n\n_Seed stub — replaced with the full v0.9 body in a follow-up commit._",
    byline: "the operator",
    topics: ["capital-capture"],
  },
];

// Map each entity to its home topic(s), keeping the relationships from
// the design's data.js topics.entities arrays.
export const SEED_TOPIC_ENTITIES: Record<string, string[]> = {
  "monetary-power": ["bank-of-canada", "osfi", "mark-carney", "dana-whitfield"],
  housing: ["b-20-stress-test", "osfi", "devin-rourke"],
  "capital-capture": ["brookfield", "lena-maddox", "mark-carney"],
};
