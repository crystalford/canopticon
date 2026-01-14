# 05_PROMPT_LIBRARY

Version: v1.0
Status: Authoritative
Scope: Phase 1

---

## 1. PURPOSE

This document defines the literal AI prompts used by Canopticon Phase 1.

Prompts are operational assets. They are versioned, immutable once deployed, and must not be inferred or improvised.

All prompts:
- Accept JSON input
- Return JSON output
- Must fail closed on invalid output

---

## 2. MODEL TIERS

### Cheap Model Tier

Used for:
- Classification
- Deduplication checks
- Scoring and triage

Constraints:
- Low token usage
- Deterministic temperature

---

### Expensive Model Tier

Used for:
- Article synthesis
- Headline generation
- Export materials

Escalation to this tier is governed by 09_COST_AND_GATING.md.

---

## 3. PROMPT: SIG_CLASSIFY_V1

### Purpose
Classify signal type.

### Input (JSON)
{
  "title": "string",
  "body_excerpt": "string"
}

### Prompt
"You are classifying a political event from a primary government source. Determine the signal type: breaking, repetition, contradiction, or shift. Respond with JSON only."

### Output (JSON)
{
  "signal_type": "breaking|repetition|contradiction|shift",
  "confidence": 0-100,
  "notes": "string"
}

---

## 4. PROMPT: SIG_DEDUP_SIMILARITY_V1

### Purpose
Check semantic duplication.

### Input (JSON)
{
  "candidate_text": "string",
  "recent_texts": ["string"]
}

### Prompt
"Compare the candidate text to recent event texts. Determine if it refers to the same event. Respond with JSON only."

### Output (JSON)
{
  "is_duplicate": true|false,
  "similarity_score": 0-1,
  "matched_index": "integer|null"
}

---

## 5. PROMPT: SIG_TRIAGE_SCORE_V1

### Purpose
Assign significance score.

### Input (JSON)
{
  "title": "string",
  "body_excerpt": "string"
}

### Prompt
"Score the public significance of this political event on a scale from 0 to 100. Respond with JSON only."

### Output (JSON)
{
  "significance_score": 0-100,
  "rationale": "string"
}

---

## 6. PROMPT: ARTICLE_HEADLINE_V1

### Purpose
Generate neutral headline.

### Input (JSON)
{
  "primary_text": "string"
}

### Prompt
"Write a neutral, factual headline describing the primary political event. Avoid opinion or speculation. Respond with JSON only."

### Output (JSON)
{
  "headline": "string"
}

---

## 7. PROMPT: ARTICLE_SUMMARY_V1

### Purpose
Generate article summary.

### Input (JSON)
{
  "primary_text": "string"
}

### Prompt
"Write a clear, neutral summary (350–550 words) explaining what happened, why it matters, and potential implications. Avoid opinion. Respond with JSON only."

### Output (JSON)
{
  "summary": "string"
}

---

## 8. PROMPT: ARTICLE_TAGS_V1

### Purpose
Extract topics and entities.

### Input (JSON)
{
  "primary_text": "string"
}

### Prompt
"Extract key topics and named entities from the text. Respond with JSON only."

### Output (JSON)
{
  "topics": ["string"],
  "entities": ["string"]
}

---

## 9. PROMPT: VIDEO_MATERIALS_V1

### Purpose
Generate video export materials.

### Input (JSON)
{
  "summary": "string"
}

### Prompt
"Generate a 60-second video script, key quotes, and framing angles based on the summary. Respond with JSON only."

### Output (JSON)
{
  "script_60s": "string",
  "key_quotes": ["string"],
  "angles": ["string"]
}

---

## 10. ERROR HANDLING RULES

- Invalid JSON → discard output
- Missing fields → retry once
- Repeated failure → escalate to operator

---

END 05_PROMPT_LIBRARY

