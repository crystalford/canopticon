/**
 * Build an X/Twitter thread for a video clip.
 *
 * Thread structure (2 tweets, all verbatim from the transcript):
 *   Tweet 1 (video attached): Most RT-able quote in curly quotes
 *   Tweet 2:                  Fuller contextual quote in curly quotes + "Clip Source: Channel"
 *
 * No AI-written prose. No YouTube URL (link penalty — post manually if needed).
 *
 * Character handling: each field is capped at its budget with word-boundary
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
    rtHook?: string | null        // stored in keyQuote — single most RT-able verbatim sentence
    extendedQuote?: string | null // stored in extendedQuote — fuller verbatim quote adding context
    channelName?: string | null
}): string[] {
    const { rtHook, extendedQuote, channelName } = params

    // Tweet 1: Most RT-able verbatim quote in curly quotes (278 - 2 for the quote chars)
    const tweet1 = rtHook?.trim()
        ? `\u201c${cap(rtHook, 276)}\u201d`
        : null

    // Tweet 2: Fuller verbatim quote + Clip Source attribution
    // Budget: 2 (quotes) + 220 (quote) + 2 (\n\n) + 12 ("Clip Source: ") + ~30 (channel) ≈ 266
    const quotePart = extendedQuote?.trim() ? `\u201c${cap(extendedQuote, 220)}\u201d` : null
    const sourcePart = channelName ? `Clip Source: ${channelName}` : null
    const tweet2Parts = [quotePart, sourcePart].filter(Boolean)
    const tweet2 = tweet2Parts.length > 0 ? tweet2Parts.join('\n\n') : null

    return [tweet1, tweet2].filter(Boolean) as string[]
}
