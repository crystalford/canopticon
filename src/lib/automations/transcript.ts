/**
 * YouTube transcript extraction.
 * Uses the youtube-transcript package which hits YouTube's own caption endpoint
 * — no API key required, works on any video with auto-generated captions.
 */
import { YoutubeTranscript } from 'youtube-transcript'

/**
 * Extract video ID from any YouTube URL format:
 *   https://www.youtube.com/watch?v=VIDEO_ID
 *   https://youtu.be/VIDEO_ID
 *   https://youtube.com/shorts/VIDEO_ID
 */
export function extractVideoId(url: string): string | null {
    const patterns = [
        /[?&]v=([a-zA-Z0-9_-]{11})/,
        /youtu\.be\/([a-zA-Z0-9_-]{11})/,
        /\/shorts\/([a-zA-Z0-9_-]{11})/,
        /\/embed\/([a-zA-Z0-9_-]{11})/,
    ]
    for (const pattern of patterns) {
        const match = url.match(pattern)
        if (match) return match[1]
    }
    return null
}

/**
 * Fetch the transcript for a YouTube video.
 * Returns cleaned text with light punctuation, or null if unavailable.
 * Caps at ~8000 words to stay within model context limits.
 */
export async function fetchTranscript(videoUrl: string): Promise<string | null> {
    const videoId = extractVideoId(videoUrl)
    if (!videoId) {
        console.warn('[fetchTranscript] Could not extract video ID from:', videoUrl)
        return null
    }

    try {
        // Try English first, fall back to any available language
        let segments
        try {
            segments = await YoutubeTranscript.fetchTranscript(videoId, { lang: 'en' })
        } catch {
            segments = await YoutubeTranscript.fetchTranscript(videoId)
        }

        if (!segments || segments.length === 0) return null

        // Join segments into readable text
        const fullText = segments
            .map(s => s.text.trim())
            .join(' ')
            // Clean up common transcript noise
            .replace(/\[Music\]|\[Applause\]|\[Laughter\]|\[Inaudible\]/gi, '')
            .replace(/\s+/g, ' ')
            .trim()

        // Cap at ~8000 words (~50k chars) to avoid exceeding model context
        const words = fullText.split(/\s+/)
        const capped = words.slice(0, 8000).join(' ')
        const wasCapped = words.length > 8000

        console.log(`[fetchTranscript] ${videoId}: ${words.length} words${wasCapped ? ' (capped at 8000)' : ''}`)
        return capped

    } catch (e: any) {
        // Not all videos have transcripts (live streams, some private channels)
        console.warn(`[fetchTranscript] No transcript for ${videoId}:`, e.message)
        return null
    }
}
