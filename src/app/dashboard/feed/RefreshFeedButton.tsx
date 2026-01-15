'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw, Loader2 } from 'lucide-react'

export default function RefreshFeedButton() {
    const router = useRouter()
    const [loading, setLoading] = useState(false)

    const handleRefresh = async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/feed/refresh', { method: 'POST' })
            if (res.ok) {
                const data = await res.json()
                // Optional: Show toast with stats
                console.log('Refresh stats:', data.stats)
                router.refresh()
            } else {
                alert('Refresh failed')
            }
        } catch (e) {
            console.error(e)
            alert('Refresh failed')
        } finally {
            setLoading(false)
        }
    }

    return (
        <button
            onClick={handleRefresh}
            disabled={loading}
            className="btn-secondary min-w-[140px] justify-center"
        >
            {loading ? (
                <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Fetching...
                </>
            ) : (
                <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Refresh Feed
                </>
            )}
        </button>
    )
}
