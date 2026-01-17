import { NextResponse } from 'next/server'
import { db } from '@/db'
import { socialAccounts } from '@/db/schema'
import { eq } from 'drizzle-orm'

export async function DELETE(
    req: Request,
    { params }: { params: { id: string } }
) {
    try {
        await db.delete(socialAccounts).where(eq(socialAccounts.id, params.id))
        return NextResponse.json({ success: true })
    } catch (e) {
        console.error('Failed to delete social account', e)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
