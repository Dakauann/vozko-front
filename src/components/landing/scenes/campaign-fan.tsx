"use client";

import type { MotionValue } from "framer-motion";
import { useRef } from "react";
import { MathUtils, type Group, type Mesh, type MeshStandardMaterial } from "three";
import {
  Bar,
  Label,
  R,
  Slab,
  StageLights,
  sheet,
  sheetWell,
  smoothWindow,
  smoothstep,
  useCompact,
  useDampedProgress,
  useFitScale,
  type ScenePalette,
  type Vec3,
  type Window,
} from "../scene-kit";

export type CampaignSceneLabels = {
  template: string;
  audience: string;
  queue: string;
  replied: string;
};

type Layout = {
  plate: Vec3;
  plateAt: [number, number];
  gridAt: [number, number];
  cols: number;
  rows: number;
  step: number;
  dot: number;
  queueAt: [number, number];
  queue: Vec3;
  labelWidth: number;
  extent: [number, number];
};

const WIDE: Layout = {
  plate: [1.7, 2.3, 0.18],
  plateAt: [-3.9, 0.35],
  gridAt: [1.5, 0.6],
  cols: 6,
  rows: 4,
  step: 0.72,
  dot: 0.15,
  queueAt: [1.5, -2.5],
  queue: [4.0, 0.5, 0.16],
  labelWidth: 150,
  extent: [9.6, 6.4],
};

const COMPACT: Layout = {
  plate: [1.6, 1.9, 0.16],
  plateAt: [0, 2.6],
  gridAt: [0, -0.3],
  cols: 4,
  rows: 4,
  step: 0.66,
  dot: 0.14,
  queueAt: [0, -2.9],
  queue: [3.2, 0.46, 0.14],
  labelWidth: 118,
  extent: [4.6, 7.2],
};

/** Which contacts answer. Fixed, so the story is the same on every scroll. */
const REPLIES = [2, 5, 9, 14, 18];
const SEND: Window = [0.06, 0.6];
const REPLY: Window = [0.58, 0.94];
const SEND_TRAVEL = 0.16;
const REPLY_TRAVEL = 0.2;

function dotAt(index: number, l: Layout): Vec3 {
  const col = index % l.cols;
  const row = Math.floor(index / l.cols);
  return [
    l.gridAt[0] + (col - (l.cols - 1) / 2) * l.step,
    l.gridAt[1] - (row - (l.rows - 1) / 2) * l.step,
    0,
  ];
}

