"use client";

import type { MotionValue } from "framer-motion";
import { useRef } from "react";
import { MathUtils, type Group, type Mesh, type MeshStandardMaterial } from "three";
import {
  Label,
  StageLights,
  arc,
  sheet,
  sheetWell,
  smoothWindow,
  useCompact,
  useDampedProgress,
  useFitScale,
  type ScenePalette,
  type Vec3,
  type Window,
} from "../scene-kit";

export type AgentSceneLabels = {
  core: string;
  ready: string;
  modules: Array<{ title: string; meta: string }>;
};

type Tone = keyof ScenePalette["accent"];
type ModuleSpec = { angle: number; tone: Tone; window: Window };

type Layout = {
  core: number;
  module: number;
  orbit: number;
  labelWidth: number;
  labelDrop: number;
  extent: [number, number];
};

const WIDE: Layout = {
  core: 1.15,
  module: 0.62,
  orbit: 2.75,
  labelWidth: 150,
  labelDrop: 1.05,
  extent: [9.2, 6.6],
};

const COMPACT: Layout = {
  core: 0.95,
  module: 0.55,
  orbit: 2.15,
  labelWidth: 106,
  labelDrop: 0.9,
  extent: [5.6, 6.6],
};

// The four things an agent is actually made of, each entering from its own
// quarter and locking into the core.
const MODULES: ModuleSpec[] = [
  { angle: 135, tone: "tag", window: [0.06, 0.24] },
  { angle: 45, tone: "team", window: [0.26, 0.44] },
  { angle: -45, tone: "ai", window: [0.46, 0.64] },
  { angle: -135, tone: "wait", window: [0.66, 0.84] },
];
const READY: Window = [0.86, 0.98];

const rad = (deg: number) => (deg * Math.PI) / 180;
const dockAt = (spec: ModuleSpec, l: Layout): Vec3 => [l.orbit * Math.cos(rad(spec.angle)), l.orbit * Math.sin(rad(spec.angle)), 0];
/** Modules arrive from far outside, along their own axis. */
const startAt = (spec: ModuleSpec, l: Layout): Vec3 => [(l.orbit + 4.2) * Math.cos(rad(spec.angle)), (l.orbit + 4.2) * Math.sin(rad(spec.angle)), -1.2];

/** A six-sided prism. The workflow editor already speaks in hexagons for the agent. */
function Hex({
  radius,
  depth,
  color,
  position,
  materialRef,
  emissive,
}: {
  radius: number;
  depth: number;
  color: string;
  position?: Vec3;
  materialRef?: (node: MeshStandardMaterial | null) => void;
  emissive?: string;
}) {
  return (
    <mesh position={position} rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
      <cylinderGeometry args={[radius, radius, depth, 6]} />
      <meshStandardMaterial ref={materialRef} color={color} emissive={emissive ?? color} emissiveIntensity={0} roughness={0.62} metalness={0.05} />
    </mesh>
  );
}

