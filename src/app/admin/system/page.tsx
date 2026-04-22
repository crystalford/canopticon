import { createClient } from '@/lib/supabase/server'
import type { Agent, SystemPrompt } from '@/types/database'
import SystemPromptsEditor from './SystemPromptsEditor'
import AgentToggles from './AgentToggles'
import JobRunner from './JobRunner'

export const dynamic = 'force-dynamic'

async function getSystemData() {
  const supabase = createClient()

  const [
    { count: entities },
    { count: relationships },
    { count: claims },
    { count: sources },
    { count: open_gaps },
    { count: open_hypotheses },
    { count: unresolved_contradictions },
    { data: agents },
    { data: prompts },
  ] = await Promise.all([
    supabase.from('entities').select('*', { count: 'exact', head: true }),
    supabase.from('relationships').select('*', { count: 'exact', head: true }),
    supabase.from('claims').select('*', { count: 'exact', head: true }),
    supabase.from('sources').select('*', { count: 'exact', head: true }),
    supabase.from('knowledge_gaps').select('*', { count: 'exact', head: true }).eq('is_resolved', false),
    supabase.from('hypotheses').select('*', { count: 'exact', head: true }).eq('status', 'open'),
    supabase.from('contradictions').select('*', { count: 'exact', head: true }).is('resolved_at', null),
    supabase.from('agents').select('*').order('name'),
    supabase.from('system_prompts').select('*').order('key'),
  ])

  return {
    health: { entities, relationships, claims, sources, open_gaps, open_hypotheses, unresolved_contradictions },
    agents: (agents ?? []) as Agent[],
    prompts: (prompts ?? []) as SystemPrompt[],
  }
}

const JOBS = [
  {
    key: 'intake-classifier',
    label: 'Intake Classifier',
    description: 'Process pending intake queue items through AI classifier.',
    endpoint: '/api/cron/news-agent',
  },
  {
    key: 'gap-escalator',
    label: 'Gap Escalator',
    description: 'Increase urgency on unanswered knowledge gaps.',
    endpoint: '/api/cron/gap-escalator',
  },
  {
    key: 'health-snapshot',
    label: 'Health Snapshot',
    description: 'Record current graph health metrics.',
    endpoint: '/api/cron/health-snapshot',
  },
  {
    key: 'neo4j-keepalive',
    label: 'Neo4j Keepalive',
    description: 'Ping AuraDB to prevent free-tier hibernation.',
    endpoint: '/api/cron/neo4j-keepalive',
  },
]

