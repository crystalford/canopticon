// The evidence checks (the Record method, Phase 2): is each cited sentence
// as strong as what it cites? In code, no model, nothing billed.
//
// The quotation check proves words are on a page; the citation check proves
// [n] names a listed source; the support check asks a model whether the
// cited passages state the sentence. None of them asks three plainer
// questions a careful editor asks first:
//
//  - Is the figure on the page the sentence cites? (A figure found on some
//    page read, but not the one cited, is the commonest way a report goes
//    wrong without any quotation failing: the right number, the wrong
//    source — or a number from one study credited to another.)
//  - Is the certainty earned? "Very likely", "demonstrates", "established"
//    resting only on news, a preprint or an encyclopedia says more than its
//    evidence (GRADE: certainty follows the kind of study, not the prose).
//  - Does a Key Finding stand on one publisher? The record's own warning:
//    three pages agreeing may be one upstream page echoing.
//
// A source's kind is read from its address and title by rules a person can
// check (`sourceKind`). Advisory: the writer is told on every write_section,
// and the engine test reports the counts.

import { siteOf } from "./independence";
import { type Note, sourceNumbers } from "./notes";
import type { ResearchSource } from "./research";
import { citedSentences } from "./support";

export type SourceKind =
  | "official"
  | "review"
  | "study"
  | "academic"
  | "book"
  | "preprint"
  | "news"
  | "reference"
  | "other";

/** The kinds that can carry a strong claim on their own. */
export const STRONG_KINDS = new Set<SourceKind>([
  "official",
  "review",
  "study",
  "academic",
  "book",
]);

export const KIND_LABEL: Record<SourceKind, string> = {
  official: "official",
  review: "systematic review",
  study: "peer-reviewed study",
  academic: "university or scholarly page",
  book: "book",
  preprint: "preprint or working paper",
  news: "news",
  reference: "encyclopedia",
  other: "other",
};

const OFFICIAL =
  /(^|\.)(gov|mil)(\.[a-z]{2})?$|\.gc\.ca$|\.gov\.[a-z]{2,3}$|\.gouv\.[a-z]{2}$|\.gob\.[a-z]{2}$|\.govt\.nz$|\.go\.(jp|kr|th|id)$|(^|\.)(canada|ontario|quebec|alberta|manitoba|saskatchewan|novascotia|gnb|princeedwardisland)\.ca$|(^|\.)(gov\.bc|gov\.nl|gov\.nt|gov\.nu|gov\.yk)\.ca$|(^|\.)statcan\.gc\.ca$|(^|\.)(europa\.eu|who\.int|oecd\.org|worldbank\.org|imf\.org|un\.org|unesco\.org|ilo\.org|wto\.org|bis\.org|bankofcanada\.ca|parl\.ca|ourcommons\.ca|sencanada\.ca|legislation\.gov\.uk|ons\.gov\.uk)$|\.int$/;
const PREPRINT =
  /(^|\.)(arxiv\.org|ssrn\.com|osf\.io|medrxiv\.org|biorxiv\.org|nber\.org|researchsquare\.com|preprints\.org|ideas\.repec\.org|econpapers\.repec\.org|socarxiv\.org|psyarxiv\.com|iza\.org|docs\.iza\.org|cepr\.org|nber\.org|brookings\.edu)$/;
const STUDY =
  /(^|\.)(doi\.org|sciencedirect\.com|springer\.com|link\.springer\.com|wiley\.com|onlinelibrary\.wiley\.com|tandfonline\.com|jstor\.org|nature\.com|sagepub\.com|academic\.oup\.com|cambridge\.org|ncbi\.nlm\.nih\.gov|pubmed\.ncbi\.nlm\.nih\.gov|europepmc\.org|plos\.org|journals\.plos\.org|bmj\.com|thelancet\.com|jamanetwork\.com|nejm\.org|frontiersin\.org|mdpi\.com|muse\.jhu\.edu|cmaj\.ca|utpjournals\.press|annualreviews\.org|science\.org|pnas\.org|aeaweb\.org|cdnsciencepub\.com|elifesciences\.org|biomedcentral\.com|hindawi\.com|dl\.acm\.org|ieeexplore\.ieee\.org|emerald\.com|degruyter\.com|karger\.com|liebertpub\.com|healthaffairs\.org|journals\.uchicago\.edu|journals\.sagepub\.com|doaj\.org|scielo\.org|semanticscholar\.org)$/;
