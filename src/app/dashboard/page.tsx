'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, Play, RefreshCw, FileText, Signal, CheckCircle, Clock, AlertCircle } from 'lucide-react'

interface Stats {
  rawArticles: number
  pendingSignals: number
  approvedSignals: number
  publishedArticles: number
}

interface LogEntry {
  id: string
  level: string
  message: string
  createdAt: string
}

interface RecentArticle {
  id: string
  title: string
  slug: string
  isDraft: boolean
  createdAt: string
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [articles, setArticles] = useState<RecentArticle[]>([])
  const [loading, setLoading] = useState(false)
  const [running, setRunning] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    try {
      const [statsRes, logsRes, articlesRes] = await Promise.all([
        fetch('/api/dashboard/stats'),
        fetch('/api/dashboard/logs'),
        fetch('/api/dashboard/articles')
      ])

      if (statsRes.ok) setStats(await statsRes.json())
      if (logsRes.ok) setLogs(await logsRes.json())
      if (articlesRes.ok) setArticles(await articlesRes.json())
    } catch (error) {
      console.error('Failed to fetch data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 5000) // Refresh every 5 seconds
    return () => clearInterval(interval)
  }, [])

  const runCycle = async () => {
    setRunning(true)
    try {
      const res = await fetch('/api/automation/cycle', { method: 'POST' })
      const result = await res.json()
      console.log('Automation result:', result)
      
      // Refresh data after cycle completes
      await fetchData()
    } catch (error) {
      console.error('Automation failed:', error)
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">Automation Dashboard</h1>
            <p className="text-muted-foreground mt-2">Monitor your article automation pipeline in real-time</p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={fetchData}
              disabled={loading}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              <span className="ml-2">Refresh</span>
            </Button>
            <Button
              onClick={runCycle}
              disabled={running}
              size="lg"
            >
              {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              <span className="ml-2">Run Automation Cycle</span>
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Raw Articles</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.rawArticles ?? '-'}</div>
              <p className="text-xs text-muted-foreground">Unprocessed articles</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Signals</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.pendingSignals ?? '-'}</div>
              <p className="text-xs text-muted-foreground">Awaiting AI analysis</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Approved Signals</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.approvedSignals ?? '-'}</div>
              <p className="text-xs text-muted-foreground">Ready for articles</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Published Articles</CardTitle>
              <Signal className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.publishedArticles ?? '-'}</div>
              <p className="text-xs text-muted-foreground">Live on site</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Recent Articles */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Articles</CardTitle>
              <CardDescription>Latest published content</CardDescription>
            </CardHeader>
            <CardContent>
              {articles.length === 0 ? (
                <p className="text-sm text-muted-foreground">No articles yet. Run an automation cycle to generate content.</p>
              ) : (
                <div className="space-y-4">
                  {articles.map(article => (
                    <div key={article.id} className="flex items-start justify-between border-b pb-3 last:border-0">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{article.title}</p>
                        <p className="text-xs text-muted-foreground mt-1">/{article.slug}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(article.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <Badge variant={article.isDraft ? 'secondary' : 'default'}>
                        {article.isDraft ? 'Draft' : 'Published'}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Activity Log */}
          <Card>
            <CardHeader>
              <CardTitle>Activity Log</CardTitle>
              <CardDescription>Real-time automation events</CardDescription>
            </CardHeader>
            <CardContent>
              {logs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No activity yet. Run an automation cycle to see logs.</p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {logs.map(log => (
                    <div key={log.id} className="flex items-start gap-2 text-xs">
                      <Badge 
                        variant={log.level === 'error' ? 'destructive' : 'secondary'}
                        className="shrink-0"
                      >
                        {log.level}
                      </Badge>
                      <div className="flex-1">
                        <p className="font-mono">{log.message}</p>
                        <p className="text-muted-foreground text-[10px] mt-0.5">
                          {new Date(log.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

        </div>

      </div>
    </div>
  )
}
