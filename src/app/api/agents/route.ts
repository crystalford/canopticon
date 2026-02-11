
import { db } from '@/db'
import { agents } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { personas as defaultPersonas } from '@/lib/ai/personas' // Fallback

export const dynamic = 'force-dynamic'

export async function GET() {
    try {
        const dbAgents = await db.select().from(agents)
        if (dbAgents.length > 0) {
            return NextResponse.json(dbAgents)
        }
        // If DB empty, return defaults (but don't save them yet to avoid confusion)
        return NextResponse.json(defaultPersonas.map(p => ({
            id: p.id,
            name: p.title,
            slug: p.id,
            description: p.description,
            systemPrompt: p.system,
            modelProvider: 'openai',
            isActive: true
        })))
    } catch (error) {
        console.warn('Agents table not ready, returning defaults')
        return NextResponse.json(defaultPersonas.map(p => ({
            id: p.id,
            name: p.title,
            slug: p.id,
            description: p.description,
            systemPrompt: p.system,
            modelProvider: 'openai',
            isActive: true
        })))
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json()

        // Upsert agent
        const [agent] = await db.insert(agents).values({
            name: body.name,
            slug: body.slug || body.name.toLowerCase().replace(/\s+/g, '-'),
            description: body.description,
            systemPrompt: body.systemPrompt,
            modelProvider: body.modelProvider || 'openai',
            isActive: body.isActive ?? true
        }).onConflictDoUpdate({
            target: agents.slug,
            set: {
                name: body.name,
                description: body.description,
                systemPrompt: body.systemPrompt,
                modelProvider: body.modelProvider,
                isActive: body.isActive,
                updatedAt: new Date()
            }
        }).returning()

        return NextResponse.json(agent)
    } catch (error) {
        console.error('Failed to save agent:', error)
        return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }
}
