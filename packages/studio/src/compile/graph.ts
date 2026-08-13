// THE SCENE GRAPH — a scene is a typed tree of visual programs.
//
// WHAT THIS RETIRES. `ground` as a privileged concept.
//
// The compiler has had two ideas of what a shot is, stacked awkwardly on
// each other. The old one: a CHAIN, plus a second input called a GROUND
// that happened to also be a chain. The new one, which the N-plane stack
// was already straining toward: a SCENE is a tree, its nodes are semantic,
// and each node's children are ordinary visual programs.
//
// The difference is not cosmetic. Under `ground`:
//
//   - there was exactly one second input per chain, so a scene could hold
//     a FIELD or a SETTING and never both;
//   - `planGround` was the gatekeeper for ALL layering, so a restrained
//     film lost the city the sentence named — a decision about decorative
//     texture silently deciding a question about depiction;
//   - "the ground is an image" was a rule of the architecture rather than
//     a fact about a particular node.
//
// Under a graph, all three go away, and the thing that decides whether two
// visual elements can interact is the TYPE SYSTEM, not the slot's name.
//
// THE ONE STRUCTURAL RULE.
//
//   A node's children are composed within it, far to near, and the node's
//   own program is the deepest thing inside it.
//
// That single rule covers both readings a scene needs:
//
//   SCENE                        a root with no program of its own —
//   ├── SETTING    city          the scene IS its children, ordered by
//   ├── COUNTERPOINT             depth
//   └── SUBJECT    insects
//
//   CITY           plate         a node WITH a program — the plate is the
//   └── STREET                   deepest thing in it and its children
//       └── PEOPLE               stand in front, which is what containment
//                                means
//
// HOW A TREE BECOMES SOMETHING THE RENDERER RUNS. It does not need a new
// executor. A compositor already takes an upstream on one input and a
// chain of its own on the other, and that chain may itself end in a
// compositor. So the tree SERIALISES as nested grounds — `flattenGraph`
// is the whole of it — and the executor that has recursed since the day
// grounds were added runs it unchanged. The graph is the representation;
// nesting is its wire format.
//
// TYPED INTERACTION, WHICH IS THE POINT.
//
// Not every child composes the same way, and the child's own OUTPUT TYPE
// decides. A child whose program emits pixels sits behind or in front of
// what is around it. A child whose program emits a FIELD cannot: a field
// compositor reads a field's NUMBERS, and numbers belong on the second
// input. So a field child INVERTS — it becomes the ground and everything
// accumulated so far becomes the upstream, which is the difference between
// a gravity field moving a sentence and a gravity field being painted over
// by one.
//
// That inversion is not a special case bolted on. It is what "the type
// system determines whether these things can interact" looks like when it
// is real.

import { PRIMITIVES } from "../primitives/registry.ts";
import type { ComposedNode } from "./compose.ts";
import { type Beat, type Style, buildConstruction } from "./construct.ts";
import { groundSatisfies } from "./ground.ts";
import { type Plane, type PlaneRole, applyPlane } from "./scene-plan.ts";

/** What a node is, semantically. `ATMOSPHERE` is the one role that is not
 *  a `PlaneRole`: it is not a thing the sentence names or implies, it is
 *  the film's own texture — the field, the grain, the weather. Kept
 *  distinct precisely so a contested line can refuse ATMOSPHERE while
 *  keeping its SETTING, which the old single gate could not express. */
export type NodeRole = PlaneRole | "ATMOSPHERE" | "SCENE";

export interface SceneNode {
  role: NodeRole;
  /** The noun this node came from, verbatim, or null when nothing named
   *  it. Same contract a plane keeps. */
  from: string | null;
  depth: number;
  weight: number;
  /** This node's own visual program — a linear chain. Empty on the root,
   *  which is the scene rather than a thing in it. */
  program: ComposedNode[];
  /** Composed WITHIN this node, ordered far to near. */
  children: SceneNode[];
  /** Two-input primitive that puts what is behind this node behind it. */
  compositor: string;
  /** True when this node's program belongs on the SECOND input rather
   *  than the first — a FIELD acts ON what is around it and cannot be
   *  layered over it. Decided from the program's output type. */
  inverted: boolean;
  why: string;
}

