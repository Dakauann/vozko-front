"use client";

import { RoundedBox } from "@react-three/drei";
import type { MotionValue } from "framer-motion";
import { useRef } from "react";
import { MathUtils, type Group, type MeshBasicMaterial, type MeshStandardMaterial } from "three";
import {
  Bar,
  CHANNEL,
  Label,
  R,
  Slab,
  StageLights,
  arc,
  lerp3,
  smoothWindow,
  smoothstep,
  useCompact,
  useDampedProgress,
  useFitScale,
  type ScenePalette,
  type Vec3,
  type Window,
} from "../scene-kit";

export type MemorySceneLabels = {
  lead: string;
  name: string;
  memories: string;
  whatsapp: string;
  instagram: string;
  customer: string;
  ai: string;
  later: string;
  items: Array<{ text: string; by: string }>;
  context: string;
};

type Point = [number, number];
type Layout = {
  wa: Point;
  record: Point;
  ig: Point;
  panel: Vec3;
  card: Vec3;
  chip: Vec3;
  /** Offsets down from the panel's top edge, plus the composer up from its foot. */
  rows: { title: number; first: number; second: number; composer: number };
  /** Offsets down from the record's top edge. */
  cardRows: { lead: number; memories: number };
  slotY: readonly [number, number, number];
  context: { at: Point; size: Point; titleY: number };
  ghost: { from: number; step: number; size: Point };
  labelWidth: number;
  extent: [number, number];
};

const WIDE: Layout = {
  wa: [-3.75, -0.05],
  record: [0, 0],
  ig: [3.75, -0.05],
  panel: [3.0, 4.9, 0.2],
  card: [2.9, 4.0, 0.18],
  chip: [2.4, 0.42, 0.1],
  rows: { title: 0.45, first: 1.45, second: 2.25, composer: 0.4 },
  cardRows: { lead: 0.55, memories: 1.12 },
  slotY: [0.4, -0.1, -0.6],
  context: { at: [0, -1.05], size: [2.6, 1.85], titleY: -0.3 },
  ghost: { from: -0.72, step: 0.42, size: [2.4, 0.36] },
  labelWidth: 190,
  extent: [10.6, 5.2],
};

// Portrait: the same three objects read as a cascade down the screen, which is
// also the order of the story, instead of three panels squeezed side by side.
const COMPACT: Layout = {
  wa: [-1.3, 2.35],
  record: [0.3, -0.15],
  ig: [-1.15, -2.8],
  panel: [2.0, 2.4, 0.16],
  card: [2.2, 2.6, 0.16],
  chip: [1.8, 0.36, 0.09],
  rows: { title: 0.4, first: 1.05, second: 1.65, composer: 0.32 },
  cardRows: { lead: 0.4, memories: 0.85 },
  slotY: [0.05, -0.35, -0.75],
  context: { at: [0, -0.6], size: [1.75, 1.0], titleY: -0.12 },
  ghost: { from: -0.35, step: 0.3, size: [1.6, 0.26] },
  labelWidth: 122,
  extent: [4.7, 7.5],
};

type ChipFlight = { fromPanel: "wa" | "below"; dy: number; window: Window; tone: "ai" | "team" };
// Two facts come from the AI mid-conversation, one is typed by an operator from
// the inbox panel below the record. All three land on the same list.
const CHIP_FLIGHTS: ChipFlight[] = [
  { fromPanel: "wa", dy: 0.45, window: [0.16, 0.32], tone: "ai" },
  { fromPanel: "below", dy: -2.6, window: [0.38, 0.52], tone: "team" },
  { fromPanel: "wa", dy: -0.6, window: [0.5, 0.64], tone: "ai" },
];
const ghostWindow = (index: number): Window => [0.74 + index * 0.03, 0.88 + index * 0.03];
const WA_CUSTOMER: Window = [0.02, 0.1];
const WA_AI: Window = [0.1, 0.18];
const IG_LIT: Window = [0.62, 0.72];
const IG_BUBBLE: Window = [0.68, 0.76];
const CONTEXT_BLOCK: Window = [0.72, 0.84];

