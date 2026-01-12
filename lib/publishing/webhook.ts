import { Signal } from '@/types'
import { getPublications } from '@/lib/content/persistence'

export async function triggerUplink(signal: Signal) {
    const webhookUrl = process.env.PUBLISH_WEBHOOK_URL;

    if (!webhookUrl) {
        console.log("No Uplink configured (PUBLISH_WEBHOOK_URL missing). Skipping.");
        return;
    }

    // Hydrate with all generated content
    const publications = await getPublications(signal.hash || signal.id); // Fallback if hash missing

    const payload = {
        event: "signal.published",
        signal: {
            id: signal.id,
            headline: signal.headline,
            summary: signal.summary,
            url: signal.url,
            source: signal.source,
            published_at: signal.publishedAt,
            ai_analysis: signal.analysis, // JSONB
        },
        media: {
            publications: publications // The full array of generated assets
        },
        // Flattened for easier n8n usage
        marketing_copy: typeof signal.analysis === 'object' ? (signal.analysis as any)?.marketing_copy : null,
        timestamp: new Date().toISOString()
    };

    try {
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Canopticon-Secret': process.env.PUBLISH_WEBHOOK_SECRET || '',
                'User-Agent': 'Canopticon/1.0'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            console.error(`Uplink Failed: ${response.status} ${response.statusText}`);
        } else {
            console.log("Uplink Successful: Signal transmitted to n8n/External.");
        }
    } catch (error) {
        console.error("Uplink Error:", error);
    }
}
