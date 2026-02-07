import { AIClient } from '@/lib/ai-client'
import { db, articles } from '@/db'
import { eq } from 'drizzle-orm'

/**
 * Writing Pipeline Logic
 *
 * Purpose: Take discovered story data and generate a full, polished article
 *
 * Data Flow:
 * 1. Receive discovered story from generation_runs (headline, summary, topics)
 * 2. Create prompt using the discovered story as context
 * 3. Call AI with writing prompt (from database)
 * 4. Parse response and generate full article content
 * 5. Update article record with generated content
 * 6. Return updated article
 *
 * Expected Input: Story object from discovery pipeline
 * {
 *   headline: string,
 *   summary: string,
 *   topics: string[],
 *   significance: string
 * }
 *
 * Expected Output: Full article content (800-1500 words)
 */

interface DiscoveredStory {
    headline: string
    summary: string
    topics: string[]
    significance: string
}

interface WritingInput {
    story: DiscoveredStory
    articleId: string
}

/**
 * Write a full article from discovered story
 *
 * @param client - Configured AI client (from pipeline runner)
 * @param promptTemplate - Writing prompt template (from database)
 * @param input - Discovered story and article ID
 * @returns Updated article with generated content
 */
export async function writeArticle(
    client: AIClient,
    promptTemplate: string,
    input: WritingInput
): Promise<any> {
    const { story, articleId } = input

    console.log('[writing] Starting article writing')
    console.log(`[writing] Story headline: "${story.headline}"`)
    console.log(`[writing] Article ID: "${articleId}"`)

    // Create the writing prompt by injecting story data
    const writingPrompt = promptTemplate
        .replace('{headline}', story.headline)
        .replace('{summary}', story.summary)
        .replace('{topics}', story.topics.join(', '))
        .replace('{significance}', story.significance || '')

    console.log('[writing] Prompt prepared, calling AI...')

    // Call AI to generate article content
    const aiResponse = await client.chat([
        {
            role: 'user',
            content: writingPrompt,
        },
    ])

    console.log(`[writing] AI response received (${aiResponse.content.length} characters)`)

    // Parse response into article content
    // For now, use the full response as content
    // In future, could parse sections (intro, body, conclusion)
    const articleContent = aiResponse.content

    console.log(`[writing] Generated article content (${articleContent.length} characters)`)

    // Update article with generated content
    console.log(`[writing] Updating article in database (id="${articleId}")`)

    const [updatedArticle] = await db
        .update(articles)
        .set({
            content: articleContent,
            updatedAt: new Date(),
        })
        .where(eq(articles.id, articleId))
        .returning()

    if (!updatedArticle) {
        throw new Error(`Article not found: ${articleId}`)
    }

    console.log(
        `[writing] Article updated successfully (headline="${updatedArticle.headline}")`
    )

    return updatedArticle
}
