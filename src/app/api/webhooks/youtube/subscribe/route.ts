import { NextResponse } from 'next/server'

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url)
    const channelId = searchParams.get('channelId')

    if (!channelId) {
        return NextResponse.json({ error: 'Missing channelId' }, { status: 400 })
    }

    // Determine the callback URL
    // In production on Vercel, use the system env or hardcode domain logic?
    // VERCEL_URL is available but lacks protocol.
    const scheme = process.env.NODE_ENV === 'development' ? 'http' : 'https'
    const host = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL || 'canopticon.com'
    // Ensure host doesn't have protocol
    const cleanHost = host.replace(/^https?:\/\//, '')
    const callbackUrl = `${scheme}://${cleanHost}/api/webhooks/youtube`

    const topicUrl = `https://www.youtube.com/xml/feeds/videos.xml?channel_id=${channelId}`
    const hubUrl = 'https://pubsubhubbub.appspot.com/subscribe'

    console.log(`[subscribe] Subscribing to ${topicUrl}`)
    console.log(`[subscribe] Callback: ${callbackUrl}`)

    try {
        const formData = new URLSearchParams()
        formData.append('hub.callback', callbackUrl)
        formData.append('hub.topic', topicUrl)
        formData.append('hub.verify', 'sync') // sync verification returns result immediately
        formData.append('hub.mode', 'subscribe')
        // formData.append('hub.lease_seconds', '864000') // 10 days (max is usually 10 days?)

        const res = await fetch(hubUrl, {
            method: 'POST',
            body: formData,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        })

        const text = await res.text()

        if (!res.ok) {
            console.error('[subscribe] Failed:', text)
            return NextResponse.json({ error: 'Hub subscription failed', details: text }, { status: res.status })
        }

        return NextResponse.json({ success: true, message: 'Subscribed successfully', hubResponse: text })

    } catch (error) {
        console.error('[subscribe] Error:', error)
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 })
    }
}
