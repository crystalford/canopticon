import { Signal } from '@/types';
import crypto from 'crypto';

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
        // Fetch recently introduced bills
        // Note: OpenParliament API doesn't always sort by introduction date by default, 
        // but we can query the bills endpoint.
        const response = await fetch(`${OPEN_PARLIAMENT_API_BASE}/bills/?limit=10&format=json`, {
            next: { revalidate: 3600 } // Cache for 1 hour
        });

        if (!response.ok) {
            throw new Error(`OpenParliament API failed: ${response.statusText}`);
        }

        const data = await response.json();
        const bills: OPBill[] = data.objects;

        return bills.map((bill) => {
            const title = bill.short_title.en || bill.name.en;
            const hash = generateHash(bill.number + bill.session);

            return {
                id: hash,
                hash: hash,
                headline: `Legislation: ${bill.number} - ${title}`,
                url: `https://openparliament.ca${bill.url}`, // Link to their UI
                source: 'Parliament of Canada',
                publishedAt: bill.introduced || new Date().toISOString(),
                summary: `Bill ${bill.number} introduced in session ${bill.session}.`,
                priority: 'high', // Legislation is always high priority signal
                status: 'pending',
                entities: ['Parliament of Canada', bill.number],
                topics: ['Legislation'],
                rawContent: JSON.stringify(bill)
            };
        });
    } catch (error) {
        console.error('Failed to fetch Parliament bills:', error);
        return [];
    }
}
