'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import { Bold, Italic, List, ListOrdered, Link as LinkIcon, Image as ImageIcon, Heading2, Quote } from 'lucide-react'

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
            }),
            Link.configure({
                openOnClick: false,
                HTMLAttributes: {
                    class: 'text-blue-600 underline',
                },
            }),
            Image.configure({
                HTMLAttributes: {
                    class: 'max-w-full h-auto rounded-lg',
                },
            }),
            Placeholder.configure({
                placeholder: 'Write your article content here...',
            }),
        ],
        content: content ? (typeof content === 'string' ? JSON.parse(content) : content) : '',
        editorProps: {
            attributes: {
                class: 'prose prose-slate max-w-none focus:outline-none min-h-[500px] p-6 text-base leading-relaxed',
            },
        },
        onUpdate: ({ editor }) => {
            onChange(JSON.stringify(editor.getJSON()))
        },
    })

    if (!editor) {
        return null
    }

    const addLink = () => {
        const url = window.prompt('Enter URL:')
        if (url) {
            editor.chain().focus().setLink({ href: url }).run()
        }
    }

    const addImage = () => {
        const url = window.prompt('Enter image URL:')
        if (url) {
            editor.chain().focus().setImage({ src: url }).run()
        }
    }

    return (
        <div className="border border-gray-300 rounded-lg overflow-hidden">
            {/* Toolbar */}
            <div className="bg-gray-100 border-b border-gray-300 p-2 flex flex-wrap gap-1">
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    className={`p-2 rounded hover:bg-gray-200 ${editor.isActive('bold') ? 'bg-gray-300' : ''}`}
                    title="Bold"
                >
                    <Bold className="w-4 h-4" />
                </button>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    className={`p-2 rounded hover:bg-gray-200 ${editor.isActive('italic') ? 'bg-gray-300' : ''}`}
                    title="Italic"
                >
                    <Italic className="w-4 h-4" />
                </button>
                <div className="w-px bg-gray-300 mx-1"></div>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                    className={`p-2 rounded hover:bg-gray-200 ${editor.isActive('heading', { level: 2 }) ? 'bg-gray-300' : ''}`}
                    title="Heading 2"
                >
                    <Heading2 className="w-4 h-4" />
                </button>
                <div className="w-px bg-gray-300 mx-1"></div>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleBulletList().run()}
                    className={`p-2 rounded hover:bg-gray-200 ${editor.isActive('bulletList') ? 'bg-gray-300' : ''}`}
                    title="Bullet List"
                >
                    <List className="w-4 h-4" />
                </button>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleOrderedList().run()}
                    className={`p-2 rounded hover:bg-gray-200 ${editor.isActive('orderedList') ? 'bg-gray-300' : ''}`}
                    title="Numbered List"
                >
                    <ListOrdered className="w-4 h-4" />
                </button>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleBlockquote().run()}
                    className={`p-2 rounded hover:bg-gray-200 ${editor.isActive('blockquote') ? 'bg-gray-300' : ''}`}
                    title="Quote"
                >
                    <Quote className="w-4 h-4" />
                </button>
                <div className="w-px bg-gray-300 mx-1"></div>
                <button
                    type="button"
                    onClick={addLink}
                    className={`p-2 rounded hover:bg-gray-200 ${editor.isActive('link') ? 'bg-gray-300' : ''}`}
                    title="Add Link"
                >
                    <LinkIcon className="w-4 h-4" />
                </button>
                <button
                    type="button"
                    onClick={addImage}
                    className="p-2 rounded hover:bg-gray-200"
                    title="Add Image"
                >
                    <ImageIcon className="w-4 h-4" />
                </button>
            </div>

            {/* Editor Content */}
            <EditorContent editor={editor} />
        </div>
    )
}
