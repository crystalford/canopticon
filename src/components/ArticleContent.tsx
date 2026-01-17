'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import LinkExtension from '@tiptap/extension-link'
import ImageExtension from '@tiptap/extension-image'
import { SimpleIframe } from './editor/extensions/SimpleIframe'

export default function ArticleContent({ content }: { content: any }) {
    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                link: false, // Disable built-in link, we configure it separately
            }),
            LinkExtension.configure({
                HTMLAttributes: {
                    class: 'text-primary-400 underline decoration-primary-500/30 hover:decoration-primary-500 transition-colors',
                },
            }),
            ImageExtension.configure({
                HTMLAttributes: {
                    class: 'max-w-full h-auto rounded-lg border border-white/10 shadow-lg my-8',
                },
            }),
            SimpleIframe,
        ],

        content: content ? (() => {
            if (typeof content === 'string') {
                try {
                    const json = JSON.parse(content)
                    if (json && json.type) return json
                    return content // Assume HTML
                } catch (e) {
                    return content // Assume HTML
                }
            }
            return content
        })() : '',

        editable: false,
        editorProps: {
            attributes: {
                class: 'prose prose-lg prose-invert max-w-none prose-headings:text-white prose-headings:font-bold prose-headings:tracking-tight prose-p:text-slate-300 prose-p:leading-relaxed prose-a:text-primary-400 prose-a:no-underline hover:prose-a:underline prose-blockquote:border-l-primary-500 prose-blockquote:bg-white/5 prose-blockquote:py-2 prose-blockquote:px-6 prose-blockquote:rounded-r-lg prose-blockquote:not-italic prose-li:text-slate-300 prose-strong:text-white focus:outline-none',
            },
        },
    })

    if (!editor) return null

    return <EditorContent editor={editor} />
}
