import { createClient } from '@/lib/supabase/server'
import ResearchQueryManager from './ResearchQueryManager'

export const dynamic = 'force-dynamic'

export default async function ResearchPage() {
  const supabase = createClient()
  const { data: queries } = await supabase
    .from('research_queries')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="font-display text-xl font-bold text-text-primary">Research Agent</h1>
        <p className="font-mono text-xs text-text-muted mt-1">
          AI-driven research queries. Claude searches the web, results flow into the intake queue and graph.
        </p>
      </div>
      <ResearchQueryManager queries={queries ?? []} />
    </div>
  )
}
