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
 * Create new prompt
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const { name, description, promptText, variables } = body

        if (!name || !promptText) {
            return NextResponse.json(
                { error: 'Name and prompt text are required' },
                { status: 400 }
            )
        }

        const [newPrompt] = await db
            .insert(prompts)
            .values({
                name,
                description: description || null,
                promptText,
                variables: variables || [],
                isActive: true,
            })
            .returning()

        return NextResponse.json({ prompt: newPrompt }, { status: 201 })
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error('Error creating prompt:', message)
        return NextResponse.json(
            { error: 'Failed to create prompt', details: message },
            { status: 500 }
        )
    }
}

/**
 * PATCH /api/admin/prompts
 * Update prompt
 */
export async function PATCH(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url)
        const id = searchParams.get('id')

        if (!id) {
            return NextResponse.json(
                { error: 'Prompt ID required' },
                { status: 400 }
            )
        }

        const body = await req.json()
        const { name, description, promptText, variables, isActive } = body

        const [updatedPrompt] = await db
            .update(prompts)
            .set({
                ...(name !== undefined && { name }),
                ...(description !== undefined && { description }),
                ...(promptText !== undefined && { promptText }),
                ...(variables !== undefined && { variables }),
                ...(isActive !== undefined && { isActive }),
                updatedAt: new Date(),
            })
            .where(eq(prompts.id, id))
            .returning()

        if (!updatedPrompt) {
            return NextResponse.json(
                { error: 'Prompt not found' },
                { status: 404 }
            )
        }

        return NextResponse.json({ prompt: updatedPrompt })
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error('Error updating prompt:', message)
        return NextResponse.json(
            { error: 'Failed to update prompt', details: message },
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
