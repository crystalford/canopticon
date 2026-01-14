'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import { Bold, Italic, List, ListOrdered, Link as LinkIcon, Image as ImageIcon, Heading2, Quote } from 'lucide-react'
import AiToolbar from './AiToolbar'

interface TipTapEditorProps {
    content: string | null
    onChange: (content: string) => void
}

export default function TipTapEditor({ content, onChange }: TipTapEditorProps) {
    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                heading: {
                    levels: [2, 3, 4],
                },
                link: false, // Disable built-in link, we configure it separately
            }),
            Link.configure({
                openOnClick: false,
                HTMLAttributes: {
                    class: 'text-primary-400 underline decoration-primary-500/30 hover:decoration-primary-500 transition-colors',
                },
            }),
            Image.configure({
                HTMLAttributes: {
                    class: 'max-w-full h-auto rounded-lg border border-white/10 shadow-lg my-6',
                },
            }),
            Placeholder.configure({
                placeholder: 'Write your article here...',
            }),
        ],
        content: content ? (typeof content === 'string' ? JSON.parse(content) : content) : '',
        editorProps: {
            attributes: {
                class: 'prose prose-invert max-w-none focus:outline-none min-h-[500px] p-6 text-slate-300 leading-relaxed prose-headings:text-white prose-headings:font-bold prose-strong:text-white prose-blockquote:border-l-primary-500 prose-blockquote:bg-white/5 prose-blockquote:py-1 prose-blockquote:px-4 prose-blockquote:rounded-r-lg not-italic',
            },
        },
        onUpdate: ({ editor }) => {
            onChange(JSON.stringify(editor.getJSON()))
        },
    })

    if (!editor) return null

    const addLink = () => {
        const url = window.prompt('Enter URL:')
        if (url) editor.chain().focus().setLink({ href: url }).run()
    }

    const addImage = () => {
        const url = window.prompt('Enter image URL:')
        if (url) editor.chain().focus().setImage({ src: url }).run()
    }

    const ToolbarButton = ({ onClick, isActive, icon: Icon, title }: any) => (
        <button
            type="button"
            onClick={onClick}
            title={title}
            className={`
                p-2 rounded-md transition-all duration-200
                ${isActive
                    ? 'bg-primary-500/20 text-primary-400 shadow-[0_0_10px_rgba(14,165,233,0.1)]'
                    : 'text-slate-500 hover:text-slate-200 hover:bg-white/5'
                }
            `}
        >
            <Icon className="w-4 h-4" />
        </button>
    )

    return (
        <div className="flex flex-col h-full relative">
            {/* Toolbar */}
            <div className="flex flex-col p-2 border-b border-white/5 bg-black/20 backdrop-blur sticky top-0 z-10">
                {/* AI Toolbar (Conditional) - PAUSED PER USER REQUEST */}
                {/* <AiToolbar editor={editor} /> */}

                {/* Main Toolbar */}
                <div className="flex flex-wrap gap-1">
                    <ToolbarButton
                        onClick={() => editor.chain().focus().toggleBold().run()}
                        isActive={editor.isActive('bold')}
                        icon={Bold}
                        title="Bold"
                    />
                    <ToolbarButton
                        onClick={() => editor.chain().focus().toggleItalic().run()}
                        isActive={editor.isActive('italic')}
                        icon={Italic}
                        title="Italic"
                    />
                    <div className="w-px bg-white/10 mx-1 my-1"></div>
                    <ToolbarButton
                        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                        isActive={editor.isActive('heading', { level: 2 })}
                        icon={Heading2}
                        title="Heading"
                    />
                    <div className="w-px bg-white/10 mx-1 my-1"></div>
                    <ToolbarButton
                        onClick={() => editor.chain().focus().toggleBulletList().run()}
                        isActive={editor.isActive('bulletList')}
                        icon={List}
                        title="Bullet List"
                    />
                    <ToolbarButton
                        onClick={() => editor.chain().focus().toggleOrderedList().run()}
                        isActive={editor.isActive('orderedList')}
                        icon={ListOrdered}
                        title="Numbered List"
                    />
                    <ToolbarButton
                        onClick={() => editor.chain().focus().toggleBlockquote().run()}
                        isActive={editor.isActive('blockquote')}
                        icon={Quote}
                        title="Blockquote"
                    />
                    <div className="w-px bg-white/10 mx-1 my-1"></div>
                    <ToolbarButton
                        onClick={addLink}
                        isActive={editor.isActive('link')}
                        icon={LinkIcon}
                        title="Link"
                    />
                    <ToolbarButton
                        onClick={addImage}
                        isActive={false}
                        icon={ImageIcon}
                        title="Image"
                    />
                </div>
            </div>

            {/* Editor Content */}
            <div className="flex-1 bg-black/10">
                <EditorContent editor={editor} />
            </div>
        </div>
    )
}
