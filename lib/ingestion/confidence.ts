import { Signal } from '@/types';

/**
 * Calculate basic confidence score for a signal during ingestion
 * Scale: 0-100
 * 
 * Factors:
 * - Source reliability (50% weight)
 * - Keyword matching (30% weight) - Poilievre, Parliament, etc.
 * - Signal freshness (20% weight) - Recent = higher
 */
export function calculateBasicConfidence(signal: Signal, sourceReliability: number = 70): number {
    let score = 0;

    // 1. Source Reliability (50% = 50 points max)
    // sourceReliability should be 0-100, we take 50% of it
    score += (sourceReliability / 100) * 50;

    // 2. Keyword Matching (30% = 30 points max)
    const highValueKeywords = [
        'poilievre', 'parliament', 'trudeau', 'carney', 'conservative',
        'liberal', 'ndp', 'election', 'vote', 'bill', 'legislation'
    ];

    const textToCheck = `${signal.headline} ${signal.summary || ''}`.toLowerCase();
    const matchedKeywords = highValueKeywords.filter(kw => textToCheck.includes(kw));
    const keywordScore = Math.min((matchedKeywords.length / highValueKeywords.length) * 30, 30);
    score += keywordScore;

    // 3. Freshness (20% = 20 points max)
    const ageInHours = (Date.now() - new Date(signal.publishedAt || Date.now()).getTime()) / (1000 * 60 * 60);
    let freshnessScore = 20;
    if (ageInHours > 24) freshnessScore = 10;  // Older than 1 day = 10 points
    if (ageInHours > 72) freshnessScore = 5;   // Older than 3 days = 5 points
    if (ageInHours > 168) freshnessScore = 0;  // Older than 1 week = 0 points
    score += freshnessScore;

    // Round to integer and clamp 0-100
    return Math.min(Math.max(Math.round(score), 0), 100);
}
