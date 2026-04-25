# CANOPTICON Skills Package v1.0

**Purpose.** This document defines all twelve skills — the eleven analytical roles plus one utility skill (claim_extraction) — as Claude Skills. Each skill is a named prompt template, packaged with its input substrate references, output substrate writes, structured-output schema (where applicable), and trigger conditions. The orchestrator (plain code) invokes these skills in response to substrate events.

The eleven analytical roles are: Ingestion Critic, Verifier, Interrogator, Red Team, Steelman, Premortem, Gap Surfacer, Calibration, Tier Projector, Assumption Auditor, Indicator Validator. The utility skill is claim_extraction, invoked by the cascade workflow's STEP 5 to convert approved source bodies into structured claim candidates. It is "utility" rather than "role" because it produces no analytical judgment of its own — it is a structured-output adapter from prose to substrate.

**Format.** Each role follows the same eight-section structure: Trigger, Reads from substrate, Writes to substrate, Model, API features, Prompt template, Output schema, Notes. This consistency lets Claude Code generate the SKILL.md filesystem layout mechanically from this document.

**Scope.** Sprint 1 implements three roles (Ingestion Critic, Verifier, Interrogator) end-to-end. The remaining eight are specified completely so they can be implemented in subsequent sprints without re-design.

**Versioning.** Each role has a `skill_md_hash` column in `role_definitions`. When a prompt template changes, the hash changes, and the orchestrator knows to re-invoke for affected substrate.

**Conventions.**
- All prompts use Anthropic's recommended XML-tag structure (`<input>`, `<task>`, `<output_format>`, `<examples>`, `<constraints>`).
- Structured-output roles emit JSON conforming to the schema in the role's "Output schema" section.
- Citations API roles return citation arrays alongside text; the orchestrator persists these to `claim_sources`.
- Cross-model verification roles (Verifier, optionally Red Team and Premortem) run Claude first, then a second model (GPT-5 or Gemini), and resolve disagreements via a deterministic rule documented per role.

---

## 0. SHARED PRIMITIVES

These are referenced by multiple roles. Defined once.

### 0.1 Substrate snapshot format

When a role reads from substrate, the orchestrator builds a JSON snapshot:

```json
{
  "thesis": { "id": "...", "title": "...", "current_version": { ... } },
  "claims": [ { "id": "...", "data": "...", "claim_text": "...", "warrant": "...", "grade": "A", "sources": [...] } ],
  "entities": [ { "id": "...", "canonical_name": "...", "type": "person" } ],
  "linchpins": [ ... ],
  "open_questions": [ ... ],
  "open_contradictions": [ ... ],
  "indicators": [ ... ],
  "watch_set": [ ... ]
}
```

The snapshot is bounded in size; large theses paginate substrate. Pagination strategy is per-role.

### 0.2 Standard output envelope

Every structured-output role wraps its output in a common envelope:

```json
{
  "role": "interrogator",
  "role_invocation_id": "uuid",
  "input_summary": "string — what the role read",
  "result": { /* role-specific payload */ },
  "self_assessment": {
    "confidence": "high | medium | low",
    "limitations": "string — what I couldn't do or wasn't sure about",
    "follow_ups_recommended": [ "string" ]
  }
}
```

The `self_assessment` block is mandatory across all structured-output roles. It catches cases where a role is uncertain and surfaces the uncertainty rather than burying it.

### 0.3 Admiralty grading rubric (used by Critic, Verifier, Indicator Validator)

```
A — Primary, official, verbatim. Gazette, OIC, SEDAR+ filing, Hansard, court ruling, peer-reviewed paper, raw dataset.
B — Credible secondary. Reporter at established outlet, analyst at known firm, academic working paper, NGO with disclosed methodology.
C — Tertiary or partisan. Op-ed, advocacy report, blog by qualified author.
D — Anonymous, unverified, or low-quality. Reddit, anonymous tip, opinion piece without disclosed methodology.
E — Known unreliable. Outlets with documented record of misrepresentation.
F — Cannot be assessed. New source, no track record, unable to verify.
```

### 0.4 IPCC likelihood vocabulary (used by Tier Projector, Calibration, Premortem)

```
virtually_certain        99–100%
very_likely              90–100%
likely                   66–100%
about_as_likely_as_not   33–66%
unlikely                 0–33%
very_unlikely            0–10%
exceptionally_unlikely   0–1%
```

When in doubt between two adjacent qualifiers, pick the weaker one. Calibration discipline punishes overconfidence harder than under-confidence.

---

## 1. INGESTION CRITIC

### Trigger

Fires automatically on `source.created` event for any source with `ingestion_state = 'pending_critic'`. Also invokable on demand via the operator's "Re-run Critic" button.

### Reads from substrate

- The source row (full body, metadata)
- All active theses' watch-sets and concept spines (for compatibility check)
- Existing claims potentially in conflict (semantic-similarity match against source body — Phase 2; for Sprint 1, exact-text-match)
- The user's `cost_whitelists` (to determine if downstream paid operations would prompt or auto-run)

### Writes to substrate

- One row in `ingestion_critic_reports`
- Updates `sources.ingestion_state` to `'pending_approval'` (or `'auto_approved'` if criteria met)
- Emits `source.critic_reported` event

### Model

`claude-opus-4-7`. The Critic is the gate; correctness here matters more than cost.

### API features

- Structured Outputs (strict schema)
- No Citations API (the Critic assesses the source itself, not claims against it)
- No cross-model verification (single-pass; Critic disagreements are caught downstream by the operator review step)

### Prompt template

```xml
<task>
You are the Ingestion Critic for a forensic intelligence system. Your job is to assess
a newly ingested source before it writes claims to the registries.

Your assessment is one step in a multi-step gate. The operator will review your report
and approve, defer, or reject. You are not the final authority — you are the structured
first read that makes the operator's review fast and informed.

Be specific. Be honest. Flag uncertainty rather than smoothing it over.
</task>

<input>
<source>
  <type>{{source.source_type}}</type>
  <title>{{source.title}}</title>
  <url>{{source.url}}</url>
  <publication>{{source.publication}}</publication>
  <author>{{source.author}}</author>
  <published_at>{{source.published_at}}</published_at>
  <ingestion_mode>{{source.ingestion_mode}}</ingestion_mode>
  <body>
{{source.raw_text or storage_uri reference}}
  </body>
</source>

<active_watch_sets>
{{for each thesis with active watch_set: thesis.id, title, watch_set entities, concept_spine}}
</active_watch_sets>

<potentially_conflicting_claims>
{{claims with semantic-similarity match against source body, top 10}}
</potentially_conflicting_claims>

<cost_context>
{{paid operations this source would trigger if approved, with whitelist status}}
</cost_context>
</input>

<assessment_criteria>
1. PROPOSED ADMIRALTY GRADE. Apply the rubric strictly. Primary documents are A, credible secondary is B, default unfamiliar sources to F until track record exists. Do not upgrade for plausibility.

2. BIAS PROFILE. Note known editorial lean, ownership ties, prior errors. If unknown, say "no track record."

3. COMPATIBILITY WITH ACTIVE WATCH-SETS. Which (if any) active theses' watch-sets does this source touch? Cite by thesis_id and entity name.

4. CONTRADICTION FLAGS. Does any claim in this source conflict with existing claims in the substrate? List specifically. If a conflict appears resolvable in favor of the new source, say so. If it's a genuine contradiction needing the Contradiction Registry, flag it.

5. PAID OPERATIONS REQUIRED. Does approval trigger paid operations (transcription, primary-document fetch, cross-model verification)? Estimate cost. State whether whitelisted.

6. REASONING. One paragraph: would you, as Critic, approve this source for registry writes? Why or why not?
</assessment_criteria>

<output_format>
Emit JSON conforming to the IngestionCriticReport schema.
</output_format>

<constraints>
- Never approve a source you cannot grade. If you cannot determine grade, say F and explain why.
- Never silently downgrade an A-grade primary source. Trust gazettes and official filings absent visible reason for doubt.
- Never recommend auto-approve for sources with any contradiction flags or paid-op requirements.
- If the source body appears truncated or corrupt, fail the critic with status='partial' and request re-ingestion.
</constraints>
```

