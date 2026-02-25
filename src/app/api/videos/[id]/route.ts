import { NextResponse } from 'next/server'
import { db, videoClips } from '@/db'
import { eq } from 'drizzle-orm'

export async function DELETE(
    req: Request,
    { params }: { params: { id: string } }
) {
    try {
        await db.delete(videoClips).where(eq(videoClips.id, params.id))
        return NextResponse.json({ success: true })
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}
