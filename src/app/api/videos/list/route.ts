
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { uploadedVideos } from '@/db/schema'
import { desc } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export async function GET() {
    try {
        const videos = await db.select().from(uploadedVideos).orderBy(desc(uploadedVideos.createdAt))
        return NextResponse.json({ videos })
    } catch (e) {
        return NextResponse.json({ error: 'Failed to fetch videos' }, { status: 500 })
    }
}
