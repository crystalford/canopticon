// The free source finder: web_search without a bill or credits.
//
// Nobody gives away a search of the whole web: building an index of it is
// expensive, so every general search engine charges, one way or another
// (Brave by subscription, Cloudflare's Web Search by prepaid credits). What
// is free is search over particular collections — and those are the sources
// research of record wants anyway: the news itself, research papers,
// encyclopedias whose citations lead to primary sources, and government
// data. This asks several of them at once, keyless, and returns one list,
// each result labelled with what kind of source it is. The model reaches the
// rest of the web as a librarian would: it fetches the authoritative pages
// it knows directly (web_fetch needs no search result) and follows their
// links.
//
// Sources (all free, no key, no account):
//   GDELT DOC 2.0 — the world's news, last three months (api.gdeltproject.org)
//   Crossref      — research papers and reports by DOI (api.crossref.org)
//   Europe PMC    — biomedical and health literature (ebi.ac.uk)
//   Wikipedia     — encyclopedia articles, whose references cite primary sources
//   Open Canada   — Government of Canada datasets and publications (CKAN)
//   Semantic Scholar — papers across every field (api.semanticscholar.org)
//   Internet Archive — books and older texts, many readable whole
//   Open Library  — books: what exists, by whom, when
//   DOAJ          — open-access journal articles, readable in full
//   arXiv         — preprints (computing, AI, physics, maths, economics)
//   World Bank    — reports and working papers
//   US Federal Register — rules, proposed rules, notices
// The core is asked every time; the rest when the question is theirs
// (route). The Wayback Machine supplies a page that has gone or moved.

export interface Found {
  title: string;
  url: string;
  description: string;
}

const UA = "CanopticonResearch/1.0 (+https://canopticon.com/about)";
const TIMEOUT = 10_000;

async function getJson(url: string, timeout = TIMEOUT): Promise<unknown> {
  const res = await fetch(url, {
    headers: { "user-agent": UA, accept: "application/json" },
    signal: AbortSignal.timeout(timeout),
  });
  if (!res.ok) throw new Error(`${new URL(url).hostname} answered ${res.status}`);
  // GDELT answers a too-frequent caller with plain text, not JSON.
  return JSON.parse(await res.text());
}