function setOpacity(node: HTMLElement | null, value: number) {
  if (node) node.style.opacity = String(value);
}

/**
 * A message in the thread. Incoming sits left on the neutral ground, ours sits
 * right on a brand tint with a squared-off tail, which is the arrangement any
 * messaging app uses and the fastest way to say "this is a conversation".
 */
function Bubble({
  tone,
  palette,
  size,
  time,
  children,
  nodeRef,
}: {
  tone: "customer" | "ai";
  palette: ScenePalette;
  size: number;
  time: string;
  children: string;
  nodeRef: (node: HTMLDivElement | null) => void;
}) {
  const outgoing = tone === "ai";
  return (
    <div ref={nodeRef} className={`flex ${outgoing ? "justify-end" : "justify-start"}`} style={{ opacity: 0 }}>
      <span
        className={`inline-block max-w-[86%] rounded-lg px-2 py-1.5 leading-snug ${outgoing ? "rounded-br-sm" : "rounded-bl-sm"}`}
        style={{
          fontSize: size,
          // The outgoing tint is dark green on graphite and pale green in
          // daylight, so its ink has to follow the theme rather than assume paper.
          color: outgoing && !palette.dark ? palette.cardInk : palette.panelInk,
          backgroundColor: outgoing ? palette.wash : palette.bubble,
        }}
      >
        {children}
        <span className="ml-1.5 inline-block align-baseline font-mono" style={{ fontSize: size * 0.72, opacity: 0.65 }}>
          {time}
        </span>
      </span>
    </div>
  );
}

/** The composer that closes every chat panel: a field and a send key. */
function Composer({ palette, size, tone }: { palette: ScenePalette; size: number; tone: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className="flex flex-1 items-center rounded-full px-2"
        // `chip` is paper: on the dark chat panel it rendered as a white bar.
        // The composer sits on the panel, so it takes the panel's own fill.
        style={{ height: size * 2.1, backgroundColor: palette.bubble, border: `1px solid ${palette.edge}` }}
      >
        <span className="block rounded" style={{ width: "58%", height: 2, backgroundColor: palette.panelMuted, opacity: 0.55 }} />
      </span>
      <span className="grid shrink-0 place-items-center rounded-full" style={{ width: size * 2.1, height: size * 2.1, backgroundColor: tone }}>
        <span
          className="block"
          style={{
            width: 0,
            height: 0,
            borderTop: `${size * 0.42}px solid transparent`,
            borderBottom: `${size * 0.42}px solid transparent`,
            borderLeft: `${size * 0.7}px solid #0D0F10`,
            marginLeft: 2,
          }}
        />
      </span>
    </div>
  );
}

/** The thread header: who you are talking to, and on which channel. */
function ChatHeader({
  name,
  channel,
  tone,
  palette,
  size,
  initials,
  nodeRef,
}: {
  name: string;
  channel: string;
  tone: string;
  palette: ScenePalette;
  size: number;
  initials: string;
  nodeRef?: (node: HTMLDivElement | null) => void;
}) {
  return (
    <div ref={nodeRef} className="flex items-center gap-2">
      <span
        className="grid shrink-0 place-items-center rounded-full font-semibold"
        style={{ width: size * 2.2, height: size * 2.2, backgroundColor: tone, color: "#0D0F10", fontSize: size * 0.8 }}
      >
        {initials}
      </span>
      <span className="min-w-0 flex-1">
        <p className="truncate font-semibold leading-none" style={{ fontSize: size, color: palette.panelInk }}>
          {name}
        </p>
        <p className="mt-1 truncate font-mono uppercase leading-none tracking-[0.14em]" style={{ fontSize: size * 0.78, color: tone }}>
          {channel}
        </p>
      </span>
    </div>
  );
}

