import { AIClient, AIMessage } from '../ai-client'

export interface DiscoveredStory {
    headline: string
    summary: string
    topics: string[]
    significance: string
}

/**
 * Discovery Pipeline Logic
 *
 * Purpose: Use AI to find and analyze the day's most important story
 *
 * Data Flow:
 * 1. Send prompt to AI (Perplexity for web search)
 * 2. AI returns structured response with HEADLINE, SUMMARY, KEY FACTS, etc.
 * 3. Parse the structured response into DiscoveredStory object
 * 4. Return data for creating draft article
 *
 * Key: High max_tokens ensures AI doesn't truncate response
 * Structured parsing extracts each section correctly
 */
export async function discoverStories(
    client: AIClient,
    promptTemplate: string
): Promise<DiscoveredStory> {
    console.log('[discovery] Starting story discovery with max_tokens=4000...')

    // Build the discovery prompt
    const messages: AIMessage[] = [
        {
            role: 'user',
            content: promptTemplate,
        },
    ]

    // Call AI with HIGH max_tokens to prevent truncation
    // Perplexity needs plenty of room for structured output (4000 tokens ≈ 3000 words)
    const response = await client.chat(messages, { maxTokens: 4000 })

    console.log(`[discovery] Received response (${response.content.length} characters)`)

    // Parse response into structured format
    // The prompt should return clearly delimited sections
    const story = parseStructuredResponse(response.content)

    console.log(`[discovery] Parsed story: "${story.headline.substring(0, 60)}..."`)

    return story
}

/**
 * Parse structured response format
 *
 * Expects format like:
 * HEADLINE: [text]
 * SUMMARY: [text]
 * KEY FACTS: [text]
 * CONTEXT: [text]
 * TOPICS: [text]
 * SOURCES: [text]
 *
 * Handles both this format and fallback to line-by-line parsing
 */
function parseStructuredResponse(content: string): DiscoveredStory {
    console.log('[discovery] Parsing structured response...')

    // Try to extract sections using regex for structured format
    // Look for patterns like "HEADLINE: ..." or "HEADLINE:\n..."

    // Extract HEADLINE
    let headline = extractSection(content, 'HEADLINE')
    if (!headline) {
        // Fallback: first line
        headline = content.split('\n')[0]?.trim() || 'Breaking News'
    }
    headline = headline.trim()

    // Extract SUMMARY (may span multiple paragraphs)
    let summary = extractSection(content, 'SUMMARY')
    if (!summary) {
        // Fallback: first few sentences
        const lines = content.split('\n').filter(l => l.trim())
        summary = lines.slice(1, 5).join(' ')
    }
    summary = summary
        .trim()
        .replace(/\n+/g, ' ') // Replace newlines with spaces
        .substring(0, 800) // Generous limit for full context

    // Extract KEY FACTS as topics
    let keyFacts = extractSection(content, 'KEY FACTS')
    let topicsList: string[] = []

    if (keyFacts) {
        // Parse bullet points from KEY FACTS
        topicsList = keyFacts
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0)
            .map(line => {
                // Remove bullet markers: -, *, •, numbers, etc.
                return line.replace(/^[\d\.\-\*\•\s]+/, '').trim()
            })
            .filter(line => line.length > 0)
    }

    // Extract TOPICS section
    let topicsSection = extractSection(content, 'TOPICS')
    if (topicsSection) {
        const moreTopics = topicsSection
            .split(/[,\n]/)
            .map(t => t.trim())
            .filter(t => t.length > 0 && !t.toLowerCase().startsWith('source'))
        topicsList = [...topicsList, ...moreTopics]
    }

    // Remove duplicates and limit to 5
    const topics = [...new Set(topicsList)]
        .filter(t => t.length > 0 && t.length < 100) // Remove spam/junk
        .slice(0, 5)

    // Default topics if none found
    if (topics.length === 0) {
        topics.push('Politics', 'Canada', 'Breaking News')
    }

    console.log(`[discovery] Extracted: headline (${headline.length}c), summary (${summary.length}c), topics (${topics.length})`)

    return {
        headline,
        summary: summary || 'See full story above',
        topics,
        significance: 'high', // User can adjust in UI if needed
    }
}

/**
 * Extract section from structured response
 * Looks for "SECTION_NAME: content" or "SECTION_NAME\ncontent"
 *
 * Returns text until the next section marker or end of content
 */
function extractSection(content: string, sectionName: string): string {
    // Case-insensitive search for section header
    const sectionRegex = new RegExp(
        `${sectionName}\\s*:?\\s*(.+?)(?=\\n[A-Z][A-Z\\s]*:|\n[A-Z][A-Z\\s]*\\n|$)`,
        'is' // 'i' for case-insensitive, 's' for dotall (. matches newlines)
    )

    const match = content.match(sectionRegex)
    if (match && match[1]) {
        return match[1].trim()
    }

    return ''
}