/** The plain depth compositor. Used unless a node's TYPE demands another
 *  one — a blend mode is a claim and a mask is redaction, and neither is
 *  what "this is behind that" means. */
const OVER = "layer_over";
/** What a FIELD-emitting node is composed with. It reads the field's
 *  numbers rather than its picture, which is why such a node inverts. */
const DISPLACE = "field_displace";

/** What a program actually EMITS — the output type of its last painting
 *  stage. This is the number the graph's typing decisions are made from,
 *  so it is read off the registry rather than assumed from the role. */
export function emits(program: ComposedNode[]): string[] {
  const tail = program[program.length - 1];
  return tail ? (PRIMITIVES[tail.primitiveId]?.outputs ?? []) : [];
}

export interface GraphBuild {
  root: SceneNode;
  /** Nodes the frame budget could not pay for, and nodes whose type could
   *  not compose with what was around them. Both reported, never silent. */
  dropped: { role: string; why: string }[];
}

export interface GraphInputs {
  planes: Plane[];
  beat: Beat;
  style: Style;
  sceneIndex: number;
  base: Record<string, number>;
  /** The SUBJECT's already-built program. The graph does not rebuild it —
   *  precedence, pins, treatments, motifs and the restraint ceiling have
   *  all already had their say on it, and re-deriving it here would be a
   *  second composition engine. */
  subject: ComposedNode[];
  /** An optional ATMOSPHERE program — the film's own texture, proposed by
   *  `ground.ts`. One child among others now, rather than the gate every
   *  other layer had to pass through. */
  atmosphere: { program: string[]; params: Record<string, number>; why: string } | null;
  budgetMs: number;
}

/** Assemble the scene as a tree.
 *
 *  `planes` arrive far to near. The SUBJECT plane is matched to the
 *  already-built subject program rather than rebuilt; everything behind it
 *  is constructed here with the same `buildConstruction` the subject used,
 *  because one construction vocabulary instantiated in different semantic
 *  roles is the whole point — a "background renderer" would be a second
 *  implementation of the eight constructions. */
