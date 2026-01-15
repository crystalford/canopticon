'use client'

import { useState } from 'react'
import { Search, BrainCircuit, Terminal, FileText, ChevronRight, X } from 'lucide-react'
import ReactMarkdown from 'react-markdown'

interface ForensicToolProps {
    editorContent: string
    headline: string
}

export default function ForensicTool({ editorContent, headline }: ForensicToolProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [status, setStatus] = useState<'idle' | 'scanning' | 'researching' | 'analyzing' | 'complete'>('idle')
    const [logs, setLogs] = useState<string[]>([])
    const [result, setResult] = useState<string>('')

    const addLog = (msg: string) => setLogs(prev => [...prev, `> ${msg}`])

    const handleRunAnalysis = async () => {
        setIsOpen(true)
        setStatus('scanning')
        setLogs(['> Initializing Forensic Module...'])
        setResult('')

        try {
            // Extract text from TipTap JSON if needed, for now assuming string or simple parse
            let textToAnalyze = ''
            try {
                const json = JSON.parse(editorContent)
                // Simple extraction (this is rough, but effective for MVP)
                textToAnalyze = JSON.stringify(json)
            } catch {
                textToAnalyze = editorContent
            }

            addLog('Scanning Signal for Entities...')

            // Artificial delay for UI feel (optional, but requested "Terminal style")
            await new Promise(r => setTimeout(r, 800))

            setStatus('researching')
            addLog('Connecting to Intelligence Grid...')
            addLog(`Target: ${headline.slice(0, 30)}...`)

            const res = await fetch('/api/articles/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: textToAnalyze, headline })
            })

            setStatus('analyzing')
            addLog('Compiling Forensic Report...')

            if (!res.ok) throw new Error('Analysis Protocol Failed')

            const data = await res.json()
            setResult(data.analysis)
            addLog('Report Generated Successfully.')
            setStatus('complete')

        } catch (e) {
            console.error(e)
            addLog('ERROR: Connection Severed.')
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
                            onClick={() => {
                                // Logic to save as new draft could go here
                                alert('Feature coming soon: Save as Response')
                            }}
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
