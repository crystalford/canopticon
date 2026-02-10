'use client'

import { useState } from 'react'
import { Edit, Trash2, UserCog, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface ArticleActionsProps {
    articleId: string
    slug: string
    status: 'draft' | 'published'
}

export function ArticleActions({ articleId, slug, status }: ArticleActionsProps) {
    const router = useRouter()
    const [isDeleting, setIsDeleting] = useState(false)

    const handleDelete = async () => {
        if (!confirm('Are you sure you want to delete this article? This cannot be undone.')) return
        setIsDeleting(true)
        try {
            const res = await fetch(`/api/articles/${articleId}`, { method: 'DELETE' })
            if (!res.ok) throw new Error('Failed to delete')
            router.refresh()
        } catch (error) {
            console.error('Failed to delete article:', error)
            alert('Failed to delete article')
        } finally {
            setIsDeleting(false)
        }
    }

    return (
        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            {status === 'published' && (
                <Link
                    href={`/articles/${slug}`}
                    target="_blank"
                    className="p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors"
                    title="View Public Page"
                >
                    <ExternalLink size={16} />
                </Link>
            )}

            <Link
                href={`/chat?edit=${articleId}`}
                className={`p-2 hover:bg-white/10 rounded-lg transition-colors ${status === 'draft' ? 'text-white' : 'text-slate-400 hover:text-white'}`}
                title="Edit Article"
            >
                <Edit size={16} />
            </Link>

            <Link
                href={`/chat?mode=editor&review=${articleId}`}
                className="p-2 hover:bg-white/10 rounded-lg text-purple-400 hover:text-purple-300 transition-colors"
                title="Review with Editor"
            >
                <UserCog size={16} />
            </Link>

            <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="p-2 hover:bg-red-500/10 rounded-lg text-slate-400 hover:text-red-400 transition-colors disabled:opacity-50"
                title="Delete Article"
            >
                <Trash2 size={16} />
            </button>
        </div>
    )
}
