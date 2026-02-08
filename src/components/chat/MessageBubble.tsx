'use client'

import ReactMarkdown from 'react-markdown'
import { User, ExternalLink, Check, AlertCircle, Search, FileText, List, Pencil, EyeOff } from 'lucide-react'
import type { UIMessage } from 'ai'

export function MessageBubble({ message }: { message: UIMessage }) {
    const isUser = message.role === 'user'

    return (
        <div className="flex gap-3">
            {/* Avatar */}
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                isUser
                    ? 'bg-slate-700 border border-slate-600'
                    : 'bg-primary-600/20 border border-primary-500/30'
            }`}>
                {isUser ? (
                    <User className="w-4 h-4 text-slate-300" />
                ) : (
                    <span className="text-primary-400 text-xs font-bold">C</span>
                )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                <div className="text-xs text-slate-500 mb-1">
                    {isUser ? 'You' : 'Canopticon'}
                </div>

                {/* Render message parts */}
                <div className="space-y-2">
                    {message.parts.map((part, index) => {
                        // Text parts
                        if (part.type === 'text') {
                            if (!part.text) return null
                            return (
                                <div key={index} className={isUser
                                    ? 'text-white'
                                    : 'prose prose-invert prose-sm max-w-none'
                                }>
                                    {isUser ? (
                                        <p className="whitespace-pre-wrap">{part.text}</p>
                                    ) : (
                                        <ReactMarkdown>{part.text}</ReactMarkdown>
                                    )}
                                </div>
                            )
                        }

                        // Tool invocation parts (type starts with "tool-")
                        if (part.type.startsWith('tool-')) {
                            return <ToolPartDisplay key={index} part={part as any} />
                        }

                        return null
                    })}
                </div>
            </div>
        </div>
    )
}

interface ToolPart {
    type: string
    toolCallId: string
    state: string
    input?: Record<string, unknown>
    output?: unknown
}

function ToolPartDisplay({ part }: { part: ToolPart }) {
    // Extract tool name from the type (e.g., "tool-search_web" → "search_web")
    const toolName = part.type.replace('tool-', '')

    const toolLabels: Record<string, string> = {
        search_web: 'Searching the web',
        publish_article: 'Publishing article',
        list_articles: 'Listing articles',
        edit_article: 'Editing article',
        unpublish_article: 'Unpublishing article',
    }

    const label = toolLabels[toolName] || toolName

    // Still running (input-streaming or input-available)
    if (part.state === 'input-streaming' || part.state === 'input-available') {
        return (
            <div className="flex items-center gap-2 text-sm text-slate-400 bg-white/5 rounded-lg px-3 py-2 border border-white/5">
                <div className="animate-spin w-3.5 h-3.5 border-2 border-slate-500 border-t-primary-400 rounded-full" />
                <span>{label}...</span>
            </div>
        )
    }

    // Completed with output
    const result = part.output as any

    if (part.state === 'output-available') {
        if (toolName === 'publish_article' && result?.success) {
            return (
                <div className="flex items-center gap-2 text-sm bg-emerald-500/10 text-emerald-400 rounded-lg px-3 py-2 border border-emerald-500/20">
                    <Check className="w-3.5 h-3.5" />
                    <span>Published: {result.article?.title}</span>
                    <a
                        href={result.article?.url}
                        target="_blank"
                        rel="noopener"
                        className="ml-auto hover:text-emerald-300 transition-colors"
                    >
                        <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                </div>
            )
        }

        if (toolName === 'search_web' && result?.success) {
            return (
                <div className="flex items-center gap-2 text-sm text-blue-400 bg-blue-500/10 rounded-lg px-3 py-2 border border-blue-500/20">
                    <Check className="w-3.5 h-3.5" />
                    <span>Web search complete</span>
                </div>
            )
        }

        if (toolName === 'list_articles' && result?.articles) {
            return (
                <div className="text-sm bg-white/5 rounded-lg px-3 py-2 border border-white/5">
                    <div className="flex items-center gap-2 text-slate-400">
                        <List className="w-3.5 h-3.5" />
                        <span>{result.count} article{result.count !== 1 ? 's' : ''} found</span>
                    </div>
                </div>
            )
        }

        if (result?.error || result?.success === false) {
            return (
                <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2 border border-red-500/20">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>{result.error || 'Operation failed'}</span>
                </div>
            )
        }

        // Generic success
        return (
            <div className="flex items-center gap-2 text-sm text-slate-400 bg-white/5 rounded-lg px-3 py-2 border border-white/5">
                <Check className="w-3.5 h-3.5" />
                <span>{label} complete</span>
            </div>
        )
    }

    if (part.state === 'output-error') {
        return (
            <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2 border border-red-500/20">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{label} failed</span>
            </div>
        )
    }

    // Fallback - still processing
    return (
        <div className="flex items-center gap-2 text-sm text-slate-400 bg-white/5 rounded-lg px-3 py-2 border border-white/5">
            <div className="animate-spin w-3.5 h-3.5 border-2 border-slate-500 border-t-primary-400 rounded-full" />
            <span>{label}...</span>
        </div>
    )
}
