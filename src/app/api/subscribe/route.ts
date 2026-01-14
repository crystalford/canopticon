import { NextRequest, NextResponse } from 'next/server'
import { db, subscribers } from '@/db'
import { eq } from 'drizzle-orm'

/**
 * Newsletter Subscription API
 * From 11_NEWSLETTER_AND_PUBLIC_SIGNUP
 */

// Simple email validation
function isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { email, source = 'homepage' } = body

        // Validate email
        if (!email || typeof email !== 'string') {
            return NextResponse.json(
                { error: 'Email is required' },
                { status: 400 }
            )
        }

        if (!isValidEmail(email)) {
            return NextResponse.json(
                { error: 'Invalid email format' },
                { status: 400 }
            )
        }

        // Check for existing subscription
        const existing = await db
            .select()
            .from(subscribers)
            .where(eq(subscribers.email, email.toLowerCase()))
            .limit(1)

        if (existing.length > 0) {
            const subscriber = existing[0]
            if (subscriber.status === 'unsubscribed') {
                // Re-subscribe
                await db
                    .update(subscribers)
                    .set({ status: 'pending', source })
                    .where(eq(subscribers.id, subscriber.id))

                return NextResponse.json({
                    success: true,
                    message: 'Welcome back! Please check your email to confirm.',
                })
            }

            return NextResponse.json({
                success: true,
                message: 'You are already subscribed.',
            })
        }

        // Create new subscription
        await db.insert(subscribers).values({
            email: email.toLowerCase(),
            status: 'pending',
            source,
        })

        // TODO: Send confirmation email (double opt-in)
        // For Phase 1, we'll auto-confirm
        await db
            .update(subscribers)
            .set({ status: 'subscribed', confirmedAt: new Date() })
            .where(eq(subscribers.email, email.toLowerCase()))

        return NextResponse.json({
            success: true,
            message: 'Successfully subscribed to updates!',
        })

    } catch (error) {
        console.error('Subscription error:', error)
        return NextResponse.json(
            { error: 'Failed to process subscription' },
            { status: 500 }
        )
    }
}
