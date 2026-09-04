"use client";

import { RoundedBox } from "@react-three/drei";
import type { MotionValue } from "framer-motion";
import { useRef } from "react";
import { MathUtils, type Group, type Mesh, type MeshBasicMaterial, type MeshStandardMaterial } from "three";
import {
  Label,
  R,
  Slab,
  StageLights,
  arc,
  smoothWindow,
  smoothstep,
  useCompact,
  useDampedProgress,
  useFitScale,
  type ScenePalette,
  type Vec3,
  type Window,
} from "../scene-kit";

export type WorkflowSceneLabels = {
  kinds: { trigger: string; ai: string; condition: string; action: string; human: string };
  nodes: { trigger: string; agent: string; condition: string; yes: string; no: string; assign: string; schedule: string; human: string };
};

type NodeKey = "trigger" | "agent" | "condition" | "assign" | "schedule" | "human";
type Tone = "neutral" | "ai" | "wait" | "team";
type NodeSpec = {
  key: NodeKey;
  tone: Tone;
  kind: keyof WorkflowSceneLabels["kinds"];
  window: Window;
  /** The final node keeps its light instead of pulsing. */
  hold?: boolean;
  /** The branch the packet does not take. */
  dim?: boolean;
};
type Point = [number, number];
type EdgeSpec = { from: Point; to: Point; window: Window; tone: Tone; dim?: boolean };

type Layout = {
  pos: Record<NodeKey, Point>;
  node: Vec3;
  canvas: Vec3;
  canvasAt: Point;
  labelWidth: number;
  /** Where the branch answers sit, and how they align. */
  yesAt: Point;
  noAt: Point;
  extent: [number, number];
};

const WIDE: Layout = {
  pos: {
    trigger: [-3.95, 1.05],
    agent: [-1.3, 1.05],
    condition: [1.3, 1.05],
    assign: [3.95, 1.05],
    schedule: [1.3, -1.35],
    human: [3.95, -1.35],
  },
  node: [1.95, 0.8, 0.18],
  canvas: [10.4, 4.9, 0.12],
  canvasAt: [0, -0.15],
  labelWidth: 150,
  yesAt: [2.62, 1.29],
  noAt: [1.02, -0.15],
  extent: [10.4, 5.0],
};

// Portrait: the journey runs top to bottom, the way a phone is read, and the
// branch opens left and right at the decision instead of trailing off-screen.
const COMPACT: Layout = {
  pos: {
    trigger: [0, 2.55],
    agent: [0, 1.25],
    condition: [0, -0.05],
    assign: [1.25, -1.5],
    schedule: [-1.25, -1.5],
    human: [1.25, -2.85],
  },
  node: [2.2, 0.72, 0.16],
  canvas: [4.9, 6.5, 0.12],
  canvasAt: [0, -0.1],
  labelWidth: 132,
  yesAt: [0.95, -0.72],
  noAt: [-0.95, -0.72],
  extent: [4.9, 6.6],
};

// The product's own node kinds: trigger, AI agent, condition, actions, human
// handoff. The packet follows the "yes" branch; the "no" branch is shown taken
// at half light so the decision reads as a real fork.
const NODES: NodeSpec[] = [
  { key: "trigger", tone: "neutral", kind: "trigger", window: [0.0, 0.1] },
  { key: "agent", tone: "ai", kind: "ai", window: [0.18, 0.3] },
  { key: "condition", tone: "wait", kind: "condition", window: [0.38, 0.5] },
  { key: "assign", tone: "team", kind: "action", window: [0.62, 0.72] },
  { key: "schedule", tone: "neutral", kind: "action", window: [0.62, 0.72], dim: true },
  { key: "human", tone: "team", kind: "human", window: [0.82, 0.95], hold: true },
];

function toneColor(tone: Tone, palette: ScenePalette) {
  if (tone === "neutral") return palette.rim;
  return palette.accent[tone];
}

/** Meets the edge of a node rather than its centre, on whichever side faces the target. */
function port(from: Point, to: Point, node: Vec3): Point {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const halfW = node[0] / 2;
  const halfH = node[1] / 2;
  if (Math.abs(dx) > Math.abs(dy) * (halfW / halfH)) return [from[0] + Math.sign(dx) * halfW, from[1]];
  return [from[0], from[1] + Math.sign(dy) * halfH];
}

function makeEdges(l: Layout): EdgeSpec[] {
  const link = (a: NodeKey, b: NodeKey, window: Window, tone: Tone, dim?: boolean): EdgeSpec => ({
    from: port(l.pos[a], l.pos[b], l.node),
    to: port(l.pos[b], l.pos[a], l.node),
    window,
    tone,
    dim,
  });
  return [
    link("trigger", "agent", [0.06, 0.2], "neutral"),
    link("agent", "condition", [0.24, 0.4], "ai"),
    link("condition", "assign", [0.48, 0.64], "wait"),
    link("assign", "human", [0.68, 0.84], "team"),
    link("condition", "schedule", [0.48, 0.64], "neutral", true),
  ];
}
const PACKET_EDGES = [0, 1, 2, 3];
const GHOST_EDGE = 4;