export function CampaignScene({
  progress,
  reduced,
  labels,
  palette,
}: {
  progress: MotionValue<number>;
  reduced: boolean;
  labels: CampaignSceneLabels;
  palette: ScenePalette;
}) {
  const stage = useRef<Group>(null);
  const dots = useRef<Array<MeshStandardMaterial | null>>([]);
  const sends = useRef<Array<Mesh | null>>([]);
  const backs = useRef<Array<Mesh | null>>([]);
  const queueFill = useRef<Mesh>(null);
  const queueLabel = useRef<HTMLDivElement | null>(null);
  const compact = useCompact();
  const layout = compact ? COMPACT : WIDE;
  const font = (n: number) => (compact ? Math.max(Math.round(n * 0.82 * 10) / 10, 8.7) : n);
  const scale = useFitScale(layout.extent[0], layout.extent[1]);
  const total = layout.cols * layout.rows;
  const plateEdge: Vec3 = [layout.plateAt[0], layout.plateAt[1] - layout.plate[1] / 2 + 0.2, 0.2];
  const queueEdge: Vec3 = [layout.queueAt[0] - layout.queue[0] / 2 + 0.3, layout.queueAt[1], 0.2];

  useDampedProgress(progress, reduced, (t, delta) => {
    const sendSpan = SEND[1] - SEND[0] - SEND_TRAVEL;
    for (let index = 0; index < total; index += 1) {
      // Each contact gets its own departure slot, so the send reads as a
      // paced batch rather than one simultaneous blast.
      const start = SEND[0] + (index / Math.max(total - 1, 1)) * sendSpan;
      const u = MathUtils.clamp((t - start) / SEND_TRAVEL, 0, 1);
      const eased = smoothstep(u);
      const target = dotAt(index, layout);
      const pulse = sends.current[index];
      if (pulse) {
        pulse.position.set(
          MathUtils.lerp(plateEdge[0], target[0], eased),
          MathUtils.lerp(plateEdge[1], target[1], eased),
          MathUtils.lerp(plateEdge[2], target[2] + 0.2, eased),
        );
        pulse.scale.setScalar(Math.max(smoothstep(Math.min(u, 1 - u) * 4), 0.001));
      }
      const material = dots.current[index];
      if (material) {
        const delivered = u >= 1 ? 1 : 0;
        const answered = REPLIES.indexOf(index);
        const back = answered >= 0 ? smoothWindow(t, [REPLY[0] + answered * 0.06, REPLY[0] + answered * 0.06 + REPLY_TRAVEL]) : 0;
        material.emissiveIntensity = delivered * 0.35 + back * 0.9;
        material.color.set(back > 0.5 ? palette.accent.ai : palette.rim);
        material.emissive.set(back > 0.5 ? palette.accent.ai : palette.accent.team);
      }
    }

    let arrived = 0;
    REPLIES.forEach((dotIndex, order) => {
      const start = REPLY[0] + order * 0.06;
      const u = MathUtils.clamp((t - start) / REPLY_TRAVEL, 0, 1);
      if (u >= 1) arrived += 1;
      const from = dotAt(dotIndex, layout);
      const pulse = backs.current[order];
      if (pulse) {
        const eased = smoothstep(u);
        pulse.position.set(
          MathUtils.lerp(from[0], queueEdge[0], eased),
          MathUtils.lerp(from[1], queueEdge[1], eased),
          MathUtils.lerp(0.2, queueEdge[2], eased),
        );
        pulse.scale.setScalar(Math.max(smoothstep(Math.min(u, 1 - u) * 4), 0.001));
      }
    });

    if (queueFill.current) {
      const width = Math.max((arrived / REPLIES.length) * (layout.queue[0] - 0.24), 0.001);
      queueFill.current.scale.x = width;
      queueFill.current.position.x = layout.queueAt[0] - layout.queue[0] / 2 + 0.12 + width / 2;
    }
    if (queueLabel.current) queueLabel.current.style.opacity = String(smoothWindow(t, [REPLY[0], REPLY[0] + 0.08]));

    if (stage.current) {
      stage.current.rotation.x = MathUtils.damp(stage.current.rotation.x, -0.12 + t * 0.03, 5, delta);
      stage.current.rotation.y = MathUtils.damp(stage.current.rotation.y, 0.09 - t * 0.16, 5, delta);
    }
  });

  return (
    <>
      <StageLights reduced={reduced} palette={palette} />
      <group ref={stage} scale={scale} rotation={[-0.12, 0.09, 0]}>
        {/* The approved template the campaign sends. */}
        <group position={[layout.plateAt[0], layout.plateAt[1], 0]}>
          <Slab size={layout.plate} color={sheet(palette)} roughness={0.6} receiveShadow />
          <Bar
            position={[0, layout.plate[1] / 2 - 0.3, layout.plate[2] / 2 + 0.02]}
            size={[layout.plate[0] - 0.4, 0.03, 0.03]}
            color={palette.accent.ai}
          />
          {/* Greeked body lines: the template's shape, not invented copy. */}
          {[0.82, 0.62, 0.9, 0.5].map((w, index) => (
            <mesh key={index} position={[-layout.plate[0] * 0.5 * (1 - w) + 0.05, 0.2 - index * 0.3, layout.plate[2] / 2 + 0.02]}>
              <boxGeometry args={[layout.plate[0] * w * 0.8, 0.05, 0.02]} />
              <meshBasicMaterial color={palette.panelMuted} />
            </mesh>
          ))}
          <Label position={[0, layout.plate[1] / 2 - 0.12, 0.2]} width={layout.labelWidth} className="select-none text-center">
            <p className="font-mono font-semibold uppercase tracking-[0.15em]" style={{ fontSize: font(9), color: palette.ink.ai }}>
              {labels.template}
            </p>
          </Label>
        </group>

        {/* The audience: one dot per contact, lighting as the message lands. */}
        <Label position={[layout.gridAt[0], layout.gridAt[1] + ((layout.rows - 1) / 2) * layout.step + 0.62, 0.2]} width={layout.labelWidth} className="select-none text-center">
          <p className="font-mono font-semibold uppercase tracking-[0.15em]" style={{ fontSize: font(9), color: palette.panelMuted }}>
            {labels.audience}
          </p>
        </Label>
        {Array.from({ length: total }, (_, index) => (
          <mesh key={index} position={dotAt(index, layout)} castShadow>
            <sphereGeometry args={[layout.dot, 20, 20]} />
            <meshStandardMaterial
              ref={(node) => {
                dots.current[index] = node;
              }}
              color={palette.rim}
              emissive={palette.accent.team}
              emissiveIntensity={0}
              roughness={0.45}
            />
          </mesh>
        ))}

        {Array.from({ length: total }, (_, index) => (
          <mesh
            key={`send-${index}`}
            ref={(node) => {
              sends.current[index] = node;
            }}
            scale={0.001}
          >
            <sphereGeometry args={[0.085, 16, 16]} />
            <meshBasicMaterial color={palette.accent.ai} />
          </mesh>
        ))}
        {REPLIES.map((dotIndex, order) => (
          <mesh
            key={`back-${dotIndex}`}
            ref={(node) => {
              backs.current[order] = node;
            }}
            scale={0.001}
          >
            <sphereGeometry args={[0.1, 16, 16]} />
            <meshBasicMaterial color={palette.accent.wait} />
          </mesh>
        ))}

        {/* The queue the replies land in. */}
        <group position={[layout.queueAt[0], layout.queueAt[1], 0]}>
          <Slab size={layout.queue} color={sheetWell(palette)} radius={R.board} roughness={0.8} receiveShadow />
        </group>
        <mesh ref={queueFill} position={[layout.queueAt[0], layout.queueAt[1], layout.queue[2] / 2 + 0.01]} scale={[0.001, 1, 1]}>
          <boxGeometry args={[1, layout.queue[1] - 0.2, 0.04]} />
          <meshBasicMaterial color={palette.accent.ai} />
        </mesh>
        <Label position={[layout.queueAt[0], layout.queueAt[1] - layout.queue[1] / 2 - 0.28, 0.2]} width={layout.labelWidth + 40} className="select-none text-center">
          <div ref={queueLabel} style={{ opacity: 0 }}>
            <p className="font-mono font-semibold uppercase tracking-[0.15em]" style={{ fontSize: font(9), color: palette.ink.ai }}>
              {labels.queue}
            </p>
          </div>
        </Label>
      </group>
    </>
  );
}
