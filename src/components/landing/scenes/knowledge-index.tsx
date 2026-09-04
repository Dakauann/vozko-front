"use client";

import type { MotionValue } from "framer-motion";
import { useRef } from "react";
import { MathUtils, type Group, type Mesh, type MeshStandardMaterial } from "three";
import {
  Disc,
  Label,
  StageLights,
  sheet,
  sheetWell,
  smoothWindow,
  smoothstep,
  useCompact,
  useDampedProgress,
  useFitScale,
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
  disc: number;
  depth: number;
  gap: number;
  /** Where the question enters and the answer leaves, relative to the stack. */
  askAt: [number, number];
  answerAt: [number, number];
  labelWidth: number;
  extent: [number, number];
};

const WIDE: Layout = {
  disc: 1.45,
  depth: 0.3,
  gap: 0.46,
  askAt: [-4.3, 0.9],
  answerAt: [4.2, -0.9],
  labelWidth: 170,
  extent: [9.8, 6.0],
};

const COMPACT: Layout = {
  disc: 1.2,
  depth: 0.26,
  gap: 0.4,
  askAt: [0, 2.9],
  answerAt: [0, -2.9],
  labelWidth: 132,
  extent: [4.6, 7.0],
};

/** The passage that answers the question. */
const MATCH = 1;
const ASK: Window = [0.06, 0.24];
const SEEK: Window = [0.26, 0.46];
const LIFT: Window = [0.44, 0.6];
const ANSWER: Window = [0.62, 0.82];
const CITE: Window = [0.8, 0.94];

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
  const stack = useRef<Group>(null);
  const discs = useRef<Array<Group | null>>([]);
  const rims = useRef<Array<MeshStandardMaterial | null>>([]);
  const query = useRef<Mesh>(null);
  const reply = useRef<Mesh>(null);
  const askLabel = useRef<HTMLDivElement | null>(null);
  const answerLabel = useRef<HTMLDivElement | null>(null);
  const citeLabel = useRef<HTMLDivElement | null>(null);
  const matchLabel = useRef<HTMLDivElement | null>(null);
  const compact = useCompact();
  const layout = compact ? COMPACT : WIDE;
  const font = (n: number) => (compact ? Math.max(Math.round(n * 0.82 * 10) / 10, 8.7) : n);
  const scale = useFitScale(layout.extent[0], layout.extent[1]);
  const docs = labels.docs.slice(0, 5);
  const top = ((docs.length - 1) / 2) * layout.gap;
  const discY = (index: number) => top - index * layout.gap;

  useDampedProgress(progress, reduced, (t, delta) => {
    const asked = smoothWindow(t, ASK);
    const seeking = smoothWindow(t, SEEK);
    const lifted = smoothWindow(t, LIFT);
    const answered = smoothWindow(t, ANSWER);

    // The question travels in, dives through the stack, and leaves as an answer.
    if (query.current) {
      const x = MathUtils.lerp(layout.askAt[0], 0, seeking);
      const y = MathUtils.lerp(layout.askAt[1], discY(MATCH), seeking);
      query.current.position.set(x, y, 0.9 - seeking * 0.55);
      query.current.scale.setScalar(Math.max(asked * (1 - smoothstep((seeking - 0.85) * 6)), 0.001));
    }
    if (reply.current) {
      const eased = smoothstep(answered);
      reply.current.position.set(
        MathUtils.lerp(0, layout.answerAt[0], eased),
        MathUtils.lerp(discY(MATCH), layout.answerAt[1], eased),
        0.35 + Math.sin(eased * Math.PI) * 0.5,
      );
      reply.current.scale.setScalar(Math.max(smoothstep(Math.min(answered, 1 - answered) * 4), 0.001));
    }

    docs.forEach((_, index) => {
      const group = discs.current[index];
      const isMatch = index === MATCH;
      if (group) {
        // The matching passage pulls out of the index, the way a drawer opens.
        group.position.set(isMatch ? lifted * 0.85 : 0, discY(index), isMatch ? lifted * 0.5 : 0);
      }
      const rim = rims.current[index];
      if (rim) {
        const sweep = Math.max(0, 1 - Math.abs(seeking * (docs.length - 1) - index) * 1.4);
        rim.emissiveIntensity = (isMatch ? Math.max(sweep, lifted) : sweep * 0.5) * (palette.dark ? 0.9 : 0.55);
      }
    });

    if (askLabel.current) askLabel.current.style.opacity = String(asked * (1 - seeking));
    if (matchLabel.current) matchLabel.current.style.opacity = String(lifted);
    if (answerLabel.current) answerLabel.current.style.opacity = String(smoothWindow(t, [ANSWER[1] - 0.06, ANSWER[1] + 0.04]));
    if (citeLabel.current) citeLabel.current.style.opacity = String(smoothWindow(t, CITE));

    if (stack.current) {
      stack.current.rotation.z = MathUtils.damp(stack.current.rotation.z, -0.05 + t * 0.1, 4, delta);
    }
    if (stage.current) {
      stage.current.rotation.x = MathUtils.damp(stage.current.rotation.x, -0.34 + t * 0.06, 5, delta);
      stage.current.rotation.y = MathUtils.damp(stage.current.rotation.y, 0.12 - t * 0.2, 5, delta);
    }
  });

  return (
    <>
      <StageLights palette={palette} cool={palette.accent.tag} />
      <group ref={stage} scale={scale} rotation={[-0.34, 0.12, 0]}>
        {/* The index: one disc per indexed passage, stacked into a single body. */}
        <group ref={stack}>
          {docs.map((doc, index) => (
            <group
              key={doc}
              ref={(node) => {
                discs.current[index] = node;
              }}
              position={[0, discY(index), 0]}
            >
              <mesh rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[layout.disc + 0.07, layout.disc + 0.07, layout.depth - 0.08, 56]} />
                <meshStandardMaterial
                  ref={(node) => {
                    rims.current[index] = node;
                  }}
                  color={palette.accent.ai}
                  emissive={palette.accent.ai}
                  emissiveIntensity={0}
                  roughness={0.5}
                />
              </mesh>
              <Disc radius={layout.disc} depth={layout.depth} color={sheet(palette)} roughness={0.65} />
            </group>
          ))}
        </group>

        <Label position={[0, top + 0.95, 0.3]} width={layout.labelWidth} className="select-none text-center">
          <p className="font-mono font-semibold uppercase tracking-[0.15em]" style={{ fontSize: font(9), color: palette.ink.ai }}>
            {labels.title}
          </p>
        </Label>

        {/* The passage that answered, named only once it is pulled out. */}
        <Label position={[layout.disc + 1.35, discY(MATCH) + 0.1, 0.5]} width={layout.labelWidth} className="select-none text-left">
          <div ref={matchLabel} style={{ opacity: 0 }}>
            <p className="truncate font-semibold leading-none" style={{ fontSize: font(11.5), color: palette.panelInk }}>
              {docs[MATCH]}
            </p>
            <p className="mt-1 font-mono uppercase leading-none tracking-[0.14em]" style={{ fontSize: font(8.5), color: palette.ink.ai }}>
              {labels.source}
            </p>
          </div>
        </Label>

        <mesh ref={query} scale={0.001}>
          <sphereGeometry args={[0.16, 20, 20]} />
          <meshStandardMaterial color={palette.accent.team} emissive={palette.accent.team} emissiveIntensity={0.7} roughness={0.35} />
        </mesh>
        <mesh ref={reply} scale={0.001}>
          <sphereGeometry args={[0.17, 20, 20]} />
          <meshStandardMaterial color={palette.accent.ai} emissive={palette.accent.ai} emissiveIntensity={0.8} roughness={0.35} />
        </mesh>

        {/* The question going in. */}
        <Label position={[layout.askAt[0], layout.askAt[1] + 0.5, 0.4]} width={layout.labelWidth + 20} className="select-none text-left">
          <div ref={askLabel} style={{ opacity: 0 }}>
            <p
              className="rounded-lg rounded-bl-sm px-2 py-1.5 leading-snug"
              style={{ fontSize: font(10), color: palette.panelInk, backgroundColor: palette.bubble }}
            >
              {labels.question}
            </p>
          </div>
        </Label>

        {/* The answer coming out, with the document it stands on. */}
        <Label position={[layout.answerAt[0], layout.answerAt[1] - 0.5, 0.4]} width={layout.labelWidth + 20} className="select-none text-left">
          <div ref={answerLabel} style={{ opacity: 0 }}>
            <p
              className="rounded-lg rounded-br-sm px-2 py-1.5 leading-snug"
              style={{ fontSize: font(10), color: palette.dark ? palette.panelInk : palette.cardInk, backgroundColor: palette.wash }}
            >
              {labels.answer}
            </p>
          </div>
          <div ref={citeLabel} style={{ opacity: 0 }}>
            <p className="mt-1.5 truncate font-mono leading-none" style={{ fontSize: font(8.5), color: palette.ink.ai }}>
              {labels.source}: {docs[MATCH]}
            </p>
          </div>
        </Label>

        {/* The bench the index sits on. */}
        <Disc radius={layout.disc + 1.4} depth={0.12} color={sheetWell(palette)} position={[0, -top - 0.75, 0]} castShadow={false} />
      </group>
    </>
  );
}
