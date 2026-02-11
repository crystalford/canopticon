'use client'

import { SocialMonitorView } from '@/components/social/SocialMonitorView'
import { useRouter } from 'next/navigation'

export default function SocialPage() {
    const router = useRouter()

    const handleEngage = (tweet: any) => {
        const prompt = `Draft a reply to this tweet from ${tweet.authorHandle}: "${tweet.content}"`
        router.push(`/chat?initialInput=${encodeURIComponent(prompt)}`)
    }

    return (
        <div className="h-full bg-black/20">
            <SocialMonitorView onEngage={handleEngage} />
        </div>
    )
}
