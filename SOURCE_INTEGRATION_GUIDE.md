# Source Integration Guide

## Quick Start: Adding New Sources

### Option 1: RSS Feeds (Easiest)

Most major news outlets have RSS feeds. Create an ingestion worker:

```typescript
// src/app/api/ingest/major-news/route.ts

import { NextResponse } from 'next/server'
import { ingestRSSFeed } from '@/lib/ingestion/core'

export async function POST() {
  const sources = [
    { id: 'cbc-politics', url: 'https://www.cbc.ca/webfeed/rss/cbc_politics_feed.xml' },
    { id: 'globe-politics', url: 'https://www.theglobeandmail.com/feed/politics/' },
    { id: 'national-post', url: 'https://nationalpost.com/category/politics/feed' },
    { id: 'ctv-politics', url: 'https://feeds.ctv.ca/ctv/politics.xml' },
  ]

  const results = await Promise.all(
    sources.map(source => ingestRSSFeed(source.id, source.url))
  )

  return NextResponse.json({ success: true, results })
}
```

Then call from automation workflow:

```typescript
// src/lib/orchestration/workflow.ts

async function runIngestionPhase() {
  // Existing sources
  await fetch('/api/ingest/parliament')
  await fetch('/api/ingest/pmo')
  await fetch('/api/ingest/viral')
  
  // NEW - add to ingestion phase
  await fetch('/api/ingest/major-news')
}
```

### Option 2: Web Scraping

For websites without RSS feeds:

```typescript
// src/lib/ingestion/web-scraper.ts

import { extractArticleContent } from '@/lib/scraper-util'

export async function scrapeNewsSource(
  sourceId: string,
  url: string,
  articleSelector: string
) {
  const res = await fetch(url)
  const html = await res.text()
  
  // Parse HTML
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  const articles = doc.querySelectorAll(articleSelector)
  
  const results = []
  for (const article of articles) {
    const link = article.querySelector('a')?.href
    if (!link) continue
    
    try {
      const content = await extractArticleContent(link)
      results.push({
        sourceId,
        headline: article.textContent?.trim(),
        url: link,
        bodyText: content.bodyText,
        publishedAt: new Date(),
      })
    } catch (error) {
      console.error('[v0] Failed to scrape:', link, error)
    }
  }
  
  return results
}
```

Usage:

```typescript
// Scrape CBC politics page
const articles = await scrapeNewsSource(
  'cbc-politics',
  'https://www.cbc.ca/news/politics',
  'article a[href*="/news/politics/"]'
)
```

### Option 3: API Ingestion

For platforms with APIs (Reddit, Bluesky, etc):

```typescript
// src/lib/ingestion/reddit-fetcher.ts

export async function fetchRedditPosts(subreddit: string, limit = 50) {
  const url = `https://www.reddit.com/r/${subreddit}/new.json?limit=${limit}`
  
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Canopticon/1.0 (Political Signal Detection)' }
  })
  
  const data = await res.json()
  
  return data.data.children.map((item: any) => ({
    sourceId: `reddit-${subreddit}`,
    headline: item.data.title,
    url: `https://reddit.com${item.data.permalink}`,
    bodyText: item.data.selftext,
    score: item.data.score,
    comments: item.data.num_comments,
    publishedAt: new Date(item.data.created_utc * 1000),
  }))
}
```

Usage:

```typescript
const posts = await fetchRedditPosts('CanadaPolitics', 50)
```

## Integrating Sources into Automation

### Step 1: Register Source in Database

```typescript
// Add to your sources table
await db.insert(sources).values({
  id: 'cbc-politics',
  name: 'CBC News - Politics',
  url: 'https://www.cbc.ca/webfeed/rss/cbc_politics_feed.xml',
  type: 'rss',
  enabled: true,
  refreshIntervalMinutes: 60,
})
```

### Step 2: Create Ingestion Worker

```typescript
// src/lib/ingestion/workers.ts

export async function ingestAllSources() {
  // Get all enabled sources from DB
  const sources = await db.select().from(sources).where(eq(sources.enabled, true))
  
  const results = await Promise.all(
    sources.map(async (source) => {
      try {
        if (source.type === 'rss') {
          return await ingestRSSFeed(source.id, source.url)
        } else if (source.type === 'api') {
          return await ingestAPISource(source.id, source.url)
        } else if (source.type === 'web-scrape') {
          return await scrapeNewsSource(source.id, source.url, source.selector)
        }
      } catch (error) {
        console.error(`[v0] Ingestion failed for ${source.id}:`, error)
        return { success: false, sourceId: source.id, error: String(error) }
      }
    })
  )
  
  return results
}
```

### Step 3: Add to Automation Workflow

```typescript
// src/lib/orchestration/workflow.ts

