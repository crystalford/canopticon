'use client'

import { useState } from 'react'
import { Search, BrainCircuit, Terminal, FileText, ChevronRight, X } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { useRouter } from 'next/navigation'

interface ForensicToolProps {
    editorContent: string
    headline: string
    articleId?: string
}

export default function ForensicTool({ editorContent, headline, articleId }: ForensicToolProps) {
    const router = useRouter()
    const [isOpen, setIsOpen] = useState(false)
    const [status, setStatus] = useState<'idle' | 'scanning' | 'researching' | 'analyzing' | 'complete' | 'creating'>('idle')
    const [logs, setLogs] = useState<string[]>([])
    const [result, setResult] = useState<string>('')

    const addLog = (msg: string) => setLogs(prev => [...prev, `> ${msg}`])

    const handleRunAnalysis = async () => {
        setIsOpen(true)
        setStatus('scanning')
        setLogs(['> Initializing Forensic Module...'])
        setResult('')

        try {
            // Extract text
            let textToAnalyze = ''
            try {
                const json = JSON.parse(editorContent)
                textToAnalyze = JSON.stringify(json)
            } catch {
                textToAnalyze = editorContent
            }

            // Step 1: Scanning
            addLog('Scanning Signal for Anomalies...')
            addLog('> Generating Investigative Queries (Agent: Claude-3-Haiku)...')

            setStatus('researching')

            // We do the whole chain in one API call for atomicity, but the backend does the steps.
            // Ideally we'd stream status, but simple fetch is safer for now.
            addLog('Connecting to Intelligence Grid...')

            const res = await fetch('/api/articles/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: textToAnalyze, headline })
            })

            setStatus('analyzing')

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}))
                throw new Error(errorData.error || 'Analysis Protocol Failed')
            }

            const data = await res.json()

            // Retroactively show what happened (Pseudo-stream)
            if (data.steps && data.steps.queries) {
                data.steps.queries.forEach((q: string) => addLog(`> Investigating: "${q}"...`))
            }
            addLog(`> Intercepted ${data.steps?.researchSize || 0} bytes of Intelligence.`)
            addLog('Compiling Forensic Report (Agent: Claude-3-Opus)...')

            setResult(data.analysis)
            addLog('Report Generated Successfully.')
            setStatus('complete')

        } catch (e: any) {
            console.error(e)
            addLog(`ERROR: ${e.message}`)
            setStatus('idle')
        }
    }

    const handleCopy = () => {
        navigator.clipboard.writeText(result)
        alert('Copied to Clipboard')
    }

    if (!isOpen) {
        return (
            <button
                onClick={handleRunAnalysis}
                className="w-full flex items-center gap-3 p-4 rounded-xl border border-primary-500/30 bg-primary-900/10 hover:bg-primary-900/20 text-primary-400 transition-all group shadow-[0_0_20px_rgba(14,165,233,0.1)] hover:shadow-[0_0_30px_rgba(14,165,233,0.2)] mt-6"
            >
                <div className="w-10 h-10 rounded-lg bg-primary-500/20 flex items-center justify-center border border-primary-500/30 group-hover:scale-110 transition-transform">
                    <BrainCircuit className="w-6 h-6" />
                </div>
                <div className="text-left">
                    <div className="font-bold text-white">Forensic Deep Dive</div>
                    <div className="text-xs text-primary-400/70">Generate investigative response</div>
                </div>
            </button>
        )
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="w-full max-w-4xl h-[80vh] flex flex-col bg-black border border-white/10 rounded-2xl shadow-2xl overflow-hidden relative">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-white/10 bg-white/5">
                    <div className="flex items-center gap-3">
                        <Terminal className="w-5 h-5 text-primary-500" />
                        <span className="font-mono text-primary-500 font-bold tracking-wider">CANOPTICON // FORENSIC_MODULE</span>
                    </div>
                    <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="flex-1 flex flex-col md:flex-row min-h-0">
                    {/* Terminal / Logs Sidebar */}
                    <div className="w-full md:w-1/3 bg-black p-6 font-mono text-xs border-r border-white/10 overflow-y-auto">
                        <div className="space-y-2">
                            {logs.map((log, i) => (
                                <div key={i} className={`${i === logs.length - 1 ? 'text-green-400 animate-pulse' : 'text-slate-500'}`}>
                                    {log}
                                </div>
                            ))}
                            {status === 'researching' && <div className="text-primary-500 mt-4">Running Google News query...</div>}
                            {status === 'analyzing' && <div className="text-primary-500 mt-4">Claude Opus processing...</div>}
                        </div>
                    </div>

                    {/* Content Area */}
                    <div className="flex-1 bg-slate-900 p-8 overflow-y-auto prose prose-invert max-w-none">
                        {status === 'complete' && result ? (
                            <div className="animate-in fade-in duration-500">
                                <ReactMarkdown>{result}</ReactMarkdown>
                            </div>
                        ) : (
                            <div className="h-full flex items-center justify-center text-slate-700">
                                <BrainCircuit className="w-24 h-24 animate-pulse opacity-20" />
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer Actions */}
                {status === 'complete' && (
                    <div className="p-4 border-t border-white/10 bg-white/5 flex justify-end gap-3">
                        <button
                            onClick={handleCopy}
                            className="btn-secondary"
                        >
                            Copy to Clipboard
                        </button>
                        <button
                            onClick={async () => {
                                setStatus('creating')
                                addLog('Creating Response Article...')
                                try {
                                    const res = await fetch('/api/articles/create-response', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                            originalArticleId: articleId,
                                            forensicContent: result
                                        })
                                    })
                                    if (!res.ok) throw new Error('Failed to create article')
                                    const data = await res.json()
                                    addLog(`Success! Redirecting to new article...`)
                                    setTimeout(() => {
                                        router.push(`/dashboard/articles/${data.slug}`)
                                    }, 500)
                                } catch (error: any) {
                                    addLog(`ERROR: ${error.message}`)
                                    setStatus('complete')
                                }
                            }}
                            disabled={status === 'creating' || status !== 'complete'}
                            className="btn-primary"
                        >
                            Create Response Article
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}