function edgeLength(spec: EdgeSpec) {
  return Math.hypot(spec.to[0] - spec.from[0], spec.to[1] - spec.from[1]);
}

function Edge({ spec, palette, overlayRef }: { spec: EdgeSpec; palette: ScenePalette; overlayRef: (node: Mesh | null) => void }) {
  const length = edgeLength(spec);
  const angle = Math.atan2(spec.to[1] - spec.from[1], spec.to[0] - spec.from[0]);
  const color = spec.tone === "neutral" && !spec.dim ? palette.panelMuted : toneColor(spec.tone, palette);
  return (
    <group position={[spec.from[0], spec.from[1], 0.02]} rotation={[0, 0, angle]}>
      <mesh position={[length / 2, 0, 0]}>
        <boxGeometry args={[length, 0.03, 0.03]} />
        <meshBasicMaterial color={palette.edge} />
      </mesh>
      <mesh ref={overlayRef} position={[0, 0, 0.006]} scale={[0.001, 1, 1]}>
        <boxGeometry args={[1, 0.05, 0.05]} />
        <meshBasicMaterial color={color} transparent opacity={spec.dim ? 0.5 : 1} />
      </mesh>
    </group>
  );
}

function NodeSlab({
  spec,
  labels,
  palette,
  layout,
  font,
  groupRef,
  rimRef,
}: {
  spec: NodeSpec;
  labels: WorkflowSceneLabels;
  palette: ScenePalette;
  layout: Layout;
  font: (n: number) => number;
  groupRef: (node: Group | null) => void;
  rimRef: (node: MeshStandardMaterial | null) => void;
}) {
  const rim = toneColor(spec.tone, palette);
  const [w, h, d] = layout.node;
  const [x, y] = layout.pos[spec.key];
  return (
    <group ref={groupRef} position={[x, y, 0]}>
      <RoundedBox args={[w + 0.07, h + 0.07, d - 0.06]} radius={R.rim} smoothness={3} position={[0, 0, -0.03]}>
        <meshStandardMaterial
          ref={rimRef}
          color={rim}
          emissive={rim}
          emissiveIntensity={0}
          roughness={0.5}
          transparent={spec.dim}
          opacity={spec.dim ? 0.55 : 1}
        />
      </RoundedBox>
      {/* A node is an object ON the canvas, so in daylight it takes the sheet
          colour and in the dark scene the panel colour. */}
      <Slab size={layout.node} color={palette.dark ? palette.board : palette.card} roughness={0.7} />
      <Label position={[0.04, 0, d / 2 + 0.02]} width={layout.labelWidth} className="select-none text-left">
        <p className="truncate font-semibold leading-none" style={{ fontSize: font(12), color: palette.panelInk, opacity: spec.dim ? 0.6 : 1 }}>
          {labels.nodes[spec.key]}
        </p>
        <p className="mt-1.5 truncate font-mono uppercase leading-none tracking-[0.15em]" style={{ fontSize: font(8.5), color: palette.panelMuted }}>
          {labels.kinds[spec.kind]}
        </p>
      </Label>
    </group>
  );
}

