import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEntityNeighbors } from '@/lib/neo4j/sync'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 120

const GRAPH_TOOLS: Anthropic.Tool[] = [
  {
    name: 'search_entities',
    description: 'Search for entities in the knowledge graph by name or type. Use this to find people, organizations, corporations, political parties, government bodies, etc. Always start here when asked about a named actor.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Name or keyword to search' },
        type: { type: 'string', description: 'Optional type filter: person, organization, corporation, government_body, political_party, media_outlet, policy, event, place, concept' },
        limit: { type: 'number', description: 'Max results, default 10' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_entity',
    description: 'Get full details for an entity: all claims about it, its relationships to other entities, and open knowledge gaps. Use after finding an entity ID via search_entities.',
    input_schema: {
      type: 'object' as const,
      properties: {
        entity_id: { type: 'string', description: 'Entity UUID from search_entities' },
      },
      required: ['entity_id'],
    },
  },
  {
    name: 'get_entity_relationships',
    description: 'Traverse the Neo4j graph to find multi-hop connections for an entity. Reveals indirect relationships across 2-3 degrees — how actors connect through intermediaries.',
    input_schema: {
      type: 'object' as const,
      properties: {
        entity_id: { type: 'string', description: 'Entity UUID' },
        depth: { type: 'number', description: 'Traversal depth 1-3, default 2' },
      },
      required: ['entity_id'],
    },
  },
  {
    name: 'search_claims',
    description: 'Search claims in the knowledge base by keyword. Returns claims with confidence scores (evidence quality) and resonance scores (belief spread). Confidence and resonance are independent axes.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Search term' },
        status: { type: 'string', description: 'Optional filter: verified, unverified, disputed, retracted' },
        limit: { type: 'number', description: 'Max results, default 10' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_knowledge_gaps',
    description: 'Get open knowledge gaps — questions the system has flagged as unanswered. Higher urgency_score means the gap has gone unresolved longer. Use to identify what intelligence is missing.',
    input_schema: {
      type: 'object' as const,
      properties: {
        entity_id: { type: 'string', description: 'Optional: filter gaps by entity UUID' },
        limit: { type: 'number', description: 'Max results, default 10' },
      },
    },
  },
  {
    name: 'get_convergence_events',
    description: 'Get convergence events — cases where multiple independent sources independently point to the same connection. High significance_score events warrant attention.',
    input_schema: {
      type: 'object' as const,
      properties: {
        limit: { type: 'number', description: 'Max results, default 10' },
      },
    },
  },
]

type ToolInput = Record<string, unknown>

