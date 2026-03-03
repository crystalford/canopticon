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
    extendedQuote?: string | null
    channelName?: string | null
    youtubeUrl?: string | null
}): string[] {
    const { rtHook, extendedQuote, channelName, youtubeUrl } = params

    const tweets: string[] = []

    // Tweet 1: punchy RT hook (with video)
    if (rtHook?.trim()) {
        tweets.push(`\u201c${cap(rtHook, 276)}\u201d`)
    }

    // Tweet 2: extended verbatim quote — only if it fits without truncation
    const eq = extendedQuote?.trim()
    if (eq && eq.length <= 274) {
        tweets.push(`\u201c${eq}\u201d`)
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
