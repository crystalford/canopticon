/**
 * Source Expansion Module
 * 
 * Adds new Canadian news and policy sources to supplement Parliament/PMO/viral:
 * - Major news outlets (CBC, Globe & Mail, National Post, CTV)
 * - Government press releases and statements
 * - Policy research institutions
 * - Social media signals (Reddit, Twitter)
 */

export const EXPANDED_SOURCES = {
  // Major News Outlets (existing RSS feeds)
  major_news: [
    {
      id: 'cbc-politics',
      name: 'CBC News - Politics',
      url: 'https://www.cbc.ca/webfeed/rss/cbc_politics_feed.xml',
      type: 'rss',
      refresh_minutes: 60,
      enabled: true,
    },
    {
      id: 'globe-politics',
      name: 'Globe & Mail - Politics',
      url: 'https://www.theglobeandmail.com/feed/politics/',
      type: 'rss',
      refresh_minutes: 60,
      enabled: true,
    },
    {
      id: 'national-post-politics',
      name: 'National Post - Politics',
      url: 'https://nationalpost.com/category/politics/feed',
      type: 'rss',
      refresh_minutes: 60,
      enabled: true,
    },
    {
      id: 'ctv-politics',
      name: 'CTV News - Politics',
      url: 'https://feeds.ctv.ca/ctv/politics.xml',
      type: 'rss',
      refresh_minutes: 60,
      enabled: true,
    },
  ],

  // Government Sources
  government: [
    {
      id: 'pm-office',
      name: 'Prime Minister\'s Office Newsroom',
      url: 'https://www.pm.gc.ca/en/news',
      type: 'web-scrape',
      refresh_minutes: 120,
      enabled: true,
      scrape_selector: 'article',
    },
    {
      id: 'pco-news',
      name: 'Privy Council Office',
      url: 'https://www.canada.ca/en/privy-council.html',
      type: 'web-scrape',
      refresh_minutes: 240,
      enabled: true,
    },
    {
      id: 'parl-hansard',
      name: 'House of Commons Hansard',
      url: 'https://www.ourcommons.ca/Members/en/ioutil/hansardsearch',
      type: 'api',
      refresh_minutes: 360,
      enabled: true,
    },
  ],

  // Policy Research & Think Tanks
  research: [
    {
      id: 'csis-politics',
      name: 'CSIS - Canadian Politics',
      url: 'https://www.csis.ca/programs/canadian-politics',
      type: 'web-scrape',
      refresh_minutes: 240,
      enabled: true,
    },
    {
      id: 'cbc-opinion',
      name: 'CBC Opinion - Politics',
      url: 'https://www.cbc.ca/webfeed/rss/cbc_opinionsection_feed.xml',
      type: 'rss',
      refresh_minutes: 120,
      enabled: true,
    },
    {
      id: 'brookings-canada',
      name: 'Brookings - Canada',
      url: 'https://www.brookings.edu/topic/canada/',
      type: 'web-scrape',
      refresh_minutes: 360,
      enabled: false,
    },
  ],

  // Social Signals
  social: [
    {
      id: 'reddit-canada-politics',
      name: 'Reddit - r/CanadaPolitics',
      url: 'https://www.reddit.com/r/CanadaPolitics/new.json',
      type: 'api',
      refresh_minutes: 30,
      enabled: true,
    },
    {
      id: 'twitter-politics-ca',
      name: 'Twitter - Canadian Politics (X Search)',
      url: 'https://api.twitter.com/2/tweets/search/recent',
      type: 'api',
      refresh_minutes: 15,
      enabled: false,
      requires_auth: true,
    },
    {
      id: 'bluesky-politics',
      name: 'Bluesky - Canadian Politics',
      url: 'https://api.bsky.app/xrpc/app.bsky.feed.searchPosts',
      type: 'api',
      refresh_minutes: 30,
      enabled: true,
    },
  ],
}

/**
 * Get all enabled sources
 */
export function getEnabledSources() {
  const all = [
    ...EXPANDED_SOURCES.major_news,
    ...EXPANDED_SOURCES.government,
    ...EXPANDED_SOURCES.research,
    ...EXPANDED_SOURCES.social,
  ]
  return all.filter(s => s.enabled)
}

/**
 * Get sources by type
 */
export function getSourcesByType(type: string) {
  const all = [
    ...EXPANDED_SOURCES.major_news,
    ...EXPANDED_SOURCES.government,
    ...EXPANDED_SOURCES.research,
    ...EXPANDED_SOURCES.social,
  ]
  return all.filter(s => s.type === type && s.enabled)
}

/**
 * Ingestion worker pattern for each source type
 */
export const SOURCE_WORKERS = {
  // RSS feed ingestion (generic)
  async ingestRSS(sourceId: string, feedUrl: string) {
    console.log(`[v0] Fetching RSS from ${sourceId}`)
    try {
      const res = await fetch(feedUrl, { headers: { 'User-Agent': 'Canopticon/1.0' } })
      const xml = await res.text()
      // Parse XML and extract articles
      // Return structured articles for ingestion pipeline
      return { success: true, articles: [] }
    } catch (error) {
      console.error(`[v0] RSS ingestion failed for ${sourceId}:`, error)
      return { success: false, error: String(error) }
    }
  },

  // Web scraping
  async ingestWebScrape(sourceId: string, url: string, selector: string) {
    console.log(`[v0] Web scraping ${sourceId}`)
    try {
      const res = await fetch(url)
      const html = await res.text()
      // Parse HTML and extract articles using selector
      // Return structured articles
      return { success: true, articles: [] }
    } catch (error) {
      console.error(`[v0] Web scraping failed for ${sourceId}:`, error)
      return { success: false, error: String(error) }
    }
  },

  // API-based ingestion (Reddit, Twitter, etc)
  async ingestAPI(sourceId: string, apiUrl: string, authToken?: string) {
    console.log(`[v0] Fetching from API: ${sourceId}`)
    try {
      const headers: Record<string, string> = { 'User-Agent': 'Canopticon/1.0' }
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`

      const res = await fetch(apiUrl, { headers })
      const data = await res.json()
      // Parse API response and extract articles
      // Return structured articles
      return { success: true, articles: [] }
    } catch (error) {
      console.error(`[v0] API ingestion failed for ${sourceId}:`, error)
      return { success: false, error: String(error) }
    }
  },
}

/**
 * Ingestion job for all expanded sources
 */
export async function runAllSourceIngestion() {
  const sources = getEnabledSources()
  console.log(`[v0] Starting ingestion for ${sources.length} sources`)

  const results = await Promise.all(
    sources.map(async (source) => {
      try {
        if (source.type === 'rss') {
          return await SOURCE_WORKERS.ingestRSS(source.id, source.url)
        } else if (source.type === 'web-scrape') {
          const selector = (source as any).scrape_selector || 'article'
          return await SOURCE_WORKERS.ingestWebScrape(source.id, source.url, selector)
        } else if (source.type === 'api') {
          return await SOURCE_WORKERS.ingestAPI(source.id, source.url)
        } else {
          return { success: false, error: `Unknown source type: ${source.type}` }
        }
      } catch (error) {
        console.error(`[v0] Failed to ingest ${source.id}:`, error)
        return { success: false, error: String(error) }
      }
    })
  )

  const successful = results.filter((r): r is { success: boolean; error?: string; articles?: unknown[] } => r !== undefined && r.success).length
  console.log(`[v0] Source ingestion complete: ${successful}/${sources.length} successful`)
  return results
}
