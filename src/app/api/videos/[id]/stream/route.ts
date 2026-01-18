
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { uploadedVideos } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { createReadStream, statSync } from 'fs'
import path from 'path'

// Turn off default body parsing to handle streams manually if needed, 
// though for GET it's strictly output.
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const videoId = params.id
        if (!videoId) return new NextResponse('ID required', { status: 400 })

        // Check DB
        const [video] = await db.select().from(uploadedVideos).where(eq(uploadedVideos.id, videoId))

        if (!video) {
            return new NextResponse('Video not found', { status: 404 })
        }

        const uploadDir = path.join(process.cwd(), 'private_uploads')
        const filePath = path.join(uploadDir, video.filename)

        // Check file stats
        try {
            const stats = statSync(filePath)
            // Basic stream response - for full seeking support (Range headers), 
            // we'd need more complex logic, but this works for basic src="" playback in modern browsers.

            // Note: Next.js App Router streaming is tricky. 
            // We'll use the Node stream but pass it to the response efficiently.

            const fileStream = createReadStream(filePath)

            // @ts-ignore - ReadableStream/Node stream mismatch types in Next/TS often conflict but work
            return new NextResponse(fileStream, {
                headers: {
                    'Content-Type': video.mimeType,
                    'Content-Length': stats.size.toString(),
                }
            })

        } catch (e) {
            return new NextResponse('File not found on disk', { status: 404 })
        }

    } catch (e) {
        console.error('Stream error:', e)
        return new NextResponse('Internal Error', { status: 500 })
    }
}
