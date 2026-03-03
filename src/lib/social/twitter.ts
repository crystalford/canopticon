/**
 * Build an X/Twitter thread for a video clip.
 *
 * Thread structure:
 *   Tweet 1 (has video): context line + quote teaser (first sentence + "...")
 *   Tweet 2:             full extended quote in double quotes
 *   Tweet 3:             Source: ChannelName\n\nYouTubeURL
 *
 * If the full quote fits with the context in 260 chars: 2-tweet thread (skip teaser, combine).
 */
export function buildTweetThread(params: {
    tweetDraft?: string | null       // "context line\n\nquote" from AI
    extendedQuote?: string | null    // 2-4 sentence quote from AI
    keyQuote?: string | null         // single best sentence
    speakerName?: string | null
    channelName?: string | null
    youtubeUrl?: string | null
}): string[] {
    const { tweetDraft, extendedQuote, keyQuote, speakerName, channelName, youtubeUrl } = params

    const source = channelName
        ? `Source: ${channelName}\n\n${youtubeUrl || ''}`
        : (youtubeUrl || null)

    // Full quote for tweet 2 — prefer extendedQuote (richer), fallback to keyQuote
    const fullQuoteText = extendedQuote || keyQuote || null
    const quoteTweet = fullQuoteText ? `"${fullQuoteText}"` : null

    // Context line: line 1 of tweetDraft (before the blank line separator)
    let contextLine: string
    if (tweetDraft) {
        const nl = tweetDraft.indexOf('\n\n')
        contextLine = nl !== -1 ? tweetDraft.slice(0, nl) : tweetDraft
    } else if (speakerName) {
        contextLine = speakerName
    } else {
        contextLine = 'New clip'
    }

    // Can the full context + quote fit in tweet 1? (2-tweet thread)
    if (quoteTweet && contextLine.length + 2 + quoteTweet.length <= 260) {
        return [
            `${contextLine}\n\n${quoteTweet}`,
            source,
        ].filter(Boolean) as string[]
    }

    // Build tweet 1: context + teaser quote
    let tweet1: string
    if (fullQuoteText && contextLine.length < 235) {
        const budget = 255 - contextLine.length - 2  // chars available after context + \n\n
        const content = fullQuoteText

        // Try to cut at first sentence boundary within budget
        let cutAt = Math.min(budget - 4, content.length)  // -4 for closing "..."
        const sentMatch = content.substring(0, cutAt).match(/^[\s\S]+?[.!?](?:\s|$)/)
        if (sentMatch && sentMatch[0].length > 20) {
            cutAt = sentMatch[0].trimEnd().length
        } else {
            // Fall back to last word boundary
            const lastSpace = content.substring(0, cutAt).lastIndexOf(' ')
            if (lastSpace > 20) cutAt = lastSpace
        }

        const teaser = `"${content.substring(0, cutAt).trim()}..."`
        tweet1 = `${contextLine}\n\n${teaser}`
    } else {
        // Context line alone if quote won't fit or context too long
        tweet1 = contextLine
    }

    // Tweet 2: full quote, hard cap at 280
    const tweet2 = quoteTweet
        ? (quoteTweet.length <= 280 ? quoteTweet : `"${fullQuoteText!.substring(0, 276)}..."`)
        : null

    return [tweet1, tweet2, source].filter(Boolean) as string[]
}