const clip = (s: unknown, n = 300) =>
  String(s ?? "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, n);

export async function gdelt(q: string): Promise<Found[]> {
  const j = (await getJson(
    `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(`${q} sourcelang:english`)}&mode=artlist&maxrecords=8&format=json&sort=hybridrel`,
    // Live, GDELT took 11-19 seconds a query.
    30_000,
  )) as { articles?: Array<{ url?: string; title?: string; domain?: string; seendate?: string }> };
  return (j.articles ?? [])
    .filter((a) => a.url)
    .map((a) => ({
      title: clip(a.title, 200),
      url: String(a.url),
      description: `[news · ${a.domain ?? ""} · ${String(a.seendate ?? "").slice(0, 8)}]`,
    }));
}

export async function crossref(q: string): Promise<Found[]> {
  const j = (await getJson(
    `https://api.crossref.org/works?query=${encodeURIComponent(q)}&rows=6&select=DOI,title,URL,container-title,issued,abstract,type`,
  )) as {
    message?: {
      items?: Array<{
        title?: string[];
        URL?: string;
        "container-title"?: string[];
        issued?: { "date-parts"?: number[][] };
        abstract?: string;
        type?: string;
      }>;
    };
  };
  return (j.message?.items ?? [])
    .filter((i) => i.URL && i.title?.[0])
    .map((i) => ({
      title: clip(i.title?.[0], 200),
      url: String(i.URL),
      description: `[${i.type === "report" ? "report" : "paper"} · ${clip(i["container-title"]?.[0], 80)} · ${i.issued?.["date-parts"]?.[0]?.[0] ?? "n.d."}] ${clip(i.abstract, 240)}`,
    }));
}

export async function europePmc(q: string): Promise<Found[]> {
  const j = (await getJson(
    `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(q)}&format=json&pageSize=5&resultType=lite`,
  )) as {
    resultList?: {
      result?: Array<{
        title?: string;
        doi?: string;
        pmid?: string;
        source?: string;
        id?: string;
        journalTitle?: string;
        pubYear?: string;
      }>;
    };
  };
  return (j.resultList?.result ?? [])
    .map((r) => ({
      title: clip(r.title, 200),
      url: r.doi
        ? `https://doi.org/${r.doi}`
        : `https://europepmc.org/article/${r.source ?? "MED"}/${r.pmid ?? r.id ?? ""}`,
      description: `[health research · ${clip(r.journalTitle, 80)} · ${r.pubYear ?? ""}]`,
    }))
    .filter((r) => r.title);
}

export async function wikipedia(q: string): Promise<Found[]> {
  const j = (await getJson(
    `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&srlimit=4&format=json`,
  )) as { query?: { search?: Array<{ title?: string; snippet?: string }> } };
  return (j.query?.search ?? []).map((s) => ({
    title: clip(s.title, 200),
    url: `https://en.wikipedia.org/wiki/${encodeURIComponent(String(s.title ?? "").replace(/ /g, "_"))}`,
    description: `[encyclopedia — follow its references to the primary sources] ${clip(s.snippet, 220)}`,
  }));
}

export async function openCanada(q: string): Promise<Found[]> {
  const j = (await getJson(
    `https://open.canada.ca/data/api/action/package_search?q=${encodeURIComponent(q)}&rows=4`,
  )) as {
    result?: {
      results?: Array<{
        name?: string;
        title?: string;
        notes?: string;
        organization?: { title?: string };
      }>;
    };
  };
  return (j.result?.results ?? [])
    .filter((r) => r.name)
    .map((r) => ({
      title: clip(r.title, 200),
      url: `https://open.canada.ca/data/en/dataset/${r.name}`,
      description: `[Government of Canada data · ${clip(r.organization?.title, 80)}] ${clip(r.notes, 200)}`,
    }));
}

/** A query as the keyword sources want it: no quotation marks or operators,
 *  the first eight words. Live, researchers wrote search-engine queries
 *  ("…" phrases, ten-plus words) and GDELT, Wikipedia and the catalogues
 *  matched little or nothing. */
export function keywords(q: string): string {
  return q
    .replace(/["“”'‘’()]/g, " ")
    .replace(/\b(AND|OR|NOT)\b/g, " ")
    .replace(/(^|\s)[-+]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 8)
    .join(" ");
}

export async function semanticScholar(q: string): Promise<Found[]> {
  const j = (await getJson(
    `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(q)}&limit=5&fields=title,url,year,venue,externalIds`,
  )) as {
    data?: Array<{
      title?: string;
      url?: string;
      year?: number;
      venue?: string;
      externalIds?: { DOI?: string };
    }>;
  };
  return (j.data ?? [])
    .filter((p) => p.title && (p.externalIds?.DOI || p.url))
    .map((p) => ({
      title: clip(p.title, 200),
      url: p.externalIds?.DOI ? `https://doi.org/${p.externalIds.DOI}` : String(p.url),
      description: `[paper · ${clip(p.venue, 80) || "Semantic Scholar"} · ${p.year ?? ""}]`,
    }));
}

/** Books and older texts, many readable in full (archive.org). */
export async function internetArchive(q: string): Promise<Found[]> {
  const j = (await getJson(
    `https://archive.org/advancedsearch.php?q=${encodeURIComponent(q)}&fl[]=identifier&fl[]=title&fl[]=year&fl[]=mediatype&rows=4&output=json`,
  )) as {
    response?: {
      docs?: Array<{ identifier?: string; title?: string; year?: string; mediatype?: string }>;
    };
  };
  return (j.response?.docs ?? [])
    .filter((d) => d.identifier && (d.mediatype === "texts" || !d.mediatype))
    .map((d) => ({
      title: clip(d.title, 200),
      url: `https://archive.org/details/${d.identifier}`,
      description: `[book or text · Internet Archive · ${d.year ?? ""}]`,
    }));
}

/** Books: what exists, by whom, when (openlibrary.org). */
export async function openLibrary(q: string): Promise<Found[]> {
  const j = (await getJson(
    `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=4&fields=key,title,author_name,first_publish_year`,
  )) as {
    docs?: Array<{
      key?: string;
      title?: string;
      author_name?: string[];
      first_publish_year?: number;
    }>;
  };
  return (j.docs ?? [])
    .filter((d) => d.key)
    .map((d) => ({
      title: clip(d.title, 200),
      url: `https://openlibrary.org${d.key}`,
      description: `[book · ${clip(d.author_name?.join(", "), 80)} · ${d.first_publish_year ?? ""}]`,
    }));
}

/** Preprints in physics, maths, computing, AI, economics and more (arxiv.org).
 *  Atom XML, read with a few patterns. */
export async function arxiv(q: string): Promise<Found[]> {
  const res = await fetch(
    `https://export.arxiv.org/api/query?search_query=${encodeURIComponent(`all:${q}`)}&max_results=4`,
    { headers: { "user-agent": UA }, signal: AbortSignal.timeout(TIMEOUT) },
  );
  if (!res.ok) throw new Error(`arxiv answered ${res.status}`);
  const xml = await res.text();
  return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)]
    .map((m) => {
      const e = m[1] ?? "";
      const pick = (tag: string) =>
        new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`).exec(e)?.[1] ?? "";
      return {
        title: clip(pick("title"), 200),
        url: clip(pick("id"), 200).replace(/^http:/, "https:"),
        description: `[preprint · arXiv · ${pick("published").slice(0, 4)}] ${clip(pick("summary"), 200)}`,
      };
    })
    .filter((r) => r.url.startsWith("https://arxiv.org/"));
}

/** Open-access journal articles, readable in full (doaj.org). */
export async function doaj(q: string): Promise<Found[]> {
  const j = (await getJson(
    `https://doaj.org/api/search/articles/${encodeURIComponent(q)}?pageSize=4`,
  )) as {
    results?: Array<{
      bibjson?: {
        title?: string;
        year?: string;
        journal?: { title?: string };
        link?: Array<{ type?: string; url?: string }>;
      };
    }>;
  };
  return (j.results ?? [])
    .map((r) => {
      const b = r.bibjson ?? {};
      const link = b.link?.find((l) => l.type === "fulltext")?.url ?? b.link?.[0]?.url ?? "";
      return {
        title: clip(b.title, 200),
        url: link,
        description: `[open-access paper · ${clip(b.journal?.title, 80)} · ${b.year ?? ""}]`,
      };
    })
    .filter((r) => r.url && r.title);
}

/** World Bank reports and working papers (documents.worldbank.org). */
export async function worldBank(q: string): Promise<Found[]> {
  const j = (await getJson(
    `https://search.worldbank.org/api/v2/wds?format=json&qterm=${encodeURIComponent(q)}&rows=4&fl=docdt,display_title,pdfurl,url,docty`,
  )) as {
    documents?: Record<
      string,
      { display_title?: string; docdt?: string; pdfurl?: string; url?: string; docty?: string }
    >;
  };
  return Object.values(j.documents ?? {})
    .filter((d) => d && typeof d === "object" && d.display_title && (d.pdfurl || d.url))
    .map((d) => ({
      title: clip(d.display_title, 200),
      url: String(d.pdfurl || d.url),
      description: `[World Bank ${clip(d.docty, 40) || "document"} · ${String(d.docdt ?? "").slice(0, 10)}]`,
    }));
}

/** US federal rules, proposed rules and notices (federalregister.gov). */
export async function federalRegister(q: string): Promise<Found[]> {
  const j = (await getJson(
    `https://www.federalregister.gov/api/v1/documents.json?conditions%5Bterm%5D=${encodeURIComponent(q)}&per_page=4&order=relevance`,
  )) as {
    results?: Array<{
      title?: string;
      html_url?: string;
      publication_date?: string;
      type?: string;
      abstract?: string;
    }>;
  };
  return (j.results ?? [])
    .filter((r) => r.html_url)
    .map((r) => ({
      title: clip(r.title, 200),
      url: String(r.html_url),
      description: `[US Federal Register · ${r.type ?? ""} · ${r.publication_date ?? ""}] ${clip(r.abstract, 200)}`,
    }));
}

type Source = (q: string) => Promise<Found[]>;

/** Which specialist sources a question calls for, by its words — no model.
 *  The core (news, papers, open-access journals, Wikipedia) is always asked;
 *  each added source makes a search slower and noisier, so the rest are
 *  asked only when the question is theirs. */
export function route(q: string): Array<[string, Source]> {
  const t = q.toLowerCase();
  const out: Array<[string, Source]> = [];
  const when = (re: RegExp, name: string, f: Source) => {
    if (re.test(t)) out.push([name, f]);
  };
  when(
    /health|medic|drug|disease|patient|clinic|hospital|mental|cancer|vaccine|diabet|pharma|opioid|overdose|therapy|nutrition|epidemi/,
    "europePmc",
    europePmc,
  );
  when(
    /canad|ontario|quebec|alberta|british columbia|manitoba|saskatchewan|nova scotia|brunswick|newfoundland|prince edward|yukon|nunavut|northwest territories|toronto|montreal|vancouver|ottawa|hamilton|federal|provinc|statcan|statistics canada/,
    "openCanada",
    openCanada,
  );
  when(
    /econom|poverty|inequal|development|trade|tariff|gdp|inflation|labou?r|employment|wage|income|debt|finance|bank|climate|carbon|emission|global|countr/,
    "worldBank",
    worldBank,
  );
  when(
    /artificial intelligence|\bai\b|machine learning|model|algorithm|comput|software|physics|math|quantum|neural|network|data|statistic|crypto/,
    "arxiv",
    arxiv,
  );
  when(
    /\bus\b|united states|american|federal register|fda|epa|ftc|sec\b|rule|regulat|agency|congress/,
    "federalRegister",
    federalRegister,
  );
  when(
    /book|history|historian|theor|philosoph|author|literat|media|mcluhan|culture|art|religio|novel|essay|scholar/,
    "internetArchive",
    internetArchive,
  );
  when(
    /book|author|novel|biograph|history|theor|philosoph|literat|media|mcluhan/,
    "openLibrary",
    openLibrary,
  );
  // A question no specialist claims still looks at government data and books.
  if (!out.length)
    out.push(
      ["openCanada", openCanada],
      ["internetArchive", internetArchive],
      ["openLibrary", openLibrary],
    );
  return out;
}

// GDELT is not in the core: it is news_search (agent.ts), asked only when a
// question needs recent events, because it takes ~19 s against ~2 s.
const CORE: Array<[string, Source]> = [
  ["crossref", crossref],
  ["semanticScholar", semanticScholar],
  ["doaj", doaj],
  ["wikipedia", wikipedia],
];

/** Every source the question calls for, at once; each that fails or times
 *  out is left out. The lists are dealt in turn so no one source fills the
 *  page. The keyword sources get the query as keywords; Crossref takes it
 *  whole. */
export async function findSources(q: string): Promise<Found[]> {
  const lists = await askSources(q);
  const out: Found[] = [];
  const seen = new Set<string>();
  for (let i = 0; out.length < 16 && lists.some((l) => l.found[i]); i++)
    for (const l of lists) {
      const r = l.found[i];
      if (r && !seen.has(r.url)) {
        seen.add(r.url);
        out.push(r);
      }
    }
  return out;
}

/** Each source asked for a question, with what it found or why it failed
 *  (for findSources, and for checking every source live). */
export async function askSources(
  q: string,
  only?: string[],
): Promise<Array<{ name: string; found: Found[]; error?: string }>> {
  const k = keywords(q) || q;
  // Named sources are asked whether or not the question routes to them.
  const chosen: Array<[string, Source]> = only
    ? only.flatMap((n) =>
        ALL_SOURCES[n] ? [[n, ALL_SOURCES[n] as Source] as [string, Source]] : [],
      )
    : [...CORE, ...route(q)];
  return Promise.all(
    chosen.map(async ([name, f]) => {
      try {
        return { name, found: await f(name === "crossref" ? q : k) };
      } catch (e) {
        return { name, found: [], error: String((e as Error).message ?? e).slice(0, 200) };
      }
    }),
  );
}

/** Every source by name, for checking them live. */
export const ALL_SOURCES: Record<string, Source> = {
  gdelt,
  crossref,
  semanticScholar,
  doaj,
  wikipedia,
  europePmc,
  openCanada,
  worldBank,
  arxiv,
  federalRegister,
  internetArchive,
  openLibrary,
};

/** The Wayback Machine's latest copy of a page, if it has one: read when the
 *  page itself is gone, moved or refuses us (archive.org/wayback). */
export async function waybackCopy(url: string): Promise<{ url: string; date: string } | null> {
  const j = (await getJson(
    `https://archive.org/wayback/available?url=${encodeURIComponent(url)}`,
  ).catch(() => null)) as {
    archived_snapshots?: {
      closest?: { available?: boolean; url?: string; timestamp?: string; status?: string };
    };
  } | null;
  const c = j?.archived_snapshots?.closest;
  if (!c?.available || !c.url || (c.status && c.status !== "200")) return null;
  const ts = String(c.timestamp ?? "");
  return {
    url: c.url.replace(/^http:/, "https:"),
    date: ts.length >= 8 ? `${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}` : "",
  };
}

/** The DOI a scholarly address carries, if any (doi.org, a publisher's
 *  /doi/ path, an SSRN abstract page). */
export function doiOf(url: string): string | null {
  const ssrn = /ssrn\.com\/.*abstract_id=(\d+)/i.exec(url);
  if (ssrn) return `10.2139/ssrn.${ssrn[1]}`;
  let u = url;
  try {
    u = decodeURIComponent(url);
  } catch {
    // Not percent-encoded as expected: read it as it is.
  }
  const m = /\b(10\.\d{4,9}\/[^\s?#&"<>]+)/.exec(u);
  return m?.[1] ? m[1].replace(/[.,;)\]]+$/, "").replace(/\/(full|abstract|pdf|epdf)$/i, "") : null;
}

// ---- a paper's full text and citation trail, from keyless sources -------------
//
// Nothing here needs a key or a bill (the record's rule since 2026-11-07):
// OpenAlex was tried first and dropped when it began metering and wanting
// keys (2026-02). Semantic Scholar's graph answers without a key (a shared,
// rate-limited pool); OpenCitations is an open citation index; Crossref
// fills in titles; Europe PMC finds open full texts of health research.

const S2 = "https://api.semanticscholar.org/graph/v1/paper";

/** A free full text of a paper, where one exists: Semantic Scholar's
 *  open-access PDF, else Europe PMC's open full text. Live (2026-11-11), a
 *  thesis report read its three central papers only as abstracts. */
export async function openAccessCopy(doi: string): Promise<string | null> {
  const s2 = (await getJson(`${S2}/DOI:${encodeURIComponent(doi)}?fields=openAccessPdf`).catch(
    () => null,
  )) as { openAccessPdf?: { url?: string | null } | null } | null;
  if (s2?.openAccessPdf?.url) return s2.openAccessPdf.url;
  const pmc = (await getJson(
    `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(`DOI:"${doi}"`)}&resultType=core&format=json&pageSize=1`,
  ).catch(() => null)) as {
    resultList?: {
      result?: Array<{
        fullTextUrlList?: { fullTextUrl?: Array<{ availability?: string; url?: string }> };
      }>;
    };
  } | null;
  const urls = pmc?.resultList?.result?.[0]?.fullTextUrlList?.fullTextUrl ?? [];
  return urls.find((u) => /open access|free/i.test(u.availability ?? "") && u.url)?.url ?? null;
}

export interface RelatedWork {
  title: string;
  year: number | null;
  cited: number;
  url: string;
}

interface S2Paper {
  title?: string | null;
  year?: number | null;
  citationCount?: number | null;
  externalIds?: { DOI?: string } | null;
  openAccessPdf?: { url?: string | null } | null;
  url?: string | null;
}

const fromS2 = (p: S2Paper | null | undefined): RelatedWork | null => {
  const title = (p?.title ?? "").trim();
  const url =
    p?.openAccessPdf?.url ||
    (p?.externalIds?.DOI ? `https://doi.org/${p.externalIds.DOI}` : "") ||
    p?.url ||
    "";
  return title && url ? { title, year: p?.year ?? null, cited: p?.citationCount ?? 0, url } : null;
};

const top = (list: Array<RelatedWork | null>, each: number): RelatedWork[] =>
  list
    .filter((x): x is RelatedWork => !!x)
    .sort((a, b) => b.cited - a.cited)
    .slice(0, each);

/** From Semantic Scholar: the references and the citing papers. */
async function relatedFromS2(
  doi: string,
  each: number,
): Promise<{ cites: RelatedWork[]; citedBy: RelatedWork[] } | null> {
  const fields = "fields=title,year,citationCount,externalIds,openAccessPdf,url&limit=100";
  const id = `DOI:${encodeURIComponent(doi)}`;
  const [refs, cits] = await Promise.all([
    getJson(`${S2}/${id}/references?${fields}`).catch(() => null) as Promise<{
      data?: Array<{ citedPaper?: S2Paper }>;
    } | null>,
    getJson(`${S2}/${id}/citations?${fields}`).catch(() => null) as Promise<{
      data?: Array<{ citingPaper?: S2Paper }>;
    } | null>,
  ]);
  if (!refs && !cits) return null;
  const cites = top(
    (refs?.data ?? []).map((r) => fromS2(r.citedPaper)),
    each,
  );
  const citedBy = top(
    (cits?.data ?? []).map((r) => fromS2(r.citingPaper)),
    each,
  );
  return cites.length || citedBy.length ? { cites, citedBy } : null;
}

/** From OpenCitations (the open citation index), with titles from Crossref:
 *  when Semantic Scholar's shared pool is busy. */
async function relatedFromOpenCitations(
  doi: string,
  each: number,
): Promise<{ cites: RelatedWork[]; citedBy: RelatedWork[] } | null> {
  const base = "https://opencitations.net/index/coci/api/v1";
  const pick = (rows: unknown, key: "cited" | "citing") =>
    ((rows as Array<Record<string, string>> | null) ?? [])
      .map((r) =>
        String(r[key] ?? "")
          .replace(/^coci\s*=>\s*/i, "")
          .trim(),
      )
      .filter((d) => /^10\./.test(d))
      .slice(0, 40);
  const [refs, cits] = await Promise.all([
    getJson(`${base}/references/${doi}`).catch(() => null),
    getJson(`${base}/citations/${doi}`).catch(() => null),
  ]);
  if (!refs && !cits) return null;
  const titled = async (dois: string[]): Promise<RelatedWork[]> => {
    if (!dois.length) return [];
    const j = (await getJson(
      `https://api.crossref.org/works?filter=${dois.map((d) => `doi:${encodeURIComponent(d)}`).join(",")}&rows=${dois.length}&select=DOI,title,issued,is-referenced-by-count`,
    ).catch(() => null)) as {
      message?: {
        items?: Array<{
          DOI?: string;
          title?: string[];
          issued?: { "date-parts"?: number[][] };
          "is-referenced-by-count"?: number;
        }>;
      };
    } | null;
    return top(
      (j?.message?.items ?? []).map((w) =>
        w.title?.[0] && w.DOI
          ? {
              title: w.title[0].trim(),
              year: w.issued?.["date-parts"]?.[0]?.[0] ?? null,
              cited: w["is-referenced-by-count"] ?? 0,
              url: `https://doi.org/${w.DOI}`,
            }
          : null,
      ),
      each,
    );
  };
  const [cites, citedBy] = await Promise.all([
    titled(pick(refs, "cited")),
    titled(pick(cits, "citing")),
  ]);
  return cites.length || citedBy.length ? { cites, citedBy } : null;
}

/** Citation chasing, as systematic reviewers do it: the works a paper cites
 *  and the works that cite it, most-cited first. From one good paper a
 *  researcher can reach a dozen more — live, reports stood on 10 to 16
 *  sources, and the free finder cannot search the whole web. Keyless:
 *  Semantic Scholar, else OpenCitations with Crossref's titles. */
export async function relatedWorks(
  doi: string,
  each = 6,
): Promise<{ cites: RelatedWork[]; citedBy: RelatedWork[] } | null> {
  return (await relatedFromS2(doi, each)) ?? (await relatedFromOpenCitations(doi, each));
}

/** Related work as a researcher reads it after a paper's page. */
export function describeRelated(r: { cites: RelatedWork[]; citedBy: RelatedWork[] }): string {
  const line = (w: RelatedWork) =>
    `- ${w.title}${w.year ? ` (${w.year})` : ""}, cited ${w.cited.toLocaleString("en")} times — ${w.url}`;
  return `\n\nRELATED WORK (most-cited first): follow the ones your section needs with web_fetch — this is how a review finds its sources.${
    r.cites.length ? `\nThis paper cites:\n${r.cites.map(line).join("\n")}` : ""
  }${r.citedBy.length ? `\nLater work citing it:\n${r.citedBy.map(line).join("\n")}` : ""}`;
}

/** A search engine's result page (or the engine itself): not fetched, since
 *  querying them by machine breaks their terms. Scholarly and data APIs that
 *  invite automated use (Crossref, Europe PMC, OpenAlex, Semantic Scholar's
 *  API) are not search engines in this sense. */
export function isSearchEnginePage(url: string): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  const h = u.hostname.toLowerCase().replace(/^www\./, "");
  if (
    /(^|\.)(duckduckgo\.com|bing\.com|search\.brave\.com|search\.yahoo\.com|yandex\.[a-z.]+|baidu\.com|startpage\.com|ecosia\.org|search\.marginalia\.nu|mojeek\.com|qwant\.com|searx\.[a-z.]+)$/.test(
      h,
    )
  )
    return true;
  // Google's search and its scholar search; its other pages are fine.
  if (/(^|\.)google\.[a-z.]+$/.test(h))
    return /^\/(search|scholar)\b/.test(u.pathname) || h.startsWith("scholar.");
  return false;
}

/** News of the last three months, for news_search: GDELT, asked with the
 *  query as keywords. */
export async function newsSearch(q: string): Promise<Found[]> {
  return gdelt(keywords(q) || q);
}