export function AgentScene({
  progress,
  reduced,
  labels,
  palette,
}: {
  progress: MotionValue<number>;
  reduced: boolean;
  labels: AgentSceneLabels;
  palette: ScenePalette;
}) {
  const stage = useRef<Group>(null);
  const core = useRef<Group>(null);
  const coreRim = useRef<MeshStandardMaterial>(null);
  const modules = useRef<Array<Group | null>>([]);
  const rims = useRef<Array<MeshStandardMaterial | null>>([]);
  const beams = useRef<Array<Mesh | null>>([]);
  const moduleLabels = useRef<Array<HTMLDivElement | null>>([]);
  const readyLabel = useRef<HTMLDivElement | null>(null);
  const compact = useCompact();
  const layout = compact ? COMPACT : WIDE;
  const font = (n: number) => (compact ? Math.max(Math.round(n * 0.82 * 10) / 10, 8.7) : n);
  const scale = useFitScale(layout.extent[0], layout.extent[1]);
  const items = labels.modules.slice(0, MODULES.length);
  const beamLength = layout.orbit - layout.core - layout.module + 0.1;

  useDampedProgress(progress, reduced, (t, delta) => {
    let docked = 0;
    MODULES.forEach((spec, index) => {
      const u = smoothWindow(t, spec.window);
      if (u > 0.98) docked += 1;
      const group = modules.current[index];
      if (group) {
        const from = startAt(spec, layout);
        const to = dockAt(spec, layout);
        group.position.set(
          MathUtils.lerp(from[0], to[0], u),
          MathUtils.lerp(from[1], to[1], u),
          MathUtils.lerp(from[2], to[2], u) + arc(u) * 0.35,
        );
        group.scale.setScalar(Math.max(0.35 + 0.65 * u, 0.001));
      }
      const rim = rims.current[index];
      // A part lights as it seats, then holds: it is now part of the agent.
      if (rim) rim.emissiveIntensity = u * (palette.dark ? 0.85 : 0.5);
      const beam = beams.current[index];
      if (beam) {
        const fill = Math.max(u * beamLength, 0.001);
        beam.scale.x = fill;
        beam.position.x = layout.core + 0.05 + fill / 2;
      }
      const label = moduleLabels.current[index];
      if (label) label.style.opacity = String(u);
    });

    if (coreRim.current) {
      const seated = docked / MODULES.length;
      coreRim.current.emissiveIntensity = (seated * 0.7 + smoothWindow(t, READY) * 0.5) * (palette.dark ? 1 : 0.6);
    }
    if (core.current) {
      core.current.rotation.z = MathUtils.damp(core.current.rotation.z, t * 0.5, 4, delta);
      core.current.position.z = smoothWindow(t, READY) * 0.35;
    }
    if (readyLabel.current) readyLabel.current.style.opacity = String(smoothWindow(t, READY));

    if (stage.current) {
      stage.current.rotation.x = MathUtils.damp(stage.current.rotation.x, -0.14 + t * 0.04, 5, delta);
      stage.current.rotation.y = MathUtils.damp(stage.current.rotation.y, 0.1 - t * 0.18, 5, delta);
    }
  });

  return (
    <>
      <StageLights reduced={reduced} palette={palette} cool={palette.accent.tag} />
      <group ref={stage} scale={scale} rotation={[-0.14, 0.1, 0]}>
        {/* The bench the agent is assembled on. */}
        <Hex radius={layout.orbit + 1.15} depth={0.14} color={sheetWell(palette)} position={[0, 0, -0.32]} />

        {MODULES.map((spec, index) => (
          <group key={spec.angle} rotation={[0, 0, rad(spec.angle)]}>
            <mesh
              ref={(node) => {
                beams.current[index] = node;
              }}
              position={[layout.core, 0, -0.05]}
              scale={[0.001, 1, 1]}
            >
              <boxGeometry args={[1, 0.05, 0.05]} />
              <meshBasicMaterial color={palette.accent[spec.tone]} />
            </mesh>
          </group>
        ))}

        <group ref={core}>
          <Hex radius={layout.core + 0.09} depth={0.42} color={palette.accent.ai} materialRef={(node) => (coreRim.current = node)} />
          <Hex radius={layout.core} depth={0.5} color={sheet(palette)} />
        </group>
        <Label position={[0, 0, 0.34]} width={layout.labelWidth} className="select-none text-center">
          <p className="font-display font-semibold leading-none" style={{ fontSize: font(15), color: palette.panelInk }}>
            {labels.core}
          </p>
          <div ref={readyLabel} style={{ opacity: 0 }}>
            <p className="mt-1.5 font-mono uppercase leading-none tracking-[0.15em]" style={{ fontSize: font(8.5), color: palette.ink.ai }}>
              {labels.ready}
            </p>
          </div>
        </Label>

        {items.map((item, index) => {
          const spec = MODULES[index];
          const tone = palette.accent[spec.tone];
          return (
            <group
              key={item.title}
              ref={(node) => {
                modules.current[index] = node;
              }}
            >
              <Hex
                radius={layout.module + 0.07}
                depth={0.26}
                color={tone}
                materialRef={(node) => {
                  rims.current[index] = node;
                }}
              />
              <Hex radius={layout.module} depth={0.34} color={sheet(palette)} />
              <Label position={[0, -layout.labelDrop, 0.1]} width={layout.labelWidth} className="select-none text-center">
                <div
                  ref={(node) => {
                    moduleLabels.current[index] = node;
                  }}
                  style={{ opacity: 0 }}
                >
                  <p className="truncate font-semibold leading-none" style={{ fontSize: font(11.5), color: palette.panelInk }}>
                    {item.title}
                  </p>
                  <p className="mt-1 truncate font-mono leading-none" style={{ fontSize: font(8.5), color: palette.panelMuted }}>
                    {item.meta}
                  </p>
                </div>
              </Label>
            </group>
          );
        })}
      </group>
    </>
  );
}
