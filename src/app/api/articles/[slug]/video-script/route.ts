```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { db, articles } from '@/db'
import { eq } from 'drizzle-orm'
import { GoogleGenerativeAI } from '@google/generative-ai'

export const dynamic = 'force-dynamic'

const SCRIPT_PROMPT = `You are a video script writer creating a 60 - SECOND SHORT video script for YouTube / TikTok / Instagram.

Given this news article, create a punchy, engaging video script that:
1. Opens with a HOOK(first 3 seconds must grab attention)
2. Explains the key story in simple terms
3. Includes 2 - 3 key facts / numbers
4. Ends with a call to action or thought - provoking question

Format your response as JSON with this exact structure:
{
    "hook": "Opening line (must grab attention in 3 seconds)",
        "body": "Main content (30-40 seconds of speaking)",
            "keyFacts": ["Fact 1", "Fact 2", "Fact 3"],
                "callToAction": "Ending question or CTA",
                    "suggestedOverlays": ["Text overlay 1", "Text overlay 2"],
                        "estimatedDuration": 60
}

Be direct, conversational, and slightly provocative.This is for Gen Z / Millennial audiences.`

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    try {
        const session = await getServerSession()
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { slug } = await params

        // Get article
        const [article] = await db
            .select()
            .from(articles)
            .where(eq(articles.slug, slug))
            .limit(1)

        if (!article) {
            return NextResponse.json({ error: 'Article not found' }, { status: 404 })
        }

        // Use Gemini to generate script
        const geminiKey = process.env.GEMINI_API_KEY
        if (!geminiKey) {
            return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 500 })
        }

        const genAI = new GoogleGenerativeAI(geminiKey)
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

        const articleContent = `
Title: ${ article.headline }
Summary: ${ article.summary }
Topics: ${ article.topics?.join(', ') || 'N/A' }
`

        const result = await model.generateContent([
            { text: SCRIPT_PROMPT },
            { text: articleContent }
        ])

        const responseText = result.response.text()

        // Extract JSON from response
        const jsonMatch = responseText.match(/\{[\s\S]*\}/)
        if (!jsonMatch) {
            return NextResponse.json({ error: 'Failed to parse script response' }, { status: 500 })
        }

        const script = JSON.parse(jsonMatch[0])

        return NextResponse.json({ script })
    } catch (error) {
        console.error('Error generating video script:', error)
        return NextResponse.json(
            { error: `Failed to generate script: ${ error } ` },
            { status: 500 }
        )
    }
}

// GET existing scripts for an article
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    try {
        const { slug } = await params

        // Get article
        const [article] = await db
            .select({ id: articles.id })
            .from(articles)
            .where(eq(articles.slug, slug))
            .limit(1)

        if (!article) {
            return NextResponse.json({ error: 'Article not found' }, { status: 404 })
        }

        // Get video materials
        const materials = await db
            .select()
            .from(videoMaterials)
            .where(eq(videoMaterials.articleId, article.id))

        return NextResponse.json({ materials })
    } catch (error) {
        console.error('Error fetching video materials:', error)
        return NextResponse.json(
            { error: 'Failed to fetch video materials' },
            { status: 500 }
        )
    }
}
