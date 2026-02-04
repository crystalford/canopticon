'use client'

import { useState, useEffect } from 'react'
import { Activity, Play, Pause, RefreshCw, AlertCircle, CheckCircle2, Clock, Zap, TrendingUp } from 'lucide-react'

interface JobExecution {
  jobName: string
  status: 'success' | 'failure'
  duration: number
  timestamp: number
}

interface AutomationStatus {
  state: 'running' | 'paused'
  config: {
    ingestionIntervalMinutes: number
    signalProcessingIntervalMinutes: number
    synthesisIntervalMinutes: number
    publishingIntervalMinutes: number
  }
  rules: {
    approval: any[]
    publishing: any[]
  }
  executions: {
    ingestion: JobExecution[]
    signalProcessing: JobExecution[]
    synthesis: JobExecution[]
    publishing: JobExecution[]
  }
  timestamp: number
}

export default function DashboardPage() {
  const [status, setStatus] = useState<AutomationStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toggling, setToggling] = useState(false)
  const [running, setRunning] = useState(false)

  useEffect(() => {
    fetchAutomationStatus()
    // Refresh every 10 seconds
    const interval = setInterval(fetchAutomationStatus, 10000)
    return () => clearInterval(interval)
  }, [])

  const fetchAutomationStatus = async () => {
    try {
      const res = await fetch('/api/automation/status')
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || `API returned ${res.status}`)
      }
      const data = await res.json()
      
      // Validate response structure
      if (!data.state || !data.config) {
        throw new Error('Invalid response structure from API')
      }
      
      setStatus(data)
      setError(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error('[v0] Failed to fetch automation status:', message)
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const toggleAutomation = async () => {
    if (!status) return
    setToggling(true)
    try {
      const newState = status.state === 'running' ? 'paused' : 'running'
      const res = await fetch('/api/automation/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          state: newState,
        }),
      })

      if (!res.ok) {
        throw new Error('Failed to update automation state')
      }

      await fetchAutomationStatus()
    } catch (err) {
      console.error('[v0] Failed to toggle automation:', err)
    } finally {
      setToggling(false)
    }
  }

  const runAutomationCycle = async () => {
    setRunning(true)
    try {
      const res = await fetch('/api/automation/run', {
        method: 'POST',
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to run automation cycle')
      }

      const result = await res.json()
      console.log('[v0] Automation cycle completed:', result)

      // Refresh status to show new executions
      setTimeout(() => {
        fetchAutomationStatus()
      }, 1000)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error('[v0] Failed to run automation cycle:', message)
      alert(`Error: ${message}`)
    } finally {
      setRunning(false)
    }
  }
    } catch (err) {
      setError('Error toggling automation')
    } finally {
      setToggling(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-400 mx-auto mb-4"></div>
          <p className="text-slate-400 font-mono text-sm">Loading automation status...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-lg">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-red-300 mb-2">Failed to Load Automation Status</h2>
          <p className="text-slate-400 text-sm mb-6">{error}</p>
          <button
            onClick={() => {
              setLoading(true)
              setError(null)
              fetchAutomationStatus()
            }}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded font-mono text-sm transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  if (!status) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-red-400">Failed to load automation status</div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-white/5">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">Automation Control</h1>
          <p className="text-slate-400 text-sm flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Self-running political signal detection & synthesis
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={runAutomationCycle}
            disabled={running}
            className="px-4 py-2.5 rounded-lg font-bold uppercase text-sm tracking-wider transition-all flex items-center gap-2 bg-blue-500/20 text-blue-300 border border-blue-500/30 hover:bg-blue-500/30 disabled:opacity-50"
          >
            {running ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                RUNNING...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                RUN CYCLE
              </>
            )}
          </button>

          <button
            onClick={toggleAutomation}
            disabled={toggling}
            className={`px-6 py-2.5 rounded-lg font-bold uppercase text-sm tracking-wider transition-all flex items-center gap-2 ${
              status.state === 'running'
                ? 'bg-green-500/20 text-green-300 border border-green-500/30 hover:bg-green-500/30'
                : 'bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30'
            } disabled:opacity-50`}
          >
            {toggling ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                TOGGLING...
              </>
            ) : status.state === 'running' ? (
              <>
                <Zap className="w-4 h-4" />
                RUNNING
              </>
            ) : (
              <>
                <Pause className="w-4 h-4" />
                PAUSED
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="glass-panel p-4 border-l-2 border-red-500 text-red-200 bg-red-500/10 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatusCard
          title="Ingestion"
          interval={status.config?.ingestionIntervalMinutes || 15}
          description="Poll sources"
          icon={<RefreshCw className="w-5 h-5" />}
        />
        <StatusCard
          title="Signal Processing"
          interval={status.config?.signalProcessingIntervalMinutes || 10}
          description="Auto-approve signals"
          icon={<Zap className="w-5 h-5" />}
        />
        <StatusCard
          title="Synthesis"
          interval={status.config?.synthesisIntervalMinutes || 30}
          description="Generate articles"
          icon={<Activity className="w-5 h-5" />}
        />
        <StatusCard
          title="Publishing"
          interval={status.config?.publishingIntervalMinutes || 5}
          description="Auto-publish articles"
          icon={<CheckCircle2 className="w-5 h-5" />}
        />
      </div>

      {/* Rules Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Approval Rules */}
        <div className="glass-card p-6">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-400" />
            Signal Approval Rules
          </h2>
          <div className="space-y-3">
            {status.rules.approval.map((rule: any, i: number) => (
              <div key={i} className="p-3 bg-white/5 border border-white/10 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-sm text-slate-300">{rule.name}</span>
                  <span className={`text-xs px-2 py-1 rounded ${rule.enabled ? 'bg-green-500/20 text-green-300' : 'bg-slate-500/20 text-slate-400'}`}>
                    {rule.enabled ? 'ENABLED' : 'DISABLED'}
                  </span>
                </div>
                <div className="text-xs text-slate-400 space-y-1">
                  {rule.conditions.minConfidenceScore && (
                    <p>Min confidence: {rule.conditions.minConfidenceScore}%</p>
                  )}
                  {rule.conditions.minSignificanceScore && (
                    <p>Min significance: {rule.conditions.minSignificanceScore}%</p>
                  )}
                  {rule.conditions.maxAgeMins && (
                    <p>Max age: {rule.conditions.maxAgeMins} mins</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Publishing Rules */}
        <div className="glass-card p-6">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-400" />
            Publishing Rules
          </h2>
          <div className="space-y-3">
            {status.rules.publishing.map((rule: any, i: number) => (
              <div key={i} className="p-3 bg-white/5 border border-white/10 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-sm text-slate-300">{rule.name}</span>
                  <span className={`text-xs px-2 py-1 rounded ${rule.enabled ? 'bg-green-500/20 text-green-300' : 'bg-slate-500/20 text-slate-400'}`}>
                    {rule.enabled ? 'ENABLED' : 'DISABLED'}
                  </span>
                </div>
                <div className="text-xs text-slate-400 space-y-1">
                  {rule.conditions.minArticleAge && (
                    <p>Min article age: {rule.conditions.minArticleAge} mins</p>
                  )}
                  {rule.conditions.autoDeriveContent && (
                    <p>Auto-derive content: YES</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Activity Log */}
      <div className="glass-card p-6">
        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-blue-400" />
          Recent Activity
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <ExecutionLog
            title="Ingestion"
            executions={status.executions?.ingestion || []}
            icon={<RefreshCw className="w-4 h-4" />}
          />
          <ExecutionLog
            title="Signal Processing"
            executions={status.executions?.signalProcessing || []}
            icon={<Zap className="w-4 h-4" />}
          />
          <ExecutionLog
            title="Synthesis"
            executions={status.executions?.synthesis || []}
            icon={<Activity className="w-4 h-4" />}
          />
          <ExecutionLog
            title="Publishing"
            executions={status.executions?.publishing || []}
            icon={<CheckCircle2 className="w-4 h-4" />}
          />
        </div>
      </div>

      {/* Info Box */}
      <div className="glass-card p-6 bg-blue-500/5 border-l-2 border-blue-500">
        <h3 className="font-bold text-white mb-2 flex items-center gap-2">
          <Clock className="w-5 h-5 text-blue-400" />
          How It Works
        </h3>
        <ul className="text-sm text-slate-400 space-y-1 list-disc list-inside">
          <li>Ingestion: Polls Parliament, PMO, viral sources for new articles</li>
          <li>Signal Processing: Auto-approves signals matching configured rules</li>
          <li>Synthesis: Generates articles from approved signals</li>
          <li>Publishing: Auto-publishes articles and posts to social media</li>
          <li>All cycles run independently on configurable intervals</li>
        </ul>
      </div>
    </div>
  )
}

function StatusCard({
  title,
  interval,
  description,
  icon,
}: {
  title: string
  interval: number
  description: string
  icon: React.ReactNode
}) {
  return (
    <div className="glass-card p-4">
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-bold text-white text-sm">{title}</h3>
        <div className="text-slate-400">{icon}</div>
      </div>
      <p className="text-xs text-slate-400 mb-2">{description}</p>
      <div className="flex items-end gap-2">
        <span className="text-2xl font-bold text-primary-400">{interval}</span>
        <span className="text-xs text-slate-500 mb-1">min</span>
      </div>
    </div>
  )
}

function ExecutionLog({
  title,
  executions,
  icon,
}: {
  title: string
  executions: JobExecution[]
  icon: React.ReactNode
}) {
  const recentExecution = executions[0]
  const successCount = executions.filter((e) => e.status === 'success').length

  return (
    <div className="p-4 bg-white/5 border border-white/10 rounded-lg">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-slate-400">{icon}</span>
          <span className="font-mono text-sm text-white">{title}</span>
        </div>
      </div>

      {executions.length === 0 ? (
        <div className="text-xs text-slate-500">No executions yet</div>
      ) : (
        <>
          <div className="mb-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs text-slate-400">Latest:</span>
              <span
                className={`text-xs px-2 py-1 rounded font-mono ${
                  recentExecution.status === 'success'
                    ? 'bg-green-500/20 text-green-300'
                    : 'bg-red-500/20 text-red-300'
                }`}
              >
                {recentExecution.status.toUpperCase()}
              </span>
            </div>
            <div className="text-xs text-slate-500">
              {recentExecution.duration}ms • {new Date(recentExecution.timestamp).toLocaleTimeString()}
            </div>
          </div>

          <div className="text-xs text-slate-400">
            Success rate: <span className="text-white font-mono">{successCount}/{executions.length}</span>
          </div>
        </>
      )}
    </div>
  )
}
