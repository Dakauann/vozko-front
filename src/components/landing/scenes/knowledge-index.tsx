"use client";

import type { MotionValue } from "framer-motion";
import { useRef } from "react";
import { MathUtils, type Group, type Mesh, type MeshStandardMaterial } from "three";
import { FileText, MagnifyingGlass } from "@/components/icons";
import {
  PanelLabel as Label,
  R,
  Slab,
  StageLights,
  labelStyle,
  sheet,
  sheetWell,
  smoothWindow,
  smoothstep,
  useCompact,
  useDampedProgress,
  useFitScale,
  usePanelType,
  type ScenePalette,
  type Window,
} from "../scene-kit";

export type KnowledgeSceneLabels = {
  title: string;
  docs: string[];
  question: string;
  answer: string;
  source: string;
};

type Layout = {
  /** The spine the index is built on. */
  railX: number;
  shelf: number;
  thickness: number;
  gap: number;
  askAt: [number, number];
  answerAt: [number, number];
  bubbleWidth: number;
  extent: [number, number];
};

const WIDE: Layout = {
  railX: -2.7,
  shelf: 2.9,
  thickness: 0.34,
  gap: 0.86,
  askAt: [-2.7, 2.95],
  answerAt: [1.5, -3.0],
  bubbleWidth: 330,
  extent: [8.4, 7.2],
};

const COMPACT: Layout = {
  railX: -2.0,
  shelf: 3.4,
  thickness: 0.38,
  gap: 0.74,
  askAt: [-1.1, 3.55],
  answerAt: [0, -2.7],
  bubbleWidth: 400,
  extent: [5.4, 8.6],
};

/** The passage that answers the question. */
const MATCH = 1;
const ASK: Window = [0.05, 0.22];
const SEEK: Window = [0.24, 0.46];
const LIFT: Window = [0.46, 0.62];
const ANSWER: Window = [0.64, 0.84];
const CITE: Window = [0.82, 0.95];

