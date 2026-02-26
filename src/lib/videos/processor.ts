import { generateText } from 'ai'
import { getModel } from '@/lib/ai/providers'
import { fetchTranscriptWithTimestamps, extractVideoId } from '@/lib/automations/transcript'
import { db, videoClips } from '@/db'
import { eq } from 'drizzle-orm'



// Extract video title using a lightweight embed fetch
async function fetchVideoTitle(url: string): Promise<string> {
    try {
        const id = extractVideoId(url)
        if (!id) return 'Unknown Video'
        const res = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`)
        if (res.ok) {
            const data = await res.json()
            return data.title || 'Unknown Video'
        }
    } catch (e) { }
    return 'Unknown Video'
}

export async function processVideoClip(clipId: string, url: string) {
    console.log(`[processVideoClip] Starting job ${clipId} for ${url}`)

    try {
        const token = process.env.APIFY_API_TOKEN
        if (!token) {
            throw new Error('APIFY_API_TOKEN is not configured in .env')
        }

        // 1. Get title and transcript
        const title = await fetchVideoTitle(url)
        const transcript = await fetchTranscriptWithTimestamps(url)

        if (!transcript) {
            throw new Error('Invalid YouTube URL or transcript could not be generated.')
        }

        // 2. Ask Claude to identify the best clip
        console.log(`[processVideoClip] Asking Claude to identify best moment in "${title}"...`)
        const model = await getModel('openai', 'gpt-4o') // or anthropic claude-3-5-sonnet
        const aiPrompt = `You are a social media strategist for a high-impact political news channel.
Read the timestamped transcript and find the SINGLE most compelling 30-90 second moment for X (Twitter) and TikTok.
Focus on "The Hook": a shocking revelation, a heated debate, or a viral-ready soundbite.

AUDIBLE PRECISION RULES (CRITICAL):
1. NO SILENCE: Do NOT start the clip during intro music, 5 seconds of silence, or generic "Hello" intros.
2. THE START: Identify the exact timestamp where the primary person starts speaking their MOST MEANINGFUL sentence.
3. THE END: End naturally after a complete thought, within the 30-90s limit.
4. If a video has a 10-second intro of music/graphics, your "start_seconds" MUST be at 10 or later.

Video: "${title}"
URL: ${url}

Timestamped transcript (format [M:SS] text):
${transcript}

Return ONLY valid JSON with no markdown wrapping and no other text:
{
  "start_seconds": <number>,
  "end_seconds": <number>,
  "rationale": "<brief 1-sentence explanation of why this hook works>"
}`

        const result = await generateText({ model, prompt: aiPrompt })
        const jsonMatch = result.text.match(/\{[\s\S]*?\}/)
        if (!jsonMatch) throw new Error('AI failed to return valid JSON timestamps')

        const parsed = JSON.parse(jsonMatch[0])
        const start = parsed.start_seconds
        const end = parsed.end_seconds
        const rationale = parsed.rationale

        if (typeof start !== 'number' || typeof end !== 'number') {
            throw new Error('AI returned invalid timestamp format')
        }

        console.log(`[processVideoClip] Chosen clip: ${start}s → ${end}s | Reason: ${rationale}`)

        // 3. Update DB with AI choices before clipping (so UI shows progress)
        await db.update(videoClips)
            .set({ videoTitle: title, startSeconds: start, endSeconds: end, clipRationale: rationale })
            .where(eq(videoClips.id, clipId))

        // 4. Call Fractal AI Clipper on Apify
        const apifyToken = process.env.APIFY_API_TOKEN
        if (!apifyToken) {
            throw new Error('APIFY_API_TOKEN is not configured in Vercel.')
        }

        console.log(`[processVideoClip] Requesting segment from Fractal AI on Apify: ${start}s-${end}s...`)

        // Helper to convert seconds to HH:MM:SS
        const toHHMMSS = (secs: number) => {
            const h = Math.floor(secs / 3600).toString().padStart(2, '0')
            const m = Math.floor((secs % 3600) / 60).toString().padStart(2, '0')
            const s = (secs % 60).toString().padStart(2, '0')
            return `${h}:${m}:${s}`
        }

        const runRes = await fetch(`https://api.apify.com/v2/acts/fractalai~youtube-video-clipper/run-sync-get-dataset-items?token=${apifyToken}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                videoUrl: url,
                clips: [{
                    start: toHHMMSS(start),
                    end: toHHMMSS(end),
                    name: "Canopticon-Clip"
                }],
                quality: "720p"
            }),
            signal: AbortSignal.timeout(300000)
        });

        if (!runRes.ok) {
            const errText = await runRes.text()
            throw new Error(`Fractal AI on Apify failed (${runRes.status}): ${errText}`)
        }

        const items = await runRes.json()
        const apifyClipUrl = items && items.length > 0 ? items[0].url : null

        if (!apifyClipUrl) {
            throw new Error('Fractal AI returned success but no video clip URL was found in dataset.')
        }

        // 5. Save success to DB
        console.log(`[processVideoClip] ✓ Success! Clip URL: ${apifyClipUrl}`)
        const [updated] = await db.update(videoClips)
            .set({
                status: 'done',
                clipUrl: apifyClipUrl,
                processedAt: new Date()
            })
            .where(eq(videoClips.id, clipId))
            .returning()

        return { success: true, clip: updated }

    } catch (e: any) {
        console.error('[processVideoClip] Failed:', e.message)
        await db.update(videoClips)
            .set({ status: 'failed', errorMessage: e.message })
            .where(eq(videoClips.id, clipId))
        throw e
    }
}
