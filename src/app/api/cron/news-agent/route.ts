import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { syncEntityToGraph, syncRelationshipToGraph } from '@/lib/neo4j/sync'
import { generateEmbedding } from '@/lib/embeddings'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 120

function verifyCron(request: NextRequest) {
  const secret = request.headers.get('authorization')?.replace('Bearer ', '')
  return secret === process.env.CRON_SECRET
}

interface ExtractedEntity {
  name: string
  type: string
  subtype?: string
  description?: string
}

interface ExtractedClaim {
  content: string
  confidence: number
  resonance: number
  entity_names: string[]
}

interface ExtractedRelationship {
  from_name: string
  to_name: string
  relationship_type: string
  confidence: number
}

interface ExtractionResult {
  entities: ExtractedEntity[]
  claims: ExtractedClaim[]
  relationships: ExtractedRelationship[]
}

const VALID_ENTITY_TYPES = ['person', 'organization', 'corporation', 'government_body', 'political_party', 'media_outlet', 'policy', 'event', 'place', 'concept']
const VALID_REL_TYPES = ['RELATES_TO', 'FUNDS', 'CONTROLS', 'EMPLOYS', 'MEMBER_OF', 'SUPPORTS', 'OPPOSES', 'CONTRADICTS']

export async function GET(request: NextRequest) {
  if (!verifyCron(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const { data: items, error } = await supabase
    .from('intake_queue')
    .select('*')
    .eq('status', 'pending')
    .order('created_at')
    .limit(10)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!items || items.length === 0) return NextResponse.json({ processed: 0, message: 'No pending items' })

  const { data: promptRow } = await supabase.from('system_prompts').select('content').eq('key', 'intake_classifier').single()

  let processed = 0
  let failed = 0

  for (const item of items) {
    await supabase.from('intake_queue').update({ status: 'processing' }).eq('id', item.id)

    try {
      const response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4096,
        system: promptRow?.content ?? `You are a Canadian political intelligence classifier. Extract structured data from news content.
Return ONLY valid JSON. No markdown fences, no explanation.`,
        messages: [{
          role: 'user',
          content: `Extract all entities, claims, and relationships from the following content.

Source URL: ${item.source_url ?? 'unknown'}

Content:
${item.raw_content}

Return JSON with this exact structure:
{
  "entities": [
    { "name": "string", "type": "person|organization|corporation|government_body|political_party|media_outlet|policy|event|place|concept", "subtype": "optional string", "description": "one sentence" }
  ],
  "claims": [
    { "content": "specific factual claim as a complete sentence", "confidence": 0.0-1.0, "resonance": 0.0-1.0, "entity_names": ["names of entities this claim is about"] }
  ],
  "relationships": [
    { "from_name": "entity name", "to_name": "entity name", "relationship_type": "FUNDS|CONTROLS|EMPLOYS|MEMBER_OF|SUPPORTS|OPPOSES|RELATES_TO", "confidence": 0.0-1.0 }
  ]
}

Confidence = quality of evidence in this source (A-tier source = 0.8+, blog = 0.3).
Resonance = how widely this is believed/reported (breaking exclusive = 0.2, widely confirmed = 0.8+).
Only include claims that are factually specific and verifiable.`,
        }],
      })

      const text = response.content[0].type === 'text' ? response.content[0].text : ''
      let extracted: ExtractionResult = { entities: [], claims: [], relationships: [] }
      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/)
        if (jsonMatch) extracted = JSON.parse(jsonMatch[0])
      } catch { /* keep empty */ }

      // --- Create entities ---
      const entityIdMap: Record<string, string> = {} // name → supabase UUID

      for (const e of (extracted.entities ?? [])) {
        if (!e.name || !VALID_ENTITY_TYPES.includes(e.type)) continue
        const entityId = `${e.type.substring(0, 4)}_${e.name.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 30)}_${Date.now()}`

        // Upsert by name (case-insensitive)
        const { data: existing } = await supabase
          .from('entities')
          .select('id, entity_id')
          .ilike('name', e.name)
          .limit(1)
          .single()

        if (existing) {
          entityIdMap[e.name] = existing.id
        } else {
          const { data: created } = await supabase
            .from('entities')
            .insert({
              entity_id: entityId,
              name: e.name,
              type: e.type,
              subtype: e.subtype ?? null,
              description: e.description ?? null,
              confidence_score: 0.4,
              resonance_score: 0.3,
              status: 'active',
              metadata: { source: item.source_url ?? null, intake_id: item.id },
            })
            .select('id, entity_id, name, type, subtype, description, confidence_score, resonance_score, status, metadata, created_at, updated_at')
            .single()

          if (created) {
            entityIdMap[e.name] = created.id
            syncEntityToGraph(created).catch(console.error)
          }
        }
      }

      // --- Create claims ---
      const createdClaimIds: string[] = []

      for (const c of (extracted.claims ?? [])) {
        if (!c.content || c.content.length < 10) continue
        const entityIds = (c.entity_names ?? [])
          .map((n: string) => entityIdMap[n])
          .filter(Boolean) as string[]

        const embedding = await generateEmbedding(c.content)

        const { data: claim } = await supabase
          .from('claims')
          .insert({
            content: c.content,
            claim_type: 'factual',
            confidence: Math.min(Math.max(c.confidence ?? 0.4, 0), 1),
            resonance: Math.min(Math.max(c.resonance ?? 0.3, 0), 1),
            entity_ids: entityIds,
            source_ids: [],
            status: 'unverified',
            embedding: embedding ?? null,
          })
          .select('id')
          .single()

        if (claim) createdClaimIds.push(claim.id)
      }

      // --- Create relationships ---
      for (const r of (extracted.relationships ?? [])) {
        const fromId = entityIdMap[r.from_name]
        const toId = entityIdMap[r.to_name]
        if (!fromId || !toId) continue
        const relType = VALID_REL_TYPES.includes(r.relationship_type) ? r.relationship_type : 'RELATES_TO'

        const { data: rel } = await supabase
          .from('relationships')
          .insert({
            from_entity_id: fromId,
            to_entity_id: toId,
            relationship_type: relType,
            confidence: Math.min(Math.max(r.confidence ?? 0.4, 0), 1),
            evidence_ids: [],
            is_current: true,
            metadata: { source: item.source_url ?? null, intake_id: item.id },
          })
          .select('id, from_entity_id, to_entity_id, relationship_type, confidence, evidence_ids, start_date, end_date, is_current, metadata, created_at')
          .single()

        if (rel) {
          const { data: fromEntity } = await supabase.from('entities').select('entity_id').eq('id', fromId).single()
          const { data: toEntity } = await supabase.from('entities').select('entity_id').eq('id', toId).single()
          if (fromEntity && toEntity) {
            syncRelationshipToGraph(rel, fromEntity.entity_id, toEntity.entity_id).catch(console.error)
          }
        }
      }

      await supabase.from('intake_queue').update({
        status: 'done',
        processed_at: new Date().toISOString(),
        extracted_entities: extracted.entities,
        extracted_claims: extracted.claims,
      }).eq('id', item.id)

      processed++
    } catch (err) {
      console.error('Intake processing error:', err)
      await supabase.from('intake_queue').update({ status: 'pending' }).eq('id', item.id)
      failed++
    }
  }

  return NextResponse.json({
    processed,
    failed,
    total: items.length,
  })
}
