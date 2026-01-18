
import { Resend } from 'resend'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

const FROM_EMAIL = 'Canopticon Intelligence <intelligence@canopticon.com>' // Ideally configured in env

export async function sendWelcomeEmail(email: string) {
    if (!resend) {
        console.warn('RESEND_API_KEY missing, skipping email.')
        return
    }

    try {
        await resend.emails.send({
            from: FROM_EMAIL,
            to: email,
            subject: 'Welcome to Canopticon Intelligence',
            html: `
                <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto;">
                    <h1 style="color: #0f172a;">Welcome to Canopticon.</h1>
                    <p>You have successfully subscribed to the intelligence brief.</p>
                    <p>You will receive high-signal updates on significant political events as they happen.</p>
                    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
                    <p style="font-size: 12px; color: #64748b;">
                        Canopticon Intelligence
                    </p>
                </div>
            `
        })
    } catch (error) {
        console.error('Failed to send welcome email:', error)
        throw error
    }
}

export async function sendArticleEmail(email: string, article: { headline: string, content: string | null, summary: string }) {
    if (!resend) return

    // Simple HTML conversion for TipTap JSON if specific renderer needed, 
    // but for now relying on summary or pre-processed HTML. 
    // Assuming 'content' might be JSON string, using summary for safety in this MVP 
    // unless we install a proper converter.

    // Using summary for the email body to ensure reliability for now.
    const bodyContent = article.summary.replace(/\n/g, '<br/>')

    await resend.emails.send({
        from: FROM_EMAIL,
        to: email,
        subject: article.headline,
        html: `
            <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto; line-height: 1.6;">
                <div style="margin-bottom: 24px;">
                    <span style="font-size: 12px; font-weight: bold; color: #6366f1; text-transform: uppercase; letter-spacing: 1px;">
                        Intelligence Brief
                    </span>
                    <h1 style="margin-top: 8px; font-size: 24px; color: #0f172a;">${article.headline}</h1>
                    <p style="color: #64748b; font-size: 14px;">
                        ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                </div>
                
                <div style="font-size: 16px; color: #334155;">
                    ${bodyContent}
                </div>

                <div style="margin-top: 40px; padding-top: 24px; border-top: 1px solid #e2e8f0; text-align: center;">
                    <a href="https://canopticon.com" style="color: #6366f1; text-decoration: none; font-size: 14px;">Read more on Canopticon</a>
                </div>
            </div>
        `
    })
}

export async function sendConfirmationEmail(email: string, token: string) {
    if (!resend) return

    const confirmUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://canopticon.com'}/api/subscribe/confirm?token=${token}`

    await resend.emails.send({
        from: FROM_EMAIL,
        to: email,
        subject: 'Confirm your subscription',
        html: `
            <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto;">
                <h1 style="color: #0f172a;">Confirm subscription</h1>
                <p>Please click the link below to confirm your subscription to the Canopticon Intelligence Brief.</p>
                <div style="margin: 24px 0;">
                    <a href="${confirmUrl}" style="background: #0f172a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Confirm Subscription</a>
                </div>
                <p style="font-size: 14px; color: #64748b;">
                    If you didn't request this, you can safely ignore this email.
                </p>
                <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
                <p style="font-size: 12px; color: #64748b;">
                    Canopticon Intelligence
                </p>
            </div>
        `
    })
}
