import { Editor } from '@tiptap/react'
import { Sparkles, Scissors, Minimize2, Maximize2, CheckCheck, BookOpen, Loader2, MousePointer2 } from 'lucide-react'
import { useState, useEffect } from 'react'

interface AiToolbarProps {
    editor: Editor
}

export default function AiToolbar({ editor }: AiToolbarProps) {
    const [loading, setLoading] = useState<string | null>(null)
    const [hasSelection, setHasSelection] = useState(false)

    useEffect(() => {
        if (!editor) return

        const updateSelection = () => {
            const { from, to } = editor.state.selection
            setHasSelection(to > from)
        }

        editor.on('selectionUpdate', updateSelection)
        // Initial check
        updateSelection()

        return () => {
            editor.off('selectionUpdate', updateSelection)
        }
    }, [editor])

    const handleAiAction = async (task: string) => {
        const { from, to } = editor.state.selection
        const text = editor.state.doc.textBetween(from, to)

        // Prevent action if no selection (redundant check but safe)
        if (!hasSelection || !text || text.length < 5) return

        setLoading(task)

        try {
            const res = await fetch('/api/ai/enhance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text,
                    task,
                    context: editor.getText().slice(0, 1000)
                })
            })

            const data = await res.json()

            if (data.result) {
                editor.chain().focus().insertContentAt({ from, to }, data.result).run()
            }
        } catch (err) {
            console.error(err)
            alert('AI Enhancement Failed')
        } finally {
            setLoading(null)
        }
    }

    return (
        <div className="flex items-center gap-1 p-1 mb-2 bg-primary-500/5 border border-primary-500/10 rounded-lg animate-in fade-in slide-in-from-bottom-2">
            <div className="flex items-center gap-2 px-2 border-r border-primary-500/10 mr-1 min-w-[120px]">
                <Sparkles className={`w-3 h-3 ${hasSelection ? 'text-primary-400' : 'text-slate-600'}`} />
                <span className={`text-[10px] font-bold uppercase tracking-wider ${hasSelection ? 'text-primary-400' : 'text-slate-600'}`}>
                    {hasSelection ? 'AI Ready' : 'Select Text'}
                </span>
            </div>

            <AiButton
                onClick={() => handleAiAction('fix_grammar')}
                icon={CheckCheck}
                label="Fix Grammar"
                loading={loading === 'fix_grammar'}
                disabled={!hasSelection}
            />
            <div className="w-px h-3 bg-primary-500/10 mx-1" />
            <AiButton
                onClick={() => handleAiAction('shorten')}
                icon={Minimize2}
                label="Shorten"
                loading={loading === 'shorten'}
                disabled={!hasSelection}
            />
            <AiButton
                onClick={() => handleAiAction('simplify')}
                icon={BookOpen}
                label="Simplify"
                loading={loading === 'simplify'}
                disabled={!hasSelection}
            />
            <AiButton
                onClick={() => handleAiAction('improve_writing')}
                icon={Sparkles}
                label="Improve"
                loading={loading === 'improve_writing'}
                disabled={!hasSelection}
            />
            <div className="w-px h-3 bg-primary-500/10 mx-1" />
            <AiButton
                onClick={() => handleAiAction('expand')}
                icon={Maximize2}
                label="Expand"
                loading={loading === 'expand'}
                disabled={!hasSelection}
            />
        </div>
    )
}

function AiButton({ onClick, icon: Icon, label, loading, disabled }: any) {
    return (
        <button
            onClick={onClick}
            disabled={disabled || loading}
            className={`
                flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded transition-colors
                ${disabled
                    ? 'text-slate-600 cursor-not-allowed opacity-50'
                    : 'text-primary-300 hover:text-white hover:bg-primary-500/20'
                }
            `}
            title={disabled ? "Select text to use this tool" : label}
        >
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Icon className="w-3 h-3" />}
            {label}
        </button>
    )
}
