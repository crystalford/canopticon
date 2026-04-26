"use client";

// Graph screen: full Cytoscape.js force-directed visualization of the
// entity substrate. Per operator decision, this uses Cytoscape from day
// one rather than a simpler SVG layout.

import { Card, MetadataStrip } from "@/components/primitives";
import { apiGet } from "@/lib/api-client";
import { useEffect, useRef, useState } from "react";

interface Entity {
  id: string;
  canonical_name: string;
  entity_type: string;
  heat_score: number;
  pinned_thesis_ids: string[];
}

interface Edge {
  from_entity_id: string;
  to_entity_id: string;
  relation_type: string;
  strength: number;
}

interface GraphData {
  nodes: Entity[];
  edges: Edge[];
}

const typeColors: Record<string, string> = {
  person: "#94b280",
  organization: "#8fa3c4",
  institution: "#d4a24a",
  corporation: "#d0a279",
  legislation: "#d14156",
  event: "#ede9de",
  concept: "#7a9c55",
  location: "#8a857a",
};

export default function GraphPage() {
  const [data, setData] = useState<GraphData | null>(null);
  const [selected, setSelected] = useState<Entity | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cyRef = useRef<unknown | null>(null);

  useEffect(() => {
    void apiGet<GraphData>("/v1/entities/graph").then(setData);
  }, []);

  useEffect(() => {
    if (!data || !containerRef.current) return;
    let active = true;
    let cleanup: (() => void) | null = null;
    void (async () => {
      const cytoscape = (await import("cytoscape")).default;
      if (!active || !containerRef.current) return;
      const cy = cytoscape({
        container: containerRef.current,
        elements: [
          ...data.nodes.map((n) => ({
            data: { id: n.id, label: n.canonical_name, type: n.entity_type, heat: n.heat_score },
          })),
          ...data.edges.map((e) => ({
            data: {
              id: `${e.from_entity_id}-${e.to_entity_id}-${e.relation_type}`,
              source: e.from_entity_id,
              target: e.to_entity_id,
              kind: e.relation_type,
              strength: e.strength,
            },
          })),
        ],
        layout: { name: "cose", animate: false, fit: true, padding: 30 },
        style: [
          {
            selector: "node",
            style: {
              "background-color": (ele: { data: (k: string) => string }) =>
                typeColors[ele.data("type")] ?? "#8a857a",
              label: "data(label)",
              "font-size": 9,
              "font-family": "JetBrains Mono, monospace",
              color: "#ede9de",
              "text-outline-width": 2,
              "text-outline-color": "#0f1218",
              width: 20,
              height: 20,
            },
          },
          {
            selector: "edge",
            style: {
              "line-color": "#242934",
              width: 1,
              "curve-style": "bezier",
              "target-arrow-shape": "triangle",
              "target-arrow-color": "#242934",
            },
          },
          {
            selector: "node:selected",
            style: { "border-width": 2, "border-color": "#ede9de" },
          },
        ],
      });

      cy.on("tap", "node", (evt: { target: { data: () => Record<string, unknown> } }) => {
        const id = evt.target.data().id as string;
        const ent = data.nodes.find((n) => n.id === id) ?? null;
        setSelected(ent);
      });

      cyRef.current = cy;
      cleanup = () => {
        cy.destroy();
        cyRef.current = null;
      };
    })();

    return () => {
      active = false;
      cleanup?.();
    };
  }, [data]);

  return (
    <main className="px-4 py-3">
      <header className="mb-3">
        <MetadataStrip>Graph · substrate</MetadataStrip>
        <h1 className="font-serif text-2xl text-cream-bright">Entity Graph</h1>
      </header>

      <div ref={containerRef} className="h-[60vh] w-full border border-border-soft bg-bg-deeper" />

      {selected && (
        <Card className="mt-3">
          <MetadataStrip>{selected.entity_type}</MetadataStrip>
          <h3 className="mt-1 font-serif text-base text-cream-bright">{selected.canonical_name}</h3>
          <div className="mt-2 font-mono text-[11px] text-text-dim">
            heat: {selected.heat_score.toFixed(2)}
          </div>
        </Card>
      )}
    </main>
  );
}
