
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { uploadedVideos } from '@/db/schema'
import { writeFile } from 'fs/promises'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData()
        const file = formData.get('file') as File | null

        if (!file) {
            return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
        }

        const buffer = Buffer.from(await file.arrayBuffer())
        const originalName = file.name
        const mimeType = file.type
        const size = file.size

        // Generate safe filename
        const ext = path.extname(originalName)
        const filename = `${uuidv4()}${ext}`
        const uploadDir = path.join(process.cwd(), 'private_uploads')
        const filePath = path.join(uploadDir, filename)

        // Write to disk
        await writeFile(filePath, buffer)

        // Save to DB
        const [video] = await db.insert(uploadedVideos).values({
            filename,
            originalName,
            mimeType,
            size
        }).returning()

        return NextResponse.json({ success: true, video })

    } catch (e: any) {
        console.error('Upload error:', e)
        return NextResponse.json({ error: 'Upload failed: ' + e.message }, { status: 500 })
    }
}
