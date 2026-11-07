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

export interface Found {
  title: string;
  url: string;
  description: string;
}

const UA = "CanopticonResearch/1.0 (+https://canopticon.com/about)";
const TIMEOUT = 10_000;

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { "user-agent": UA, accept: "application/json" },
    signal: AbortSignal.timeout(TIMEOUT),
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

/** Every free source at once; each that fails or times out is left out. The
 *  lists are dealt in turn so no one source fills the page. */
export async function findSources(q: string): Promise<Found[]> {
  const lists = await Promise.all(
    [gdelt, crossref, wikipedia, europePmc, openCanada].map((f) => f(q).catch(() => [])),
  );
  const out: Found[] = [];
  const seen = new Set<string>();
  for (let i = 0; out.length < 14 && lists.some((l) => l[i]); i++)
    for (const l of lists) {
      const r = l[i];
      if (r && !seen.has(r.url)) {
        seen.add(r.url);
        out.push(r);
      }
    }
  return out;
}
