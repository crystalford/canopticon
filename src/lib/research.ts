
/**
 * Research Module
 * 
 * Modular function to perform live research based on queries.
 * Currently implements a robust reliable fallback using Google News RSS.
 * Ready for drop-in replacement with Serper/Tavily APIs.
 */

import { callAI } from '@/lib/ai'
import { RESEARCH_ANALYSIS_V1, ResearchAnalysisInput, ResearchAnalysisOutput } from '@/lib/ai/prompts'

const ADAPTER = 'google_news_rss' // 'google_news_rss' | 'tavily' | 'serper'

/**
 * Analyze an article to identify research gaps
 */
export async function identifyResearchGaps(
  headline: string,
  summary: string
): Promise<{ area: string; questions: string[] }[]> {
  try {
    const result = await callAI<ResearchAnalysisOutput>({
      prompt: RESEARCH_ANALYSIS_V1.prompt,
      input: {
        headline,
        summary,
      } as ResearchAnalysisInput,
      model: 'gpt-4o-mini',
    })

    if (!result.success || !result.data) {
      console.log('[v0] Research analysis skipped (cost control)')
      return []
    }

    return result.data.research_areas
  } catch (error) {
    console.error('[v0] Error identifying research gaps:', error)
    return []
  }
}

/**
 * Enrich article with research findings
 */
export async function enrichArticleWithResearch(
  headline: string,
  summary: string
): Promise<string> {
  console.log('[v0] Starting research enrichment for:', headline)

  // 1. Identify research gaps
  const gaps = await identifyResearchGaps(headline, summary)
  if (gaps.length === 0) {
    console.log('[v0] No research gaps identified')
    return ''
  }

  console.log('[v0] Identified research gaps:', gaps.length)

  // 2. For each gap, search for findings
  const findings: string[] = []
  for (const gap of gaps) {
    if (gap.questions.length > 0) {
      const result = await searchGeneric(gap.questions[0])
      findings.push(`## ${gap.area}\n${result}`)
    }
  }

  console.log('[v0] Found research findings:', findings.length)
  return findings.join('\n\n')
}

export async function performLiveResearch(queries: string[]): Promise<string> {
    console.log(`[Research] Starting investigation for queries: ${queries.join(', ')}`)

    // Fan-out search requests
    const results = await Promise.all(queries.map(q => searchGeneric(q)))

    // Deduplicate and format
    return results.join('\n\n')
}

async function searchGeneric(query: string): Promise<string> {
    try {
        if (ADAPTER === 'google_news_rss') {
            return await searchGoogleNewsRSS(query)
        }
        // Future adapters:
        // if (ADAPTER === 'tavily') return await searchTavily(query)

        return `[Mock Result for: ${query}]`
    } catch (error) {
        console.error(`[Research] Failed to search for "${query}":`, error)
        return `[Error fetching context for: ${query}]`
    }
}

import { extractArticleContent } from '@/lib/scraper-util'

/**
 * reliable free search using Google News RSS + Deep Content Fetch via Scraper
 */
async function searchGoogleNewsRSS(query: string): Promise<string> {
    const GOOGLE_NEWS_RSS_BASE = 'https://news.google.com/rss/search?q='
    const encodedQuery = encodeURIComponent(query + ' when:7d') // Last 7 days to keep it fresh

    const res = await fetch(`${GOOGLE_NEWS_RSS_BASE}${encodedQuery}&hl=en-CA&gl=CA&ceid=CA:en`)
    const xml = await res.text()

    // Robust Regex Parse
    const items = xml.match(/<item>[\s\S]*?<\/item>/g) || []

    if (items.length === 0) return `[No news found for: ${query}]`

    // Process top 3 items
    const topItems = items.slice(0, 3).map(item => {
        const title = item.match(/<title>(.*?)<\/title>/)?.[1] || ''
        const pubDate = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || ''
        const link = item.match(/<link>(.*?)<\/link>/)?.[1] || ''

        let description = item.match(/<description>(.*?)<\/description>/)?.[1] || ''
        description = description.replace(/<[^>]*>/g, '').replace('&nbsp;', ' ')

        return { title, pubDate, link, description }
    })

    // DEEP DIVE: Fetch full content for the top 2 results
    const deepDivePromise = topItems.slice(0, 2).map(async (item) => {
        try {
            if (!item.link) return null
            console.log(`[Research] Deep fetching: ${item.link}`)

            // Add 5s timeout to avoid hanging the entire request
            const timeoutPromise = new Promise<{ bodyText: string } | null>((_, reject) =>
                setTimeout(() => resolveTimeout(null), 5000)
            )
            const resolveTimeout = (val: any) => val // helper

            const contentPromise = extractArticleContent(item.link)

            const content = await Promise.race([
                contentPromise,
                new Promise<null>(r => setTimeout(() => r(null), 5000))
            ])

            if (content && content.bodyText.length > 500) {
                return {
                    ...item,
                    fullText: content.bodyText.slice(0, 5000) // 5KB limit per article
                }
            }
        } catch (e) {
            console.warn(`[Research] Failed to fetch content for ${item.link}`, e)
        }
        return item
    })

    const enrichedItems = await Promise.all(deepDivePromise)

    return `--- INTELLIGENCE ON: "${query}" ---\n` + enrichedItems.map((item: any) => {
        if (!item) return ''
        const content = item.fullText
            ? `\n\n[FULL CONTENT EXTRACTED]:\n${item.fullText}\n`
            : `\n\n[SNIPPET ONLY]: ${item.description}`

        return `SOURCE: ${item.title}\nDATE: ${item.pubDate}\nLINK: ${item.link}${content}`
    }).join('\n\n' + '='.repeat(40) + '\n\n')
}
