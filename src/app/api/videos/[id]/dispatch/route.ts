
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { uploadedVideos } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { readFile } from 'fs/promises'
import path from 'path'
import { getSetting, SETTINGS_KEYS } from '@/lib/db-settings'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const videoId = params.id
        if (!videoId) return NextResponse.json({ error: 'ID required' }, { status: 400 })

        // 1. Get Webhook URL
        const webhookUrl = await getSetting(SETTINGS_KEYS.VIDEO_WEBHOOK_URL)
        if (!webhookUrl) {
            return NextResponse.json({ error: 'Webhook URL not configured in Settings' }, { status: 400 })
        }

        // 2. Get Video Metadata
        const [video] = await db.select().from(uploadedVideos).where(eq(uploadedVideos.id, videoId))
        if (!video) {
            return NextResponse.json({ error: 'Video not found' }, { status: 404 })
        }

        // 3. Read File from Disk
        const uploadDir = path.join(process.cwd(), 'private_uploads')
        const filePath = path.join(uploadDir, video.filename)

        try {
            const fileBuffer = await readFile(filePath)

            // 4. Send to Webhook (as multipart/form-data)
            const formData = new FormData()
            const blob = new Blob([fileBuffer], { type: video.mimeType })
            formData.append('file', blob, video.originalName)
            formData.append('filename', video.originalName)
            formData.append('video_id', video.id)

            const res = await fetch(webhookUrl, {
                method: 'POST',
                body: formData
            })

            if (!res.ok) {
                const text = await res.text()
                throw new Error(`Webhook failed: ${res.status} ${text}`)
            }

            return NextResponse.json({ success: true })

        } catch (e: any) {
            console.error('Dispatch error:', e)
            return NextResponse.json({ error: 'Dispatch failed: ' + e.message }, { status: 500 })
        }

    } catch (e: any) {
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 })
    }
}