export function buildGraph(input: GraphInputs): GraphBuild {
  const { planes, beat, style, sceneIndex, base } = input;
  const dropped: GraphBuild["dropped"] = [];
  const children: SceneNode[] = [];
  let spend = 0;

  const afford = (nodes: ComposedNode[]): boolean => {
    const cost = nodes.reduce((n, x) => n + x.costMsPerFrame, 0) + COMPOSITOR_MS;
    if (spend + cost > input.budgetMs) return false;
    spend += cost;
    return true;
  };

  // BEHIND THE SUBJECT, far to near. Built near-first so that when the
  // budget runs out the film loses its FURTHEST layer — the least
  // entitled to the frame — rather than the backdrop its subject stands
  // against.
  // Sorted by DEPTH, not by the order the planner happened to push them.
  // A tree whose children are in planning order is not a depth order, and
  // the difference is invisible until two roles swap places on screen.
  const background = planes
    .filter((p) => p.role !== "SUBJECT" && p.role !== "EDITORIAL")
    .sort((a, b) => a.depth - b.depth);
  const admitted: SceneNode[] = [];
  for (let i = background.length - 1; i >= 0; i--) {
    const plane = background[i];
    if (!plane) continue;
    const built = buildConstruction(plane.construction, beat, style);
    if (!built || built.length === 0) {
      dropped.push({ role: plane.role, why: `${plane.construction} could not be built` });
      continue;
    }
    const program = built.map<ComposedNode>((n, j) => {
      const seed = 7000 + sceneIndex * 17 + i * 211 + j;
      return {
        primitiveId: n.primitiveId,
        // THE SEED REACHES THE TRANSLATION. Population is a character,
        // not a count — see `applyPlane`. Passing the node's own seed is
        // what makes two scenes at the same population look like two
        // streets rather than one street rendered twice.
        params: applyPlane(n.primitiveId, { ...base, ...n.params }, plane, seed),
        seed,
        costMsPerFrame: PRIMITIVES[n.primitiveId]?.estimatedCostMsPerFrame ?? 4,
        reason: `${plane.role.toLowerCase()} — ${n.reason}`,
      };
    });
    if (!afford(program)) {
      dropped.push({ role: plane.role, why: "frame budget" });
      continue;
    }
    admitted.unshift(nodeFor(plane, program));
  }
  children.push(...admitted);

  // THE SUBJECT, already built.
  const subjectPlane = planes.find((p) => p.role === "SUBJECT");
  children.push({
    role: "SUBJECT",
    from: subjectPlane?.from ?? null,
    depth: subjectPlane?.depth ?? 0.55,
    weight: subjectPlane?.weight ?? 0.85,
    program: input.subject,
    children: [],
    compositor: OVER,
    inverted: false,
    why: "what the sentence is about",
  });

  // ATMOSPHERE — the film's own texture, and ALWAYS inverted.
  //
  // Last in the child list and deepest in the picture, which reads as a
  // contradiction until you follow what `inverted` means: this node's
  // program goes on the SECOND input, and a compositor's second input
  // renders behind its first. So applying it last is what puts it behind
  // everything. Applying it as an ordinary first child would make the
  // whole scene ITS ground — which is what the first build of this file
  // did, and it turned a subject chain into the background of a
  // reaction-diffusion plate.
  //
  // Its compositor still comes from its TYPE. A field emits numbers and
  // gets `field_displace`, which reads them; a picture gets the plain
  // depth compositor. That is the one decision the graph makes from what
  // a program emits rather than from what it means.
  if (input.atmosphere) {
    const program = input.atmosphere.program.map<ComposedNode>((primitiveId, j) => ({
      primitiveId,
      params: { ...base },
      seed: 9000 + sceneIndex * 17 + j,
      costMsPerFrame: PRIMITIVES[primitiveId]?.estimatedCostMsPerFrame ?? 4,
      reason: `atmosphere — ${input.atmosphere?.why ?? "the film's own texture"}`,
    }));
    if (afford(program)) {
      const field = emits(program).includes("FIELD");
      children.push({
        role: "ATMOSPHERE",
        from: null,
        depth: 0.02,
        weight: 0.5,
        program,
        children: [],
        compositor: field ? DISPLACE : OVER,
        inverted: true,
        why: input.atmosphere.why,
      });
    } else {
      dropped.push({ role: "ATMOSPHERE", why: "frame budget" });
    }
  }

  return {
    root: {
      role: "SCENE",
      from: null,
      depth: 0,
      weight: 1,
      program: [],
      children,
      compositor: OVER,
      inverted: false,
      why: "the scene is its children",
    },
    dropped,
  };
}

const COMPOSITOR_MS = PRIMITIVES[OVER]?.estimatedCostMsPerFrame ?? 4;

function nodeFor(plane: Plane, program: ComposedNode[]): SceneNode {
  return {
    role: plane.role,
    from: plane.from,
    depth: plane.depth,
    weight: plane.weight,
    program,
    children: [],
    compositor: OVER,
    inverted: false,
    why: `${plane.role.toLowerCase()}${plane.from ? ` (${plane.from})` : ""}`,
  };
}

export interface Flattened {
  chain: ComposedNode[];
  /** Children the type system refused, with the reason. A refusal here is
   *  a real answer — a compositor handed something it cannot read would
   *  composite nothing and look like it worked. */
  refused: { role: string; why: string }[];
}

/** THE TREE, SERIALISED FOR AN EXECUTOR THAT ONLY KNOWS CHAINS.
 *
 *  One rule, applied recursively: a node's own program is the deepest
 *  thing in it, and each child in turn is composited in front of
 *  everything accumulated so far.
 *
 *  Two shapes come out of that, and they are the same shape:
 *
 *    [ …child… , compositor(ground: everything behind) ]
 *
 *  and for an INVERTED child, whose program must sit on the second input
 *  because its type says so:
 *
 *    [ …everything behind… , compositor(ground: child) ]
 *
 *  The second is how a gravity field moves a sentence instead of being
 *  painted over by it, and it falls out of the type check rather than
 *  being a case anyone wrote by hand. */
