import { NextRequest, NextResponse } from 'next/server'
import { db, aiProviders } from '@/db'
import { eq } from 'drizzle-orm'

/**
 * GET /api/admin/ai-providers
 * List all AI providers
 */
export async function GET() {
    try {
        const providers = await db
            .select({
                id: aiProviders.id,
                name: aiProviders.name,
                provider: aiProviders.provider,
                config: aiProviders.config,
                isActive: aiProviders.isActive,
                createdAt: aiProviders.createdAt,
                // Don't return API key in list
            })
            .from(aiProviders)
            .orderBy(aiProviders.createdAt)

        return NextResponse.json({ providers })
    } catch (error) {
        console.error('Error fetching AI providers:', error)
        return NextResponse.json(
            { error: 'Failed to fetch providers' },
            { status: 500 }
        )
    }
}

/**
 * POST /api/admin/ai-providers
 * Create new AI provider
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const { name, provider, apiKey, config } = body

        if (!name || !provider || !apiKey) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            )
        }

        // TODO: Encrypt API key before storing
        const [newProvider] = await db
            .insert(aiProviders)
            .values({
                name,
                provider,
                apiKey, // Should be encrypted
                config: config || {},
                isActive: true,
            })
            .returning()

        return NextResponse.json({ provider: newProvider }, { status: 201 })
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error('Error creating AI provider:', message)
        return NextResponse.json(
            { error: 'Failed to create provider', details: message },
            { status: 500 }
        )
    }
}

/**
 * DELETE /api/admin/ai-providers
 * Delete AI provider
 */
export async function DELETE(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url)
        const id = searchParams.get('id')

        if (!id) {
            return NextResponse.json(
                { error: 'Provider ID required' },
                { status: 400 }
            )
        }

        await db.delete(aiProviders).where(eq(aiProviders.id, id))

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error deleting AI provider:', error)
        return NextResponse.json(
            { error: 'Failed to delete provider' },
            { status: 500 }
        )
    }
}
