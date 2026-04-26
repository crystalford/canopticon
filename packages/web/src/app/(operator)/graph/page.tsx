"use client";

import { Badge, ScreenHeader } from "@/components/primitives";
import { ApiError, apiGet } from "@/lib/api-client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface GraphNode {
  id: string;
  canonical_name: string;
  entity_type: string;
  degree: number;
  claim_count: number;
}

interface GraphEdge {
  source: string;
  target: string;
  weight: number;
  claim_ids: string[];
}

interface GraphPayload {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

interface ThesisOption {
  id: string;
  title: string;
}

interface PositionedNode extends GraphNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

const WIDTH = 900;
const HEIGHT = 600;
const CHARGE = -800;
const SPRING_LENGTH = 90;
const SPRING_K = 0.04;
const DAMPING = 0.82;
const ITERATIONS = 220;

export default function GraphPage() {
  const [payload, setPayload] = useState<GraphPayload | null>(null);
  const [theses, setTheses] = useState<ThesisOption[]>([]);
  const [thesisId, setThesisId] = useState("");
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(() => {
    const qs = thesisId ? `?thesis_id=${thesisId}` : "";
    apiGet<GraphPayload>(`/v1/graph${qs}`)
      .then(setPayload)
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : (err as Error).message));
  }, [thesisId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    apiGet<ThesisOption[]>("/v1/theses")
      .then((rows) => setTheses(rows.map((r) => ({ id: r.id, title: r.title }))))
      .catch(() => setTheses([]));
  }, []);

  const positioned = useForceLayout(payload);

  const hovered = hoveredId ? (positioned.find((n) => n.id === hoveredId) ?? null) : null;
  const connectedIds = useMemo(() => {
    if (!hoveredId || !payload) return new Set<string>();
    const ids = new Set<string>([hoveredId]);
    for (const e of payload.edges) {
      if (e.source === hoveredId) ids.add(e.target);
      else if (e.target === hoveredId) ids.add(e.source);
    }
    return ids;
  }, [hoveredId, payload]);

  return (
    <div className="px-6 py-8 max-w-6xl mx-auto">
      <ScreenHeader
        title="Graph"
        subtitle="entities co-cited in claims · edge weight = shared claim count"
        actions={
          <select
            value={thesisId}
            onChange={(e) => setThesisId(e.target.value)}
            className="block bg-bg-elevated border border-border-bright text-text px-3 py-2 font-mono text-xs focus:border-amber focus:outline-none"
          >
            <option value="">— all theses —</option>
            {theses.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
        }
      />

      {loadError && (
        <p className="text-signal font-mono text-xs mb-4">could not load: {loadError}</p>
      )}

      {!payload ? (
        <p className="text-text-faint font-mono text-xs uppercase tracking-widest">loading...</p>
      ) : payload.nodes.length === 0 ? (
        <p className="text-text-faint font-mono text-xs uppercase tracking-widest">
          no resolved entities yet · the graph populates as the resolver runs
        </p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
          <div className="border border-border-soft bg-bg-elevated overflow-hidden">
            <svg
              viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
              role="img"
              aria-label="entity-claim graph"
              className="w-full h-auto"
            >
              <title>entity-claim graph</title>
              {payload.edges.map((e) => {
                const a = positioned.find((n) => n.id === e.source);
                const b = positioned.find((n) => n.id === e.target);
                if (!a || !b) return null;
                const dimmed =
                  hoveredId !== null && !(connectedIds.has(e.source) && connectedIds.has(e.target));
                return (
                  <line
                    key={`${e.source}-${e.target}`}
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke={dimmed ? "#1b1f28" : "#5a7349"}
                    strokeOpacity={dimmed ? 0.3 : Math.min(0.85, 0.25 + e.weight * 0.15)}
                    strokeWidth={Math.min(4, 0.5 + e.weight * 0.5)}
                  />
                );
              })}
              {positioned.map((n) => {
                const radius = 4 + Math.min(14, n.degree * 1.5);
                const dimmed = hoveredId !== null && !connectedIds.has(n.id);
                const fill = nodeColor(n.entity_type);
                return (
                  <g
                    key={n.id}
                    onMouseEnter={() => setHoveredId(n.id)}
                    onMouseLeave={() => setHoveredId(null)}
                  >
                    <circle
                      cx={n.x}
                      cy={n.y}
                      r={radius}
                      fill={fill}
                      fillOpacity={dimmed ? 0.18 : 0.85}
                      stroke={dimmed ? "transparent" : "#0f1218"}
                      strokeWidth={1}
                    />
                    {(hoveredId === n.id || n.degree >= 4) && (
                      <text
                        x={n.x}
                        y={n.y - radius - 4}
                        textAnchor="middle"
                        fontSize={11}
                        fontFamily="JetBrains Mono, monospace"
                        fill={dimmed ? "#4f4b42" : "#ede9de"}
                        pointerEvents="none"
                      >
                        {n.canonical_name}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
          <aside className="space-y-4">
            <section>
              <h2 className="font-mono text-xs uppercase tracking-widest text-text-dim mb-2">
                graph
              </h2>
              <p className="text-text font-mono text-xs">
                {payload.nodes.length} entities · {payload.edges.length} edges
              </p>
            </section>

            {hovered && (
              <section className="border-l-2 border-amber pl-3">
                <Badge tone="neutral">{hovered.entity_type}</Badge>
                <p className="text-cream font-serif mt-1">{hovered.canonical_name}</p>
                <p className="text-text-faint font-mono text-xs mt-1">
                  degree {hovered.degree} · {hovered.claim_count} claims
                </p>
                <Link
                  href={`/entities/${hovered.id}` as never}
                  className="text-text-dim hover:text-amber font-mono text-xs uppercase tracking-widest mt-2 block"
                >
                  open entity →
                </Link>
              </section>
            )}

            <section>
              <h2 className="font-mono text-xs uppercase tracking-widest text-text-dim mb-2">
                top by degree
              </h2>
              <ol className="space-y-1">
                {[...payload.nodes]
                  .sort((a, b) => b.degree - a.degree)
                  .slice(0, 8)
                  .map((n) => (
                    <li key={n.id}>
                      <Link
                        href={`/entities/${n.id}` as never}
                        className="text-text-dim hover:text-amber font-mono text-xs"
                        onMouseEnter={() => setHoveredId(n.id)}
                        onMouseLeave={() => setHoveredId(null)}
                      >
                        {n.canonical_name}
                        <span className="text-text-faint ml-2">{n.degree}</span>
                      </Link>
                    </li>
                  ))}
              </ol>
            </section>
          </aside>
        </div>
      )}
    </div>
  );
}

function useForceLayout(payload: GraphPayload | null): PositionedNode[] {
  const cache = useRef<Map<string, { x: number; y: number; vx: number; vy: number }>>(new Map());

  return useMemo(() => {
    if (!payload || payload.nodes.length === 0) return [];

    const cx = WIDTH / 2;
    const cy = HEIGHT / 2;

    // Seed positions (use cached positions when entity persists across
    // re-renders, otherwise random).
    const nodes: PositionedNode[] = payload.nodes.map((n, i) => {
      const cached = cache.current.get(n.id);
      if (cached) {
        return { ...n, x: cached.x, y: cached.y, vx: cached.vx, vy: cached.vy };
      }
      const angle = (i / payload.nodes.length) * Math.PI * 2;
      const r = 200;
      return {
        ...n,
        x: cx + Math.cos(angle) * r + (Math.random() - 0.5) * 30,
        y: cy + Math.sin(angle) * r + (Math.random() - 0.5) * 30,
        vx: 0,
        vy: 0,
      };
    });

    const idIndex: Record<string, number> = {};
    nodes.forEach((n, i) => {
      idIndex[n.id] = i;
    });

    const edges = payload.edges
      .map((e) => ({
        a: idIndex[e.source],
        b: idIndex[e.target],
        weight: e.weight,
      }))
      .filter(
        (e): e is { a: number; b: number; weight: number } =>
          typeof e.a === "number" && typeof e.b === "number",
      );

    for (let step = 0; step < ITERATIONS; step++) {
      // Charge repulsion between every pair.
      for (let i = 0; i < nodes.length; i++) {
        const ni = nodes[i];
        if (!ni) continue;
        for (let j = i + 1; j < nodes.length; j++) {
          const nj = nodes[j];
          if (!nj) continue;
          const dx = ni.x - nj.x;
          const dy = ni.y - nj.y;
          const distSq = dx * dx + dy * dy + 0.01;
          const force = CHARGE / distSq;
          const dist = Math.sqrt(distSq);
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          ni.vx -= fx;
          ni.vy -= fy;
          nj.vx += fx;
          nj.vy += fy;
        }
      }

      // Spring attraction along each edge.
      for (const e of edges) {
        const a = nodes[e.a];
        const b = nodes[e.b];
        if (!a || !b) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const desired = SPRING_LENGTH;
        const force = SPRING_K * (dist - desired) * (1 + Math.log(1 + e.weight));
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        a.vx += fx;
        a.vy += fy;
        b.vx -= fx;
        b.vy -= fy;
      }

      // Pull toward the canvas center to prevent drift.
      for (const n of nodes) {
        n.vx += (cx - n.x) * 0.005;
        n.vy += (cy - n.y) * 0.005;
        n.vx *= DAMPING;
        n.vy *= DAMPING;
        n.x += n.vx;
        n.y += n.vy;
        // Clamp inside canvas with a margin.
        n.x = Math.max(20, Math.min(WIDTH - 20, n.x));
        n.y = Math.max(20, Math.min(HEIGHT - 20, n.y));
      }
    }

    // Cache for next render.
    const next = new Map<string, { x: number; y: number; vx: number; vy: number }>();
    for (const n of nodes) {
      next.set(n.id, { x: n.x, y: n.y, vx: 0, vy: 0 });
    }
    cache.current = next;

    return nodes;
  }, [payload]);
}

function nodeColor(entity_type: string): string {
  switch (entity_type) {
    case "person":
      return "#d4a24a";
    case "organization":
    case "corporation":
      return "#8fa3c4";
    case "institution":
    case "department":
    case "office":
      return "#94b280";
    case "legislation":
      return "#d0a279";
    case "event":
      return "#d14156";
    case "location":
      return "#7a9c55";
    case "concept":
      return "#ede9de";
    default:
      return "#8a857a";
  }
}
