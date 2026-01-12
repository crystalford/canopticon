import { Trend } from '@/types';

// Mock Data for Development
const MOCK_TRENDS: Trend[] = [
    { id: '1', topic: '#Debate2026', volume: 154000, sentiment: -0.2, timestamp: new Date().toISOString(), domain: 'Politics' },
    { id: '2', topic: 'Inflation', volume: 89000, sentiment: -0.8, timestamp: new Date().toISOString(), domain: 'Economy' },
    { id: '3', topic: 'SpaceX', volume: 45000, sentiment: 0.6, timestamp: new Date().toISOString(), domain: 'Tech' },
    { id: '4', topic: '#SenateVote', volume: 32000, sentiment: 0.1, timestamp: new Date().toISOString(), domain: 'Politics' },
    { id: '5', topic: 'Clean Energy Bill', volume: 21000, sentiment: 0.4, timestamp: new Date().toISOString(), domain: 'Policy' },
];

export class TwitterClient {
    private apiKey: string | undefined;

    constructor() {
        this.apiKey = process.env.TWITTER_BEARER_TOKEN;
    }

    async getTrends(): Promise<Trend[]> {
        // Default to Mock if no key
        if (!this.apiKey) {
            console.log("[TwitterClient] No API Key, returning MOCKS.");
            return MOCK_TRENDS;
        }

        try {
            // Real API Call Implementation (Placeholder for now)
            // const response = await fetch('https://api.twitter.com/2/trends/by/woeid/23424977', { headers: { Authorization: `Bearer ${this.apiKey}` } });
            // ... parse ...
            throw new Error("Live API Not Yet Implemented");
        } catch (e) {
            console.error("[TwitterClient] API Error, falling back to mocks", e);
            return MOCK_TRENDS;
        }
    }

    async searchTweets(query: string) {
        // Implement tweet search
        return [];
    }
}

export const twitter = new TwitterClient();
