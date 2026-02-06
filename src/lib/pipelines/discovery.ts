import { AIClient, AIMessage } from '../ai-client'

export interface DiscoveredStory {
    headline: string
    summary: string
    topics: string[]
    significance: string
}

/**
 * Discovery Pipeline Logic
 * Uses AI to find daily top stories
 */
export async function discoverStories(
    client: AIClient,
    promptTemplate: string
): Promise<DiscoveredStory> {
    // Build the discovery prompt
    const messages: AIMessage[] = [
        {
            role: 'user',
            content: promptTemplate,
        },
    ]

    // Call AI (Perplexity)
    const response = await client.chat(messages)

    // Parse response into structured format
    // The prompt should return a well-formatted story
    const story = parseStoryResponse(response.content)

    return story
}

/**
 * Parse AI response into structured story format
 * Expects response with clear sections for headline, summary, topics
 */
function parseStoryResponse(content: string): DiscoveredStory {
    // Try to parse structured response
    // If the prompt is well-designed, it should return clearly delimited sections

    // Default: extract what we can from the response
    const lines = content.split('\n').filter((l) => l.trim())

    // First non-empty line is headline
    const headline = lines[0]?.trim() || 'Breaking News'

    // Next few lines are summary (up to a section marker or "Topics")
    const summaryLines: string[] = []
    let topicsStartIdx = -1

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].toLowerCase()
        if (
            line.includes('topic') ||
            line.includes('key point') ||
            line.startsWith('---')
        ) {
            topicsStartIdx = i
            break
        }
        summaryLines.push(lines[i])
    }

    const summary = summaryLines
        .join(' ')
        .trim()
        .substring(0, 500) // Cap at 500 chars

    // Extract topics (after Topics section or everything after summary)
    const topics: string[] = []
    if (topicsStartIdx !== -1) {
        for (let i = topicsStartIdx + 1; i < lines.length; i++) {
            const line = lines[i].trim()
            if (line && !line.startsWith('---')) {
                // Clean up bullet points, numbers, etc.
                const topic = line
                    .replace(/^[\d\.\-\*\s]+/, '')
                    .trim()
                if (topic.length > 0) {
                    topics.push(topic)
                }
            }
        }
    }

    // Default topics if none found
    if (topics.length === 0) {
        topics.push('Politics', 'Canada', 'Breaking News')
    }

    return {
        headline,
        summary: summary || 'See full story above',
        topics: topics.slice(0, 5), // Limit to 5 topics
        significance: 'high', // Default to high - user can adjust later
    }
}