const ACADEMIC =
  /(^|\.)edu(\.[a-z]{2})?$|\.ac\.[a-z]{2}$|(^|\.)(utoronto|ubc|mcgill|uwaterloo|queensu|ualberta|yorku|uottawa|sfu|dal|usask|umanitoba|uvic|carleton|concordia|mcmaster|uwo|umontreal|ulaval)\.ca$|(^|\.)(plato\.stanford\.edu|iep\.utm\.edu)$/;
/** Open Journal Systems, the software most small journals run on:
 *  /index.php/<journal>/article/… (live: the Canadian Journal of
 *  Communication, DiGRA's proceedings and a university journal had all
 *  been counted as "other"). */
const JOURNAL_PATH = /\/index\.php\/[^/]+\/(?:article|dl\/article)\/|\/index\.php\/dl\/article\//i;
const JOURNAL_HOST =
  /(^|\.)(cjc-online\.ca|gamestudies\.org|dl\.digra\.org|journals\.openedition\.org|ojs\.[a-z.]+|erudit\.org|persee\.fr|scholarsportal\.info|projecteuclid\.org|jmir\.org|aclanthology\.org|openreview\.net|proceedings\.mlr\.press)$/;
const BOOK = /(^|\.)(openlibrary\.org|books\.google\.[a-z.]+|gutenberg\.org)$/;
const NEWS =
  /(^|\.)(nytimes\.com|washingtonpost\.com|theguardian\.com|bbc\.co\.uk|bbc\.com|cbc\.ca|theglobeandmail\.com|thestar\.com|nationalpost\.com|reuters\.com|apnews\.com|bloomberg\.com|ft\.com|wsj\.com|economist\.com|cnn\.com|npr\.org|politico\.com|politico\.eu|theatlantic\.com|newyorker\.com|vox\.com|axios\.com|ctvnews\.ca|globalnews\.ca|macleans\.ca|latimes\.com|usatoday\.com|independent\.co\.uk|telegraph\.co\.uk|aljazeera\.com|theconversation\.com|thetyee\.ca|torontolife\.com|financialpost\.com|businessinsider\.com|forbes\.com|time\.com|wired\.com|theverge\.com|nbcnews\.com|cbsnews\.com|abcnews\.go\.com|foxnews\.com|lapresse\.ca|ledevoir\.com|radio-canada\.ca|thehill\.com|slate\.com|salon\.com|vice\.com|huffpost\.com|lemonde\.fr|spiegel\.de|scmp\.com|smh\.com\.au|thenarwhal\.ca|cp24\.com|citynews\.ca|torontosun\.com|vancouversun\.com|calgaryherald\.com|ottawacitizen\.com|montrealgazette\.com|edmontonjournal\.com)$/;
const REFERENCE = /(^|\.)(wikipedia\.org|britannica\.com|wikiwand\.com|encyclopedia\.com)$/;

/** What kind of source a page is, from its address and title. The rules are
 *  plain on purpose: a person can see why a page was counted as it was. */
export function sourceKind(url: string, title?: string | null): SourceKind {
  const site = siteOf(url).toLowerCase();
  const t = (title ?? "").toLowerCase();
  if (/systematic review|meta-analy|umbrella review|scoping review|cochrane/.test(t))
    return "review";
  if (/(^|\.)cochranelibrary\.com$/.test(site)) return "review";
  if (REFERENCE.test(site)) return "reference";
  if (OFFICIAL.test(site)) return "official";
  if (PREPRINT.test(site) || /working paper|discussion paper|preprint/.test(t)) return "preprint";
  if (STUDY.test(site) || JOURNAL_PATH.test(url) || JOURNAL_HOST.test(site)) return "study";
  if (BOOK.test(site) || /^archive\.org$/.test(site)) return "book";
  if (ACADEMIC.test(site)) return "academic";
  if (NEWS.test(site)) return "news";
  return "other";
}

