import { NextRequest, NextResponse } from 'next/server'
import { db, subscribers } from '@/db'
import { eq } from 'drizzle-orm'
import { sendWelcomeEmail } from '@/lib/email'

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams
    const token = searchParams.get('token')

    if (!token) {
        return NextResponse.json({ error: 'Missing token' }, { status: 400 })
    }

    try {
        // Find subscriber with this token
        const existing = await db
            .select()
            .from(subscribers)
            .where(eq(subscribers.confirmationToken, token))
            .limit(1)

        if (existing.length === 0) {
            return NextResponse.json({ error: 'Invalid or expired token' }, { status: 400 })
        }

        const subscriber = existing[0]

        // Update status to subscribed
        await db
            .update(subscribers)
            .set({
                status: 'subscribed',
                confirmedAt: new Date(),
                confirmationToken: null // Clear token after use
            })
            .where(eq(subscribers.id, subscriber.id))

        // Send final welcome email
        try {
            await sendWelcomeEmail(subscriber.email)
        } catch (e) {
            console.error('Error sending welcome email:', e)
        }

        // Redirect to homepage with success message
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://canopticon.com'
        return NextResponse.redirect(`${siteUrl}/?confirmed=true`)

    } catch (error) {
        console.error('Confirmation error:', error)
        return NextResponse.json(
            { error: 'Failed to confirm subscription' },
            { status: 500 }
        )
    }
}
