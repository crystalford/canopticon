import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { db, articles } from '@/db'
import { eq } from 'drizzle-orm'

/**
 * GET /api/articles/[slug] - Get article by slug
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    try {
        const { slug } = await params

        const [article] = await db
            .select()
            .from(articles)
            .where(eq(articles.slug, slug))
            .limit(1)

        if (!article) {
            return NextResponse.json(
                { error: 'Article not found' },
                { status: 404 }
            )
        }

        // Check for session to allow draft access
        const session = await getServerSession()
        const isAdmin = !!session

        // Don't show drafts on public endpoint unless admin/authenticated
        if (article.isDraft && !isAdmin) {
            return NextResponse.json(
                { error: 'Article not found' },
                { status: 404 }
            )
        }

        return NextResponse.json({ article })
    } catch (error) {
        console.error('Error fetching article:', error)
        return NextResponse.json(
            { error: 'Failed to fetch article' },
            { status: 500 }
        )
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    try {
        // Require authentication
        const session = await getServerSession()
        if (!session) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            )
        }

        const { slug } = await params
        const body = await request.json()

        console.log('PATCH /api/articles/[slug]:', { slug, keys: Object.keys(body) })

        // Sanitize dates - need to convert ISO strings to Date objects for database
        const sanitizedBody = { ...body }
        if (sanitizedBody.publishedAt) {
            sanitizedBody.publishedAt = new Date(sanitizedBody.publishedAt)
        }
        if (sanitizedBody.updatedAt) {
            sanitizedBody.updatedAt = new Date(sanitizedBody.updatedAt)
        }

        // Parse content JSON if it's a string (for jsonb column)
        if (sanitizedBody.content && typeof sanitizedBody.content === 'string') {
            try {
                sanitizedBody.content = JSON.parse(sanitizedBody.content)
            } catch (e) {
                console.warn('Failed to parse content JSON, saving as string:', e)
            }
        }

        // Update article
        const [updatedArticle] = await db
            .update(articles)
            .set(sanitizedBody)
            .where(eq(articles.slug, slug))
            .returning()

        if (!updatedArticle) {
            return NextResponse.json(
                { error: 'Article not found' },
                { status: 404 }
            )
        }

        console.log('Article updated successfully:', updatedArticle.slug)
        return NextResponse.json({ article: updatedArticle })
    } catch (error) {
        console.error('Error updating article:', error)
        return NextResponse.json(
            { error: `Failed to update article: ${error}` },
            { status: 500 }
        )
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    try {
        const session = await getServerSession()
        if (!session) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            )
        }

        const { slug } = await params

        const [deletedArticle] = await db
            .delete(articles)
            .where(eq(articles.slug, slug))
            .returning()

        if (!deletedArticle) {
            return NextResponse.json(
                { error: 'Article not found' },
                { status: 404 }
            )
        }

        console.log('Article deleted:', deletedArticle.slug)
        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error deleting article:', error)
        return NextResponse.json(
            { error: `Failed to delete article: ${error}` },
            { status: 500 }
        )
    }
}