/** The kinds whose host is a platform, not a voice: a journal publisher, a
 *  working-paper series or a repository carries papers by independent
 *  authors (live, seven NBER working papers by different economists had
 *  been counted as one publisher, and a 26-source report as "about 5"
 *  independent). */
const PLATFORM_KINDS = new Set<SourceKind>(["study", "preprint", "review", "book"]);

/** The unit of independence: for a paper or a book, the work itself (its
 *  address, an archived copy unwrapped); for anything else, the site — an
 *  agency's or a newspaper's pages are one voice. */
export function voiceOf(url: string, title?: string | null): string {
  if (!PLATFORM_KINDS.has(sourceKind(url, title))) return siteOf(url);
  const copy = /^https?:\/\/web\.archive\.org\/web\/[^/]+\/(.+)$/i.exec(url);
  return (copy?.[1] ?? url)
    .replace(/^https?:\/\/(www\.)?/i, "")
    .replace(/#.*$/, "")
    .replace(/\/+$/, "")
    .toLowerCase();
}

/** Words that claim a high certainty (the IPCC scale's top terms; GRADE's
 *  strong verbs). */
const STRONG =
  /\b(virtually certain|extremely likely|very likely|demonstrat(?:es|ed|ing)|establish(?:es|ed)|prov(?:es|ed|en)|conclusive(?:ly)?|definitive(?:ly)?|beyond (?:reasonable )?doubt|confirm(?:s|ed)|settled)\b/i;

/** A finding that says whose it is ("Logan and Iseri state…", "per
 *  Statistics Canada", "Katz and Katz report…") is honest about standing on
 *  one source; only an unattributed one is flagged (live, eight of eight
 *  McLuhan findings were flagged, most of them attributed). */
const ATTRIBUTED_TO = /\b(?:according to|per|citing|cited by)\s+(?:the\s+)?[A-Z][\w'’.-]+/;
/** A named source: two capitalised words ("Statistics Canada", "Low Pay
 *  Commission"), names joined by "and", or a possessive ("the UK's"). */
const NAMED =
  /\b[A-Z][\w'’.-]+(?:\s+(?:and|&|of|the)?\s*[A-Z][\w'’.-]+)+|\b[A-Z][\w.-]*(?:'s|’s|s'|s’)(?=\s|$)/;
/** "Tyler's critique", "the McLuhans' own words": a named author's own
 *  work, which a single citation to that work is honest about. */
const THEIR_WORK =
  /\b[A-Z][\w.-]*(?:'s|’s|s'|s’)\s+(?:own\s+)?(?:critique|verdict|account|reading|argument|view|claim|claims|finding|findings|estimate|estimates|review|analysis|study|survey|data|report|words|position|definition|model|theory|reply|response|thesis|book|paper|essay)\b/;
const REPORTING =
  /\b(?:report|reports|reported|state|states|stated|find|finds|found|argue|argues|argued|write|writes|wrote|say|says|said|show|shows|showed|estimate|estimates|estimated|read|reads|conclude|concludes|concluded|note|notes|noted|count|counts|counted|describe|describes|described|call|calls|called|attribute|attributes|attributed|extend|extends|extended|concede|concedes|conceded|record|records|recorded|put|puts|give|gives|gave|measure|measures|measured|claimed|propose|proposes|proposed)\b/;
/** A surname straight before its verb ("Wolfson concludes") counts too. */
const NAME_THEN_VERB = new RegExp(
  `\\b[A-Z][\\w'’.-]+(?:'s|’s)?(?:\\s+(?:also|then|later|first|explicitly|repeatedly|himself|herself|themselves|itself))?\\s+${REPORTING.source}`,
);
const attributed = (sentence: string) => {
  const s = sentence.replace(/[*_`]/g, "");
  return (
    (ATTRIBUTED_TO.test(s) && NAMED.test(s)) ||
    (NAMED.test(s) && REPORTING.test(s)) ||
    NAME_THEN_VERB.test(s) ||
    THEIR_WORK.test(s)
  );
};

/** A figure a reader checks: separators, a decimal, a percentage, a dollar
 *  amount, or three or more digits (years aside). */
const FIGURE =
  /(?<![\w.])\d{1,3}(?:[,   ]\d{3})+(?:\.\d+)?(?![\d])|(?<![\w.,])\d+\.\d+(?![\d])|(?<![\w.,$])\d+(?=\s?(?:%|per ?cent))|(?<=\$)\d+(?![\d.,])|(?<![\w.,])\d{3,}(?![\d,])/g;

const digits = (x: string) => x.replace(/(?<=\d)[,   ](?=\d{3}(?!\d))/g, "");
const isYear = (x: string) => /^(1[5-9]|20)\d{2}$/.test(x);
const unquoted = (s: string) => s.replace(/["“][^"”]*["”]/g, " ");
const has = (text: string, figure: string) =>
  new RegExp(`(?<![\\d.])${figure.replace(/\./g, "\\.")}(?![\\d])`).test(text);

interface Sentence {
  where: string;
  sentence: string;
  cites: number[];
}

/** Key Findings bullets that cite a source, as sentences. */
function findingSentences(report: string): Sentence[] {
  const body = `\n${report}`;
  const at = body.indexOf("\n## Key Findings");
  if (at < 0) return [];
  const rest = body.slice(at + "\n## Key Findings".length);
  const end = rest.search(/\n## /);
  return (end < 0 ? rest : rest.slice(0, end))
    .split("\n")
    .map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "").trim())
    .filter((l) => l.length >= 20)
    .map((l) => ({
      where: "Key Findings",
      sentence: l.replace(/\s+/g, " "),
      cites: [
        ...new Set(
          [...l.matchAll(/\[(\d+(?:[,\s–-]*\d+)*)\]/g)].flatMap(
            (m) => (m[1] ?? "").match(/\d+/g)?.map(Number) ?? [],
          ),
        ),
      ],
    }));
}

export interface EvidenceProblems {
  /** A figure not on any page the sentence cites; `on` names the source
   *  number of a listed source that does give it ("[n]"), or the address
   *  of a page read but never noted. */
  misplacedFigures: Array<{ figure: string; sentence: string; cites: number[]; on: string }>;
  /** Strong certainty resting only on weak kinds, or on one publisher. */
  overcertain: Array<{ sentence: string; why: string }>;
  /** Key Findings whose citations all lead to one publisher. */
  onePublisherFindings: string[];
  /** The cited sources by kind. */
  profile: Partial<Record<SourceKind, number>>;
}

export function evidenceProblems(
  body: string,
  notes: Note[],
  pages: ResearchSource[],
): EvidenceProblems {
  const numbers = sourceNumbers(notes);
  const urlOf = new Map([...numbers.entries()].map(([url, n]) => [n, url]));
  const page = new Map(pages.map((p) => [p.url, p]));
  const textOf = new Map<string, string>();
  const pageText = (url: string) => {
    let t = textOf.get(url);
    if (t === undefined) {
      t = digits(page.get(url)?.text ?? "");
      textOf.set(url, t);
    }
    return t;
  };
  const kindOf = (n: number) => {
    const url = urlOf.get(n);
    return url ? sourceKind(url, page.get(url)?.title) : null;
  };

  const profile: Partial<Record<SourceKind, number>> = {};
  for (const [url] of numbers) {
    const k = sourceKind(url, page.get(url)?.title);
    profile[k] = (profile[k] ?? 0) + 1;
  }
  const voice = (url: string) => voiceOf(url, page.get(url)?.title);
  const sites = new Set([...numbers.keys()].map(voice));

  const sentences: Sentence[] = [
    ...findingSentences(body),
    ...citedSentences(body).map((c) => ({
      where: `§${c.section}`,
      sentence: c.sentence,
      cites: c.cites,
    })),
  ];

  const misplacedFigures: EvidenceProblems["misplacedFigures"] = [];
  const overcertain: EvidenceProblems["overcertain"] = [];
  const onePublisherFindings: string[] = [];
  const seen = new Set<string>();
  for (const s of sentences) {
    const cited = s.cites.map((n) => urlOf.get(n)).filter((u): u is string => !!u);
    if (!cited.length) continue;
    const short = `${s.where}: ${s.sentence.slice(0, 160)}`;
    // The figure on a page the sentence cites.
    if (!/\b(calculat|implies|sum of|difference between|combined|in total)/i.test(s.sentence)) {
      const plain = unquoted(s.sentence).replace(/\[[\d,\s–-]+\]/g, " ");
      for (const m of plain.matchAll(FIGURE)) {
        const figure = digits(m[0]);
        if (isYear(figure) || seen.has(`${figure}|${s.sentence}`)) continue;
        seen.add(`${figure}|${s.sentence}`);
        if (cited.some((u) => has(pageText(u), figure))) continue;
        // Where it is, if anywhere: another listed source, or a page read and never noted.
        const elsewhere = [...numbers.entries()].find(([u]) => has(pageText(u), figure));
        const unnoted = elsewhere
          ? undefined
          : pages.find((p) => !numbers.has(p.url) && has(pageText(p.url), figure));
        if (!elsewhere && !unnoted) continue; // In no page at all: figureProblems says so.
        misplacedFigures.push({
          figure: m[0],
          sentence: short,
          cites: s.cites,
          on: elsewhere ? `[${elsewhere[1]}]` : (unnoted?.url ?? ""),
        });
      }
    }
    // Certainty the evidence earns.
    if (STRONG.test(unquoted(s.sentence))) {
      const kinds = s.cites.map(kindOf).filter((k): k is SourceKind => !!k);
      const citedSites = new Set(cited.map(voice));
      if (kinds.length && !kinds.some((k) => STRONG_KINDS.has(k)))
        overcertain.push({
          sentence: short,
          why: `it cites only ${[...new Set(kinds.map((k) => KIND_LABEL[k]))].join(" and ")}`,
        });
      else if (citedSites.size === 1 && sites.size >= 3)
        overcertain.push({
          sentence: short,
          why: `it cites one publisher (${[...citedSites][0]})`,
        });
    }
    // A Key Finding on one publisher.
    if (
      s.where === "Key Findings" &&
      sites.size >= 3 &&
      new Set(cited.map(voice)).size === 1 &&
      !attributed(unquoted(s.sentence))
    )
      onePublisherFindings.push(s.sentence.slice(0, 160));
  }
  return {
    misplacedFigures: misplacedFigures.slice(0, 15),
    overcertain: overcertain.slice(0, 10),
    onePublisherFindings: onePublisherFindings.slice(0, 8),
    profile,
  };
}

/** The evidence checks as the writer reads them. */
export function describeEvidence(e: EvidenceProblems): string {
  const out: string[] = [];
  if (e.misplacedFigures.length)
    out.push(
      `FIGURES NOT ON THE PAGE THEY CITE (${e.misplacedFigures.length}) — cite the page that gives the figure, or correct it:\n${e.misplacedFigures
        .map(
          (f) =>
            `- ${f.figure} cites [${f.cites.join(", ")}]${f.on ? `; it is on ${f.on.startsWith("[") ? `source ${f.on}` : `${f.on}, read but never noted (note it, then cite it)`}` : ""} — "${f.sentence}"`,
        )
        .join("\n")}`,
    );
  if (e.overcertain.length)
    out.push(
      `CERTAINTY ABOVE ITS EVIDENCE (${e.overcertain.length}) — the words claim more than the sources can carry; say it at the strength they support, or cite official data, a study or a review that does:\n${e.overcertain
        .map((o) => `- ${o.why} — "${o.sentence}"`)
        .join("\n")}`,
    );
  if (e.onePublisherFindings.length)
    out.push(
      `KEY FINDINGS ON ONE PUBLISHER (${e.onePublisherFindings.length}) — a decisive finding needs a second, independent source, or the bullet should say whose finding it is:\n${e.onePublisherFindings
        .map((f) => `- "${f}"`)
        .join("\n")}`,
    );
  const kinds = Object.entries(e.profile)
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
    .map(([k, n]) => `${n} ${KIND_LABEL[k as SourceKind]}`);
  if (kinds.length) out.push(`Your cited sources by kind: ${kinds.join(", ")}.`);
  return out.length ? `\n${out.join("\n")}` : "";
}
