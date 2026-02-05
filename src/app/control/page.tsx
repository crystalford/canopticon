'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, Sparkles, FileText, Eye, CheckCircle } from 'lucide-react'

interface Topic {
  id: string
  title: string
  description: string
  angle: string
  keywords: string[]
  urgency: 'high' | 'medium' | 'low'
}

interface Article {
  id: string
  title: string
  slug: string
  summary: string
  content: string
  isDraft: boolean
  publishedAt: string | null
  createdAt: string
}

export default function ControlPanel() {
  const [topics, setTopics] = useState<Topic[]>([])
  const [articles, setArticles] = useState<Article[]>([])
  const [findingTopics, setFindingTopics] = useState(false)
  const [generatingId, setGeneratingId] = useState<string | null>(null)
  const [publishingId, setPublishingId] = useState<string | null>(null)

  // Load existing articles on mount
  useEffect(() => {
    loadArticles()
  }, [])

  const loadArticles = async () => {
    try {
      const res = await fetch('/api/dashboard/articles')
      if (res.ok) {
        const data = await res.json()
        setArticles(data)
      }
    } catch (error) {
      console.error('Failed to load articles:', error)
    }
  }

  const findTopics = async () => {
    setFindingTopics(true)
    try {
      const res = await fetch('/api/topics/find', { method: 'POST' })
      const data = await res.json()
      
      if (data.success) {
        setTopics(data.topics)
        console.log(`[v0] Found ${data.topics.length} topics`)
      } else {
        alert(`Error: ${data.error}`)
      }
    } catch (error) {
      console.error('[v0] Failed to find topics:', error)
      alert('Failed to find topics. Check console for details.')
    } finally {
      setFindingTopics(false)
    }
  }

  const generateArticle = async (topic: Topic) => {
    setGeneratingId(topic.id)
    try {
      console.log(`[v0] Generating article for: ${topic.title}`)
      const res = await fetch('/api/topics/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic })
      })
      const data = await res.json()
      
      if (data.success) {
        setArticles([data.article, ...articles])
        console.log(`[v0] Generated article: ${data.article.title}`)
        // Remove topic from list
        setTopics(topics.filter(t => t.id !== topic.id))
      } else {
        alert(`Error: ${data.error}`)
      }
    } catch (error) {
      console.error('[v0] Failed to generate article:', error)
      alert('Failed to generate article. Check console for details.')
    } finally {
      setGeneratingId(null)
    }
  }

  const publishArticle = async (articleId: string) => {
    setPublishingId(articleId)
    try {
      console.log(`[v0] Publishing article: ${articleId}`)
      const res = await fetch('/api/articles/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleId })
      })
      const data = await res.json()
      
      if (data.success) {
        // Update article in list
        setArticles(articles.map(a => 
          a.id === articleId 
            ? { ...a, isDraft: false, publishedAt: new Date().toISOString() }
            : a
        ))
        console.log('[v0] Article published successfully')
      } else {
        alert(`Error: ${data.error}`)
      }
    } catch (error) {
      console.error('[v0] Failed to publish article:', error)
      alert('Failed to publish article. Check console for details.')
    } finally {
      setPublishingId(null)
    }
  }

  const draftArticles = articles.filter(a => a.isDraft)
  const publishedArticles = articles.filter(a => !a.isDraft)

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-8 max-w-7xl">
        
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold tracking-tight mb-2">Control Panel</h1>
          <p className="text-muted-foreground">Simple AI-powered article generation</p>
        </div>

        {/* Find Topics Section */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Step 1: Find Topics</CardTitle>
            <CardDescription>AI researches current political topics worth writing about</CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={findTopics} 
              disabled={findingTopics}
              size="lg"
              className="w-full sm:w-auto"
            >
              {findingTopics ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Researching Topics...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Find Current Topics
                </>
              )}
            </Button>

            {topics.length > 0 && (
              <div className="mt-6 space-y-4">
                <p className="text-sm font-medium">Found {topics.length} topics:</p>
                {topics.map(topic => (
                  <div key={topic.id} className="border rounded-lg p-4 bg-card">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold text-lg">{topic.title}</h3>
                          <Badge variant={
                            topic.urgency === 'high' ? 'destructive' :
                            topic.urgency === 'medium' ? 'default' : 'secondary'
                          }>
                            {topic.urgency}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">{topic.description}</p>
                        <p className="text-xs text-muted-foreground italic mb-2">
                          <span className="font-medium">Angle:</span> {topic.angle}
                        </p>
                        <div className="flex gap-1 flex-wrap">
                          {topic.keywords.map(kw => (
                            <Badge key={kw} variant="outline" className="text-xs">{kw}</Badge>
                          ))}
                        </div>
                      </div>
                      <Button
                        onClick={() => generateArticle(topic)}
                        disabled={generatingId === topic.id}
                      >
                        {generatingId === topic.id ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <FileText className="w-4 h-4 mr-2" />
                            Generate Article
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {topics.length === 0 && !findingTopics && (
              <p className="text-sm text-muted-foreground mt-4">
                No topics yet. Click the button above to have AI research current political topics.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Draft Articles Section */}
        {draftArticles.length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Step 2: Review Drafts</CardTitle>
              <CardDescription>Review AI-generated articles and publish when ready</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {draftArticles.map(article => (
                  <div key={article.id} className="border rounded-lg p-4 bg-card">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg mb-2">{article.title}</h3>
                        <p className="text-sm text-muted-foreground mb-2">{article.summary}</p>
                        <p className="text-xs text-muted-foreground">
                          Created: {new Date(article.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <Button
                          variant="outline"
                          onClick={() => window.open(`/articles/${article.slug}`, '_blank')}
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          Preview
                        </Button>
                        <Button
                          onClick={() => publishArticle(article.id)}
                          disabled={publishingId === article.id}
                        >
                          {publishingId === article.id ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Publishing...
                            </>
                          ) : (
                            <>
                              <CheckCircle className="w-4 h-4 mr-2" />
                              Publish
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Published Articles Section */}
        {publishedArticles.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Published Articles</CardTitle>
              <CardDescription>Live on your site</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {publishedArticles.map(article => (
                  <div key={article.id} className="border rounded-lg p-4 bg-green-50 dark:bg-green-950/20">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold text-lg">{article.title}</h3>
                          <Badge className="bg-green-600">Published</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">{article.summary}</p>
                        <p className="text-xs text-muted-foreground">
                          Published: {new Date(article.publishedAt!).toLocaleString()}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        onClick={() => window.open(`/articles/${article.slug}`, '_blank')}
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        View Live
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empty State */}
        {articles.length === 0 && topics.length === 0 && !findingTopics && (
          <Card>
            <CardContent className="py-12 text-center">
              <Sparkles className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">Ready to Generate Articles</h3>
              <p className="text-muted-foreground mb-6">
                Click "Find Current Topics" to have AI research newsworthy political topics.
                Then generate full articles with one click.
              </p>
            </CardContent>
          </Card>
        )}

      </div>
    </div>
  )
}
