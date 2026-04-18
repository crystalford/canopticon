import { generateObject } from 'ai'
import { z } from 'zod'
import { db } from '@/db'
import { videoSources, videoClips } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { getAnthropicModel } from '../research/providers'
import { ApifyClient } from 'apify-client'
import { YoutubeTranscript } from 'youtube-transcript'

// Initialize the ApifyClient with API token
const apifyClient = new ApifyClient({
    token: process.env.APIFY_API_TOKEN || '',
});

export class VideoPipeline {

    /**
     * Entry point for a new YouTube video URL.
     * Fetches transcript, then runs AI analysis to propose clips.
     */
    static async ingestAndAnalyze(youtubeUrl: string) {
        // 1. Get or create VideoSource
        let source = await db.query.videoSources.findFirst({
            where: eq(videoSources.url, youtubeUrl)
        });

        if (!source) {
            const [newSource] = await db.insert(videoSources).values({
                url: youtubeUrl,
                status: 'pending_transcript'
            }).returning();
            source = newSource;
        }

        if (source.status === 'completed') {
            console.log(`Video ${youtubeUrl} already completed.`);
            return;
        }

        try {
            await db.update(videoSources).set({ status: 'analyzing' }).where(eq(videoSources.id, source.id));

            // 2. Fetch transcript locally to avoid Apify costs for full video downloads
            console.log(`Fetching transcript for ${youtubeUrl}`);
            const transcriptItems = await YoutubeTranscript.fetchTranscript(youtubeUrl);

            // Format transcript loosely to pass to AI
            const rawTranscript = transcriptItems.map(t => `[${this.formatSeconds(t.offset)}] ${t.text}`).join('\n');

            await db.update(videoSources).set({ transcript: rawTranscript }).where(eq(videoSources.id, source.id));

            // 3. AI Analysis to find the single most newsworthy / investigative clip
            const { object } = await generateObject({
                model: getAnthropicModel('claude-3-5-sonnet-latest'),
                schema: z.object({
                    hasNewsworthyMoment: z.boolean(),
                    rationale: z.string().describe("Why this moment is significant for investigative reporting."),
                    startSeconds: z.number().describe("The exact start second to clip from."),
                    endSeconds: z.number().describe("The exact end second. Clip should be between 15-60 seconds long."),
                    keyQuote: z.string().describe("The most striking quote from this segment."),
                }),
                system: "You are Canopticon's Video Investigative Agent. Analyze the transcript to find the single most newsworthy, surprising, or fallacious moment that deserves to be highlighted. It must be a self-contained point. If there is nothing interesting, set hasNewsworthyMoment to false.",
                prompt: `Transcript:\n\n${rawTranscript}\n\nFind the single best clip between 15s and 60s long.`
            });

            if (object.hasNewsworthyMoment) {
                // 4. Propose Clip (Defaults to 'proposed' status, requiring approval or budget check)
                await db.insert(videoClips).values({
                    videoSourceId: source.id,
                    startSeconds: Math.floor(object.startSeconds),
                    endSeconds: Math.ceil(object.endSeconds),
                    rationale: object.rationale,
                    keyQuote: object.keyQuote,
                    status: 'proposed'
                });
            }

            await db.update(videoSources).set({ status: 'completed' }).where(eq(videoSources.id, source.id));

        } catch (error) {
            console.error(`Failed to ingest video ${youtubeUrl}:`, error);
            await db.update(videoSources).set({
                status: 'failed',
                errorMessage: error instanceof Error ? error.message : String(error)
            }).where(eq(videoSources.id, source.id));
        }
    }

    /**
     * Processes an approved clip via Apify.
     */
    static async processApprovedClip(clipId: string) {
        const clip = await db.query.videoClips.findFirst({
            where: eq(videoClips.id, clipId),
            with: { source: true }
        });

        if (!clip) throw new Error("Clip not found");
        if (clip.status !== 'approved') throw new Error("Clip must be approved to process");

        try {
            await db.update(videoClips).set({ status: 'processing_apify' }).where(eq(videoClips.id, clipId));

            // Start Apify Actor (e.g. YouTube Video Downloader with time constraints)
            // Note: This uses a generic YT downloader actor structure. The specific Actor ID depends on the Apify account.
            const run = await apifyClient.actor('streamers/youtube-scraper').call({
                startUrls: [{ url: clip.source.url }],
                downloadMode: "audio_video",
                downloadSectionFrom: clip.startSeconds,
                downloadSectionTo: clip.endSeconds,
            });

            await db.update(videoClips).set({ apifyJobId: run.id }).where(eq(videoClips.id, clipId));

            // We do not wait for it here. A separate webhook from Apify should call back to complete it,
            // or we run a status checker.
            console.log(`Started Apify Job ${run.id} for Clip ${clipId}`);

        } catch (error) {
            console.error(`Failed to process clip ${clipId}:`, error);
            await db.update(videoClips).set({
                status: 'failed',
            }).where(eq(videoClips.id, clipId));
        }
    }

    private static formatSeconds(seconds: number): string {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    }
}
