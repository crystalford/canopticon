import { notFound } from 'next/navigation'
import { mockSignals } from '@/lib/mockData'
import Link from 'next/link'
import { ArrowLeft, Clock, AlertCircle } from 'lucide-react'

interface PageProps {
  params: {
    slug: string
  }
}

export default function SignalDetailPage({ params }: PageProps) {
  const signal = mockSignals.find((s) => s.slug === params.slug)

  if (!signal) {
    notFound()
  }

  const priorityColors = {
    low: 'text-[#22c55e]',
    medium: 'text-yellow-500',
    high: 'text-orange-500',
    critical: 'text-red-500',
  }

  const statusColors = {
    pending: 'text-yellow-500',
    processing: 'text-blue-500',
    resolved: 'text-[#22c55e]',
    archived: 'text-[#22c55e]/50',
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#22c55e] font-mono">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <Link
          href="/"
          className="inline-flex items-center gap-2 mb-8 text-sm hover:text-[#22c55e]/80 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          BACK TO HOME
        </Link>

        <div className="space-y-6">
          {/* Signal Header */}
          <div className="border border-[#22c55e]/30 p-6 bg-[#0a0a0a]">
            <div className="flex items-start justify-between mb-4">
              <h1 className="text-3xl font-bold">{signal.title}</h1>
              <div className="flex items-center gap-2">
                <span className={`text-sm font-bold ${priorityColors[signal.priority]}`}>
                  {signal.priority.toUpperCase()}
                </span>
                <span className={`text-sm ${statusColors[signal.status]}`}>
                  {signal.status.toUpperCase()}
                </span>
              </div>
            </div>
            <div className="space-y-2 text-sm text-[#22c55e]/70">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                <span>{new Date(signal.timestamp).toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                <span>Source: {signal.source}</span>
              </div>
            </div>
          </div>

          {/* Signal Content */}
          <div className="border border-[#22c55e]/30 p-6 bg-[#0a0a0a]">
            <p className="text-sm mb-4">$ canopticon --signal {signal.slug} --content</p>
            <div className="text-[#22c55e]/80 leading-relaxed">
              {signal.content}
            </div>
          </div>

          {/* Metadata */}
          {signal.metadata && (
            <div className="border border-[#22c55e]/30 p-6 bg-[#0a0a0a]">
              <p className="text-sm mb-4">$ canopticon --signal {signal.slug} --metadata</p>
              <pre className="text-xs text-[#22c55e]/70 overflow-x-auto">
                {JSON.stringify(signal.metadata, null, 2)}
              </pre>
            </div>
          )}

          {/* Signal ID */}
          <div className="text-xs text-[#22c55e]/50">
            Signal ID: {signal.id} | Slug: {signal.slug}
          </div>
        </div>
      </div>
    </div>
  )
}
