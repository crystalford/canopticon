import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { db } from '@/db'
import { articles } from '@/db/schema'
import slugify from 'slugify'

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession()
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { originalArticleId, forensicContent } = await request.json()

        if (!forensicContent) {
            return NextResponse.json({ error: 'Forensic content required' }, { status: 400 })
        }

        // Extract title from the first heading in the forensic content
        // The forensic report format has: "1. Cynical Headline" as the first section
        const titleMatch = forensicContent.match(/#+\s*(.+)/m)
        let title = titleMatch ? titleMatch[1].trim() : null

        // Fallback: Look for "Cynical Headline" or numbered list title
        if (!title) {
            const cynicalMatch = forensicContent.match(/1\.\s*([^\n]+)/m)
            title = cynicalMatch ? cynicalMatch[1].trim() : 'Forensic Analysis'
        }

        // Clean up common markdown formatting from the title
        title = title.replace(/\*\*/g, '').replace(/\*/g, '').replace(/#/g, '').trim()

        // Generate slug
        const baseSlug = slugify(title, { lower: true, strict: true })
        let slug = baseSlug
        let counter = 1

        // Ensure unique slug
        while (true) {
            const existing = await db.query.articles.findFirst({
                where: (articles, { eq }) => eq(articles.slug, slug)
            })
            if (!existing) break
            slug = `${baseSlug}-${counter++}`
        }

        const [newArticle] = await db.insert(articles).values({
            slug,
            headline: title,
            summary: title, // Use title as summary
            content: forensicContent,
            isDraft: true,
        }).returning()

        return NextResponse.json({
            success: true,
            slug: newArticle.slug,
            title: newArticle.headline
        })

    } catch (error: any) {
        console.error('Create Response Article Error:', error)
        return NextResponse.json(
            { error: error.message || 'Failed to create article' },
            { status: 500 }
        )
    }
}
