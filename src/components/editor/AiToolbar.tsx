import { Editor } from '@tiptap/react'
import { Sparkles, Scissors, Minimize2, Maximize2, CheckCheck, BookOpen, Loader2 } from 'lucide-react'
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
        return () => {
            editor.off('selectionUpdate', updateSelection)
        }
    }, [editor])

    const handleAiAction = async (task: string) => {
        const { from, to } = editor.state.selection
        const text = editor.state.doc.textBetween(from, to)

        if (!text || text.length < 5) return

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

    if (!hasSelection) return null

    return (
        <div className="flex items-center gap-1 p-1 mb-2 bg-primary-500/10 border border-primary-500/20 rounded-lg animate-in fade-in slide-in-from-bottom-2">
            <span className="px-2 text-[10px] font-bold text-primary-400 uppercase tracking-wider">AI Tools:</span>
            <AiButton
                onClick={() => handleAiAction('fix_grammar')}
                icon={CheckCheck}
                label="Fix Grammar"
                loading={loading === 'fix_grammar'}
            />
            <div className="w-px h-3 bg-primary-500/20 mx-1" />
            <AiButton
                onClick={() => handleAiAction('shorten')}
                icon={Minimize2}
                label="Shorten"
                loading={loading === 'shorten'}
            />
            <AiButton
                onClick={() => handleAiAction('simplify')}
                icon={BookOpen}
                label="Simplify"
                loading={loading === 'simplify'}
            />
            <AiButton
                onClick={() => handleAiAction('improve_writing')}
                icon={Sparkles}
                label="Improve"
                loading={loading === 'improve_writing'}
            />
            <div className="w-px h-3 bg-primary-500/20 mx-1" />
            <AiButton
                onClick={() => handleAiAction('expand')}
                icon={Maximize2}
                label="Expand"
                loading={loading === 'expand'}
            />
        </div>
    )
}

function AiButton({ onClick, icon: Icon, label, loading }: any) {
    return (
        <button
            onClick={onClick}
            disabled={loading}
            className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-primary-300 hover:text-white hover:bg-primary-500/20 rounded transition-colors disabled:opacity-50"
        >
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Icon className="w-3 h-3" />}
            {label}
        </button>
    )
}
