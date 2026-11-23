# Depositing theories and papers on Zenodo

Zenodo (zenodo.org, run by CERN) is a free, permanent archive for research.
Every deposit gets a DOI. A DOI is what library catalogues, Google Scholar and
answer engines treat as the mark of a formal publication: it resolves forever,
and a citation to it does not break if canopticon.com moves.

**A published Zenodo record cannot be deleted.** It can only be given a new
version, and every version keeps its own DOI under one "concept" DOI that
always points to the latest. Deposit when the text is one you are content to
have on the record; revise afterwards by adding a version.

## Once: accounts

1. **ORCID** (orcid.org, free): a permanent identifier for you as a
   researcher. Register, then put the iD in the Creators field below. Two
   people named Chris Telford can then never be confused, and your works
   gather under one profile.
2. **Zenodo**: sign up with your ORCID (or GitHub) login.

## Each deposit

Make the PDF with the site's own print styles (the canonical address is in the
footer of every page):

```
cd packages/api
pnpm tsx scripts/print-site.mts <outDir> /theories/<slug> /articles/<slug>
```

On Zenodo: **New upload**, attach the PDF, then fill in:

| Field | Value |
| --- | --- |
| Resource type | Publication → Working paper |
| Title | The page's title, with its subtitle |
| Creators | Telford, Christopher · ORCID · affiliation: Canopticon (independent) |
| Description | The abstract or claim (below) |
| Licence | Creative Commons Attribution 4.0 International |
| Publication date | The date on the page |
| Version | The page's version (1) |
| Language | English |
| Keywords | Below |
| Related works | "Is identical to" → the canopticon.com address (URL) |
| Notes | "Drafted with the assistance of Claude (Anthropic). The author is responsible for the content." (COPE's guidance on AI tools: disclose; an AI is never an author) |

**Merge and deploy first.** Each deposit says it is identical to a page on
canopticon.com, so the page must be live before the record points at it.

Then **Publish**, and send the DOI back. It goes into the page's front matter
as `doi: "10.5281/zenodo.NNNNNNN"`, and the page then shows it in the byline,
in its citation metadata (`citation_doi`) and in its JSON-LD
(`identifier`, `sameAs`). The build checks the format.

## The three ready to deposit (2026-11-22)

### 1. Self-extinguishing maintenance

- **Title:** Self-extinguishing maintenance: a theory of why working treatments are abandoned
- **Address:** https://canopticon.com/theories/self-extinguishing-maintenance
- **Description:** For conditions with a standing cause, a maintenance routine
  that succeeds removes the symptom that both prompted and rewarded it. The
  routine therefore stops, the controlled state is mistaken for a cure (the
  remission-as-cure error), and the unchanged cause brings the symptom back, at
  a cost larger and slower to repay than the routine. Because the relapse comes
  long after the stopping, each cycle teaches the link only a little. The theory
  states eight graded propositions on sixteen primary references, with
  measures, a protocol, a four-question check and its counter-evidence.
- **Keywords:** treatment adherence; maintenance behaviour; habit; remission;
  relapse; negative reinforcement; delayed consequences; self-management
- **Date:** 2026-11-22 (coined 2026-09-30) · **Version:** 1

### 2. Why Temperature

- **Title:** Why Temperature: McLuhan's hot and cool as a theory of regulation
- **Address:** https://canopticon.com/articles/why-temperature
- **Description:** the paper's abstract (three paragraphs, from "McLuhan
  divided media into hot and cool").
- **Keywords:** Marshall McLuhan; hot and cool media; media theory; active
  learning; pretesting; productive failure; expertise reversal; cognitive
  offloading; generative AI; thermoregulation
- **Date:** 2026-11-22 · **Version:** 1
- **Checked 2026-11-22:** every McLuhan quotation against a scanned text of *Understanding Media*; every reference given a DOI or address and a status for what was read.

### 3. Cognitive ectothermy

- **Title:** Cognitive ectothermy: a theory of what hot media leave untrained
- **Address:** https://canopticon.com/theories/cognitive-ectothermy
- **Description:** the claim, then: "Drawn from the working paper Why
  Temperature. Six graded propositions on fifteen primary references, with
  measures, a protocol and its counter-evidence."
- **Keywords:** cognitive ectothermy; Marshall McLuhan; hot and cool media;
  learning; prediction; cognitive offloading; generative AI
- **Related works:** also "Is derived from" → the DOI of Why Temperature
- **Date:** 2026-11-22 · **Version:** 1

Deposit Why Temperature before Cognitive ectothermy, so the theory can name the
paper's DOI.
