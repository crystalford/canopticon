/**
 * Build an X/Twitter thread for a video clip.
 *
 * Thread structure (2-3 tweets):
 *   Tweet 1 (video): Most RT-able verbatim quote in curly quotes
 *   Tweet 2 (opt):   Casual plain-English context note (if AI generated one ≤276 chars)
 *   Tweet 3:         "Clip Source: Channel\n\n[youtubeUrl]"
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
    const { rtHook, contextNote, channelName, youtubeUrl } = params

    const tweets: string[] = []

    // Tweet 1: punchy RT hook (with video)
    if (rtHook?.trim()) {
        tweets.push(`\u201c${cap(rtHook, 276)}\u201d`)
    }

    // Tweet 2: casual context note — only if present and fits without truncation
    const note = contextNote?.trim()
    if (note && note.length <= 276) {
        tweets.push(note)
    }

    // Final tweet: source + YouTube link
    const sourceParts: string[] = []
    if (channelName) sourceParts.push(`Clip Source: ${channelName}`)
    if (youtubeUrl) sourceParts.push(youtubeUrl)
    if (sourceParts.length > 0) {
        tweets.push(sourceParts.join('\n\n'))
    }

    return tweets
}