export function flattenGraph(node: SceneNode, base: Record<string, number>): Flattened {
  const refused: Flattened["refused"] = [];
  let acc: ComposedNode[] | null = node.program.length > 0 ? [...node.program] : null;
  let behind: SceneNode = node;

  for (const child of node.children) {
    const inner = flattenGraph(child, base);
    refused.push(...inner.refused);
    if (inner.chain.length === 0) continue;
    if (acc === null) {
      acc = inner.chain;
      behind = child;
      continue;
    }

    // WHICH SIDE THE CHILD GOES ON, decided by what it emits.
    const upstream = child.inverted ? acc : inner.chain;
    const ground = child.inverted ? inner.chain : acc;
    const satisfied = groundSatisfies(
      child.compositor,
      ground.map((n) => n.primitiveId),
    );
    if (satisfied !== true) {
      // Refused rather than composited into nothing. The child is dropped
      // and the rest of the scene stands — degrade, flag, continue.
      refused.push({ role: child.role, why: satisfied });
      continue;
    }
    // WHOSE WEIGHT THE COMPOSITOR CARRIES. It answers "how much of the
    // frame does the thing BEHIND me keep", so its parameters come from
    // whichever node actually ended up behind — which for an inverted
    // child is the child itself, not the node it displaced.
    const rear = child.inverted ? child : behind;
    acc = [
      ...upstream,
      {
        primitiveId: child.compositor,
        // `applyPlane` is the only place the weight → parameter mapping
        // lives — standing rule 9.
        params: applyPlane(
          child.compositor,
          { ...base },
          {
            role: rear.role === "SCENE" ? "SETTING" : (rear.role as PlaneRole),
            construction: "",
            from: rear.from,
            depth: rear.depth,
            weight: rear.weight,
            population: 0.5,
          },
        ),
        seed: 7500 + (ground[0]?.seed ?? 0),
        costMsPerFrame: COMPOSITOR_MS,
        reason: child.inverted
          ? `${child.role.toLowerCase()} sits under the whole scene, on the second input`
          : `${behind.role.toLowerCase()} sits behind ${child.role.toLowerCase()}`,
        ground,
      },
    ];
    behind = child;
  }

  return { chain: acc ?? [], refused };
}

/** Every node in a graph, flattened, at any nesting depth.
 *
 *  Cost, determinism, palette usage and the cache all have to see a nested
 *  ground as real work — standing rule 11. Before the stack existed a
 *  ground was one level deep and every one of those consumers walked
 *  exactly one level, which would have made a three-layer scene report the
 *  cost of a two-layer one and hash identically when its deepest layer
 *  changed. */
export function flattenGround(nodes: ComposedNode[] | undefined): ComposedNode[] {
  if (!nodes || nodes.length === 0) return [];
  const out: ComposedNode[] = [];
  for (const n of nodes) {
    out.push(n);
    out.push(...flattenGround(n.ground));
  }
  return out;
}

/** How deep the composition actually goes, for the report. A director
 *  reading "3 planes" should be able to tell that from "3 layers nested
 *  inside each other", because they are different pictures. */
export function graphDepth(node: SceneNode): number {
  if (node.children.length === 0) return 1;
  return 1 + Math.max(...node.children.map(graphDepth));
}

/** The graph, in one line, far to near, with the numbers attached.
 *
 *  Carries depth and weight because a director reading "three planes"
 *  cannot tell from that whether the city is a backdrop or the subject of
 *  the shot, and those are different films. `⊙` marks an inverted node —
 *  one acting ON the scene from the second input rather than sitting in
 *  the depth order. */
export function describeGraph(node: SceneNode): string {
  return node.children
    .map((c) => {
      const self = `${c.role.toLowerCase()}${c.from ? ` (${c.from})` : ""}${
        c.inverted ? " ⊙" : ""
      } @${c.depth.toFixed(2)}×${c.weight.toFixed(2)}`;
      return c.children.length > 0 ? `${self}[${describeGraph(c)}]` : self;
    })
    .join(" ‹ ");
}

/** Just the roles, far to near. The structural shape without the
 *  arithmetic — what a test asserting composition order actually wants. */
export function graphShape(node: SceneNode): string {
  return node.children
    .map((c) => (c.children.length > 0 ? `${c.role}[${graphShape(c)}]` : c.role))
    .join(" ‹ ");
}
