import { db } from '@/db'
import { socialMonitors } from '@/db/schema'
import { desc, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
    try {
        const monitors = await db.select().from(socialMonitors).orderBy(desc(socialMonitors.createdAt))
        return NextResponse.json(monitors)
    } catch (error) {
        console.error('Failed to fetch social monitors:', error)
        return NextResponse.json({ error: 'Failed to fetch monitors' }, { status: 500 })
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json()
        const { accountHandle, monitorType, displayName } = body

        if (!accountHandle || !monitorType) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        // Clean handle (ensure @)
        const handle = accountHandle.startsWith('@') ? accountHandle : `@${accountHandle}`

        const [monitor] = await db.insert(socialMonitors).values({
            accountHandle: handle,
            displayName: displayName || handle,
            monitorType,
            config: {
                autoReply: false,
                requireApproval: true,
                maxRepliesPerDay: 10,
                fallacyTypes: [],
            }
        }).returning()

        return NextResponse.json(monitor)
    } catch (error) {
        console.error('Failed to create social monitor:', error)
        return NextResponse.json({ error: 'Failed to create monitor' }, { status: 500 })
    }
}
