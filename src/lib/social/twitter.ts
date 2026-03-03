/**
 * Build an X/Twitter thread for a video clip.
 *
 * Thread structure (4 tweets, optimised for X engagement algorithm):
 *   Tweet 1 (video attached): RT hook — the single most shareable sentence
 *   Tweet 2:                  Context block — who, what, why it matters
 *   Tweet 3:                  Forensic layer — CANOPTICON analysis (skipped if null/empty)
 *   Tweet 4:                  "Clip Source: Channel · Speaker" — text only, no link
 *
 * YouTube URL is NOT in the thread (link penalty). Callers post it as a
 * reply to the last thread tweet after the thread is live.
 *
 * Character handling: each field is capped at 278 chars with word-boundary
 * truncation (never mid-word) and a trailing ellipsis if cut.
 */

/** Truncate at the last word boundary within `limit` chars, append ellipsis if cut. */
function cap(text: string, limit = 278): string {
    const t = text.trim()
    if (t.length <= limit) return t
    const cut = t.lastIndexOf(' ', limit - 1)
    return cut > limit * 0.6
        ? t.substring(0, cut) + '\u2026'
        : t.substring(0, limit - 1) + '\u2026'
}

export function buildTweetThread(params: {
    rtHook?: string | null         // stored in keyQuote field — single most RT-able sentence
    contextBlock?: string | null   // stored in tweetDraft field — who, stakes, why it matters
    forensicLayer?: string | null  // stored in forensicLayer field — CANOPTICON analytical layer
    speakerName?: string | null
    channelName?: string | null
}): string[] {
    const { rtHook, contextBlock, forensicLayer, speakerName, channelName } = params

    const tweet1 = rtHook?.trim() ? cap(rtHook) : null
    const tweet2 = contextBlock?.trim() ? cap(contextBlock) : null
    const tweet3 = forensicLayer?.trim() ? cap(forensicLayer) : null

    // Attribution: "Clip Source: Channel · Speaker"
    // Avoid duplication if speakerName === channelName (fallback case in pipeline)
    const parts: string[] = []
    if (channelName) parts.push(channelName)
    if (speakerName && speakerName !== channelName) parts.push(speakerName)
    const tweet4 = parts.length > 0 ? `Clip Source: ${parts.join(' \u00b7 ')}` : null

    return [tweet1, tweet2, tweet3, tweet4].filter(Boolean) as string[]
}
