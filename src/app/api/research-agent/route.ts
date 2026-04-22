import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 300

function verifyCron(request: NextRequest) {
  const secret = request.headers.get('authorization')?.replace('Bearer ', '')
  return secret === process.env.CRON_SECRET
}

export async function GET(request: NextRequest) {
  if (!verifyCron(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const { data: queries, error } = await supabase
    .from('research_queries')
    .select('*')
    .eq('is_active', true)
    .order('last_run_at', { ascending: true, nullsFirst: true })
    .limit(5)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!queries || queries.length === 0) return NextResponse.json({ ran: 0, message: 'No active queries' })

  let ran = 0
  let failed = 0
  const results: { query: string; summary: string; intake_id: string }[] = []

  for (const q of queries) {
    try {
      // Claude with web search — no Perplexity needed
      const response = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        // @ts-expect-error — web_search is a beta tool, types lag behind
        betas: ['web-search-2025-03-05'],
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        system: `You are a Canadian political intelligence researcher. Search the web for current, factual information about Canadian politics, power structures, and policy. Focus on: named actors and their institutional roles, funding relationships, lobbying activity, policy influence, and structural power dynamics. Return a detailed synthesis with specific claims, named entities, and source references. Be precise and factual.`,
        messages: [{ role: 'user', content: q.query_text }],
      })

      // Extract final text from response (after any web search tool calls)
      const finalText = response.content
        .filter((b) => b.type === 'text')
        .map((b) => (b as Anthropic.TextBlock).text)
        .join('\n')

      if (!finalText || finalText.length < 100) {
        failed++
        continue
      }

      // Push to intake queue for the classifier to extract entities/claims
      const { data: intake } = await supabase
        .from('intake_queue')
        .insert({
          raw_content: finalText,
          source_url: `research-agent://query/${q.id}`,
          status: 'pending',
          submitted_by: null,
        })
        .select('id')
        .single()

      // Update query metadata
      const summary = finalText.substring(0, 300).replace(/\n/g, ' ') + '...'
      await supabase.from('research_queries').update({
        last_run_at: new Date().toISOString(),
        last_result_summary: summary,
        run_count: (q.run_count ?? 0) + 1,
      }).eq('id', q.id)

      if (intake) {
        results.push({ query: q.query_text, summary, intake_id: intake.id })
      }
      ran++
    } catch (err) {
      console.error('Research query failed:', q.query_text, err)
      failed++
    }
  }

  return NextResponse.json({ ran, failed, results })
}
