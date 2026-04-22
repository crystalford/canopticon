'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import cytoscape from 'cytoscape'
import { X, ZoomIn, ZoomOut, Maximize2, Loader2, Search, GitBranch } from 'lucide-react'

interface EntityDetail {
  id: string
  label: string
  type: string
  subtype?: string
  description?: string
  confidence: number
  resonance: number
  color: string
}

interface GraphData {
  nodes: { data: EntityDetail }[]
  edges: { data: { id: string; source: string; target: string; label: string; confidence: number } }[]
}

const ENTITY_TYPES = ['person', 'organization', 'corporation', 'government_body', 'political_party', 'media_outlet', 'policy', 'event', 'place', 'concept']

const TYPE_COLORS: Record<string, string> = {
  person: '#e8a020',
  organization: '#4da6ff',
  corporation: '#3dd68c',
  government_body: '#c084fc',
  political_party: '#e63946',
  media_outlet: '#f97316',
  policy: '#64748b',
  event: '#94a3b8',
  place: '#6b7280',
  concept: '#8b949e',
}

export default function GraphView() {
  const containerRef = useRef<HTMLDivElement>(null)
  const cyRef = useRef<cytoscape.Core | null>(null)

  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<EntityDetail | null>(null)
  const [selectedClaims, setSelectedClaims] = useState<{ content: string; confidence: number; status: string }[]>([])
  const [diggingDeeper, setDiggingDeeper] = useState(false)
  const [deeperDone, setDeeperDone] = useState(false)
  const [graphMeta, setGraphMeta] = useState({ nodes: 0, edges: 0 })
  const [activeTypes, setActiveTypes] = useState<Set<string>>(new Set(ENTITY_TYPES))
  const [minConfidence, setMinConfidence] = useState(0)

  const loadGraph = useCallback(async () => {
    setLoading(true)
    const types = Array.from(activeTypes).join(',')
    const res = await fetch(`/api/graph?limit=150&types=${types}&min_confidence=${minConfidence}`)
    const data: GraphData & { entity_count: number; edge_count: number } = await res.json()
    setGraphMeta({ nodes: data.entity_count ?? 0, edges: data.edge_count ?? 0 })

    if (!containerRef.current) { setLoading(false); return }

    // Destroy existing instance
    if (cyRef.current) { cyRef.current.destroy(); cyRef.current = null }

    const cy = cytoscape({
      container: containerRef.current,
      elements: [...(data.nodes ?? []), ...(data.edges ?? [])],
      style: [
        {
          selector: 'node',
          style: {
            'background-color': 'data(color)',
            'label': 'data(label)',
            'color': '#e6edf3',
            'font-size': 10,
            'font-family': '"JetBrains Mono", monospace',
            'text-valign': 'bottom',
            'text-halign': 'center',
            'text-margin-y': 5,
            'width': 'data(size)',
            'height': 'data(size)',
            'border-width': 1,
            'border-color': '#30363d',
            'text-background-color': '#080a0f',
            'text-background-opacity': 0.7,
            'text-background-padding': '2px',
          },
        },
        {
          selector: 'node:selected',
          style: {
            'border-color': '#e8a020',
            'border-width': 3,
            'background-opacity': 1,
          },
        },
        {
          selector: 'node.faded',
          style: { 'opacity': 0.2 },
        },
        {
          selector: 'edge',
          style: {
            'line-color': '#30363d',
            'target-arrow-color': '#30363d',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'width': 1,
            'font-size': 8,
            'color': '#484f58',
            'font-family': '"JetBrains Mono", monospace',
          },
        },
        {
          selector: 'edge:selected',
          style: {
            'line-color': '#e8a020',
            'target-arrow-color': '#e8a020',
            'label': 'data(label)',
            'width': 2,
          },
        },
        {
          selector: 'edge.faded',
          style: { 'opacity': 0.05 },
        },
      ],
      layout: {
        name: 'cose',
        animate: true,
        animationDuration: 800,
        nodeRepulsion: () => 8000,
        idealEdgeLength: () => 80,
        edgeElasticity: () => 100,
        gravity: 0.25,
        numIter: 1000,
        fit: true,
        padding: 40,
      } as cytoscape.LayoutOptions,
      wheelSensitivity: 0.3,
    })

    // Node tap → show details + fade unconnected
    cy.on('tap', 'node', (evt) => {
      const node = evt.target
      const nodeData = node.data() as EntityDetail
      setSelected(nodeData)
      setDeeperDone(false)

      // Fade nodes not connected to this one
      const connected = node.closedNeighborhood()
      cy.elements().addClass('faded')
      connected.removeClass('faded')

      // Fetch claims for this entity
      fetch(`/api/claims?entity_id=${nodeData.id}&limit=5`)
        .then(r => r.json())
        .then(claims => setSelectedClaims(Array.isArray(claims) ? claims : []))
        .catch(() => setSelectedClaims([]))
    })

    // Tap on background → clear selection
    cy.on('tap', (evt) => {
      if (evt.target === cy) {
        setSelected(null)
        cy.elements().removeClass('faded')
      }
    })

    cyRef.current = cy
    setLoading(false)
  }, [activeTypes, minConfidence])

  useEffect(() => {
    loadGraph()
    return () => { cyRef.current?.destroy(); cyRef.current = null }
  }, [loadGraph])

  function zoomIn() { cyRef.current?.zoom({ level: (cyRef.current.zoom() * 1.3), renderedPosition: { x: containerRef.current!.offsetWidth / 2, y: containerRef.current!.offsetHeight / 2 } }) }
  function zoomOut() { cyRef.current?.zoom({ level: (cyRef.current.zoom() * 0.77), renderedPosition: { x: containerRef.current!.offsetWidth / 2, y: containerRef.current!.offsetHeight / 2 } }) }
  function fitAll() { cyRef.current?.fit(undefined, 40) }

  function toggleType(type: string) {
    setActiveTypes(prev => {
      const next = new Set(prev)
      next.has(type) ? next.delete(type) : next.add(type)
      return next
    })
  }

  async function digDeeper() {
    if (!selected) return
    setDiggingDeeper(true)
    await fetch('/api/research-queries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query_text: `Deep background profile on ${selected.label}: institutional roles, funding relationships, political connections, career history, and any controversies or significant actions in Canadian politics.`,
        category: 'entity_monitor',
        entity_id: selected.id,
      }),
    })
    setDiggingDeeper(false)
    setDeeperDone(true)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Controls bar */}
      <div className="flex items-center gap-3 p-3 border-b border-border bg-base shrink-0 flex-wrap">
        <div className="flex items-center gap-1">
          {ENTITY_TYPES.map((type) => (
            <button
              key={type}
              onClick={() => toggleType(type)}
              title={type}
              className="w-3 h-3 rounded-full border transition-opacity"
              style={{
                backgroundColor: TYPE_COLORS[type],
                borderColor: TYPE_COLORS[type],
                opacity: activeTypes.has(type) ? 1 : 0.2,
              }}
            />
          ))}
          <span className="font-mono text-[10px] text-text-muted ml-2">filter types</span>
        </div>

        <div className="flex items-center gap-2 ml-2">
          <span className="font-mono text-[10px] text-text-muted">min conf</span>
          <input
            type="range" min={0} max={0.9} step={0.1} value={minConfidence}
            onChange={(e) => setMinConfidence(parseFloat(e.target.value))}
            className="w-20 accent-signal"
          />
          <span className="font-mono text-[10px] text-text-muted">{Math.round(minConfidence * 100)}%</span>
        </div>

        <div className="flex items-center gap-1 ml-auto">
          <span className="font-mono text-[10px] text-text-muted mr-2">
            {graphMeta.nodes} nodes · {graphMeta.edges} edges
          </span>
          <button onClick={zoomIn} className="p-1.5 text-text-muted hover:text-text-primary transition-colors"><ZoomIn size={13} /></button>
          <button onClick={zoomOut} className="p-1.5 text-text-muted hover:text-text-primary transition-colors"><ZoomOut size={13} /></button>
          <button onClick={fitAll} className="p-1.5 text-text-muted hover:text-text-primary transition-colors"><Maximize2 size={13} /></button>
          <button onClick={loadGraph} className="p-1.5 text-text-muted hover:text-signal transition-colors" title="Reload graph"><Search size={13} /></button>
        </div>
      </div>

      {/* Canvas + side panel */}
      <div className="flex flex-1 min-h-0">
        {/* Cytoscape canvas */}
        <div className="relative flex-1">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-void/80 z-10">
              <Loader2 size={20} className="animate-spin text-signal" />
              <span className="font-mono text-xs text-text-muted ml-3">Computing layout...</span>
            </div>
          )}
          <div ref={containerRef} className="w-full h-full bg-void" />

          {/* Empty state */}
          {!loading && graphMeta.nodes === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
              <GitBranch size={32} className="text-text-muted mb-3" />
              <p className="font-mono text-xs text-text-muted">Graph is empty.</p>
              <p className="font-mono text-xs text-text-muted mt-1">Add entities via intake or research agent.</p>
            </div>
          )}
        </div>

        {/* Side panel */}
        {selected && (
          <div className="w-72 border-l border-border bg-base overflow-y-auto shrink-0 flex flex-col">
            <div className="flex items-start justify-between p-4 border-b border-border">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: selected.color }} />
                  <span className="font-mono text-[10px] text-text-muted">{selected.type}</span>
                  {selected.subtype && <span className="font-mono text-[10px] text-text-muted">· {selected.subtype}</span>}
                </div>
                <h3 className="font-display text-sm font-bold text-text-primary">{selected.label}</h3>
              </div>
              <button onClick={() => { setSelected(null); cyRef.current?.elements().removeClass('faded') }}
                className="text-text-muted hover:text-text-primary transition-colors shrink-0 ml-2">
                <X size={14} />
              </button>
            </div>

            <div className="p-4 space-y-4 flex-1">
              {selected.description && (
                <p className="font-body text-xs text-text-secondary leading-relaxed">{selected.description}</p>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div className="bg-void border border-border rounded-sm p-2">
                  <div className="font-mono text-base font-bold text-text-primary">{Math.round(selected.confidence * 100)}%</div>
                  <div className="font-mono text-[10px] text-text-muted">confidence</div>
                </div>
                <div className="bg-void border border-border rounded-sm p-2">
                  <div className="font-mono text-base font-bold text-text-primary">{Math.round(selected.resonance * 100)}%</div>
                  <div className="font-mono text-[10px] text-text-muted">resonance</div>
                </div>
              </div>

              {selectedClaims.length > 0 && (
                <div className="space-y-2">
                  <p className="font-mono text-[10px] text-text-secondary uppercase tracking-wider">Recent Claims</p>
                  {selectedClaims.map((c, i) => (
                    <div key={i} className="bg-void border border-border rounded-sm p-2">
                      <p className="font-body text-xs text-text-secondary leading-relaxed line-clamp-3">{c.content}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`font-mono text-[9px] ${c.status === 'verified' ? 'text-confirmed' : c.status === 'disputed' ? 'text-disputed' : 'text-text-muted'}`}>{c.status}</span>
                        <span className="font-mono text-[9px] text-text-muted">{Math.round(c.confidence * 100)}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-2 border-t border-border pt-4">
                <a
                  href={`/admin/entities/${selected.id}`}
                  className="btn-secondary w-full text-center block font-mono text-xs"
                >
                  View Full Profile →
                </a>

                <button
                  onClick={digDeeper}
                  disabled={diggingDeeper || deeperDone}
                  className="w-full font-mono text-xs px-3 py-2 rounded-sm border transition-colors disabled:opacity-50
                    border-signal/30 text-signal hover:bg-signal/10"
                >
                  {diggingDeeper ? (
                    <span className="flex items-center justify-center gap-2"><Loader2 size={12} className="animate-spin" /> Queuing research...</span>
                  ) : deeperDone ? (
                    '✓ Research queued'
                  ) : (
                    'Dig Deeper'
                  )}
                </button>
                {deeperDone && (
                  <p className="font-mono text-[10px] text-text-muted text-center">
                    Research query added. Run Research Agent from System panel.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-4 py-2 border-t border-border bg-base shrink-0 flex-wrap">
        {Object.entries(TYPE_COLORS).map(([type, color]) => (
          <div key={type} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
            <span className="font-mono text-[10px] text-text-muted">{type.replace('_', ' ')}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