export default async function SystemPage() {
  const { health, agents, prompts } = await getSystemData()

  const healthRows = [
    { label: 'Entities', value: health.entities ?? 0 },
    { label: 'Relationships', value: health.relationships ?? 0 },
    { label: 'Claims', value: health.claims ?? 0 },
    { label: 'Sources', value: health.sources ?? 0 },
    { label: 'Open Knowledge Gaps', value: health.open_gaps ?? 0, warn: true },
    { label: 'Open Hypotheses', value: health.open_hypotheses ?? 0 },
    { label: 'Unresolved Contradictions', value: health.unresolved_contradictions ?? 0, warn: true },
  ]

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h1 className="font-display text-xl font-bold text-text-primary">System</h1>
        <p className="font-mono text-xs text-text-muted mt-1">Graph health, jobs, agents, prompts, architecture.</p>
      </div>

      {/* Graph Health */}
      <section className="glass-panel p-6 space-y-4">
        <h2 className="font-display text-sm font-semibold text-text-secondary tracking-wider uppercase">
          Graph Health
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {healthRows.map(({ label, value, warn }) => (
            <div key={label} className="bg-void border border-border rounded-sm p-3">
              <div className={`font-mono text-2xl font-bold ${warn && value > 0 ? 'text-signal' : 'text-text-primary'}`}>
                {value}
              </div>
              <div className="font-mono text-xs text-text-muted mt-1">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Manual Jobs */}
      <section className="glass-panel p-6 space-y-4">
        <div>
          <h2 className="font-display text-sm font-semibold text-text-secondary tracking-wider uppercase">
            Background Jobs
          </h2>
          <p className="font-mono text-xs text-text-muted mt-1">All jobs are manual — run on demand, no hidden automation.</p>
        </div>
        <div className="space-y-2">
          {JOBS.map((job) => (
            <JobRunner key={job.key} label={job.label} description={job.description} endpoint={job.endpoint} />
          ))}
        </div>
      </section>

      {/* Agent Status */}
      <section className="glass-panel p-6 space-y-4">
        <h2 className="font-display text-sm font-semibold text-text-secondary tracking-wider uppercase">
          Agent Status
        </h2>
        <AgentToggles agents={agents} />
      </section>

      {/* System Prompts */}
      <section className="glass-panel p-6 space-y-4">
        <h2 className="font-display text-sm font-semibold text-text-secondary tracking-wider uppercase">
          System Prompts
        </h2>
        <SystemPromptsEditor prompts={prompts} />
      </section>

      {/* Architecture */}
      <section className="glass-panel p-6 space-y-4">
        <h2 className="font-display text-sm font-semibold text-text-secondary tracking-wider uppercase">
          Architecture
        </h2>
        <div className="overflow-x-auto">
          <svg viewBox="0 0 800 300" className="w-full max-w-3xl font-mono text-[11px]" fill="none">
            <rect x="20" y="110" width="120" height="50" rx="2" fill="#161b22" stroke="#30363d"/>
            <text x="80" y="130" textAnchor="middle" fill="#8b949e">Intake Queue</text>
            <text x="80" y="148" textAnchor="middle" fill="#484f58">pending/processing</text>
            <path d="M140 135 L180 135" stroke="#30363d" strokeWidth="1" markerEnd="url(#arrow)"/>
            <rect x="180" y="110" width="120" height="50" rx="2" fill="#161b22" stroke="#e8a020" strokeOpacity="0.4"/>
            <text x="240" y="130" textAnchor="middle" fill="#e8a020">Classifier</text>
            <text x="240" y="148" textAnchor="middle" fill="#484f58">haiku-4-5</text>
            <path d="M300 135 L340 135" stroke="#30363d" strokeWidth="1" markerEnd="url(#arrow)"/>
            <rect x="340" y="80" width="140" height="110" rx="2" fill="#161b22" stroke="#3dd68c" strokeOpacity="0.4"/>
            <text x="410" y="105" textAnchor="middle" fill="#3dd68c">Supabase</text>
            <text x="410" y="123" textAnchor="middle" fill="#484f58">entities</text>
            <text x="410" y="139" textAnchor="middle" fill="#484f58">claims + evidence</text>
            <text x="410" y="155" textAnchor="middle" fill="#484f58">pgvector embeddings</text>
            <text x="410" y="171" textAnchor="middle" fill="#484f58">auth + RLS</text>
            <path d="M480 135 L520 135" stroke="#30363d" strokeWidth="1" markerEnd="url(#arrow)"/>
            <rect x="520" y="90" width="120" height="70" rx="2" fill="#161b22" stroke="#4da6ff" strokeOpacity="0.4"/>
            <text x="580" y="115" textAnchor="middle" fill="#4da6ff">Neo4j</text>
            <text x="580" y="133" textAnchor="middle" fill="#484f58">graph traversal</text>
            <text x="580" y="149" textAnchor="middle" fill="#484f58">multi-hop paths</text>
            <path d="M640 135 L680 135" stroke="#30363d" strokeWidth="1" markerEnd="url(#arrow)"/>
            <rect x="680" y="100" width="100" height="60" rx="2" fill="#161b22" stroke="#e8a020" strokeOpacity="0.4"/>
            <text x="730" y="124" textAnchor="middle" fill="#e8a020">Intelligence</text>
            <text x="730" y="142" textAnchor="middle" fill="#484f58">sonnet-4-6</text>
            <text x="240" y="185" textAnchor="middle" fill="#484f58">↑ manual trigger</text>
            <text x="730" y="185" textAnchor="middle" fill="#484f58">↑ on demand</text>
            <defs>
              <marker id="arrow" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
                <path d="M0,0 L0,6 L6,3 z" fill="#30363d"/>
              </marker>
            </defs>
          </svg>
        </div>
      </section>
    </div>
  )
}
