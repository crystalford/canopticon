/**
 * Build an X/Twitter thread for a video clip.
 *
 * Thread structure (2 tweets):
 *   Tweet 1 (video): Most RT-able verbatim quote in curly quotes
 *   Tweet 2:         "Clip Source: Channel\n\n[youtubeUrl]"
 */

function cap(text: string, limit = 278): string {
    const t = text.trim()
    if (t.length <= limit) return t
    const cut = t.lastIndexOf(' ', limit - 1)
    return cut > limit * 0.6
        ? t.substring(0, cut) + '\u2026'
        : t.substring(0, limit - 1) + '\u2026'
}

export function buildTweetThread(params: {
    rtHook?: string | null
    contextNote?: string | null
    channelName?: string | null
    youtubeUrl?: string | null
}): string[] {
    const { rtHook, contextNote } = params

    // Single tweet: context note (if any) + verbatim quote
    const parts: string[] = []
    if (contextNote?.trim()) parts.push(cap(contextNote, 120))
    if (rtHook?.trim()) parts.push(`\u201c${cap(rtHook, 150)}\u201d`)

    return parts.length > 0 ? [parts.join('\n\n')] : []
}
