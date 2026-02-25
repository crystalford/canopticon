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
        const aiPrompt = `You are a social media manager for a political news channel.
Read the following transcript and find the SINGLE most compelling 30-90 second moment to clip for X (Twitter) and TikTok.
Look for a hot take, key revelation, dramatic exchange, surprising fact, or highly quotable statement.

Video: "${title}"
URL: ${url}

Timestamped transcript (format [M:SS] text):
${transcript}

Return ONLY valid JSON with no markdown wrapping and no other text:
{
  "start_seconds": <number>,
  "end_seconds": <number>,
  "rationale": "<brief 1-sentence explanation of why this is the best moment>"
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

        // 4. Call the Dedicated EC2 Clip Server
        const clipServerUrl = process.env.CLIP_SERVER_URL
        const clipServerSecret = process.env.CLIP_SERVER_SECRET

        if (!clipServerUrl || !clipServerSecret) {
            throw new Error('CLIP_SERVER_URL and CLIP_SERVER_SECRET must be configured in Vercel to bypass YouTube bot detection.')
        }

        console.log(`[processVideoClip] Requesting extraction from dedicated EC2 Clip Server: ${clipServerUrl}/clip...`)

        const runRes = await fetch(`${clipServerUrl}/clip`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': clipServerSecret
            },
            body: JSON.stringify({
                url: url,
                start_seconds: start,
                end_seconds: end
            }),
            signal: AbortSignal.timeout(300000) // Give EC2 5 full minutes to download, ffmpeg-trim, and upload back to S3/Cloudfront
        })

        if (!runRes.ok) {
            const errText = await runRes.text()
            throw new Error(`EC2 Clip Server failed (${runRes.status}): ${errText}`)
        }

        const runData = await runRes.json()

        if (!runData.videoUrl) {
            throw new Error('EC2 Clip Server returned success but no videoUrl was found.')
        }

        const apifyClipUrl = runData.videoUrl

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