### Output schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": [
    "proposed_grade",
    "bias_assessment",
    "compatibility_check",
    "contradiction_flags",
    "watch_set_matches",
    "paid_op_required",
    "reasoning",
    "auto_approve_recommended"
  ],
  "properties": {
    "proposed_grade": {
      "type": "string",
      "enum": ["A", "B", "C", "D", "E", "F"]
    },
    "bias_assessment": { "type": "string" },
    "compatibility_check": {
      "type": "object",
      "required": ["level", "commentary"],
      "properties": {
        "level": { "type": "string", "enum": ["high", "medium", "low", "none"] },
        "commentary": { "type": "string" }
      }
    },
    "contradiction_flags": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["existing_claim_id", "conflict_description", "proposed_resolution"],
        "properties": {
          "existing_claim_id": { "type": "string", "format": "uuid" },
          "conflict_description": { "type": "string" },
          "proposed_resolution": {
            "type": "string",
            "enum": ["new_source_wins", "existing_claim_wins", "needs_contradiction_registry", "requires_operator_judgment"]
          }
        }
      }
    },
    "watch_set_matches": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["thesis_id", "matched_entities"],
        "properties": {
          "thesis_id": { "type": "string", "format": "uuid" },
          "matched_entities": {
            "type": "array",
            "items": { "type": "string" }
          }
        }
      }
    },
    "paid_op_required": { "type": "boolean" },
    "paid_op_estimate_cents": { "type": "integer" },
    "paid_op_description": { "type": "string" },
    "reasoning": { "type": "string" },
    "auto_approve_recommended": { "type": "boolean" }
  }
}
```

### Notes

- Auto-approve is recommended only when: grade is A, no contradiction flags, no paid op required, at least one watch-set match, and the operator has enabled `auto_ingest_a_grade_uncontested` in System settings.
- The Critic is intentionally cautious. Better to over-flag and have the operator clear it than to silently approve.

---

## 2. VERIFIER

### Trigger

Fires on `claim.created` and `claim.updated`. Also runs nightly on a sample of high-stakes claims (claims linked to public theses or anchored predictions).

### Reads from substrate

- The target claim (current version, with all Toulmin fields)
- All sources cited as `claim_sources.supports = TRUE` (with their stored bodies)
- Source metadata (Admiralty grade, bias)

### Writes to substrate

- Updates `claims.verification_status` to one of `grounded | partial | unsupported | contested`
- Emits `claim.verified` event with status
- Logs full reasoning to `role_invocations.output_text` and citation array to `role_invocations.citations_returned`
- If cross-model verification is enabled: invokes a second model and writes the second invocation; if results disagree, sets status to `contested` and emits `claim.verification_contested`

### Model

Primary: `claude-opus-4-7` with Citations API enabled.
Cross-model: `gpt-5` or `gemini-2.5-pro` (operator's choice in `role_definitions.metadata`).

### API features

- **Citations API** — required. The Verifier's job is to ground claims in source documents.
- No Structured Outputs (incompatible with Citations API in single call).
- After Citations response, a second non-citations call extracts a structured `verification_status` from the citation results.
- Cross-model: same prompt run against secondary model; secondary model also uses citations if available, otherwise plain completion with source bodies in context.

### Prompt template

```xml
<task>
You are the Verifier for a forensic intelligence system. Your job is to determine
whether a claim is grounded in its cited sources.

You have access to the source documents via the Citations API. Use them.

Be conservative. "Grounded" means the source explicitly supports the claim, not that
the source is consistent with the claim. "Partial" means the source supports part of
the claim but not all of it. "Unsupported" means the source does not actually contain
the claimed information, even if the claim might be true.
</task>

<input>
<claim>
  <id>{{claim.id}}</id>
  <data>{{claim.data}}</data>
  <claim_text>{{claim.claim_text}}</claim_text>
  <warrant>{{claim.warrant}}</warrant>
  <backing>{{claim.backing}}</backing>
  <qualifier>{{claim.qualifier}}</qualifier>
  <rebuttal>{{claim.rebuttal}}</rebuttal>
  <grade>{{claim.admiralty_grade}}</grade>
</claim>

<cited_sources>
{{document blocks for each supporting source, with citations enabled}}
</cited_sources>
</input>

<verification_steps>
1. For each cited source, identify the specific passage(s) that bear on the claim.
   Cite passages explicitly using the Citations API mechanism.

2. For each passage, determine:
   - Does it explicitly state the claim's data? (Yes / Partial / No)
   - Does it support the claim's warrant? (Yes / Partial / No / N/A)
   - Does it contain the qualifier specified? (Yes / Partial / No / N/A)
   - Does it acknowledge the rebuttal? (Yes / Partial / No / N/A)

3. Aggregate to a verification_status:
   - GROUNDED: every load-bearing element is explicitly supported by at least one cited source.
   - PARTIAL: some elements supported, others missing or only implicit.
   - UNSUPPORTED: cited sources do not actually contain the claimed information.

4. Note any concerns: source quality issues, ambiguity in the claim, contradictions between cited sources.
</verification_steps>

<output_format>
1. A passage-by-passage citation analysis (this output uses Citations API native format).
2. A final paragraph stating the verification_status and one-sentence reasoning.
3. Note any flags for downstream roles (e.g., "this claim should also be checked by Red Team for warrant strength").
</output_format>

<constraints>
- Never mark a claim grounded based on a source that "would support" the claim if more context were available. Cite explicitly or mark partial.
- If a cited source contradicts the claim, mark unsupported and flag for the Contradiction Registry.
- If sources disagree among themselves, mark contested and flag for operator review.
</constraints>
```

### Output schema (post-citations call extraction)

```json
{
  "type": "object",
  "required": ["verification_status", "passage_analysis", "reasoning", "flags"],
  "properties": {
    "verification_status": {
      "type": "string",
      "enum": ["grounded", "partial", "unsupported", "contested"]
    },
    "passage_analysis": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["source_id", "passage_excerpt", "supports_data", "supports_warrant", "supports_qualifier"],
        "properties": {
          "source_id": { "type": "string", "format": "uuid" },
          "passage_excerpt": { "type": "string" },
          "supports_data": { "type": "string", "enum": ["yes", "partial", "no", "na"] },
          "supports_warrant": { "type": "string", "enum": ["yes", "partial", "no", "na"] },
          "supports_qualifier": { "type": "string", "enum": ["yes", "partial", "no", "na"] }
        }
      }
    },
    "reasoning": { "type": "string" },
    "flags": {
      "type": "array",
      "items": {
        "type": "string",
        "enum": ["needs_red_team", "needs_steelman", "needs_contradiction_registry", "source_quality_concern"]
      }
    }
  }
}
```

### Cross-model conflict resolution

If primary (Claude) and secondary (GPT-5/Gemini) verification statuses agree → that's the final status.
If they disagree by one step (e.g., Claude says "grounded", secondary says "partial") → status is the more conservative of the two, and a `cross_model_disagreement` flag is set on the role_invocation.
If they disagree by two or more steps → status is `contested`, the claim is surfaced to the operator for review, and a contradiction-registry-style entry is created comparing the two analyses.

### Notes

- The Verifier is the most expensive role per invocation. Cost discipline matters.
- For Sprint 1, cross-model verification runs only on claims explicitly flagged by the operator as high-stakes. Default behavior is single-model with Citations API.
- Citations API and Structured Outputs cannot be combined in a single call. The Verifier makes two calls per claim: (1) Citations call to ground, (2) Structured Outputs call to extract status from the grounding output.

---

## 3. INTERROGATOR

### Trigger

Fires on `thesis.updated` (any new claims integrated). Also runs at the start of every morning cascade.

### Reads from substrate

- The current thesis state (version, claims, layer decomposition)
- All open questions for this thesis (to avoid duplicates)
- Recent role_invocations for this thesis (to avoid generating questions just-answered)
- The Concept Spine

### Writes to substrate

- One or more rows in `questions` with `generated_by = 'interrogator'`
- Sets `expected_information_gain` for each
- Emits `question.generated` events

### Model

`claude-opus-4-7`.

### API features

- Structured Outputs (strict schema)
- No Citations API
- No cross-model verification (questions are generative; downstream verification on answers is what matters)

### Prompt template

```xml
<task>
You are the Interrogator for a forensic intelligence system. Your job is not to answer
questions. Your job is to surface the questions a thesis hasn't yet answered but should.