async function executeAutomationCycle() {
  // ... existing code ...
  
  // PHASE 1: Ingestion
  if (shouldRunPhase('ingestion', lastIngestion)) {
    console.log('[v0] Running ingestion phase')
    const result = await ingestAllSources()
    stats.articlesIngested = result.filter(r => r.success).length
  }
  
  // PHASE 2: Signal processing
  // PHASE 3: Synthesis
  // ... etc ...
}
```

## Testing New Sources

### Test RSS Feed

```bash
# Verify feed is valid
curl https://www.cbc.ca/webfeed/rss/cbc_politics_feed.xml | head -20
```

### Test Web Scraper

```typescript
// Quick test
import { scrapeNewsSource } from '@/lib/ingestion/web-scraper'

const articles = await scrapeNewsSource(
  'test-source',
  'https://example.com',
  'article'
)

console.log(`Found ${articles.length} articles`)
console.log(articles[0])
```

### Test API Endpoint

```typescript
const posts = await fetchRedditPosts('CanadaPolitics')
console.log(`Found ${posts.length} posts`)
console.log(`Top post: "${posts[0].headline}" (score: ${posts[0].score})`)
```

## Recommended Source Priority

### Phase 1 (Easy, High Value)
- CBC News - Politics (RSS)
- Globe & Mail - Politics (RSS)
- National Post - Politics (RSS)
- CTV News - Politics (RSS)

**Why:** Official RSS feeds, proven Canadian outlets, high-quality journalism

**Time to implement:** 1-2 hours

### Phase 2 (Medium, Strategic)
- Reddit r/CanadaPolitics (API)
- Bluesky politics (API - distributed social)
- Prime Minister's Office (Web scrape)

**Why:** Grassroots signals, social feedback, official sources

**Time to implement:** 4-6 hours

### Phase 3 (Advanced, Research)
- Hansard (Web scrape or API)
- CSIS (Web scrape)
- Policy research institutions

**Why:** Deep research context and expert analysis

**Time to implement:** 8-12 hours

## Cost of Sources

- **RSS feeds**: Free (just bandwidth)
- **Web scraping**: Free (just processing)
- **Reddit API**: Free (public API)
- **Bluesky API**: Free (open federation)
- **Twitter API**: Paid (~$100-500/month for rate limits)

**Recommendation:** Start with RSS + Reddit + Bluesky (all free), add premium APIs only if needed

## Monitoring Source Health

```typescript
// src/lib/sources-health.ts

export async function checkSourceHealth() {
  const sources = await db.select().from(sources)
  
  const health = await Promise.all(
    sources.map(async (source) => {
      const lastIngestion = await db
        .select({ createdAt: rawArticles.createdAt })
        .from(rawArticles)
        .where(eq(rawArticles.sourceId, source.id))
        .orderBy(desc(rawArticles.createdAt))
        .limit(1)
      
      const hoursSinceLastArticle = lastIngestion[0]
        ? (Date.now() - lastIngestion[0].createdAt.getTime()) / 1000 / 3600
        : null
      
      return {
        sourceId: source.id,
        name: source.name,
        enabled: source.enabled,
        hoursSinceLastArticle,
        isHealthy: hoursSinceLastArticle ? hoursSinceLastArticle < source.refreshIntervalMinutes * 2 / 60 : false,
      }
    })
  )
  
  return health
}
```

Track which sources are stale or broken, fix immediately.

## Common Issues & Fixes

### "Feed validation failed"
- Check if URL is correct
- Test in browser: does it load?
- Verify CORS headers (add User-Agent header)

### "No articles found"
- Check CSS selectors (might have changed)
- Verify auth token (if API requires it)
- Check if site structure changed (scraping is fragile)

### "Rate limited"
- Space out requests using delay
- Use API keys if available
- Cache results to reduce requests

### "SSL/Certificate errors"
- Some news sites have cert issues
- Try adding `NODE_TLS_REJECT_UNAUTHORIZED=0` (dev only!)
- Report to site owner

## Next: Integrate into Automation

Once you've added sources, update the automation schedule:

```typescript
// src/lib/orchestration/scheduler.ts

const INGESTION_INTERVALS = {
  parliament: 15 * 60 * 1000,      // Every 15 min
  pmo: 15 * 60 * 1000,              // Every 15 min
  viral: 10 * 60 * 1000,            // Every 10 min
  majorNews: 60 * 60 * 1000,        // Every 60 min (NEW)
  reddit: 30 * 60 * 1000,           // Every 30 min (NEW)
  bluesky: 30 * 60 * 1000,          // Every 30 min (NEW)
}
```

The system will then automatically:
1. Ingest from all sources on schedule
2. Cluster related articles
3. Synthesize comprehensive articles
4. Auto-publish based on rules

**Result:** Automated intelligence platform that never sleeps.
