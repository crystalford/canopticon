# docs/ — what is current, what is history

Read in this order if you are new: `../CLAUDE.md` → `the-record.md` →
`HANDOFF.md` → `DESIGN-BRIEF.md`. `../CHANGELOG.md` says what changed when.

## Current — these bind

| File | What it is |
|---|---|
| `the-record.md` | The product definition. §1b names the NEO / neuronal-extension idea; §4 the pipeline; §5 lineage, bridges, readings; §7 findability; §8 design; §9 the cuts; §10 build order (all built). |
| `HANDOFF.md` | Where the build stands, what only the operator can do, what is next. Updated at the end of every session. |
| `DESIGN-BRIEF.md` | The briefing for the redesign (2026-09-24): every surface, how the machinery works, the visual system as it stands, what the operator asked for. Describes; does not prescribe. |

## Historical — read for context, never as design authority

| File | Era | Why it is kept |
|---|---|---|
| `archive/LINEAGE.md` | v1 → Fabric (to 2026-09-14) | The version history before the turn to the publication. |
| `archive/site-design.md` | The "files on power" dossier product | Superseded by `the-record.md`. Its opening line names a product that no longer exists. |
| `archive/canopticon-renovation.md` | The renovation plan, mid-2026 | Superseded. Says the graph "has never eaten a real corpus"; it has (see `../CLAUDE.md`). |
| `archive/` | v1.0 and the v2 graph era | Specs, schema, API, prototypes, the old changelog. `archive/README.md` explains. |

## Compartmentalised — separate systems, maintained not grown

| Folder | System |
|---|---|
| `studio/` | The film engine (`packages/studio`, parked). `CANOPTICON_FILM_ENGINE.md` is its own authority; `studio/archive/` describes a deleted engine and binds nothing. |
| `instruments/` | The Blind Spot and other instruments (`packages/blindspot`). |

## Conventions

- A document that stops being true gets a dated note at the top saying so,
  not a silent edit and not deletion. `archive/LINEAGE.md` and `CLAUDE.md` both do
  this.
- `HANDOFF.md` is rewritten, not appended: it describes the present.
- `../CHANGELOG.md` is appended, newest first, at the level of decisions.
