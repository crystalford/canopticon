import { NextRequest, NextResponse } from 'next/server'
import { db, briefs, articles } from '@/db'
import { eq } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'

function simpleSlugify(text: string): string {
    return text
        .toString()
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^\w\-]+/g, '')
        .replace(/\-\-+/g, '-')
        .substring(0, 100)
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { briefId, storyIndex } = body

        if (!briefId || storyIndex === undefined) {
            return NextResponse.json(
                { error: 'Missing briefId or storyIndex' },
                { status: 400 }
            )
        }

        // 1. Get the brief
        const [brief] = await db
            .select()
            .from(briefs)
            .where(eq(briefs.id, briefId))
            .limit(1)

        if (!brief) {
            return NextResponse.json(
                { error: 'Brief not found' },
                { status: 404 }
            )
        }

        const stories = brief.stories as any[]
        const story = stories[storyIndex]

        if (!story) {
            return NextResponse.json(
                { error: 'Story not found' },
                { status: 404 }
            )
        }

        // 2. Create Article
        // Generate unique slug
        const baseSlug = simpleSlugify(story.headline)
        const uniqueSlug = `${baseSlug}-${uuidv4().substring(0, 8)}`

        // Note: status field doesn't exist in schema, relies on isDraft boolean
        const [article] = await db.insert(articles).values({
            briefId: briefId,
            headline: story.headline,
            summary: story.summary,
            slug: uniqueSlug,
            isDraft: true,
            topics: story.keyPlayers || [],
            entities: story.keyPlayers || [],
            signalId: null, // Explicitly null as it's from a brief
            createdAt: new Date(),
            publishedAt: null,
        }).returning()

        return NextResponse.json({
            success: true,
            articleId: article.id,
            slug: article.slug
        })

    } catch (error) {
        console.error('Failed to publish story:', error)
        return NextResponse.json(
            { error: 'Failed to publish story' },
            { status: 500 }
        )
    }
}
