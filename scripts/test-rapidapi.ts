import dotenv from 'dotenv'
dotenv.config()

async function testRapidApi() {
    const rapidApiKey = process.env.RAPIDAPI_KEY
    if (!rapidApiKey) {
        console.error('❌ Error: RAPIDAPI_KEY is missing in .env')
        process.exit(1)
    }

    const videoUrl = 'https://www.youtube.com/watch?v=brRN9OT6GL8'
    const start = 10
    const end = 20

    console.log(`[Test] Requesting clip from RapidAPI: ${videoUrl} (${start}s-${end}s)...`)

    const urlParams = new URLSearchParams({
        url: videoUrl,
        start: start.toString(),
        end: end.toString()
    })

    try {
        const res = await fetch(`https://social-media-video-clipp.p.rapidapi.com/video-clip?${urlParams}`, {
            method: 'GET',
            headers: {
                'x-rapidapi-key': rapidApiKey,
                'x-rapidapi-host': 'social-media-video-clipp.p.rapidapi.com'
            }
        })

        if (!res.ok) {
            const err = await res.text()
            throw new Error(`RapidAPI returned ${res.status}: ${err}`)
        }

        const data = await res.json()
        console.log('✅ RapidAPI Success!')
        console.log('Response body:', JSON.stringify(data, null, 2))

        const finalUrl = data.url || data.video_url
        if (finalUrl) {
            console.log(`🔗 Clip URL: ${finalUrl}`)
        } else {
            console.warn('⚠️ Warning: Success but no URL found in response.')
        }

    } catch (e: any) {
        console.error('❌ Test Failed:', e.message)
    }
}

testRapidApi()
