import { NextRequest, NextResponse } from 'next/server'
import { db, subscribers } from '@/db'
import { eq } from 'drizzle-orm'
import { sendConfirmationEmail, sendWelcomeEmail } from '@/lib/email'
import { v4 as uuidv4 } from 'uuid'

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

        const token = uuidv4()

        // Check for existing subscription
        const existing = await db
            .select()
            .from(subscribers)
            .where(eq(subscribers.email, email.toLowerCase()))
            .limit(1)

        if (existing.length > 0) {
            const subscriber = existing[0]
            if (subscriber.status === 'unsubscribed') {
                // Re-subscribe with new confirmation token
                await db
                    .update(subscribers)
                    .set({
                        status: 'pending',
                        source,
                        confirmationToken: token,
                        confirmedAt: null
                    })
                    .where(eq(subscribers.id, subscriber.id))

                try {
                    await sendConfirmationEmail(email.toLowerCase(), token)
                } catch (e) {
                    console.error('Error sending confirmation email:', e)
                }

                return NextResponse.json({
                    success: true,
                    message: 'Welcome back! Please check your email to confirm.',
                })
            } else if (subscriber.status === 'pending') {
                // Resend confirmation
                await db
                    .update(subscribers)
                    .set({ confirmationToken: token })
                    .where(eq(subscribers.id, subscriber.id))

                try {
                    await sendConfirmationEmail(email.toLowerCase(), token)
                } catch (e) {
                    console.error('Error sending confirmation email:', e)
                }

                return NextResponse.json({
                    success: true,
                    message: 'Confirmation email resent. Please check your inbox.',
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
            confirmationToken: token,
        })

        // Send confirmation email (double opt-in)
        try {
            await sendConfirmationEmail(email.toLowerCase(), token)
        } catch (e) {
            console.error('Error sending confirmation email:', e)
            // Still return success so UI shows message
        }

        return NextResponse.json({
            success: true,
            message: 'Please check your email to confirm your subscription.',
        })

    } catch (error) {
        console.error('Subscription error:', error)
        return NextResponse.json(
            { error: 'Failed to process subscription' },
            { status: 500 }
        )
    }
}
