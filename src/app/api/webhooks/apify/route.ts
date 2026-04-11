import { NextResponse } from 'next/server';
import { db } from '@/db';
import { videoClips } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { ApifyClient } from 'apify-client';

const apifyClient = new ApifyClient({
    token: process.env.APIFY_API_TOKEN || '',
});

export async function POST(req: Request) {
    try {
        const payload = await req.json();

        // Ensure this is from Apify
        const apifyEvent = payload.eventType;
        const runId = payload.eventData?.actorRunId;
        const datasetId = payload.eventData?.defaultDatasetId;

        if (apifyEvent !== 'ACTOR.RUN.SUCCEEDED' || !runId) {
            return NextResponse.json({ received: true });
        }

        const clip = await db.query.videoClips.findFirst({
            where: eq(videoClips.apifyJobId, runId)
        });

        if (!clip) {
            console.error(`Clip for Apify run ${runId} not found`);
            return NextResponse.json({ error: 'Clip not found' }, { status: 404 });
        }

        // Fetch dataset items from Apify
        const { items } = await apifyClient.dataset(datasetId).listItems();

        if (!items || items.length === 0) {
            await db.update(videoClips).set({
                status: 'failed',
            }).where(eq(videoClips.id, clip.id));
            return NextResponse.json({ error: 'No items in dataset' }, { status: 400 });
        }

        // Assume the first item has the video url
        const videoUrl = items[0].url || items[0].videoUrl;

        await db.update(videoClips).set({
            status: 'completed',
            clipUrl: videoUrl as string
        }).where(eq(videoClips.id, clip.id));

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Webhook error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
