import { NextResponse } from 'next/server'
import { fetchViralFeed } from '@/lib/ingestion/viral-fetcher'

export async function GET() {
    try {
        const posts = await fetchViralFeed(30)
        return NextResponse.json({ posts })
    } catch (error: any) {
        return NextResponse.json(
            { error: 'Failed to fetch viral feed', details: error.message },
            { status: 500 }
        )
    }
}
