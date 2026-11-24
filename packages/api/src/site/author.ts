// The author as one entity. Every page's JSON-LD names Chris Telford through
// this object, with one @id, so search engines and answer engines join the
// author of every document into a single person rather than many strings that
// happen to match. Add an identifier to SAME_AS when one exists (an ORCID iD,
// for example); nothing goes here that is not his.

export const AUTHOR_ID = "https://canopticon.com/about#chris";

export const SAME_AS: string[] = [];

export const AUTHOR = {
  "@type": "Person",
  "@id": AUTHOR_ID,
  name: "Chris Telford",
  url: "https://canopticon.com/about",
  ...(SAME_AS.length ? { sameAs: SAME_AS } : {}),
} as const;
