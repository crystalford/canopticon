import { tool, generateText } from 'ai'
import { z } from 'zod'
import { db, articles } from '@/db'
import { eq } from 'drizzle-orm'
import { researchModel } from './providers'
import slugify from 'slugify'

function makeSlug(title: string): string {
    return slugify(title, { lower: true, strict: true, trim: true })
}

export function createTools(conversationId?: string) {
    return {
        search_web: tool({
            description: 'Search the web for current information on any topic. Use this for news, events, facts, research. Returns detailed search results.',
            inputSchema: z.object({
                query: z.string().describe('The search query - be specific for better results'),
            }),
            execute: async ({ query }) => {
                try {
                    console.log('[search_web] Searching for:', query)
                    console.log('[search_web] PERPLEXITY_API_KEY set:', !!process.env.PERPLEXITY_API_KEY)
                    const result = await generateText({
                        model: researchModel,
                        messages: [{ role: 'user', content: query }],
                    })
                    console.log('[search_web] Success, response length:', result.text.length)
                    return { success: true, results: result.text }
                } catch (error: any) {
                    console.error('[search_web] Error:', error?.message, error?.statusCode, error?.url, JSON.stringify(error?.cause || ''))
                    const message = error instanceof Error ? error.message : String(error)
                    return { success: false, error: `Search failed: ${message}` }
                }
            },
        }),

        publish_article: tool({
            description: 'Publish an article to the website. It goes live immediately. Use this when the user says "publish" or "publish it".',
            inputSchema: z.object({
                title: z.string().describe('The article headline'),
                content: z.string().describe('The full article content in markdown'),
                summary: z.string().describe('A 1-2 sentence summary for SEO and previews'),
            }),
            execute: async ({ title, content, summary }) => {
                try {
                    const slug = makeSlug(title)
                    const now = new Date()

                    const [article] = await db.insert(articles).values({
                        title,
                        slug,
                        content,
                        summary,
                        status: 'published',
                        conversationId: conversationId || null,
                        publishedAt: now,
                    }).returning()

                    return {
                        success: true,
                        article: {
                            id: article.id,
                            title: article.title,
                            slug: article.slug,
                            url: `/articles/${article.slug}`,
                        },
                    }
                } catch (error) {
                    const message = error instanceof Error ? error.message : String(error)
                    return { success: false, error: `Failed to publish: ${message}` }
                }
            },
        }),

        list_articles: tool({
            description: 'List published articles on the site. Use this when the user wants to see what has been published.',
            inputSchema: z.object({
                limit: z.number().optional().default(20).describe('How many articles to return'),
            }),
            execute: async ({ limit }) => {
                const results = await db.query.articles.findMany({
                    columns: {
                        id: true,
                        title: true,
                        slug: true,
                        summary: true,
                        status: true,
                        publishedAt: true,
                    },
                    orderBy: (articles, { desc }) => [desc(articles.createdAt)],
                    limit,
                })

                return { articles: results, count: results.length }
            },
        }),

        edit_article: tool({
            description: 'Edit an existing article. Can update title, content, summary, or status.',
            inputSchema: z.object({
                id: z.string().describe('The article ID to edit'),
                title: z.string().optional().describe('New title'),
                content: z.string().optional().describe('New content in markdown'),
                summary: z.string().optional().describe('New summary'),
            }),
            execute: async ({ id, title, content, summary }) => {
                try {
                    const updates: Record<string, unknown> = { updatedAt: new Date() }
                    if (title) {
                        updates.title = title
                        updates.slug = makeSlug(title)
                    }
                    if (content) updates.content = content
                    if (summary) updates.summary = summary

                    const [article] = await db.update(articles)
                        .set(updates)
                        .where(eq(articles.id, id))
                        .returning()

                    if (!article) {
                        return { success: false, error: 'Article not found' }
                    }

                    return {
                        success: true,
                        article: {
                            id: article.id,
                            title: article.title,
                            slug: article.slug,
                            url: `/articles/${article.slug}`,
                        },
                    }
                } catch (error) {
                    const message = error instanceof Error ? error.message : String(error)
                    return { success: false, error: `Failed to edit: ${message}` }
                }
            },
        }),

        unpublish_article: tool({
            description: 'Unpublish an article (set to draft). Use when the user wants to take an article offline.',
            inputSchema: z.object({
                id: z.string().describe('The article ID to unpublish'),
            }),
            execute: async ({ id }) => {
                try {
                    const [article] = await db.update(articles)
                        .set({ status: 'draft', updatedAt: new Date() })
                        .where(eq(articles.id, id))
                        .returning()

                    if (!article) {
                        return { success: false, error: 'Article not found' }
                    }

                    return { success: true, message: `"${article.title}" has been unpublished.` }
                } catch (error) {
                    const message = error instanceof Error ? error.message : String(error)
                    return { success: false, error: `Failed to unpublish: ${message}` }
                }
            },
        }),
    }
}
