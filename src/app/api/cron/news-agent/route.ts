import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 60

function verifyCron(request: NextRequest) {
  const secret = request.headers.get('authorization')?.replace('Bearer ', '')
  return secret === process.env.CRON_SECRET
}

export async function GET(request: NextRequest) {
  if (!verifyCron(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  // Fetch pending intake items
  const { data: items, error } = await supabase
    .from('intake_queue')
    .select('*')
    .eq('status', 'pending')
    .order('created_at')
    .limit(10)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!items || items.length === 0) {
    return NextResponse.json({ processed: 0, message: 'No pending items' })
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  let processed = 0
  let failed = 0

  for (const item of items) {
    // Mark as processing
    await supabase.from('intake_queue').update({ status: 'processing' }).eq('id', item.id)

    try {
      const { data: promptRow } = await supabase
        .from('system_prompts')
        .select('content')
        .eq('key', 'intake_classifier')
        .single()

      const response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2048,
        system: promptRow?.content ?? 'Extract entities and claims from the provided content as JSON.',
        messages: [
          {
            role: 'user',
            content: `Extract entities and claims from the following content.\n\nSource URL: ${item.source_url ?? 'unknown'}\n\nContent:\n${item.raw_content}\n\nRespond with JSON only: { "entities": [...], "claims": [...] }`,
          },
        ],
      })

      let extracted: { entities: unknown[]; claims: unknown[] } = { entities: [], claims: [] }
      const text = response.content[0].type === 'text' ? response.content[0].text : ''
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        try { extracted = JSON.parse(jsonMatch[0]) } catch { /* keep empty */ }
      }

      await supabase.from('intake_queue').update({
        status: 'done',
        processed_at: new Date().toISOString(),
        extracted_entities: extracted.entities,
        extracted_claims: extracted.claims,
      }).eq('id', item.id)

      processed++
    } catch {
      await supabase.from('intake_queue').update({ status: 'pending' }).eq('id', item.id)
      failed++
    }
  }

  return NextResponse.json({ processed, failed, total: items.length })
}
