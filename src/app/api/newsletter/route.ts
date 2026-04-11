import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
    try {
        const { email } = await request.json()

        // Basic email validation
        if (!email || !email.includes('@')) {
            return NextResponse.json(
                { error: 'Invalid email address' },
                { status: 400 }
            )
        }

        // For now, just log the subscription
        // Future: integrate with email service (ConvertKit, Mailchimp, etc.)
        console.log('Newsletter subscription:', email)

        // TODO: Store in database or send to email service

        return NextResponse.json(
            { success: true, message: 'Successfully subscribed!' },
            { status: 200 }
        )
    } catch (error) {
        console.error('Newsletter subscription error:', error)
        return NextResponse.json(
            { error: 'Failed to subscribe' },
            { status: 500 }
        )
    }
}
