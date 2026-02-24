import { NextResponse } from 'next/server'
import { db, articles } from '@/db'
import { eq } from 'drizzle-orm'

export async function GET(
    _req: Request,
    { params }: { params: { id: string } }
) {
    const { id } = params
    try {
        const article = await db.query.articles.findFirst({ where: eq(articles.id, id) })
        if (!article) return NextResponse.json({ error: 'Not found' }, { status: 404 })
        return NextResponse.json(article)
    } catch {
        return NextResponse.json({ error: 'Failed' }, { status: 500 })
    }
}

export async function DELETE(
    _req: Request,
    { params }: { params: { id: string } }
) {
    const { id } = params

    try {
        await db.delete(articles).where(eq(articles.id, id))
        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Failed to delete article:', error)
        return NextResponse.json({ error: 'Failed to delete article' }, { status: 500 })
    }
}
