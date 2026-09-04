"use client";

import type { MotionValue } from "framer-motion";
import { useRef } from "react";
import { MathUtils, type Group, type Mesh } from "three";
import {
  Bar,
  CHANNEL,
  Label,
  R,
  Slab,
  StageLights,
  sheet,
  sheetChip,
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

export type RouletteSceneLabels = {
  incoming: string;
  unopened: string;
  rescue: string;
  members: Array<{ name: string; presence: string }>;
  conversations: Array<{ title: string; meta: string }>;
};

type Point = [number, number];
type Layout = {
  ringAt: Point;
  radius: number;
  token: Vec3;
  card: Vec3;
  tray: Vec3;
  trayAt: Point;
  /** A phone reads top to bottom, so the queue sits above the ring, not beside it. */
  trayHorizontal: boolean;
  slot: number;
  labelWidth: number;
  extent: [number, number];
};

const WIDE: Layout = {
  ringAt: [0.55, -0.1],
  radius: 2.7,
  token: [1.72, 0.66, 0.14],
  card: [1.7, 0.62, 0.14],
  tray: [1.95, 5.0, 0.2],
  trayAt: [-4.3, -0.2],
  trayHorizontal: false,
  slot: 0.86,
  labelWidth: 122,
  extent: [10.2, 7.2],
};

const COMPACT: Layout = {
  ringAt: [0, -1.45],
  radius: 1.74,
  token: [1.52, 0.6, 0.13],
  card: [1.44, 0.54, 0.13],
  tray: [4.6, 0.92, 0.18],
  trayAt: [0, 2.6],
  trayHorizontal: true,
  slot: 1.48,
  labelWidth: 84,
  extent: [5.0, 7.1],
};

const ANGLES = [90, 18, -54, -126, 162].map((deg) => (deg * Math.PI) / 180);
/**
 * Presence is the only thing colour says here; the avatars stay neutral. Lia is
 * offline past the last-seen window, which is why the deal skips her seat.
 */
const PRESENCE = ["online", "online", "offline", "stale", "online"] as const;
const ARC_LENGTH = Math.PI * 0.4;

const memberAt = (index: number, l: Layout): Vec3 => [
  l.ringAt[0] + l.radius * Math.cos(ANGLES[index]),
  l.ringAt[1] + l.radius * Math.sin(ANGLES[index]),
  0,
];
const seatAt = (index: number, l: Layout): Vec3 => {
  const member = memberAt(index, l);
  return [member[0], member[1] - (l.token[1] + 0.4), 0.3];
};
const trayAt = (slot: number, l: Layout): Vec3 =>
  l.trayHorizontal
    ? [l.trayAt[0] + (slot - 1) * l.slot, l.trayAt[1], 0.3]
    : [l.trayAt[0], l.trayAt[1] + l.tray[1] / 2 - 1.0 - slot * l.slot, 0.3];

type Flight = { card: number; seat: number; window: Window };
// Round robin: the first three conversations go to Ana, Davi and Rui (Lia is
// skipped). The rescue sweep then moves the conversation Ana never opened on
// to Bia, the next member of the ring.
const FLIGHTS: Flight[] = [
  { card: 0, seat: 0, window: [0.05, 0.24] },
  { card: 1, seat: 1, window: [0.32, 0.5] },
  { card: 2, seat: 3, window: [0.58, 0.74] },
  { card: 0, seat: 4, window: [0.8, 0.94] },
];
/** (progress, degrees) keyframes for the dealer arc; it only ever moves clockwise. */
const ARC_KEYS: Array<[number, number]> = [
  [0, 90],
  [0.26, 90],
  [0.36, 18],
  [0.52, 18],
  [0.66, -126],
  [0.78, -126],
  [0.88, -198],
  [1, -198],
];
const UNOPENED_WINDOW: Window = [0.7, 0.76];
const RESCUE_AT = 0.84;

function arcAngle(t: number) {
  for (let index = 0; index < ARC_KEYS.length - 1; index += 1) {
    const [t0, a0] = ARC_KEYS[index];
    const [t1, a1] = ARC_KEYS[index + 1];
    if (t <= t1) return MathUtils.lerp(a0, a1, smoothstep((t - t0) / (t1 - t0)));
  }
  return ARC_KEYS[ARC_KEYS.length - 1][1];
}

function Token({
  index,
  member,
  palette,
  layout,
  font,
}: {
  index: number;
  member: RouletteSceneLabels["members"][number];
  palette: ScenePalette;
  layout: Layout;
  font: (n: number) => number;
}) {
  const state = PRESENCE[index] ?? "online";
  const offline = state === "offline";
  const initials = member.name.slice(0, 2).toUpperCase();
  const dot = state === "online" ? palette.accent.ai : state === "stale" ? palette.accent.wait : palette.rim;
  const badge = font(8);
  return (
    <group position={memberAt(index, layout)}>
      <Slab size={layout.token} color={offline ? palette.offline : sheet(palette)} roughness={offline ? 0.8 : 0.58} />
      <Label position={[0, 0, layout.token[2] / 2 + 0.02]} width={layout.labelWidth} className="flex select-none items-center gap-1.5 text-left">
        <span
          className="grid shrink-0 place-items-center rounded-full font-semibold"
          style={{
            width: badge * 2.3,
            height: badge * 2.3,
            fontSize: badge * 0.92,
            backgroundColor: offline ? palette.rim : sheetChip(palette),
            color: offline ? palette.card : palette.panelMuted,
          }}
        >
          {initials}
        </span>
        <span className="min-w-0 flex-1">
          <p className="truncate font-semibold leading-none" style={{ fontSize: font(11), color: offline ? palette.offlineInk : palette.panelInk }}>
            {member.name}
          </p>
          <span className="mt-1 flex items-center gap-1">
            <i className="block shrink-0 rounded-full" style={{ width: badge * 0.55, height: badge * 0.55, backgroundColor: dot }} />
            <span className="truncate font-mono leading-none" style={{ fontSize: font(8.5), color: offline ? palette.offlineInk : palette.panelMuted }}>
              {member.presence}
            </span>
          </span>
        </span>
      </Label>
    </group>
  );
}

function ConversationCard({
  card,
  tone,
  palette,
  layout,
  font,
  groupRef,
  statusRef,
}: {
  card: RouletteSceneLabels["conversations"][number];
  tone: string;
  palette: ScenePalette;
  layout: Layout;
  font: (n: number) => number;
  groupRef: (node: Group | null) => void;
  statusRef?: (node: HTMLSpanElement | null) => void;
}) {
  const [w, h, d] = layout.card;
  return (
    <group ref={groupRef}>
      <Slab size={layout.card} color={sheet(palette)} roughness={0.58} />
      <Bar position={[-w / 2 + 0.12, 0, d / 2 + 0.015]} size={[0.06, h * 0.68, 0.02]} color={tone} />
      <Label position={[0.2, 0, d / 2 + 0.02]} width={layout.labelWidth - 14} className="select-none text-left">
        <p className="truncate font-semibold leading-none" style={{ fontSize: font(11), color: palette.panelInk }}>
          {card.title}
        </p>
        <p className="mt-1 truncate font-mono leading-none" style={{ fontSize: font(8.5), color: palette.panelMuted }}>
          {card.meta}
        </p>
      </Label>
      {statusRef && (
        // Below the card, not above it: above, it landed on the attendant token
        // the card had just been dealt to.
        <Label position={[0.2, -h / 2 - 0.22, d / 2 + 0.04]} width={layout.labelWidth} className="select-none text-right">
          <span
            ref={statusRef}
            className="inline-block px-1.5 py-1 font-mono font-semibold uppercase tracking-[0.12em]"
            style={{ opacity: 0, fontSize: font(8.5), backgroundColor: palette.accent.wait, color: "#0D0F10" }}
          />
        </Label>
      )}
    </group>
  );
}

export function RouletteScene({
  progress,
  reduced,
  labels,
  palette,
}: {
  progress: MotionValue<number>;
  reduced: boolean;
  labels: RouletteSceneLabels;
  palette: ScenePalette;
}) {
  const ring = useRef<Group>(null);
  const dealer = useRef<Mesh>(null);
  const cards = useRef<Array<Group | null>>([]);
  const status = useRef<HTMLSpanElement | null>(null);
  const statusText = useRef("");
  const compact = useCompact();
  const layout = compact ? COMPACT : WIDE;
  const font = (n: number) => (compact ? Math.max(Math.round(n * 0.82 * 10) / 10, 8.7) : n);
  const ringScale = useFitScale(layout.extent[0], layout.extent[1]);
  const cardTone = [CHANNEL.whatsapp, CHANNEL.instagram, CHANNEL.whatsapp];
  const conversations = labels.conversations.slice(0, cardTone.length);
  const members = labels.members.slice(0, ANGLES.length);
  const table = layout.radius + 0.6;
  const [trayW, trayH] = layout.tray;

  useDampedProgress(progress, reduced, (t, delta) => {
    conversations.forEach((_, index) => {
      const group = cards.current[index];
      if (!group) return;
      let position = trayAt(index, layout);
      let lift = 0;
      let tilt = 0;
      FLIGHTS.forEach((flight) => {
        if (flight.card !== index) return;
        const u = smoothWindow(t, flight.window);
        position = lerp3(position, seatAt(flight.seat, layout), u);
        lift += arc(u) * 0.85;
        tilt += arc(u) * -0.06;
      });
      group.position.set(position[0], position[1], position[2] + lift);
      group.rotation.z = tilt;
    });

    if (dealer.current) {
      dealer.current.rotation.z = MathUtils.degToRad(arcAngle(t)) - ARC_LENGTH / 2;
    }

    if (status.current) {
      const rescued = t >= RESCUE_AT;
      const text = rescued ? labels.rescue : labels.unopened;
      if (statusText.current !== text) {
        status.current.textContent = text;
        statusText.current = text;
      }
      status.current.style.opacity = String(smoothWindow(t, UNOPENED_WINDOW));
      status.current.style.backgroundColor = rescued ? palette.accent.ai : palette.accent.wait;
    }

    if (ring.current) {
      ring.current.rotation.x = MathUtils.damp(ring.current.rotation.x, -0.12 + t * 0.04, 5, delta);
      ring.current.rotation.y = MathUtils.damp(ring.current.rotation.y, 0.08 - t * 0.14, 5, delta);
    }
  });

  return (
    <>
      <StageLights palette={palette} />
      <group ref={ring} scale={ringScale} rotation={[-0.12, 0.08, 0]}>
        <group position={[layout.ringAt[0], layout.ringAt[1], 0]}>
          <mesh position={[0, 0, -0.12]} receiveShadow>
            <circleGeometry args={[table, 96]} />
            <meshStandardMaterial color={palette.well} roughness={0.9} />
          </mesh>
          <mesh position={[0, 0, -0.05]}>
            <ringGeometry args={[table - 0.16, table, 96]} />
            <meshStandardMaterial color={palette.edge} roughness={0.85} metalness={0.05} />
          </mesh>
          {/* The pointer is a marking ON the table, so it passes UNDER the
              conversations resting on it rather than across them. */}
          <mesh ref={dealer} position={[0, 0, -0.015]}>
            <torusGeometry args={[table - 0.08, 0.045, 8, 48, ARC_LENGTH]} />
            <meshBasicMaterial color={palette.accent.ai} />
          </mesh>
        </group>

        {members.map((member, index) => (
          <Token key={member.name} index={index} member={member} palette={palette} layout={layout} font={font} />
        ))}

        {/* The queue: what has not been dealt yet. */}
        <Slab
          size={layout.tray}
          color={palette.board}
          position={[layout.trayAt[0], layout.trayAt[1] - (layout.trayHorizontal ? 0 : 0.1), -0.05]}
          radius={R.board}
          roughness={0.72}
          receiveShadow
        />
        <Bar
          position={
            layout.trayHorizontal
              ? [layout.trayAt[0], layout.trayAt[1] + trayH / 2 - 0.16, 0.11]
              : [layout.trayAt[0], layout.trayAt[1] + trayH / 2 - 0.4, 0.11]
          }
          size={[trayW - 0.4, 0.025, 0.025]}
          color={palette.accent.ai}
        />
        <Label
          position={[
            layout.trayHorizontal ? layout.trayAt[0] - trayW / 2 + 0.5 : layout.trayAt[0],
            layout.trayAt[1] + trayH / 2 + (layout.trayHorizontal ? 0.22 : -0.2),
            0.2,
          ]}
          width={layout.labelWidth}
          className="select-none text-left"
        >
          <p className="font-mono font-semibold uppercase tracking-[0.15em]" style={{ fontSize: font(9), color: palette.ink.ai }}>
            {labels.incoming}
          </p>
        </Label>

        {conversations.map((card, index) => (
          <ConversationCard
            key={card.title}
            card={card}
            tone={cardTone[index]}
            palette={palette}
            layout={layout}
            font={font}
            groupRef={(node) => {
              cards.current[index] = node;
            }}
            statusRef={
              index === 0
                ? (node) => {
                    status.current = node;
                  }
                : undefined
            }
          />
        ))}
      </group>
    </>
  );
}
