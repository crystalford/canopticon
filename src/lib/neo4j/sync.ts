import { runQuery } from './client'
import type { Entity, Relationship } from '@/types/database'

export async function syncEntityToGraph(entity: Entity): Promise<void> {
  await runQuery(
    `MERGE (e:Entity {entity_id: $entity_id})
     SET e.name = $name,
         e.type = $type,
         e.subtype = $subtype,
         e.confidence = $confidence,
         e.resonance = $resonance,
         e.status = $status,
         e.updated_at = datetime()
     RETURN e`,
    {
      entity_id: entity.entity_id,
      name: entity.name,
      type: entity.type,
      subtype: entity.subtype ?? '',
      confidence: entity.confidence_score,
      resonance: entity.resonance_score,
      status: entity.status,
    }
  )
}

export async function syncRelationshipToGraph(rel: Relationship, fromEntityId: string, toEntityId: string): Promise<void> {
  await runQuery(
    `MATCH (a:Entity {entity_id: $from_entity_id})
     MATCH (b:Entity {entity_id: $to_entity_id})
     MERGE (a)-[r:RELATES_TO {rel_id: $rel_id}]->(b)
     SET r.type = $rel_type,
         r.confidence = $confidence,
         r.is_current = $is_current,
         r.updated_at = datetime()
     RETURN r`,
    {
      from_entity_id: fromEntityId,
      to_entity_id: toEntityId,
      rel_id: rel.id,
      rel_type: rel.relationship_type,
      confidence: rel.confidence,
      is_current: rel.is_current,
    }
  )
}

export async function deleteEntityFromGraph(entityId: string): Promise<void> {
  await runQuery(
    `MATCH (e:Entity {entity_id: $entity_id}) DETACH DELETE e`,
    { entity_id: entityId }
  )
}

export async function getEntityNeighbors(entityId: string, depth = 2): Promise<unknown[]> {
  return runQuery(
    `MATCH path = (e:Entity {entity_id: $entity_id})-[*1..${depth}]-(neighbor:Entity)
     RETURN neighbor.entity_id as entity_id, neighbor.name as name, neighbor.type as type,
            length(path) as distance
     ORDER BY distance
     LIMIT 50`,
    { entity_id: entityId }
  )
}
