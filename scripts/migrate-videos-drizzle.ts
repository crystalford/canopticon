import { db } from './src/db'
import { sql } from 'drizzle-orm'

async function run() {
    console.log('Running migration: create video_clips table via Drizzle...')
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS video_clips (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            youtube_url TEXT NOT NULL,
            start_seconds INTEGER,
            end_seconds INTEGER,
            clip_rationale TEXT,
            status TEXT NOT NULL DEFAULT 'queued',
            error_message TEXT,
            clip_url TEXT,
            x_post_id TEXT,
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
    `)
    console.log('✓ Done. video_clips table created.')
    process.exit(0)
}

run().catch(e => { console.error(e); process.exit(1) })