A good Interrogator question:
- Has high Expected Information Gain — its answer would materially change the thesis.
- Is specific enough to be answerable with documentary evidence.
- Is not already in the open-questions list.
- Is not what someone else (Red Team, Gap Surfacer) would obviously surface — those roles
  have their own jobs. Yours is the question that opens up new evidence territory.

Generate 3–7 questions per invocation. More than 7 is noise; fewer than 3 means you
weren't trying.
</task>

<input>
<thesis>
  <id>{{thesis.id}}</id>
  <title>{{thesis.title}}</title>
  <bluf>{{thesis.bluf}}</bluf>
  <concept_spine>{{thesis.concept_spine}}</concept_spine>
</thesis>

<current_claims>
{{for each claim in thesis: layer, data, claim_text, warrant, grade, sources}}
</current_claims>

<open_questions>
{{questions where status='open' and thesis_id=this thesis}}
</open_questions>

<recent_role_outputs>
{{last 5 role_invocations involving this thesis, role_name and brief output}}
</recent_role_outputs>
</input>

<question_generation_steps>
1. Read the thesis as if you were a skeptical investigator who knows the field.

2. Identify entities, claims, or relations where the documentary record could disambiguate
   between competing interpretations of the thesis.

3. Identify time periods, jurisdictions, or stakeholders that the thesis names but does
   not document. ("X happened in 2014 — what was Y doing during 2014?")

