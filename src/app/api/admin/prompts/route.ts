import { NextRequest, NextResponse } from 'next/server'
import { db, prompts } from '@/db'
import { eq } from 'drizzle-orm'

/**
 * GET /api/admin/prompts
 * List all prompts
 */
export async function GET() {
    try {
        const allPrompts = await db
            .select()
            .from(prompts)
            .orderBy(prompts.createdAt)

        return NextResponse.json({ prompts: allPrompts })
    } catch (error) {
        console.error('Error fetching prompts:', error)
        return NextResponse.json(
            { error: 'Failed to fetch prompts' },
            { status: 500 }
        )
    }
}

/**
 * POST /api/admin/prompts
 * Create or update prompt
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const { id, name, description, promptText, variables } = body

        if (!name || !promptText) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            )
        }

        // Update existing or create new
        if (id) {
            const [updated] = await db
                .update(prompts)
                .set({
                    name,
                    description,
                    promptText,
                    variables,
                    updatedAt: new Date(),
                })
                .where(eq(prompts.id, id))
                .returning()

            return NextResponse.json({ prompt: updated })
        } else {
            const [newPrompt] = await db
                .insert(prompts)
                .values({
                    name,
                    description,
                    promptText,
                    variables,
                    isActive: true,
                })
                .returning()

            return NextResponse.json({ prompt: newPrompt }, { status: 201 })
        }
    } catch (error) {
        console.error('Error saving prompt:', error)
        return NextResponse.json(
            { error: 'Failed to save prompt' },
            { status: 500 }
        )
    }
}

/**
 * DELETE /api/admin/prompts
 * Delete prompt
 */
export async function DELETE(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url)
        const id = searchParams.get('id')

        if (!id) {
            return NextResponse.json(
                { error: 'Prompt ID required' },
                { status: 400 }
            )
        }

        await db.delete(prompts).where(eq(prompts.id, id))

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error deleting prompt:', error)
        return NextResponse.json(
            { error: 'Failed to delete prompt' },
            { status: 500 }
        )
    }
}