async function executeTool(name: string, input: ToolInput, supabase: ReturnType<typeof createClient>): Promise<unknown> {
  switch (name) {
    case 'search_entities': {
      const q = input.query as string
      const type = input.type as string | undefined
      const limit = (input.limit as number) ?? 10
      let query = supabase
        .from('entities')
        .select('id, entity_id, name, type, subtype, description, confidence_score, resonance_score, status')
        .ilike('name', `%${q}%`)
        .limit(limit)
      if (type) query = query.eq('type', type)
      const { data } = await query
      return data ?? []
    }

    case 'get_entity': {
      const id = input.entity_id as string
      const [{ data: entity }, { data: claims }, { data: relationships }, { data: gaps }] = await Promise.all([
        supabase.from('entities').select('*').eq('id', id).single(),
        supabase.from('claims').select('id, content, confidence, resonance, status').contains('entity_ids', [id]).limit(20),
        supabase.from('relationships').select('id, relationship_type, confidence, is_current, from_entity_id, to_entity_id').or(`from_entity_id.eq.${id},to_entity_id.eq.${id}`).limit(20),
        supabase.from('knowledge_gaps').select('id, description, urgency_score, gap_type').contains('entity_ids', [id]).eq('is_resolved', false).limit(10),
      ])
      return { entity, claims: claims ?? [], relationships: relationships ?? [], open_gaps: gaps ?? [] }
    }

    case 'get_entity_relationships': {
      const id = input.entity_id as string
      const depth = Math.min((input.depth as number) ?? 2, 3)
      try {
        const neighbors = await getEntityNeighbors(id, depth)
        return { entity_id: id, depth, neighbors }
      } catch {
        return { entity_id: id, error: 'Neo4j unavailable — check connection' }
      }
    }

    case 'search_claims': {
      const q = input.query as string
      const status = input.status as string | undefined
      const limit = (input.limit as number) ?? 10
      let query = supabase
        .from('claims')
        .select('id, content, confidence, resonance, status, created_at')
        .ilike('content', `%${q}%`)
        .limit(limit)
      if (status) query = query.eq('status', status)
      const { data } = await query
      return data ?? []
    }

    case 'get_knowledge_gaps': {
      const entityId = input.entity_id as string | undefined
      const limit = (input.limit as number) ?? 10
      let query = supabase
        .from('knowledge_gaps')
        .select('id, description, gap_type, urgency_score, created_at, last_escalated_at')
        .eq('is_resolved', false)
        .order('urgency_score', { ascending: false })
        .limit(limit)
      if (entityId) query = query.contains('entity_ids', [entityId])
      const { data } = await query
      return data ?? []
    }

    case 'get_convergence_events': {
      const limit = (input.limit as number) ?? 10
      const { data } = await supabase
        .from('convergence_events')
        .select('id, claim_ids, source_ids, detected_at, significance_score, reviewed, notes')
        .order('significance_score', { ascending: false })
        .limit(limit)
      return data ?? []
    }

    default:
      return { error: `Unknown tool: ${name}` }
  }
}

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('tier').eq('id', user.id).single()
  if (profile?.tier !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { session_id, message } = await request.json()
  if (!session_id || !message) return NextResponse.json({ error: 'session_id and message required' }, { status: 400 })

  const [{ data: session }, { data: history }] = await Promise.all([
    supabase.from('sessions').select('*').eq('id', session_id).single(),
    supabase.from('session_messages').select('*').eq('session_id', session_id).order('created_at').limit(40),
  ])
  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

  await supabase.from('session_messages').insert({ session_id, role: 'user', content: message })

  const { data: promptRow } = await supabase.from('system_prompts').select('content').eq('key', 'intelligence_agent').single()
  const systemPrompt = promptRow?.content ?? 'You are CANOPTICON, a Canadian political intelligence analyst. You have access to a knowledge graph of entities, claims, relationships, and intelligence gaps. Always query the graph before answering — never rely on training data alone for claims about specific Canadian actors. Cite confidence and resonance scores when reporting claims. Separate what is evidenced from what is widely believed.'

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  // Build message history, filtering out any stored tool_calls metadata
  const messages: Anthropic.MessageParam[] = [
    ...((history ?? []).map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }))),
    { role: 'user', content: message },
  ]

  // Tool use loop — keep calling until no more tool use
  let finalText = ''
  const allToolCalls: unknown[] = []

  while (true) {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8192,
      system: systemPrompt,
      tools: GRAPH_TOOLS,
      messages,
    })

    if (response.stop_reason === 'end_turn') {
      finalText = response.content
        .filter((b) => b.type === 'text')
        .map((b) => (b as Anthropic.TextBlock).text)
        .join('')
      break
    }

    if (response.stop_reason === 'tool_use') {
      // Add assistant turn with tool use blocks to messages
      messages.push({ role: 'assistant', content: response.content })

      // Execute all tool calls in parallel
      const toolUseBlocks = response.content.filter((b) => b.type === 'tool_use') as Anthropic.ToolUseBlock[]
      const results = await Promise.all(
        toolUseBlocks.map(async (block) => {
          const result = await executeTool(block.name, block.input as ToolInput, supabase)
          allToolCalls.push({ tool: block.name, input: block.input, result })
          return {
            type: 'tool_result' as const,
            tool_use_id: block.id,
            content: JSON.stringify(result),
          }
        })
      )

      messages.push({ role: 'user', content: results })
      continue
    }

    // Unexpected stop reason — extract whatever text exists
    finalText = response.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as Anthropic.TextBlock).text)
      .join('')
    break
  }

  await supabase.from('session_messages').insert({
    session_id,
    role: 'assistant',
    content: finalText,
    tool_calls: allToolCalls.length > 0 ? allToolCalls : null,
  })

  await supabase.from('sessions').update({ updated_at: new Date().toISOString() }).eq('id', session_id)

  return NextResponse.json({ content: finalText, tool_calls_made: allToolCalls.length })
}
