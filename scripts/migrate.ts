/**
 * Migration: add automation_id to articles
 *
 * Usage (requires DATABASE_URL env var):
 *   DATABASE_URL="postgresql://..." npx tsx scripts/migrate.ts
 *
 * Or pull Vercel env vars first:
 *   npx vercel env pull .env.local
 *   npx tsx scripts/migrate.ts
 */
import postgres from 'postgres'

const url = process.env.DATABASE_URL
if (!url) {
    console.error('❌ DATABASE_URL not set. Run: npx vercel env pull .env.local first.')
    process.exit(1)
}

const sql = postgres(url, { max: 1, ssl: 'require' })

async function run() {
    console.log('Running migration: add automation_id to articles...')
    await sql`
        ALTER TABLE articles
        ADD COLUMN IF NOT EXISTS automation_id UUID
        REFERENCES automations(id)
        ON DELETE SET NULL
    `
    console.log('✓ Done. automation_id column added to articles.')
    await sql.end()
}

run().catch(e => { console.error(e); process.exit(1) })