export function KnowledgeScene({
  progress,
  reduced,
  labels,
  palette,
}: {
  progress: MotionValue<number>;
  reduced: boolean;
  labels: KnowledgeSceneLabels;
  palette: ScenePalette;
}) {
  const stage = useRef<Group>(null);
  const shelves = useRef<Array<Group | null>>([]);
  const caps = useRef<Array<MeshStandardMaterial | null>>([]);
  const rowLabels = useRef<Array<HTMLDivElement | null>>([]);
  const query = useRef<Mesh>(null);
  const reply = useRef<Mesh>(null);
  const askLabel = useRef<HTMLDivElement | null>(null);
  const answerLabel = useRef<HTMLDivElement | null>(null);
  const citeLabel = useRef<HTMLDivElement | null>(null);
  const compact = useCompact();
  const layout = compact ? COMPACT : WIDE;
  const scale = useFitScale(layout.extent[0], layout.extent[1]);
  const { font, px } = usePanelType(scale);
  const docs = labels.docs.slice(0, 5);
  const top = ((docs.length - 1) / 2) * layout.gap;
  const rowY = (index: number) => top - index * layout.gap;
  const shelfEnd = layout.railX + layout.shelf;
  const railH = docs.length * layout.gap + 0.5;

  useDampedProgress(progress, reduced, (t, delta) => {
    const asked = smoothWindow(t, ASK);
    const seeking = smoothWindow(t, SEEK);
    const lifted = smoothWindow(t, LIFT);
    const answered = smoothWindow(t, ANSWER);

    // The question runs down the spine, stops at the row that answers it.
    if (query.current) {
      const y = MathUtils.lerp(top + 0.55, rowY(MATCH), seeking);
      query.current.position.set(layout.railX, y, 0.42);
      query.current.scale.setScalar(Math.max(asked * (1 - smoothstep((answered - 0.1) * 4)), 0.001));
    }
    if (reply.current) {
      const eased = smoothstep(answered);
      reply.current.position.set(
        MathUtils.lerp(shelfEnd, layout.answerAt[0], eased),
        MathUtils.lerp(rowY(MATCH), layout.answerAt[1] + 0.55, eased),
        0.42 + Math.sin(eased * Math.PI) * 0.45,
      );
      reply.current.scale.setScalar(Math.max(smoothstep(Math.min(answered, 1 - answered) * 4), 0.001));
    }

    docs.forEach((_, index) => {
      const isMatch = index === MATCH;
      const group = shelves.current[index];
      // The row the answer came from pulls out of the index, like a drawer.
      if (group) group.position.set(isMatch ? lifted * 0.5 : 0, rowY(index), isMatch ? lifted * 0.28 : 0);
      const cap = caps.current[index];
      if (cap) {
        // The search sweeps the index on its way down, then holds on the match.
        const sweep = Math.max(0, 1 - Math.abs(seeking * (docs.length - 1) - index) * 1.6);
        cap.emissiveIntensity = (isMatch ? Math.max(sweep, lifted) : sweep * 0.45) * (palette.dark ? 0.95 : 0.55);
      }
      const row = rowLabels.current[index];
      if (row) row.style.opacity = String(isMatch ? 0.85 + 0.15 * lifted : 0.85);
    });

    if (askLabel.current) askLabel.current.style.opacity = String(asked);
    if (answerLabel.current) answerLabel.current.style.opacity = String(smoothWindow(t, [ANSWER[1] - 0.06, ANSWER[1] + 0.03]));
    if (citeLabel.current) citeLabel.current.style.opacity = String(smoothWindow(t, CITE));

    if (stage.current) {
      stage.current.rotation.x = MathUtils.damp(stage.current.rotation.x, -0.1 + t * 0.03, 5, delta);
      stage.current.rotation.y = MathUtils.damp(stage.current.rotation.y, 0.14 - t * 0.22, 5, delta);
    }
  });

  const icon = font(12);

  return (
    <>
      <StageLights reduced={reduced} palette={palette} cool={palette.accent.tag} />
      <group ref={stage} scale={scale} rotation={[-0.1, 0.14, 0]}>
        {/* The spine: one index, with a row per document rather than a pile. */}
        <Slab
          size={[0.3, railH, 0.4]}
          color={sheetWell(palette)}
          position={[layout.railX, 0, -0.05]}
          radius={R.chip}
          roughness={0.82}
          receiveShadow
        />

        <Label position={[layout.railX + layout.shelf / 2, top + 0.75, 0.3]} width={px(layout.shelf)} className="flex min-w-0 select-none items-center gap-1.5 text-left">
          <MagnifyingGlass size={icon} color={palette.ink.ai} style={{ ["--icon-accent" as string]: palette.ink.ai }} />
          <span className="min-w-0 font-semibold leading-tight" style={{ fontSize: font(10), color: palette.panelInk }}>
            {labels.title}
          </span>
        </Label>

        {docs.map((doc, index) => (
          <group
            key={doc}
            ref={(node) => {
              shelves.current[index] = node;
            }}
            position={[0, rowY(index), 0]}
          >
            <Slab
              size={[layout.shelf, layout.thickness, 0.36]}
              color={sheet(palette)}
              position={[layout.railX + layout.shelf / 2, 0, 0]}
              radius={R.chip}
              roughness={0.62}
              receiveShadow
            />
            {/* The lit end-cap: which row the search is touching. */}
            <mesh position={[shelfEnd - 0.07, 0, 0.02]}>
              <boxGeometry args={[0.14, layout.thickness + 0.04, 0.4]} />
              <meshStandardMaterial
                ref={(node) => {
                  caps.current[index] = node;
                }}
                color={palette.accent.ai}
                emissive={palette.accent.ai}
                emissiveIntensity={0}
                roughness={0.5}
              />
            </mesh>
            <Label
              position={[layout.railX + layout.shelf / 2 + 0.08, 0, 0.24]}
              width={px(layout.shelf - 0.5)}
              className="flex select-none items-center gap-1.5 text-left"
            >
              <div
                ref={(node) => {
                  rowLabels.current[index] = node;
                }}
                className="flex min-w-0 items-center gap-1.5"
                style={{ opacity: 0.85 }}
              >
                <FileText size={icon} color={palette.panelMuted} style={{ ["--icon-accent" as string]: palette.accent.ai }} />
                <span className="truncate font-semibold leading-none" style={{ fontSize: font(11), color: palette.panelInk }}>
                  {doc}
                </span>
              </div>
            </Label>
          </group>
        ))}

        <mesh ref={query} scale={0.001}>
          <sphereGeometry args={[0.15, 20, 20]} />
          <meshStandardMaterial color={palette.accent.team} emissive={palette.accent.team} emissiveIntensity={0.7} roughness={0.35} />
        </mesh>
        <mesh ref={reply} scale={0.001}>
          <sphereGeometry args={[0.16, 20, 20]} />
          <meshStandardMaterial color={palette.accent.ai} emissive={palette.accent.ai} emissiveIntensity={0.85} roughness={0.35} />
        </mesh>

        {/* The question going in. */}
        <Label position={[layout.askAt[0] + 1.1, layout.askAt[1], 0.4]} width={layout.bubbleWidth} className="select-none text-left">
          <div ref={askLabel} style={{ opacity: 0 }}>
            <p className="rounded-lg rounded-bl-sm px-2 py-1.5 leading-snug [overflow-wrap:anywhere]" style={labelStyle(font(10), palette.panelInk, palette.bubble)}>
              {labels.question}
            </p>
          </div>
        </Label>

        {/* The answer coming out, and the row it stands on. */}
        <Label position={[layout.answerAt[0], layout.answerAt[1], 0.4]} width={layout.bubbleWidth} className="select-none text-left">
          <div ref={answerLabel} style={{ opacity: 0 }}>
            <p
              className="rounded-lg rounded-br-sm px-2 py-1.5 leading-snug [overflow-wrap:anywhere]"
              style={labelStyle(font(10), palette.dark ? palette.panelInk : palette.cardInk, palette.wash)}
            >
              {labels.answer}
            </p>
          </div>
          <div ref={citeLabel} className="mt-1.5 flex items-center gap-1.5" style={{ opacity: 0 }}>
            <FileText size={font(10)} color={palette.ink.ai} style={{ ["--icon-accent" as string]: palette.ink.ai }} />
            <span className="truncate font-mono leading-none" style={{ fontSize: font(8.5), color: palette.ink.ai }}>
              {labels.source}: {docs[MATCH]}
            </span>
          </div>
        </Label>
      </group>
    </>
  );
}