4. Identify warrants that are stated but not backed. ("The thesis assumes X implies Y.
   What evidence would support that warrant being a general pattern vs. an isolated case?")

5. For each candidate question, estimate Expected Information Gain on a 0–1 scale.
   Calibrate: 1.0 means the answer would resolve a linchpin assumption. 0.5 means it
   would refine the thesis. 0.1 means it would only add detail.

6. Drop any question with EIG < 0.3 unless explicitly asked for low-EIG follow-ups.

7. Drop any question already in open_questions or substantively answered by recent role outputs.
</question_generation_steps>

<output_format>
Emit JSON conforming to the InterrogatorOutput schema.
</output_format>

<constraints>
- Questions must be specific. "What about Brookfield's history?" is not a question.
  "Did Brookfield's 2018 reorganization shift any subsidiaries' beneficial ownership
  outside Canada?" is a question.
- Questions must be answerable in principle by documentary evidence.
- No "what if" hypotheticals. Those go to the Premortem role.
- No adversarial framing. That goes to Red Team.
</constraints>
```

### Output schema

```json
{
  "type": "object",
  "required": ["questions"],
  "properties": {
    "questions": {
      "type": "array",
      "minItems": 3,
      "maxItems": 7,
      "items": {
        "type": "object",
        "required": ["text", "expected_information_gain", "rationale", "evidence_targets"],
        "properties": {
          "text": { "type": "string" },
          "expected_information_gain": { "type": "number", "minimum": 0, "maximum": 1 },
          "rationale": { "type": "string" },
          "evidence_targets": {
            "type": "array",
            "items": { "type": "string" }
          }
        }
      }
    }
  }
}
```

### Notes

- The `evidence_targets` array suggests where the operator might look to answer the question (e.g., "SEDAR+ filings 2017-2019", "Hansard Standing Committee on Finance June 2014").
- The Interrogator does not answer its own questions. Answers come from new sources or operator research.

### Sprint 1 round-trip contract

The output schema above is intentionally narrow for v1.0 — every emitted field round-trips into the substrate without loss. See schema-v1.0 §12.4 for the field-by-field mapping into the `questions` table (`text`, `expected_information_gain`, `rationale`, `evidence_targets[]`).

Fields that would require true-graph storage — discriminates-between-claims, tests-warrant-of-claim, depends-on-question — are deferred to v1.1 of both this skill and the schema, where they land in `question_claims` and `question_dependencies` edge tables (schema-v1.0 §12.2, §12.3). Sprint 1's Question Graph is a tree via `parent_question_id`; promoting it to a graph is a Sprint 2+ task with co-changes on both sides of this contract.

---

## 4. RED TEAM

### Trigger

Fires when a thesis crosses a confidence threshold (manually set per thesis, default IPCC `likely`). Also operator-invokable on demand. Runs from a specified vantage (historian-50yr, contrarian-economist, opposing-political-tradition, foreign-observer — operator picks).

### Reads from substrate

- Thesis with current version and BLUF
- Top-claim set (highest-grade claims supporting the thesis's conclusion)
- Linchpins (high-priority targets for adversarial pressure)
- Existing Red Team objections (to avoid repetition)

### Writes to substrate

- Rows in a new table `red_team_objections` (specified below) — one per objection
- Emits `red_team.fired` event
- Optionally creates entries in `contradictions` if an objection identifies an existing-graph contradiction

### Model

`claude-opus-4-7` for primary. Cross-model with `gpt-5` or `gemini-2.5-pro` is optional and operator-controlled — Red Team disagreement is information, not noise.

### API features

- Structured Outputs (strict schema)
- No Citations API (Red Team is generative skepticism, not source-grounded verification)

### Prompt template

```xml
<task>
You are the Red Team for a forensic intelligence system. Your job is to attack a thesis
to find its weaknesses, from a specified analytical vantage.

You are not trying to be helpful or balanced. You are trying to find the strongest
possible objections a serious critic of this vantage would raise.

If the thesis is sound, your objections will fail and the thesis will hold. If it has
weaknesses, you will find them. Either outcome is valuable.
</task>

<input>
<vantage>{{operator-specified vantage; default: historian-50yr}}</vantage>

<thesis>
  <title>{{thesis.title}}</title>
  <bluf>{{thesis.bluf}}</bluf>
  <full_text>{{thesis.tier_full or tier_800}}</full_text>
</thesis>

<linchpins>
{{linchpin assumptions for this thesis}}
</linchpins>

<top_claims>
{{top 10 highest-grade supporting claims}}
</top_claims>

<existing_objections>
{{prior red_team_objections to avoid repetition}}
</existing_objections>
</input>

<vantages>
- historian-50yr: Imagine you're a historian writing about this period 50 years from now.
  What is this thesis missing about the longer arc?
- contrarian-economist: Apply a heterodox economic frame (e.g., MMT, ecological economics,
  Austrian) and ask what assumptions the mainstream frame is smuggling in.
- opposing-political-tradition: If the thesis lives in tradition X, attack from tradition
  not-X (left from right, right from left, structural from individualist).
- foreign-observer: How does this look to someone outside Canada — what is being treated
  as universal but is actually local?
- base-rate-skeptic: How often does this kind of pattern (e.g., career overlap) occur
  by chance in similar networks? What's the null hypothesis?
- methodological-skeptic: What if the methodology itself is flawed? What if the wrong
  layer is being treated as primary?
</vantages>

<attack_steps>
1. Apply your vantage to the thesis. What does this vantage reveal that the thesis
   misses, downplays, or assumes away?

2. Identify the linchpin most vulnerable from your vantage. State the strongest
   objection to that linchpin.

3. Identify a claim that, if true, doesn't actually support the thesis's conclusion
   under your vantage's assumptions. (Same data, different inference rule.)

4. Identify what evidence would change your mind — what observation would lead you,
   from your vantage, to accept the thesis.

5. Steelman your own objections — make sure they're the strongest version of the
   critique, not a strawman.
</attack_steps>

<output_format>
Emit JSON conforming to the RedTeamOutput schema.
</output_format>

<constraints>
- Be sharp. Vague generalities ("this could be wrong") are useless.
- Cite specific claims by ID when attacking them.
- If the thesis genuinely seems sound from your vantage, say so — but explain why your
  vantage doesn't generate strong objections in this case.
- Don't recycle existing objections. Add new ones or flag the existing ones as still
  valid.
</constraints>
```

### Output schema

```json
{
  "type": "object",
  "required": ["vantage", "objections"],
  "properties": {
    "vantage": { "type": "string" },
    "objections": {
      "type": "array",
      "minItems": 1,
      "maxItems": 5,
      "items": {
        "type": "object",
        "required": ["target_type", "objection_text", "severity", "what_would_change_my_mind"],
        "properties": {
          "target_type": {
            "type": "string",
            "enum": ["linchpin", "claim", "warrant", "framing", "thesis_overall"]
          },
          "target_id": { "type": "string", "format": "uuid" },
          "objection_text": { "type": "string" },
          "severity": {
            "type": "string",
            "enum": ["fatal", "major", "moderate", "minor"]
          },
          "what_would_change_my_mind": { "type": "string" },
          "steelmanning_note": { "type": "string" }
        }
      }
    },
    "thesis_holds_under_vantage": { "type": "boolean" },
    "vantage_specific_commentary": { "type": "string" }
  }
}
```

### Supporting table: `red_team_objections`

```sql
CREATE TABLE public.red_team_objections (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  thesis_id       UUID NOT NULL REFERENCES public.theses(id) ON DELETE CASCADE,
  role_invocation_id UUID NOT NULL REFERENCES public.role_invocations(id),
  vantage         TEXT NOT NULL,
  target_type     TEXT NOT NULL,
  target_id       UUID,
  objection_text  TEXT NOT NULL,
  severity        TEXT NOT NULL,
  what_would_change_my_mind TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'open',  -- 'open', 'addressed', 'dismissed', 'machloket'
  resolution_notes TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

(Add to schema in v1.1.)

---

## 5. STEELMAN

### Trigger

Fires after every Red Team invocation, on each objection with severity ≥ moderate. Also operator-invokable on a contradiction or claim.

### Reads from substrate

- The Red Team objection (or the claim/contradiction being steelmanned)
- The thesis context
- Existing claims in the substrate that might support the steelman position

### Writes to substrate

- Updates `red_team_objections.steelman_response` (column added in v1.1)
- Optionally: if the steelman reveals a genuine machloket, updates the contradiction registry posture

### Model

`claude-opus-4-7`.

### API features

- Structured Outputs
- No Citations API

### Prompt template

```xml
<task>
You are the Steelman for a forensic intelligence system. Your job is to construct the
strongest possible version of an opposing position — better than its actual proponents
typically articulate.

A steelman is not a defense of the original thesis. It is the strongest case for the
opposite. If the steelman is decisively rebuttable, the original thesis is stronger
for having faced it. If the steelman is genuinely compelling, the original thesis
should update — possibly to a machloket posture.
</task>

<input>
<original_position>
{{thesis BLUF or specific claim being attacked}}
</original_position>

<objection_being_steelmanned>
{{red team objection or competing claim}}
</objection_being_steelmanned>

<context>
{{thesis full text, relevant claims}}
</context>
</input>

<steelman_steps>
1. State the strongest version of the opposing position. Use its proponents' best
   vocabulary, their strongest evidence, their most persuasive framing.

2. Identify what the original thesis would have to concede if the steelman is correct.

3. Identify what evidence would distinguish between the original thesis and the
   steelman position.

4. Make a recommendation: does the steelman survive scrutiny? Three options:
   - REBUTTED: the original thesis defeats the steelman; the objection fails.
   - MACHLOKET: both positions have merit; preserve the contradiction.
   - UPDATE: the steelman reveals the original thesis needs to update.
</steelman_steps>

<output_format>
Emit JSON conforming to the SteelmanOutput schema.
</output_format>

<constraints>
- A steelman in bad faith is useless. Genuinely advocate for the opposing position.
- Don't smuggle in obvious refutations. The steelman is presented on its own terms.
- The recommendation comes after the steelman, not as a hedge during it.
</constraints>
```

### Output schema

```json
{
  "type": "object",
  "required": ["steelman_position", "what_thesis_would_concede", "distinguishing_evidence", "recommendation", "reasoning"],
  "properties": {
    "steelman_position": { "type": "string" },
    "what_thesis_would_concede": { "type": "string" },
    "distinguishing_evidence": {
      "type": "array",
      "items": { "type": "string" }
    },
    "recommendation": {
      "type": "string",
      "enum": ["rebutted", "machloket", "update"]
    },
    "reasoning": { "type": "string" }
  }
}
```

---

## 6. PREMORTEM

### Trigger

Operator-invokable on any thesis or major claim. Also runs automatically when a thesis is about to be published as a public surface.

### Reads from substrate

- The thesis
- Linchpins
- Active predictions anchored to the thesis
- Indicators tracking the thesis

### Writes to substrate

- A `premortem_report` row (table specified below)
- Updates `assumptions.consequence_if_failed` for relevant assumptions
- Emits `premortem.completed` event

### Model

`claude-opus-4-7`.

### API features

- Structured Outputs
- No Citations API

### Prompt template

```xml
<task>
You are the Premortem for a forensic intelligence system. Your job is to imagine a
specific future in which this thesis turns out to have been wrong, and reason backward
to identify what would have caused the failure.

The premortem is not the same as the Red Team. Red Team attacks from outside the
thesis's frame. Premortem assumes the thesis fails and traces the most likely failure
mode from inside the frame.

Premortems sharpen falsifiability. After this exercise, the thesis should have a clear
answer to "what observation would falsify this?"
</task>

<input>
<thesis>
  <title>{{thesis.title}}</title>
  <bluf>{{thesis.bluf}}</bluf>
  <full_text>{{thesis.tier_full or tier_800}}</full_text>
  <ipcc_likelihood>{{thesis.ipcc_likelihood}}</ipcc_likelihood>
</thesis>

<linchpins>
{{linchpins}}
</linchpins>

<active_predictions>
{{predictions anchored to this thesis}}
</active_predictions>

<active_indicators>
{{indicators tracking this thesis}}
</active_indicators>
</input>

<premortem_steps>
1. Imagine it is two years from now and this thesis has been decisively wrong.
   Specifically describe what was discovered or observed that proved it wrong.

2. Trace backward: what was the failure mode?
   - Was a linchpin actually false?
   - Was the framing wrong (a different layer was primary)?
   - Was the evidence base unrepresentative?
   - Was a counterfactual ignored?
   - Did the thesis confuse correlation with causation?
   - Did time make a static thesis obsolete?

3. For each failure mode candidate, estimate its likelihood from 0 to 1.

4. For the most likely failure mode, identify what indicator could be set up now
   to provide early warning.

5. Identify what concrete observation would falsify the thesis. (If you can't,
   the thesis is not falsifiable and must be re-stated.)
</premortem_steps>

<output_format>
Emit JSON conforming to the PremortemOutput schema.
</output_format>

<constraints>
- Be specific about the failure scenario. "It could be wrong" is useless.
- The falsification observation must be specific and answerable in principle.
- If the thesis is not falsifiable, say so explicitly.
</constraints>
```

### Output schema

```json
{
  "type": "object",
  "required": ["failure_scenario", "failure_modes", "early_warning_indicators", "falsifying_observation"],
  "properties": {
    "failure_scenario": { "type": "string" },
    "failure_modes": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["mode", "description", "likelihood"],
        "properties": {
          "mode": {
            "type": "string",
            "enum": ["linchpin_false", "framing_wrong", "evidence_unrepresentative", "counterfactual_ignored", "correlation_not_causation", "time_obsoleted", "other"]
          },
          "description": { "type": "string" },
          "likelihood": { "type": "number", "minimum": 0, "maximum": 1 }
        }
      }
    },
    "early_warning_indicators": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["indicator_name", "definition", "threshold_for_concern"],
        "properties": {
          "indicator_name": { "type": "string" },
          "definition": { "type": "string" },
          "threshold_for_concern": { "type": "string" }
        }
      }
    },
    "falsifying_observation": { "type": "string" },
    "is_falsifiable": { "type": "boolean" }
  }
}
```

### Supporting table: `premortem_reports`

```sql
CREATE TABLE public.premortem_reports (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  thesis_id       UUID NOT NULL REFERENCES public.theses(id) ON DELETE CASCADE,
  role_invocation_id UUID NOT NULL REFERENCES public.role_invocations(id),
  failure_scenario TEXT NOT NULL,
  failure_modes   JSONB NOT NULL,
  early_warning_indicators JSONB NOT NULL,
  falsifying_observation TEXT NOT NULL,
  is_falsifiable  BOOLEAN NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 7. GAP SURFACER

### Trigger

Runs in every morning cascade, plus operator-invokable on any thesis.

### Reads from substrate

- Thesis with all integrated claims, layer-decomposed
- Watch-set
- Concept spine
- Entity relations involving thesis-relevant entities
- Claims in the wider Claim Graph that mention thesis entities but are not yet integrated

### Writes to substrate

- One row in `gap_surfacer_reports` (table specified below)
- Optionally: surfaces specific entities, time periods, or stakeholder perspectives as new questions (calls Interrogator with specific seed)
- Emits `gap.surfaced` events with structural-hole locations

### Model

`claude-opus-4-7`.

### API features

- Structured Outputs
- No Citations API

### Seven-stage sweep

The Gap Surfacer's distinctive contribution is a structured seven-stage sweep:

```
Stage 1 — MISSING ENTITIES
Are there entities mentioned in the thesis text that don't have corresponding entity
records? Are there entities the thesis ought to mention given its scope?

Stage 2 — MISSING RELATIONS
Are there entity-pairs the thesis discusses without a documented relation? Are there
entity-pairs that, given the thesis's frame, should be examined for relations?

Stage 3 — MISSING COUNTER-EVIDENCE
The thesis's claims supporting its conclusion — are there sources that *might* contradict
those claims that haven't been searched? Specifically: which sources are systematically
missing from the support set?

Stage 4 — MISSING TIME PERIODS
Are there years, decades, or events in the thesis's time scope that are underrepresented?
Where does the documentary trail go silent?

Stage 5 — MISSING STAKEHOLDER PERSPECTIVES
Whose perspective is missing? The thesis is structural; whose lived experience is
absent? Whose institutional position is underrepresented?

Stage 6 — MISSING COMPARISON CASES
Is this thesis treating its case as unique? Are there parallel cases (other countries,
other periods, other industries) that would test the thesis's claims about general
patterns?

Stage 7 — MISSING DISCONFIRMING INDICATORS
What indicators should the thesis be tracking that it isn't? What measurable values
would, if observed, weaken the thesis's IPCC likelihood?
```

### Prompt template

```xml
<task>
You are the Gap Surfacer for a forensic intelligence system. Your job is to identify
what the thesis isn't addressing that it should.

You run a structured seven-stage sweep. Each stage looks for a specific kind of gap.
Be specific. Vague gap-flagging is useless. "This thesis could say more about X" is
worthless; "Stage 2 gap: the thesis discusses Carney's Brookfield tenure and his BoC
tenure separately, but does not document any relation between Brookfield and BoC's
post-2008 mortgage-backed-securities holdings" is a real gap.
</task>

<input>
<thesis>
  <id>{{thesis.id}}</id>
  <title>{{thesis.title}}</title>
  <bluf>{{thesis.bluf}}</bluf>
  <full_text>{{thesis.tier_full or tier_800}}</full_text>
</thesis>

<integrated_claims_by_layer>
{{claims grouped by layer: factual, framing, architectural, distributive}}
</integrated_claims_by_layer>

<watch_set>
{{thesis.watch_set entities}}
</watch_set>

<adjacent_unintegrated_claims>
{{claims mentioning thesis entities that haven't been integrated into the thesis yet}}
</adjacent_unintegrated_claims>

<existing_indicators>
{{indicators tracking this thesis}}
</existing_indicators>
</input>

<sweep>
Run all seven stages. For each stage, identify 0–4 specific gaps. Stages with no gaps
return an empty array (not omitted).

Stage 1 — Missing Entities
Stage 2 — Missing Relations
Stage 3 — Missing Counter-Evidence
Stage 4 — Missing Time Periods
Stage 5 — Missing Stakeholder Perspectives
Stage 6 — Missing Comparison Cases
Stage 7 — Missing Disconfirming Indicators
</sweep>

<output_format>
Emit JSON conforming to the GapSurfacerOutput schema.
</output_format>

<constraints>
- Be specific. Cite entity names, time periods, source candidates by name.
- Don't surface gaps that are out-of-scope for the thesis. (A thesis on Canadian
  monetary policy doesn't have a "gap" because it doesn't cover Australia.)
- For each gap, suggest a concrete next step the operator could take.
</constraints>
```

### Output schema

```json
{
  "type": "object",
  "required": ["stage_1", "stage_2", "stage_3", "stage_4", "stage_5", "stage_6", "stage_7", "structural_holes"],
  "properties": {
    "stage_1": { "$ref": "#/definitions/gap_array" },
    "stage_2": { "$ref": "#/definitions/gap_array" },
    "stage_3": { "$ref": "#/definitions/gap_array" },
    "stage_4": { "$ref": "#/definitions/gap_array" },
    "stage_5": { "$ref": "#/definitions/gap_array" },
    "stage_6": { "$ref": "#/definitions/gap_array" },
    "stage_7": { "$ref": "#/definitions/gap_array" },
    "structural_holes": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["description", "between_clusters"],
        "properties": {
          "description": { "type": "string" },
          "between_clusters": {
            "type": "array",
            "items": { "type": "string" }
          }
        }
      }
    }
  },
  "definitions": {
    "gap_array": {
      "type": "array",
      "maxItems": 4,
      "items": {
        "type": "object",
        "required": ["description", "next_step"],
        "properties": {
          "description": { "type": "string" },
          "next_step": { "type": "string" },
          "candidate_sources": {
            "type": "array",
            "items": { "type": "string" }
          }
        }
      }
    }
  }
}
```

### Supporting table: `gap_surfacer_reports`

```sql
CREATE TABLE public.gap_surfacer_reports (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  thesis_id       UUID NOT NULL REFERENCES public.theses(id) ON DELETE CASCADE,
  role_invocation_id UUID NOT NULL REFERENCES public.role_invocations(id),
  stage_results   JSONB NOT NULL,
  structural_holes JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_gaps_surfaced INTEGER NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 8. CALIBRATION

### Trigger

Runs nightly. Also fires on `indicator.observed` events that resolve a prediction.

### Reads from substrate

- All resolved predictions in the last 24 hours (or since last run)
- The full prediction history for rolling Brier computation
- Predictions with horizons crossing today (potentially expiring)
- Indicators with new observations

### Writes to substrate

- Updates `predictions.status`, `resolved_at`, `resolved_outcome`, `brier_contribution`
- Refreshes `mv_brier_rolling` materialized view
- Emits `prediction.resolved` events
- Updates `indicator_observations.resolved_predictions` arrays

### Model

`claude-opus-4-7`. (Resolution often requires reading evidence; future: a smaller cheaper model could handle this.)

### API features

- Structured Outputs
- Optionally Citations API for resolutions that need source-grounding

### Prompt template

```xml
<task>
You are the Calibration role for a forensic intelligence system. Your job is to resolve
predictions whose horizon has been reached or whose resolution criterion has been met,
and to maintain the Brier scoring ledger.

This role is the accountability mechanism. The system makes predictions; this role
forces them to be scored. Honest scoring matters more than favorable scoring.
</task>

<input>
<predictions_to_assess>
{{for each prediction: id, claim_text, confidence, resolution_criterion, banked_at, horizon, anchored_indicators}}
</predictions_to_assess>

<recent_indicator_observations>
{{indicator observations in the last 24h}}
</recent_indicator_observations>

<recent_substrate_evidence>
{{recent claims/sources that bear on prediction outcomes}}
</recent_substrate_evidence>
</input>

<resolution_steps>
For each prediction:

1. Has the resolution criterion been met (one way or the other)? Look at indicators,
   recent claims, and explicit operator-provided evidence.

2. If yes: determine outcome (correct / incorrect / ambiguous).

3. If outcome is ambiguous: explain why. Do not force a resolution.

4. Compute brier_contribution = (predicted_probability - actual_outcome)^2,
   where actual_outcome = 1 for correct, 0 for incorrect.
   For ambiguous, do not compute Brier; mark resolved_ambiguous and exclude from rolling Brier.

5. If the prediction's horizon has been reached but the criterion has not been met:
   mark expired_unresolved. This is information about the prediction's framing,
   not just a non-event.

6. Cite the evidence used to resolve, with source IDs.
</resolution_steps>

<output_format>
Emit JSON conforming to the CalibrationOutput schema.
</output_format>

<constraints>
- Never resolve a prediction without explicit evidence.
- Never round outcomes. Ambiguous is its own status.
- Brier rewards calibration, not bias toward extremes. Don't push predictions toward
  resolved_correct just because they had high confidence.
</constraints>
```

### Output schema

```json
{
  "type": "object",
  "required": ["resolutions"],
  "properties": {
    "resolutions": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["prediction_id", "new_status", "reasoning"],
        "properties": {
          "prediction_id": { "type": "string", "format": "uuid" },
          "new_status": {
            "type": "string",
            "enum": ["resolved_correct", "resolved_incorrect", "resolved_ambiguous", "expired_unresolved", "active_continuing"]
          },
          "outcome_value": { "type": "number", "minimum": 0, "maximum": 1 },
          "brier_contribution": { "type": "number" },
          "evidence_source_ids": {
            "type": "array",
            "items": { "type": "string", "format": "uuid" }
          },
          "evidence_indicator_id": { "type": "string", "format": "uuid" },
          "reasoning": { "type": "string" }
        }
      }
    }
  }
}
```

### Notes

- For Sprint 1, predictions are resolved manually by the operator. Calibration as a
  role activates in Sprint 2 once enough predictions exist to make automation worthwhile.
- Calibration disagreements between automated and operator resolution are logged but
  the operator's decision wins.

---

## 9. TIER PROJECTOR

### Trigger

Fires on `thesis.updated` (any version change). Runs on every morning cascade for theses with `is_public = TRUE`.

### Reads from substrate

- Thesis current version
- All claims in `thesis_claims` for this thesis, with full Toulmin
- Linchpins
- Open contradictions affecting this thesis
- Anchored predictions

### Writes to substrate

- Updates `thesis_versions.bluf`, `tier_80`, `tier_800`, `tier_full`
- Sets `thesis_versions.ipcc_likelihood` based on weighted claim grades
- Emits `thesis.tiers_regenerated` event
- Triggers `pub_theses_cache` rebuild for public theses

### Model

`claude-opus-4-7`.

### API features

- No Structured Outputs (output is markdown prose at four lengths)
- No Citations API (citations are inline in the markdown via existing claim references)

### Prompt template

```xml
<task>
You are the Tier Projector for a forensic intelligence system. Your job is to render
a thesis at four lengths: BLUF (one sentence), 80 words, 800 words, and Full.

Each tier is for a different reader at a different time:
- BLUF for the headline. The conclusion with an IPCC likelihood qualifier.
- 80 words for the executive scan. The thesis with the two or three load-bearing claims.
- 800 words for the engaged reader. The full argument with key evidence cited inline.
- Full for the auditing reader. Complete argument, all claims, all sources cited.

Each tier must regenerate deterministically from the same substrate. The same claim
state should produce substantially the same tier text (with allowed prose variation).

Voice: declarative, evidence-first, no editorializing. The Moose-on-the-Loose register.
Conclusions emerge from facts. The reader should never feel sold to.
</task>

<input>
<thesis>
  <title>{{thesis.title}}</title>
  <seed_paragraph>{{thesis.seed_paragraph}}</seed_paragraph>
  <previous_bluf>{{thesis.bluf or empty}}</previous_bluf>
</thesis>

<claims_by_layer>
  <factual>{{factual claims with grades and sources}}</factual>
  <framing>{{framing claims}}</framing>
  <architectural>{{architectural claims, including any linchpins}}</architectural>
  <distributive>{{distributive claims}}</distributive>
</claims_by_layer>

<linchpins>{{linchpins}}</linchpins>
<open_contradictions>{{contradictions affecting this thesis}}</open_contradictions>
<anchored_predictions>{{predictions anchored to this thesis}}</anchored_predictions>
</input>

<tier_specs>
BLUF (1 sentence):
- The thesis's conclusion in declarative form
- Ends with an IPCC likelihood qualifier ("— likely", "— very likely", etc.)
- 25 words maximum, ideally 15

80 words:
- Two or three sentences
- States the thesis, names the load-bearing pattern, qualifies with IPCC
- Cites no specific sources by name
- Maximum 90 words, target 80

800 words:
- Full argument structure: thesis → key evidence → counter-evidence considered → confidence
- Inline citations to specific claims using claim IDs (will be rendered as links)
- Acknowledges open contradictions
- Names linchpins explicitly
- Maximum 900 words, target 800

Full:
- Complete argument with all integrated claims
- Layer-by-layer organization
- All sources cited
- Every Toulmin warrant explicit
- No artificial length cap; aim for completeness
</tier_specs>

<output_format>
Emit four markdown blocks separated by `--- TIER BREAK ---` lines.

```
[BLUF block]

--- TIER BREAK ---

[80-word block]

--- TIER BREAK ---

[800-word block with inline claim references like {claim:abc-123}]

--- TIER BREAK ---

[Full block]
```

Use {claim:UUID} syntax for inline citations. The orchestrator will replace these
with claim-page links when rendering for the public site.
</output_format>

<constraints>
- IPCC qualifier in BLUF is mandatory. Pick the weaker option if uncertain.
- No editorializing. No "concerning patterns," no "alarming findings." State facts.
- 800-word tier acknowledges what's contested. If contradictions exist on this thesis,
  the 800-word tier mentions them.
- Voice consistency across tiers. Same register, different lengths.
</constraints>
```

### Output

Plain markdown emitted in four blocks separated by tier-break markers. The orchestrator parses and stores each block to the corresponding column on `thesis_versions`.

### IPCC qualifier derivation

The Tier Projector also returns the recommended `ipcc_likelihood` for the thesis as a whole, computed from:

```
weighted_support = Σ(grade_weight * supports_thesis_conclusion)
weighted_total   = Σ(grade_weight)

where grade_weight = 4 (A), 3 (B), 2 (C), 1 (D), 0 (E/F)

ratio = weighted_support / weighted_total

ratio >= 0.99 → virtually_certain
ratio >= 0.90 → very_likely
ratio >= 0.66 → likely
0.33 <= ratio < 0.66 → about_as_likely_as_not
ratio < 0.33 → unlikely (or weaker)
```

The model is given the ratio and the rubric, and must return the qualifier as a final line:

```
IPCC_LIKELIHOOD: likely
```

The orchestrator parses this and updates `thesis_versions.ipcc_likelihood`.

---

## 10. ASSUMPTION AUDITOR

### Trigger

Runs weekly. Also fires when a claim that supports an assumption is updated, downgraded, or refuted.

### Reads from substrate

- All assumptions for the user, with current status
- Linchpins specifically (priority targets)
- Supporting claims for each assumption (from `assumption_supporting_claims`)
- Recent verifier outputs touching those claims

### Writes to substrate

- Updates `assumptions.status`, `last_audited_at`, `last_audit_role_invocation_id`
- If a linchpin assumption changes status, emits `linchpin.status_changed` event
- Logs the audit reasoning to `role_invocations.output_text`

### Model

`claude-opus-4-7`.

### API features

- Structured Outputs
- No Citations API

### Prompt template

```xml
<task>
You are the Assumption Auditor for a forensic intelligence system. Your job is to
periodically sweep the Assumption Registry and re-evaluate whether each assumption
is still holding, given the current state of supporting claims.

Linchpins are priority. If a linchpin's supporting claims have been weakened,
downgraded, or refuted since the last audit, the linchpin's status should change —
and the change is consequential because linchpins, by definition, collapse theses
when they fail.

Be conservative about upgrading status. Be quick to flag weakening.
</task>

<input>
<assumptions>
{{for each assumption: id, text, status, is_linchpin, last_audited_at, supporting_claim_ids}}
</assumptions>

<supporting_claims_state>
{{for each supporting claim: id, claim_text, current_grade, verification_status, last_updated}}
</supporting_claims_state>

<recent_verifier_outputs>
{{verifier outputs in the last 7 days that touched supporting claims}}
</recent_verifier_outputs>
</input>

<audit_steps>
For each assumption:

1. Review the current state of every supporting claim. What is the average grade?
   How many are 'grounded'? How many have been recently downgraded or contradicted?

2. Has the supporting evidence base changed since last_audited_at?

3. Determine new status:
   - HOLDING: supporting claims unchanged or strengthened
   - STRENGTHENED: new high-grade claims have been added
   - WEAKENING: at least one supporting claim downgraded, contradicted, or refuted
   - FAILED: enough supporting claims have failed that the assumption no longer holds

4. For linchpin assumptions, be especially specific about what evidence change
   triggered the status update.
</audit_steps>

<output_format>
Emit JSON conforming to the AssumptionAuditorOutput schema.
</output_format>

<constraints>
- Default to HOLDING if no evidence has changed.
- Never mark FAILED without specifically naming the failed supporting claim(s).
- Linchpin status changes are surfaced to the operator with high priority.
</constraints>
```

### Output schema

```json
{
  "type": "object",
  "required": ["audits"],
  "properties": {
    "audits": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["assumption_id", "previous_status", "new_status", "reasoning"],
        "properties": {
          "assumption_id": { "type": "string", "format": "uuid" },
          "previous_status": {
            "type": "string",
            "enum": ["holding", "weakening", "failed", "strengthened"]
          },
          "new_status": {
            "type": "string",
            "enum": ["holding", "weakening", "failed", "strengthened"]
          },
          "reasoning": { "type": "string" },
          "evidence_changes": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "claim_id": { "type": "string", "format": "uuid" },
                "change_type": {
                  "type": "string",
                  "enum": ["downgraded", "upgraded", "refuted", "added", "verified"]
                }
              }
            }
          },
          "linchpin_alert": { "type": "boolean" }
        }
      }
    }
  }
}
```

---

## 11. INDICATOR VALIDATOR

### Trigger

Fires when an operator declares a new indicator. Also runs on `indicator.observed` events to validate observations.

### Reads from substrate

- The proposed/existing indicator definition
- Any associated source for an observation
- Other indicators (to detect duplicate or near-duplicate definitions)

### Writes to substrate

- Approves or rejects the indicator (`indicators.is_active`)
- Validates new observations (writes to `indicator_observations` or rejects)
- Emits `indicator.validated` event

### Model

`claude-opus-4-7` for declaration validation, `claude-haiku` (or successor) for routine observation validation if cost matters.

### API features

- Structured Outputs

### Prompt template

```xml
<task>
You are the Indicator Validator for a forensic intelligence system. You have two jobs:

1. When an indicator is declared, validate that it is well-formed: definition is
   specific, source is reliable, cadence is sensible, threshold for confirmation/
   disconfirmation is operationalized.

2. When an observation is recorded, validate that the observed value is internally
   consistent and matches the indicator's expected format.

Reject malformed indicators. Reject suspicious observations. Approval here gates
downstream Calibration use.
</task>

<input>
<mode>{{validate_declaration | validate_observation}}</mode>

<indicator>
{{full indicator record}}
</indicator>

<observation>
{{observation if mode=validate_observation}}
</observation>

<existing_indicators>
{{user's existing indicators, for duplicate detection}}
</existing_indicators>
</input>

<validation_criteria>
For declaration:
- Definition is specific (not "the economy" — specific GDP series, etc.)
- Source URI is accessible and reliable
- Cadence matches source's actual publication cadence
- Thresholds are operationalized as comparable values, not vibes
- Not a duplicate of an existing indicator

For observation:
- Observed value matches expected type/format
- Observation timestamp is plausible (not future-dated, not absurdly old)
- Source for observation is appropriate (the cited source actually publishes this value)
</validation_criteria>

<output_format>
Emit JSON conforming to the IndicatorValidatorOutput schema.
</output_format>
```

### Output schema

```json
{
  "type": "object",
  "required": ["mode", "valid", "reasoning"],
  "properties": {
    "mode": {
      "type": "string",
      "enum": ["validate_declaration", "validate_observation"]
    },
    "valid": { "type": "boolean" },
    "reasoning": { "type": "string" },
    "issues": {
      "type": "array",
      "items": { "type": "string" }
    },
    "suggested_fixes": {
      "type": "array",
      "items": { "type": "string" }
    },
    "duplicate_of_indicator_id": { "type": "string", "format": "uuid" }
  }
}
```

---

## 12. CLAIM EXTRACTION (utility skill)

This is the twelfth skill: a utility, not a role. It produces no analytical judgment — it converts an approved source body into structured claim candidates that the orchestrator then writes to the substrate. Roles (the eleven above) sit in judgment over substrate state; claim_extraction is the adapter that turns prose into substrate so the roles have something to judge.

### Trigger

Cascade workflow STEP 5, after a source's `ingestion_state` transitions to `approved`. Also invoked by the on-demand cascade when an operator manually approves a source outside the morning cron.

### Reads from substrate

- The approved source: `sources.raw_text` (or R2-hosted body), `source_type`, `title`, `publication`, `published_at`, Critic-assigned `admiralty_grade`
- Active thesis concept spines (`thesis_concept_spines`) for relevance hint — claims that touch active investigations are flagged but never excluded

### Writes to substrate

- Returns a structured array of claim candidates. The orchestrator (not the skill) then writes:
  - `claims` rows
  - `claim_versions` rows (initial version, `is_current = TRUE`)
  - `claim_entities` rows with `entity_id = NULL` until entity resolution runs (Sprint 2+)
  - `claim_sources` rows linking each claim to the originating source with `supports = TRUE`
- Emits `claim.extracted` events per candidate (one event per claim written)

The skill itself produces no substrate writes — it returns a candidate array. This separation keeps the skill side-effect-free and the orchestrator's transactional boundary clean.

### Model

`claude-opus-4-7`. Claim extraction touches the Toulmin layer assignment and Admiralty inheritance; both are quality-sensitive. Haiku is acceptable for routine secondary-source fragments once a calibration baseline exists, but Sprint 1 standardizes on Opus.

### API features

- Structured Outputs (strict schema)
- No Citations API call here — the source body is already grounded by virtue of being the input. Citations API is the Verifier's tool, not the extractor's.
- No cross-model in v1.0. Claim extraction is a faithful-restatement task, not a judgment task; cross-model verification adds cost without catching the failure modes that matter here (over-extraction, framing-as-claim, compound atomicity).

### Prompt template

```xml
<task>
You are the Claim Extractor. Given a source document, identify discrete factual
claims worth recording in the substrate. Each claim should be:

- Atomic (one factual proposition, not a compound)
- Stated declaratively
- Tied to specific entities mentioned in the source
- Quotable from or directly inferable from the source text

Do NOT extract:
- Opinions, framing, editorial commentary (those are not claims)
- Speculation about future events (those are predictions, separate flow)
- Context-only facts that don't relate to active theses

Extract 0-10 claims per source. More than 10 means you're being too granular.
Zero is a valid output for sources that contain only opinion, framing, or noise.
</task>

<input>
<source>
  <type>{{source.source_type}}</type>
  <title>{{source.title}}</title>
  <publication>{{source.publication}}</publication>
  <published_at>{{source.published_at}}</published_at>
  <admiralty_grade>{{source.admiralty_grade}}</admiralty_grade>
  <body>{{source.raw_text}}</body>
</source>

<active_thesis_concepts>
{{concepts from active thesis concept_spines, for relevance hint}}
</active_thesis_concepts>
</input>

<extraction_steps>
For each candidate claim:

1. State the data: what observable fact does this claim rest on, with a quotable
   source passage?

2. State the claim text: what is being asserted?

3. Identify the warrant: what inference rule connects data to claim? (Often left
   implicit in source; surface it.)

4. Identify the qualifier: any IPCC-style likelihood or temporal scope?

5. Identify the entities involved with their surface mentions (we'll resolve
   them later — entity_id stays NULL until Sprint 2's resolver runs).

6. Propose the layer: factual / framing / architectural / distributive.

7. Propose an Admiralty grade. Default to the source's grade unless a specific
   claim has special standing (e.g., a grade-B publication directly quoting a
   grade-A primary document inherits A for that quoted span).
</extraction_steps>

<output_format>
Emit JSON conforming to the ClaimExtractionOutput schema.
</output_format>

<constraints>
- Be quotable. The `source_passage` you cite must be findable verbatim in the
  source body. Do not paraphrase the passage — copy it.
- Be conservative on warrants. If the source doesn't make the warrant explicit
  and it's not obviously inferable, leave warrant=null.
- Most Hansard claims are factual layer. Architectural claims are rare and
  high-value — flag the layer with care.
- Do not invent entity types. Use the surface text exactly as it appears in
  the source; type-hint conservatively.
</constraints>
```

### Output schema

```json
{
  "type": "object",
  "required": ["claims"],
  "properties": {
    "claims": {
      "type": "array",
      "maxItems": 10,
      "items": {
        "type": "object",
        "required": ["data", "claim_text", "layer", "admiralty_grade", "source_passage", "entities"],
        "properties": {
          "data": { "type": "string" },
          "claim_text": { "type": "string" },
          "warrant": { "type": ["string", "null"] },
          "qualifier": { "type": ["string", "null"] },
          "rebuttal": { "type": ["string", "null"] },
          "layer": {
            "type": "string",
            "enum": ["factual", "framing", "architectural", "distributive"]
          },
          "admiralty_grade": {
            "type": "string",
            "enum": ["A", "B", "C", "D", "E", "F"]
          },
          "source_passage": { "type": "string" },
          "entities": {
            "type": "array",
            "items": {
              "type": "object",
              "required": ["surface_text", "entity_type_hint"],
              "properties": {
                "surface_text": { "type": "string" },
                "entity_type_hint": {
                  "type": "string",
                  "enum": ["person", "organization", "institution", "corporation", "department", "office", "legislation", "event", "concept", "location"]
                },
                "context_excerpt": { "type": "string" }
              }
            }
          }
        }
      }
    }
  }
}
```

### Notes

**Why this is a utility, not a role.** The eleven analytical roles produce judgments — grading, grounding, questioning, falsification, calibration, projection. claim_extraction produces no judgment. It is a structured-output adapter from natural-language source bodies to substrate-shaped candidates. The orchestrator then hands those candidates to the analytical roles (Verifier grounds them, Interrogator interrogates them, Red Team attacks them). Mixing the adapter into the role list would conflate "structuring prose" with "evaluating claims" — distinct concerns.

**Why it's not in the cascade as inline orchestrator code.** It could be — the orchestrator could call Anthropic directly and skip the Skill packaging. Two reasons it's a Skill: (1) prompt iteration without redeploy, the same justification as for the eleven roles; (2) audit symmetry — every model invocation flows through `role_invocations`, has a SHA-hashed prompt, and charges through `cost_ledger`. Skipping the Skill packaging would create a second, ad-hoc invocation pathway that bypasses the audit trail.

**Idempotency.** Re-running claim_extraction on the same source must not duplicate claims. Dedup is by `(source_id, source_passage_hash)` at the orchestrator's apply step, not in the skill itself. The skill is stateless and may emit the same candidate twice across runs without issue — the apply step catches it.

---

## 13. ROLE INVOCATION FLOW (orchestrator-side, for reference)

For every role invocation, the orchestrator:

1. Builds the substrate snapshot (Section 0.1) by querying the relevant tables.
2. Loads the role's prompt template from `role_definitions`.
3. Performs simple variable substitution on the template using snapshot data.
4. Calls Anthropic API with appropriate features (Citations API, Structured Outputs, both, neither).
5. If Structured Outputs: validates response against role's `output_schema`. On failure, retries once.
6. Persists the role invocation row in `role_invocations`.
7. Charges cost to `cost_ledger`.
8. Applies the role's writes to substrate (claim_versions, contradictions, etc.) inside a transaction.
9. Emits the role's standard event(s) to `orchestrator_events`.

If any step fails, the role invocation is marked status='error' with the error_detail. No partial writes — substrate writes are atomic with the role invocation row.

---

## 14. CROSS-MODEL VERIFICATION INFRASTRUCTURE

The Verifier (and optionally Red Team and Premortem) supports cross-model runs. The orchestrator implements:

```
function invokeWithCrossModel(role, snapshot):
  primary_result = invokeRole(role, snapshot, model='claude-opus-4-7')
  if not role.cross_model_enabled or not user.allow_cross_model:
    return primary_result
  
  secondary_model = user.preferences.cross_model_choice  # 'gpt-5' or 'gemini-2.5-pro'
  secondary_result = invokeRole(role, snapshot, model=secondary_model)
  
  agreement = compareResults(primary_result, secondary_result)
  
  if agreement == 'agree':
    return primary_result
  elif agreement == 'minor_disagreement':
    return moreConservative(primary_result, secondary_result)
  else:  # major disagreement
    flagForOperator(primary_result, secondary_result)
    return contestedResult(primary_result, secondary_result)
```

Cost is charged to `cost_ledger` for both invocations. Operator approval gating per the no-silent-spending discipline applies — if cross-model verification is not whitelisted, the operator approves before the secondary call runs.

---

## 15. SKILLS PACKAGING (filesystem layout)

When this document is split into individual SKILL.md files for the build, the layout is:

```
/skills
  /ingestion-critic
    SKILL.md            (sections 0-1 of this doc)
    schema.json
    examples/
      example_grade_a.md
      example_grade_b.md
      example_partial.md
  /verifier
    SKILL.md
    schema.json
    examples/
      ...
  /interrogator
    SKILL.md
    schema.json
  /red-team
    SKILL.md
    schema.json
  /steelman
    SKILL.md
    schema.json
  /premortem
    SKILL.md
    schema.json
  /gap-surfacer
    SKILL.md
    schema.json
  /calibration
    SKILL.md
    schema.json
  /tier-projector
    SKILL.md
  /assumption-auditor
    SKILL.md
    schema.json
  /indicator-validator
    SKILL.md
    schema.json
  /claim-extraction
    SKILL.md            (utility skill — section 12 of this doc)
    schema.json
```

Each SKILL.md includes a frontmatter block:

```yaml
---
name: ingestion-critic
version: 1.0
model: claude-opus-4-7
features:
  citations_api: false
  structured_output: true
  cross_model: false
hash: <auto-computed>
---
```

The `hash` updates on any change to the SKILL.md content; the orchestrator stores this hash in `role_definitions.skill_md_hash` and re-runs roles when the hash changes if appropriate.

---

## 16. NOTES AND DEFERRALS

**Deferred to v1.1 of skills:**

- Few-shot examples per role. v1.0 is zero-shot prompts. Examples will be added once the system has run enough invocations to generate a curated example set.
- Per-thesis prompt customization. Currently roles use the same prompt template across all theses. Future: thesis-specific overrides for vantage selection, depth tuning, etc.
- Role chains as named workflows. Currently the orchestrator wires roles together imperatively. Future: declarative workflow definitions (e.g., `cascade.yaml`).

**Sprint 1 minimum skills:**

Four skills ship in Sprint 1: three analytical roles plus the claim_extraction utility.

- `ingestion_critic` — gates incoming sources
- `claim_extraction` — converts approved sources into claim candidates (utility, §12)
- `verifier` — grounds claims via Citations API
- `interrogator` — generates verification questions

These four plus the orchestrator and the Sprint 1 schema produce a working end-to-end pipeline: source ingests → Critic gates → operator approves → claim_extraction emits candidates → claims write → Verifier grounds → Interrogator generates questions → Live feed populates.

`tier_projector` is required for any thesis that goes public, so it activates whenever the first thesis is set `is_public = TRUE`.

The remaining roles (`red_team`, `steelman`, `premortem`, `gap_surfacer`, `calibration`, `assumption_auditor`, `indicator_validator`) come online in Sprints 2+. Specs are complete here so they can be added without re-design.
