import { NextRequest, NextResponse } from 'next/server'
import { callAI } from '@/lib/ai/client'
import { z } from 'zod'

/**
 * POST /api/articles/optimize - Generate metadata (topics, excerpt, etc.) form content
 */
export async function POST(request: NextRequest) {
    try {
        const { headline, content } = await request.json()

        if (!headline && !content) {
            return NextResponse.json(
                { error: 'Headline or content required' },
                { status: 400 }
            )
        }

        // Schema for structured output
        const Schema = z.object({
            topics: z.array(z.string()).describe('Array of 3-5 relevant topics/tags, focusing on Canadian politics, entities, or key themes. e.g. "Liberal Party", "Carbon Tax", "Supreme Court"'),
            excerpt: z.string().describe('A concise, engaging summary of the article (max 200 chars).'),
            metaDescription: z.string().describe('SEO-optimized meta description (max 155 chars).'),
        })

        const result = await callAI({
            prompt: `
                You are an expert editor for Canopticon, an independent Canadian political intelligence platform.
                Analyze the following article content and generate high-quality metadata.
                
                Guidelines:
                1. Topics: Identify specific entities (people, parties, bills) and themes. Focus on Canadian context.
                2. Excerpt: Summarize the core finding or event. Be objective and professional.
                3. Meta Description: Write for SEO. Include keywords but keep it readable.
            `,
            input: { headline, content: content?.slice(0, 5000) }, // Truncate content for cost/speed
            jsonSchema: Schema,
            outputFormat: 'json'
        })

        if (!result.success || !result.data) {
            throw new Error(result.error || 'Failed to generate metadata')
        }

        return NextResponse.json(result.data)

    } catch (error) {
        console.error('Error optimizing article:', error)
        return NextResponse.json(
            { error: 'Failed to optimize article' },
            { status: 500 }
        )
    }
}
