/**
 * Build a single X post for a video clip.
 * Uses extendedQuote (2-4 verbatim sentences) when available, falls back to keyQuote.
 * Fills up to X's 280-char limit: quote first, then context note below.
 *
 * Format:
 *   "Extended verbatim quote from the clip..."
 *
 *   Context note explaining why it matters.
 */

const X_LIMIT = 278 // leave 2 chars headroom

function trimToWord(text: string, limit: number): string {
    if (text.length <= limit) return text
    const cut = text.lastIndexOf(' ', limit - 1)
    return cut > limit * 0.6
        ? text.substring(0, cut) + '\u2026'
        : text.substring(0, limit - 1) + '\u2026'
}

export function buildTweetThread(params: {
    rtHook?: string | null        // short punchy quote (keyQuote)
    extendedQuote?: string | null // 2-4 verbatim sentences (more context)
    contextNote?: string | null   // 1-2 casual sentences explaining the moment
    channelName?: string | null
    youtubeUrl?: string | null
}): string[] {
    const { rtHook, extendedQuote, contextNote } = params

    // Prefer extendedQuote (richer context), fall back to rtHook
    const rawQuote = extendedQuote?.trim() || rtHook?.trim() || ''
    const rawContext = contextNote?.trim() || ''

    if (!rawQuote && !rawContext) return []

    // Try to fit both quote + context in one tweet
    // Format: "<quote>"\n\n<context>
    const separator = '\n\n'
    const quoteWrapper = (q: string) => `\u201c${q}\u201d`

    if (rawQuote && rawContext) {
        // Reserve space for: opening quote char (1) + closing quote char (1) + separator (2) + context
        const contextLimit = Math.min(rawContext.length, 220)
        const contextPart = trimToWord(rawContext, contextLimit)
        const quoteLimit = X_LIMIT - contextPart.length - separator.length - 2 // 2 for curly quotes
        if (quoteLimit >= 40) {
            const quotePart = trimToWord(rawQuote, quoteLimit)
            return [`${quoteWrapper(quotePart)}${separator}${contextPart}`]
        }
        // Context too long on its own — just quote
    }

    if (rawQuote) {
        return [quoteWrapper(trimToWord(rawQuote, X_LIMIT - 2))]
    }

    return [trimToWord(rawContext, X_LIMIT)]
}
