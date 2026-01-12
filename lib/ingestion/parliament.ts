import { Signal } from '@/types';
import crypto from 'crypto';
import { SourceManager } from '@/lib/services/source-manager';
import { calculateBasicConfidence } from './confidence';

const OPEN_PARLIAMENT_API_BASE = 'https://api.openparliament.ca';

// Types for OpenParliament API responses (partial)
interface OPBill {
    url: string;
    number: string;
    name: { en: string; fr: string };
    short_title: { en: string; fr: string };
    session: string;
    introduced: string;
    legisinfo_url: string;
}

function generateHash(str: string): string {
    return crypto.createHash('md5').update(str).digest('hex');
}

export async function fetchParliamentBills(): Promise<Signal[]> {
    try {
        // Fetch source ID for Parliament (Best effort)
        const sources = await SourceManager.getActiveSources();
        const parliamentSource = sources.find(s => s.name.includes('Parliament') || s.category === 'government');
        const sourceId = parliamentSource?.id;

        // Fetch recently introduced bills
        const response = await fetch(`${OPEN_PARLIAMENT_API_BASE}/bills/?limit=10&format=json`, {
            next: { revalidate: 3600 } // Cache for 1 hour
        });

        if (!response.ok) {
            throw new Error(`OpenParliament API failed: ${response.statusText}`);
        }

        const data = await response.json();
        const bills: OPBill[] = data.objects;

        // Record success if source found
        if (sourceId) await SourceManager.recordSuccess(sourceId);

        return bills.map((bill) => {
            const title = bill.short_title.en || bill.name.en;
            const hash = generateHash(bill.number + bill.session);

            return {
                id: hash,
                hash: hash,
                headline: `Legislation: ${bill.number} - ${title}`,
                url: `https://openparliament.ca${bill.url}`, // Link to their UI
                source: 'Parliament of Canada',
                source_id: sourceId,
                publishedAt: bill.introduced || new Date().toISOString(),
                summary: `Bill ${bill.number} introduced in session ${bill.session}.`,
                priority: 'high', // Legislation is always high priority signal
                status: 'pending',
                entities: ['Parliament of Canada', bill.number],
                topics: ['parliament', 'legislation'],
                raw_content: bill.legisinfo_url,
                // Calculate confidence - Parliament bills are high reliability
                confidence_score: calculateBasicConfidence(
                    {
                        id: hash,
                        headline: title,
                        summary: '',
                        publishedAt: bill.introduced
                    } as Signal,
                    95  // Parliament is very reliable source
                )
            };
        });
    } catch (error: any) {
        console.error('Failed to fetch Parliament bills:', error);
        // We can't record failure if we don't have the source ID handy easily without fetching, 
        // but we try our best in a real app. For MVP, skip complex failure recording for API sources if fetch fails early.
        return [];
    }
}
