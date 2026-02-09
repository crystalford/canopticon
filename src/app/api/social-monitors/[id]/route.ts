import { db } from '@/db'
import { socialMonitors } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'

export async function DELETE(
    req: Request,
    { params }: { params: { id: string } }
) {
    try {
        await db.delete(socialMonitors).where(eq(socialMonitors.id, params.id))
        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Failed to delete social monitor:', error)
        return NextResponse.json({ error: 'Failed to delete monitor' }, { status: 500 })
    }
}
