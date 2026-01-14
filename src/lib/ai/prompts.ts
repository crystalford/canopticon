/**
 * Versioned AI Prompts from 05_PROMPT_LIBRARY
 * 
 * These prompts are operational assets and must not be modified without versioning.
 * All prompts accept JSON input and return JSON output.
 */

// ============================================================================
// SIGNAL CLASSIFICATION (Cheap Tier)
// ============================================================================

export const SIG_CLASSIFY_V1 = {
    name: 'SIG_CLASSIFY_V1',
    prompt: `You are classifying a political event from a primary government source. 
Determine the signal type based on these definitions:
- breaking: First occurrence of a new event
- repetition: Subsequent reports of the same event  
- contradiction: Conflicting statements or actions
- shift: Material change in position, policy, or framing

Respond with JSON only.`,
    inputSchema: {
        title: 'string',
        body_excerpt: 'string',
    },
    outputSchema: {
        signal_type: 'breaking|repetition|contradiction|shift',
        confidence: '0-100',
        notes: 'string',
    },
}

export interface SigClassifyInput {
    title: string
    body_excerpt: string
}

export interface SigClassifyOutput {
    signal_type: 'breaking' | 'repetition' | 'contradiction' | 'shift'
    confidence: number
    notes: string
}

// ============================================================================
// SEMANTIC DEDUPLICATION (Cheap Tier)
// ============================================================================

export const SIG_DEDUP_SIMILARITY_V1 = {
    name: 'SIG_DEDUP_SIMILARITY_V1',
    prompt: `Compare the candidate text to recent event texts. 
Determine if it refers to the same underlying political event.
Consider: same subject matter, same actors, same timeframe, same action.

Respond with JSON only.`,
    inputSchema: {
        candidate_text: 'string',
        recent_texts: 'string[]',
    },
    outputSchema: {
        is_duplicate: 'boolean',
        similarity_score: '0-1',
        matched_index: 'integer|null',
    },
}

export interface SigDedupInput {
    candidate_text: string
    recent_texts: string[]
}

export interface SigDedupOutput {
    is_duplicate: boolean
    similarity_score: number
    matched_index: number | null
}

// ============================================================================
// SIGNIFICANCE SCORING (Cheap Tier)
// ============================================================================

export const SIG_TRIAGE_SCORE_V1 = {
    name: 'SIG_TRIAGE_SCORE_V1',
    prompt: `Score the public significance of this political event on a scale from 0 to 100.

Consider:
- Impact on citizens (high = more significant)
- Precedent or novelty (first-time events score higher)
- Scope (national > provincial > local)
- Urgency (immediate effects score higher)

Respond with JSON only.`,
    inputSchema: {
        title: 'string',
        body_excerpt: 'string',
    },
    outputSchema: {
        significance_score: '0-100',
        rationale: 'string',
    },
}

export interface SigTriageInput {
    title: string
    body_excerpt: string
}

export interface SigTriageOutput {
    significance_score: number
    rationale: string
}

// ============================================================================
// ARTICLE HEADLINE (Expensive Tier)
// ============================================================================

export const ARTICLE_HEADLINE_V1 = {
    name: 'ARTICLE_HEADLINE_V1',
    prompt: `Write a neutral, factual headline describing the primary political event.

Requirements:
- State what happened clearly
- Avoid opinion, speculation, or loaded language
- Be concise (under 15 words preferred)
- Use active voice when possible

Respond with JSON only.`,
    inputSchema: {
        primary_text: 'string',
    },
    outputSchema: {
        headline: 'string',
    },
}

export interface ArticleHeadlineInput {
    primary_text: string
}

export interface ArticleHeadlineOutput {
    headline: string
}

// ============================================================================
// ARTICLE SUMMARY (Expensive Tier)
// ============================================================================

export const ARTICLE_SUMMARY_V1 = {
    name: 'ARTICLE_SUMMARY_V1',
    prompt: `Write a clear, neutral summary (350-550 words) explaining:
1. What happened
2. Why it matters structurally  
3. Potential implications

Requirements:
- Use factual, non-editorial language
- Avoid opinion or speculation
- Structure with clear paragraphs
- Include relevant context

Respond with JSON only.`,
    inputSchema: {
        primary_text: 'string',
    },
    outputSchema: {
        summary: 'string',
    },
}

export interface ArticleSummaryInput {
    primary_text: string
}

export interface ArticleSummaryOutput {
    summary: string
}

// ============================================================================
// ARTICLE TAGS (Expensive Tier)
// ============================================================================

export const ARTICLE_TAGS_V1 = {
    name: 'ARTICLE_TAGS_V1',
    prompt: `Extract key topics and named entities from the text.

Topics: broad subject areas (e.g., "healthcare", "taxation", "trade")
Entities: specific named items (e.g., "Bill C-42", "Justin Trudeau", "Supreme Court")

Return 3-7 topics and all relevant entities.

Respond with JSON only.`,
    inputSchema: {
        primary_text: 'string',
    },
    outputSchema: {
        topics: 'string[]',
        entities: 'string[]',
    },
}

export interface ArticleTagsInput {
    primary_text: string
}

export interface ArticleTagsOutput {
    topics: string[]
    entities: string[]
}

// ============================================================================
// VIDEO MATERIALS (Expensive Tier)
// ============================================================================

export const VIDEO_MATERIALS_V1 = {
    name: 'VIDEO_MATERIALS_V1',
    prompt: `Generate video export materials based on the summary.

Create:
1. A 60-second script suitable for video narration
2. 2-4 key quotes that could be displayed as text overlays
3. 2-3 framing angles for different video approaches

Keep language neutral and factual.

Respond with JSON only.`,
    inputSchema: {
        summary: 'string',
    },
    outputSchema: {
        script_60s: 'string',
        key_quotes: 'string[]',
        angles: 'string[]',
    },
}

export interface VideoMaterialsInput {
    summary: string
}

export interface VideoMaterialsOutput {
    script_60s: string
    key_quotes: string[]
    angles: string[]
}

// ============================================================================
// PROMPT REGISTRY
// ============================================================================

export const PROMPTS = {
    SIG_CLASSIFY_V1,
    SIG_DEDUP_SIMILARITY_V1,
    SIG_TRIAGE_SCORE_V1,
    ARTICLE_HEADLINE_V1,
    ARTICLE_SUMMARY_V1,
    ARTICLE_TAGS_V1,
    VIDEO_MATERIALS_V1,
} as const

export type PromptName = keyof typeof PROMPTS
