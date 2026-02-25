import postgres from 'postgres'

const url = process.env.DATABASE_URL
if (!url) {
    console.error('❌ DATABASE_URL not set.')
    process.exit(1)
}

const sql = postgres(url, { max: 1, ssl: 'require' })

async function run() {
    console.log('Running migration: create video_clips table...')
    await sql`
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
    `
    console.log('✓ Done. video_clips table created.')
    await sql.end()
}

run().catch(e => { console.error(e); process.exit(1) })