export function WorkflowScene({
  progress,
  reduced,
  labels,
  palette,
}: {
  progress: MotionValue<number>;
  reduced: boolean;
  labels: WorkflowSceneLabels;
  palette: ScenePalette;
}) {
  const board = useRef<Group>(null);
  const nodeGroups = useRef<Array<Group | null>>([]);
  const rims = useRef<Array<MeshStandardMaterial | null>>([]);
  const overlays = useRef<Array<Mesh | null>>([]);
  const packet = useRef<Mesh>(null);
  const packetMaterial = useRef<MeshStandardMaterial>(null);
  const packetColor = useRef("");
  const ghost = useRef<Mesh>(null);
  const ghostMaterial = useRef<MeshBasicMaterial>(null);
  const compact = useCompact();
  const layout = compact ? COMPACT : WIDE;
  const font = (n: number) => (compact ? Math.max(Math.round(n * 0.82 * 10) / 10, 8.7) : n);
  const boardScale = useFitScale(layout.extent[0], layout.extent[1]);
  const edges = makeEdges(layout);

  useDampedProgress(progress, reduced, (t, delta) => {
    NODES.forEach((node, index) => {
      const window = smoothWindow(t, node.window);
      const active = node.hold ? window : arc(window);
      const group = nodeGroups.current[index];
      const rim = rims.current[index];
      if (group) group.position.z = active * 0.3;
      if (rim) rim.emissiveIntensity = active * (node.dim ? 0.3 : palette.dark ? 0.9 : 0.55);
    });

    edges.forEach((edge, index) => {
      const overlay = overlays.current[index];
      if (!overlay) return;
      const fill = smoothWindow(t, edge.window);
      const length = edgeLength(edge);
      overlay.scale.x = Math.max(fill * length, 0.001);
      overlay.position.x = (fill * length) / 2;
    });

    let x = edges[0].from[0];
    let y = edges[0].from[1];
    let scale = 0;
    let color = palette.panelMuted;
    for (const index of PACKET_EDGES) {
      const edge = edges[index];
      const [start, end] = edge.window;
      if (t < start) break;
      const u = MathUtils.clamp((t - start) / (end - start), 0, 1);
      const eased = smoothstep(u);
      x = MathUtils.lerp(edge.from[0], edge.to[0], eased);
      y = MathUtils.lerp(edge.from[1], edge.to[1], eased);
      scale = smoothstep(Math.min(u, 1 - u) * 5);
      color = edge.tone === "neutral" ? palette.panelMuted : toneColor(edge.tone, palette);
    }
    if (packet.current) {
      packet.current.position.set(x, y, 0.28);
      packet.current.scale.setScalar(Math.max(scale, 0.001));
      packet.current.rotation.z = t * 6;
    }
    if (packetMaterial.current && packetColor.current !== color) {
      packetMaterial.current.color.set(color);
      packetMaterial.current.emissive.set(color);
      packetColor.current = color;
    }

    const ghostEdge = edges[GHOST_EDGE];
    const [ghostStart, ghostEnd] = ghostEdge.window;
    const gu = MathUtils.clamp((t - ghostStart) / (ghostEnd - ghostStart), 0, 1);
    if (ghost.current) {
      const eased = smoothstep(gu);
      ghost.current.position.set(
        MathUtils.lerp(ghostEdge.from[0], ghostEdge.to[0], eased),
        MathUtils.lerp(ghostEdge.from[1], ghostEdge.to[1], eased),
        0.28,
      );
      ghost.current.scale.setScalar(Math.max(smoothstep(Math.min(gu, 1 - gu) * 5) * 0.7, 0.001));
    }
    if (ghostMaterial.current) ghostMaterial.current.opacity = 0.5;

    if (board.current) {
      board.current.rotation.x = MathUtils.damp(board.current.rotation.x, -0.1 + t * 0.03, 5, delta);
      board.current.rotation.y = MathUtils.damp(board.current.rotation.y, 0.06 - t * 0.12, 5, delta);
    }
  });

  const packetSize = compact ? 0.14 : 0.17;

  return (
    <>
      <StageLights palette={palette} cool={palette.accent.tag} />
      <group ref={board} scale={boardScale} rotation={[-0.1, 0.06, 0]}>
        <Slab
          size={layout.canvas}
          color={palette.well}
          position={[layout.canvasAt[0], layout.canvasAt[1], -0.16]}
          radius={R.board}
          castShadow={false}
          receiveShadow
          roughness={0.85}
        />

        {edges.map((edge, index) => (
          <Edge
            key={index}
            spec={edge}
            palette={palette}
            overlayRef={(node) => {
              overlays.current[index] = node;
            }}
          />
        ))}

        <Label position={[layout.yesAt[0], layout.yesAt[1], 0.1]} width={60} className="select-none text-center">
          <span className="font-mono font-semibold uppercase tracking-[0.15em]" style={{ fontSize: font(8.5), color: palette.ink.wait }}>
            {labels.nodes.yes}
          </span>
        </Label>
        <Label position={[layout.noAt[0], layout.noAt[1], 0.1]} width={60} className="select-none text-center">
          <span className="font-mono font-semibold uppercase tracking-[0.15em]" style={{ fontSize: font(8.5), color: palette.panelMuted }}>
            {labels.nodes.no}
          </span>
        </Label>

        {NODES.map((node, index) => (
          <NodeSlab
            key={node.key}
            spec={node}
            labels={labels}
            palette={palette}
            layout={layout}
            font={font}
            groupRef={(el) => {
              nodeGroups.current[index] = el;
            }}
            rimRef={(el) => {
              rims.current[index] = el;
            }}
          />
        ))}

        <mesh ref={packet} castShadow>
          <boxGeometry args={[packetSize, packetSize, packetSize]} />
          <meshStandardMaterial ref={packetMaterial} color={palette.panelMuted} emissive={palette.panelMuted} emissiveIntensity={0.6} roughness={0.35} />
        </mesh>
        <mesh ref={ghost}>
          <boxGeometry args={[packetSize, packetSize, packetSize]} />
          <meshBasicMaterial ref={ghostMaterial} color={palette.rim} transparent opacity={0.5} />
        </mesh>
      </group>
    </>
  );
}