export function MemoryScene({
  progress,
  reduced,
  labels,
  palette,
}: {
  progress: MotionValue<number>;
  reduced: boolean;
  labels: MemorySceneLabels;
  palette: ScenePalette;
}) {
  const stage = useRef<Group>(null);
  const chips = useRef<Array<Group | null>>([]);
  const chipLabels = useRef<Array<HTMLDivElement | null>>([]);
  const ghosts = useRef<Array<Group | null>>([]);
  const ghostMaterials = useRef<Array<MeshStandardMaterial | null>>([]);
  const ghostLabels = useRef<Array<HTMLDivElement | null>>([]);
  const waCustomer = useRef<HTMLDivElement | null>(null);
  const waAi = useRef<HTMLDivElement | null>(null);
  const igMaterial = useRef<MeshStandardMaterial>(null);
  const igBarMaterial = useRef<MeshBasicMaterial>(null);
  const igTitle = useRef<HTMLDivElement | null>(null);
  const igBubble = useRef<HTMLDivElement | null>(null);
  const contextMaterial = useRef<MeshStandardMaterial>(null);
  const contextTitle = useRef<HTMLDivElement | null>(null);
  const compact = useCompact();
  const layout = compact ? COMPACT : WIDE;
  const font = (n: number) => (compact ? Math.max(Math.round(n * 0.82 * 10) / 10, 8.7) : n);
  const stageScale = useFitScale(layout.extent[0], layout.extent[1]);
  const items = labels.items.slice(0, CHIP_FLIGHTS.length);

  const panelHalf = layout.panel[1] / 2;
  const cardHalf = layout.card[1] / 2;
  const slotAt = (index: number): Vec3 => [layout.record[0], layout.record[1] + layout.slotY[index], layout.card[2] / 2 + 0.14];
  const contextRowAt = (index: number): Vec3 => [layout.ig[0], layout.ig[1] + layout.ghost.from - index * layout.ghost.step, 0.34];
  const chipFrom = (flight: ChipFlight): Vec3 =>
    flight.fromPanel === "wa" ? [layout.wa[0], layout.wa[1] + flight.dy, 0.6] : [layout.record[0], layout.record[1] + flight.dy, 0.7];

  useDampedProgress(progress, reduced, (t, delta) => {
    setOpacity(waCustomer.current, smoothWindow(t, WA_CUSTOMER));
    setOpacity(waAi.current, smoothWindow(t, WA_AI));

    CHIP_FLIGHTS.forEach((flight, index) => {
      const chip = chips.current[index];
      if (!chip) return;
      const u = smoothWindow(t, flight.window);
      const position = lerp3(chipFrom(flight), slotAt(index), u);
      const pop = smoothstep(u * 4);
      chip.position.set(position[0], position[1], position[2] + arc(u) * 0.7);
      chip.scale.setScalar(Math.max(pop, 0.001));
      chip.rotation.z = arc(u) * -0.05;
      setOpacity(chipLabels.current[index], pop);
    });

    // Not-yet-arrived reads as "faded" on graphite, but a faded sheet on a
    // daylight canvas simply disappears, so the floor is higher in light.
    const floor = palette.dark ? 0.35 : 0.6;
    const lit = floor + (1 - floor) * smoothWindow(t, IG_LIT);
    if (igMaterial.current) igMaterial.current.opacity = lit;
    if (igBarMaterial.current) igBarMaterial.current.opacity = lit;
    setOpacity(igTitle.current, lit);
    setOpacity(igBubble.current, smoothWindow(t, IG_BUBBLE));

    const block = smoothWindow(t, CONTEXT_BLOCK);
    if (contextMaterial.current) contextMaterial.current.opacity = block * (palette.dark ? 0.6 : 0.9);
    setOpacity(contextTitle.current, block);

    items.forEach((_, index) => {
      const ghost = ghosts.current[index];
      if (!ghost) return;
      const u = smoothWindow(t, ghostWindow(index));
      const position = lerp3(slotAt(index), contextRowAt(index), u);
      const reveal = smoothstep(u * 5);
      ghost.position.set(position[0], position[1], position[2] + arc(u) * 0.5);
      ghost.scale.setScalar(Math.max(reveal * 0.85, 0.001));
      const material = ghostMaterials.current[index];
      if (material) material.opacity = reveal * 0.95;
      setOpacity(ghostLabels.current[index], u);
    });

    if (stage.current) {
      stage.current.rotation.x = MathUtils.damp(stage.current.rotation.x, -0.1 + t * 0.03, 5, delta);
      stage.current.rotation.y = MathUtils.damp(stage.current.rotation.y, 0.07 - t * 0.14, 5, delta);
    }
  });

  return (
    <>
      <StageLights palette={palette} accent={CHANNEL.whatsapp} cool={CHANNEL.instagram} />
      <group ref={stage} scale={stageScale} rotation={[-0.1, 0.07, 0]}>
        {/* WhatsApp conversation */}
        <group position={[layout.wa[0], layout.wa[1], 0]}>
          <Slab size={layout.panel} color={palette.board} radius={R.board} roughness={0.72} receiveShadow />
          <Bar position={[0, panelHalf - layout.rows.title - 0.3, 0.11]} size={[layout.panel[0] - 0.16, 0.02, 0.02]} color={palette.edge} />
          <Label position={[0, panelHalf - layout.rows.title, 0.2]} width={layout.labelWidth} className="select-none text-left">
            <ChatHeader
              name={labels.name}
              channel={labels.whatsapp}
              tone={CHANNEL.whatsapp}
              palette={palette}
              size={font(10)}
              initials={labels.name.slice(0, 2).toUpperCase()}
            />
          </Label>
          <Label position={[0, panelHalf - layout.rows.first, 0.14]} width={layout.labelWidth} className="select-none">
            <Bubble
              tone="customer"
              palette={palette}
              size={font(10)}
              time="09:12"
              nodeRef={(node) => {
                waCustomer.current = node;
              }}
            >
              {labels.customer}
            </Bubble>
          </Label>
          <Label position={[0, panelHalf - layout.rows.second, 0.14]} width={layout.labelWidth} className="select-none">
            <Bubble
              tone="ai"
              palette={palette}
              size={font(10)}
              time="09:12"
              nodeRef={(node) => {
                waAi.current = node;
              }}
            >
              {labels.ai}
            </Bubble>
          </Label>
          <Label position={[0, -panelHalf + layout.rows.composer, 0.14]} width={layout.labelWidth} className="select-none">
            <Composer palette={palette} size={font(10)} tone={CHANNEL.whatsapp} />
          </Label>
        </group>

        {/* The lead record */}
        <group position={[layout.record[0], layout.record[1], 0.12]}>
          <Slab size={layout.card} color={palette.card} roughness={0.58} receiveShadow />
          <Label position={[0, cardHalf - layout.cardRows.lead, 0.22]} width={layout.labelWidth + 14} className="select-none text-left">
            <p className="font-mono uppercase tracking-[0.15em]" style={{ fontSize: font(9), color: palette.cardInkMuted }}>
              {labels.lead}
            </p>
            <p className="mt-1 font-semibold leading-none" style={{ fontSize: font(13), color: palette.cardInk }}>
              {labels.name}
            </p>
          </Label>
          <Label position={[0, cardHalf - layout.cardRows.memories, 0.22]} width={layout.labelWidth + 14} className="select-none text-left">
            <p
              className="border-t pt-1.5 font-mono uppercase tracking-[0.15em]"
              style={{ fontSize: font(9), color: palette.cardInkMuted, borderColor: palette.dark ? "#D5DCE0" : "#CBD3D8" }}
            >
              {labels.memories}
            </p>
          </Label>
        </group>

        {items.map((item, index) => (
          <group
            key={item.text}
            ref={(node) => {
              chips.current[index] = node;
            }}
          >
            <Slab size={layout.chip} color={palette.chip} radius={R.chip} roughness={0.7} />
            <Bar
              position={[-layout.chip[0] / 2 + 0.08, 0, layout.chip[2] / 2 + 0.01]}
              size={[0.06, layout.chip[1] * 0.65, 0.02]}
              color={palette.accent[CHIP_FLIGHTS[index].tone]}
            />
            <Label position={[0.06, 0, layout.chip[2] / 2 + 0.02]} width={layout.labelWidth - 20} className="select-none text-left">
              <div
                ref={(node) => {
                  chipLabels.current[index] = node;
                }}
                style={{ opacity: 0 }}
              >
                <p className="truncate font-semibold leading-none" style={{ fontSize: font(10), color: palette.cardInk }}>
                  {item.text}
                </p>
                <p className="mt-1 truncate font-mono leading-none" style={{ fontSize: font(8.5), color: palette.cardInkMuted }}>
                  {item.by}
                </p>
              </div>
            </Label>
          </group>
        ))}

        {/* Instagram conversation, weeks later */}
        <group position={[layout.ig[0], layout.ig[1], 0]}>
          <RoundedBox args={layout.panel} radius={R.board} smoothness={3} receiveShadow>
            <meshStandardMaterial ref={igMaterial} color={palette.board} roughness={0.72} transparent opacity={0.35} />
          </RoundedBox>
          <mesh position={[0, panelHalf - layout.rows.title - 0.3, 0.11]}>
            <boxGeometry args={[layout.panel[0] - 0.16, 0.02, 0.02]} />
            <meshBasicMaterial ref={igBarMaterial} color={palette.edge} transparent opacity={0.35} />
          </mesh>
          <Label position={[0, panelHalf - layout.rows.title, 0.2]} width={layout.labelWidth} className="select-none text-left">
            <ChatHeader
              name={labels.name}
              channel={labels.instagram}
              tone={CHANNEL.instagram}
              palette={palette}
              size={font(10)}
              initials={labels.name.slice(0, 2).toUpperCase()}
              nodeRef={(node) => {
                igTitle.current = node;
              }}
            />
          </Label>
          <Label position={[0, panelHalf - layout.rows.first, 0.14]} width={layout.labelWidth} className="select-none">
            <Bubble
              tone="customer"
              palette={palette}
              size={font(10)}
              time="14:36"
              nodeRef={(node) => {
                igBubble.current = node;
              }}
            >
              {labels.later}
            </Bubble>
          </Label>

          <RoundedBox
            args={[layout.context.size[0], layout.context.size[1], 0.06]}
            radius={R.chip}
            smoothness={3}
            position={[layout.context.at[0], layout.context.at[1], 0.14]}
          >
            <meshStandardMaterial ref={contextMaterial} color={palette.wash} roughness={0.8} transparent opacity={0} />
          </RoundedBox>
          <Label position={[0, layout.context.titleY, 0.2]} width={layout.labelWidth} className="select-none text-left">
            <div
              ref={(node) => {
                contextTitle.current = node;
              }}
              style={{ opacity: 0 }}
            >
              <p className="font-mono font-semibold uppercase tracking-[0.15em]" style={{ fontSize: font(9), color: palette.ink.ai }}>
                {labels.context}
              </p>
            </div>
          </Label>
        </group>

        {items.map((item, index) => (
          <group
            key={`ghost-${item.text}`}
            ref={(node) => {
              ghosts.current[index] = node;
            }}
          >
            <RoundedBox args={[layout.ghost.size[0], layout.ghost.size[1], 0.08]} radius={R.chip} smoothness={3}>
              <meshStandardMaterial
                ref={(node) => {
                  ghostMaterials.current[index] = node;
                }}
                color={palette.ghost}
                roughness={0.7}
                transparent
                opacity={0}
              />
            </RoundedBox>
            <Label position={[0.04, 0, 0.06]} width={layout.labelWidth - 40} className="select-none text-left">
              <div
                ref={(node) => {
                  ghostLabels.current[index] = node;
                }}
                style={{ opacity: 0 }}
              >
                <p className="truncate font-semibold leading-none" style={{ fontSize: font(9.5), color: palette.panelInk }}>
                  {item.text}
                </p>
              </div>
            </Label>
          </group>
        ))}
      </group>
    </>
  );
}
