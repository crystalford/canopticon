import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { db, rawArticles, articles } from '@/db'
import { eq } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession()
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { rawArticleId } = await request.json()
        if (!rawArticleId) {
            return NextResponse.json({ error: 'Article ID required' }, { status: 400 })
        }

        // Fetch raw article
        const [rawArticle] = await db
            .select()
            .from(rawArticles)
            .where(eq(rawArticles.id, rawArticleId))
            .limit(1)

        if (!rawArticle) {
            return NextResponse.json({ error: 'Raw article not found' }, { status: 404 })
        }

        // Generate slug
        const slugBase = rawArticle.title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 100)
        const slug = `${slugBase}-${Date.now().toString().slice(-4)}`

        // Convert to TipTap JSON structure for the editor
        // We wrap the raw text in a paragraph node
        const contentJson = {
            type: 'doc',
            content: rawArticle.bodyText.split('\n\n').map(para => ({
                type: 'paragraph',
                content: [{ type: 'text', text: para.trim() }]
            })).filter(node => node.content[0].text) // Remove empty paragraphs
        }

        // Insert new Article
        const [newArticle] = await db.insert(articles).values({
            slug,
            headline: rawArticle.title,
            summary: rawArticle.bodyText.slice(0, 300) + '...', // Required field
            content: contentJson, // TipTap JSON
            excerpt: rawArticle.bodyText.slice(0, 200) + '...',
            isDraft: true,
            author: session.user?.name || 'Operator',
            // topics: [], // Can auto-tag later
        }).returning()

        // Mark raw article as processed
        await db
            .update(rawArticles)
            .set({ isProcessed: true })
            .where(eq(rawArticles.id, rawArticleId))

        return NextResponse.json({
            success: true,
            slug: newArticle.slug,
            articleId: newArticle.id
        })

    } catch (error) {
        console.error('Failed to convert article:', error)
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        )
    }
}
