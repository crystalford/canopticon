'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Network,
  Users,
  Lightbulb,
  GitMerge,
  GitBranch,
  Inbox,
  MessageSquare,
  Video,
  FileText,
  Library,
  Settings,
  Search,
  Telescope,
  Rss,
  Sparkles,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const nav = [
  {
    section: 'INTELLIGENCE',
    items: [
      { label: 'Intelligence', href: '/admin/intelligence', icon: Network },
      { label: 'Entities', href: '/admin/entities', icon: Users },
      { label: 'Hypotheses', href: '/admin/hypotheses', icon: Lightbulb },
      { label: 'Argument Maps', href: '/admin/argument-maps', icon: GitBranch },
      { label: 'Contradictions', href: '/admin/contradictions', icon: GitMerge },
    ],
  },
  {
    section: 'OPERATIONS',
    items: [
      { label: 'Research', href: '/admin/research', icon: Telescope },
      { label: 'Intake', href: '/admin/intake', icon: Inbox },
      { label: 'Sessions', href: '/admin/sessions', icon: MessageSquare },
    ],
  },
  {
    section: 'CONTENT',
    items: [
      { label: 'Stories', href: '/admin/stories', icon: Sparkles },
      { label: 'Vlogs', href: '/admin/vlogs', icon: Video },
      { label: 'Articles', href: '/admin/articles', icon: FileText },
      { label: 'Library', href: '/admin/library', icon: Library },
      { label: 'Channels', href: '/admin/channels', icon: Rss },
    ],
  },
  {
    section: 'SYSTEM',
    items: [
      { label: 'Search', href: '/admin/search', icon: Search },
      { label: 'System', href: '/admin/system', icon: Settings },
    ],
  },
]

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()

  return (
    <aside
      className={cn(
        'flex flex-col h-screen bg-base border-r border-border transition-all duration-200 shrink-0',
        collapsed ? 'w-14' : 'w-52'
      )}
    >
      <div className="flex items-center justify-end p-2 border-b border-border h-12">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-sm text-text-muted hover:text-text-secondary hover:bg-raised transition-colors"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto py-3 space-y-4">
        {nav.map(({ section, items }) => (
          <div key={section}>
            {!collapsed && (
              <p className="font-mono text-[10px] text-text-muted tracking-widest px-4 mb-1">
                {section}
              </p>
            )}
            {items.map(({ label, href, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(href + '/')
              return (
                <Link
                  key={href}
                  href={href}
                  title={collapsed ? label : undefined}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 mx-1 rounded-sm text-sm transition-colors',
                    'font-display',
                    active
                      ? 'bg-raised text-signal border-l-2 border-signal'
                      : 'text-text-secondary hover:text-text-primary hover:bg-raised border-l-2 border-transparent'
                  )}
                >
                  <Icon size={15} className="shrink-0" />
                  {!collapsed && <span>{label}</span>}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>
    </aside>
  )
}
