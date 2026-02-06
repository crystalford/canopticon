import { db, articles } from '@/db'
import { DiscoveredStory } from './discovery'

/**
 * Create a draft article from discovered story
 */
export async function createDraftArticle(story: DiscoveredStory) {
    // Generate slug from headline (lowercase, replace spaces with hyphens, remove special chars)
    const slug = story.headline
        .toLowerCase()
        .replace(/[^\w\s-]/g, '') // Remove special characters
        .replace(/\s+/g, '-') // Replace spaces with hyphens
        .replace(/-+/g, '-') // Replace multiple hyphens with single
        .substring(0, 100) // Cap at 100 chars

    // Check if slug already exists, append timestamp if it does
    const existingCount = await db.execute(`
        SELECT COUNT(*) as count FROM articles WHERE slug LIKE '${slug}%'
    `)
    const count = (existingCount as any)[0]?.count || 0
    const finalSlug = count > 0 ? `${slug}-${Date.now()}` : slug

    // Create article record
    const [article] = await db
        .insert(articles)
        .values({
            slug: finalSlug,
            headline: story.headline,
            summary: story.summary,
            topics: story.topics,
            isDraft: true,
            // content, signalId, briefId left null - will be filled by generation pipeline
        })
        .returning()

    return article
}
