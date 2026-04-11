import { useState } from 'react'
import { Send, X, AlertCircle, Smile, Trash2, Plus } from 'lucide-react'
import { Twitter } from 'lucide-react'

interface ThreadPreviewProps {
    initialTweets: string[]
    topic?: string
    onPosted?: () => void
}

export function ThreadPreview({ initialTweets, topic, onPosted }: ThreadPreviewProps) {
    const [tweets, setTweets] = useState<string[]>(initialTweets)
    const [posting, setPosting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [successUrl, setSuccessUrl] = useState<string | null>(null)

    const handleTweetChange = (index: number, val: string) => {
        const newTweets = [...tweets]
        newTweets[index] = val
        setTweets(newTweets)
    }

    const removeTweet = (index: number) => {
        setTweets(tweets.filter((_, i) => i !== index))
    }

    const addTweet = () => {
        setTweets([...tweets, ''])
    }

    const stripEmojis = () => {
        // Regex to strip emojis
        const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu
        const cleaned = tweets.map(t => t.replace(emojiRegex, '').replace(/\s+/g, ' ').trim())
        setTweets(cleaned)
    }

    const handlePost = async () => {
        setPosting(true)
        setError(null)
        try {
            const res = await fetch('/api/twitter/post', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tweets })
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Failed to post')

            setSuccessUrl(data.threadUrl)
            if (onPosted) onPosted()
        } catch (err: any) {
            setError(err.message)
        } finally {
            setPosting(false)
        }
    }

    if (successUrl) {
        return (
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                <div className="flex items-center gap-2 text-green-400 font-medium mb-2">
                    <Twitter className="w-4 h-4" />
                    Thread Posted Successfully!
                </div>
                <a
                    href={successUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-green-300 hover:underline flex items-center gap-1"
                >
                    View on X <Send className="w-3 h-3" />
                </a>
            </div>
        )
    }

    return (
        <div className="bg-slate-900/50 border border-slate-700 rounded-lg overflow-hidden mt-2 max-w-md">
            <div className="bg-slate-800/50 px-4 py-2 border-b border-slate-700 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold text-sky-400">
                    <Twitter className="w-3.5 h-3.5" />
                    <span>Thread Preview {topic ? `- ${topic}` : ''}</span>
                </div>
                <button
                    onClick={stripEmojis}
                    className="text-[10px] bg-slate-700 hover:bg-slate-600 text-slate-300 px-2 py-1 rounded flex items-center gap-1 transition-colors"
                    title="Remove all emojis"
                >
                    <Smile className="w-3 h-3" /> No Emojis
                </button>
            </div>

            <div className="p-4 space-y-4">
                {tweets.map((tweet, i) => {
                    const len = tweet.length
                    const isLong = len > 280
                    return (
                        <div key={i} className="relative group">
                            <div className="flex items-baseline justify-between mb-1">
                                <span className="text-[10px] text-slate-500 font-mono">{i + 1}/{tweets.length}</span>
                                <span className={`text-[10px] ${isLong ? 'text-red-400 font-bold' : 'text-slate-500'}`}>
                                    {len}/280
                                </span>
                            </div>
                            <textarea
                                value={tweet}
                                onChange={e => handleTweetChange(i, e.target.value)}
                                className={`w-full bg-black/20 text-sm text-slate-200 rounded p-2 min-h-[80px] border focus:outline-none focus:ring-1 transition-all resize-y ${isLong ? 'border-red-500/50 focus:ring-red-500' : 'border-slate-700 focus:ring-sky-500/50'}`}
                            />
                            {tweets.length > 1 && (
                                <button
                                    onClick={() => removeTweet(i)}
                                    className="absolute -right-2 -top-2 bg-slate-800 text-slate-400 hover:text-red-400 p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity border border-slate-700"
                                >
                                    <Trash2 className="w-3 h-3" />
                                </button>
                            )}
                        </div>
                    )
                })}

                <button
                    onClick={addTweet}
                    className="w-full py-2 border border-dashed border-slate-700 rounded text-slate-500 text-xs hover:bg-slate-800/50 hover:text-slate-300 transition-colors flex items-center justify-center gap-1"
                >
                    <Plus className="w-3 h-3" /> Add Tweet
                </button>

                {error && (
                    <div className="text-red-400 text-xs bg-red-500/10 p-2 rounded flex items-center gap-2">
                        <AlertCircle className="w-3 h-3" />
                        {error}
                    </div>
                )}
            </div>

            <div className="bg-slate-800/50 px-4 py-3 border-t border-slate-700 flex justify-end">
                <button
                    onClick={handlePost}
                    disabled={posting || tweets.some(t => t.length > 280) || tweets.length === 0}
                    className="bg-sky-500 hover:bg-sky-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold px-4 py-2 rounded flex items-center gap-2 transition-all shadow-lg shadow-sky-500/20"
                >
                    {posting ? 'Posting...' : 'Post to X'}
                    <Send className="w-3 h-3" />
                </button>
            </div>
        </div>
    )
}
