"use client";

import { RoundedBox } from "@react-three/drei";
import type { MotionValue } from "framer-motion";
import { useRef } from "react";
import { MathUtils, type Group, type Mesh, type MeshBasicMaterial, type MeshStandardMaterial } from "three";
import { Sparkle } from "@/components/icons";
import { InstagramLogoColor, TelegramLogoColor, WhatsAppLogoColor } from "@/components/icons/channel-logos";
import {
  Label,
  R,
  StageLights,
  Surface,
  sheet,
  sheetChip,
  sheetWell,
  arc,
  smoothWindow,
  useCompact,
  useDampedProgress,
  useFitScale,
  useLabelPx,
  type ScenePalette,
  type Vec3,
  type Window,
} from "../scene-kit";

export type KanbanCard = { title: string; meta: string; channel: "whatsapp" | "instagram" | "telegram"; owner: string };
export type KanbanSceneLabels = {
  columns: [string, string, string, string];
  cards: KanbanCard[];
  /** What the thing moving the cards is called. */
  agent: string;
};

const CHANNEL_MARK = {
  whatsapp: WhatsAppLogoColor,
  instagram: InstagramLogoColor,
  telegram: TelegramLogoColor,
} as const;

type Route = {
  /** Column index at each stop, and the scroll window for each move. */
  stops: number[];
  windows: Window[];
  y: number;
};

type Layout = {
  columnX: readonly [number, number, number, number];
  column: Vec3;
  card: Vec3;
  extent: [number, number];
};

/** The colour bar's own width, and the clear space kept between it and the text. */
const BAR_INSET = 0.15;
const BAR_WIDTH = 0.07;
const TEXT_GUTTER = 0.12;

const WIDE: Layout = {
  columnX: [-4.05, -1.35, 1.35, 4.05],
  column: [2.55, 5.5, 0.22],
  card: [2.36, 1.05, 0.16],
  extent: [10.7, 6.4],
};

// Portrait: four narrower columns, taller, so a phone still shows the whole
// funnel rather than a cropped board.
const COMPACT: Layout = {
  columnX: [-2.55, -0.85, 0.85, 2.55],
  column: [1.62, 5.9, 0.18],
  card: [1.5, 0.92, 0.14],
  extent: [5.75, 6.6],
};

/** Card rows, starting clear of the column header rather than under it. */
const SLOT = [1.45, 0.25, -0.95, -2.15] as const;
/** Header bar and title, measured down from the column's top edge. */
const HEADER_BAR = 0.34;
const HEADER_TEXT = 0.16;

// Six leads on the board. The windows never overlap: exactly one card is in
// the air at a time, because the agent can only carry one, and two cards
// crossing at once read as the board moving itself.
const ROUTES: Route[] = [
  { stops: [0, 1, 2], windows: [[0.04, 0.17], [0.80, 0.93]], y: SLOT[0] },
  { stops: [0, 1], windows: [[0.23, 0.36]], y: SLOT[1] },
  { stops: [1, 2], windows: [[0.42, 0.55]], y: SLOT[2] },
  { stops: [2, 3], windows: [[0.61, 0.74]], y: SLOT[3] },
  { stops: [0], windows: [], y: SLOT[2] },
  { stops: [1], windows: [], y: SLOT[3] },
];

/** Every move on the board, in the order the scroll performs them. */
const MOVES = ROUTES.flatMap((route, cardIndex) =>
  route.windows.map((window) => ({ cardIndex, window })),
).sort((a, b) => a.window[0] - b.window[0]);
/** How early the agent reaches the card it is about to move. */
const APPROACH = 0.08;

/** Places the card and reports which stage it currently belongs to. */
function placeCard(group: Group, route: Route, columnX: Layout["columnX"], progress: number) {
  let x = columnX[route.stops[0]];
  let lift = 0;
  let tilt = 0;
  let stage = route.stops[0];
  route.windows.forEach((window, index) => {
    const t = smoothWindow(progress, window);
    x = MathUtils.lerp(columnX[route.stops[index]], columnX[route.stops[index + 1]], t);
    if (t > 0 && t < 1) {
      lift += arc(t) * 0.75;
      tilt += arc(t) * -0.05;
    }
    // The card takes its new stage's colour halfway across, the way a card
    // dropped in a column immediately reads as that column's.
    if (t >= 0.5) stage = route.stops[index + 1];
  });
  group.position.set(x, route.y, 0.26 + lift);
  group.rotation.z = tilt;
  return stage;
}

function BoardCard({
  card,
  tone,
  palette,
  layout,
  font,
  px,
  compact,
  cardRef,
  barRef,
}: {
  card: KanbanCard;
  tone: string;
  palette: ScenePalette;
  layout: Layout;
  font: (n: number) => number;
  px: (units: number) => number;
  compact: boolean;
  cardRef: (node: Group | null) => void;
  barRef: (node: MeshBasicMaterial | null) => void;
}) {
  const [w, h, d] = layout.card;
  const Mark = CHANNEL_MARK[card.channel] ?? WhatsAppLogoColor;
  const mark = font(11);
  // The text block starts where the colour bar ends, and stops short of the
  // card's right edge, so it can never ride over either.
  const textLeft = -w / 2.8 + BAR_INSET + BAR_WIDTH / 2 + TEXT_GUTTER;
  const textRight = w / 2.8 - 0.1;
  return (
    <group ref={cardRef}>
      <RoundedBox args={layout.card} radius={R.card} smoothness={3} castShadow>
        <Surface color={sheet(palette)} roughness={0.58} metalness={0.02} />
      </RoundedBox>
      {/* The stage bar the product draws on the leading edge of a card. It
          repaints as the card changes column, so its colour is never a promise
          about where the card is going to end up. */}
      <mesh position={[-w / 2 + BAR_INSET, 0, d / 2 + 0.015]}>
        <boxGeometry args={[BAR_WIDTH, h * 0.78, 0.025]} />
        <meshBasicMaterial ref={barRef} color={tone} />
      </mesh>
      <Label
        position={[(textLeft + textRight) / 2, 0, d / 2 + 0.03]}
        width={px(textRight - textLeft)}
        className="select-none text-left"
        style={{ color: palette.panelInk }}
      >
        <p className="truncate font-semibold leading-none" style={{ fontSize: font(12) }}>
          {card.title}
        </p>
        {!compact && (
          <p className="mt-1.5 truncate leading-none" style={{ fontSize: font(9.5), color: palette.panelMuted }}>
            {card.meta}
          </p>
        )}
        {/* The row an operator actually scans: which channel, and who owns it.
            The mark keeps its real brand colours, so it is sized by its box
            rather than by a class the brand component would override. */}
        <span className="mt-2 flex items-center justify-between gap-2">
          <span className="inline-flex shrink-0" style={{ width: mark, height: mark }}>
            <Mark className="h-full w-full" />
          </span>
          <span
            className="grid shrink-0 place-items-center rounded-full font-semibold"
            style={{
              width: mark * 1.5,
              height: mark * 1.5,
              fontSize: font(7.5),
              backgroundColor: sheetChip(palette),
              color: palette.panelMuted,
            }}
          >
            {card.owner}
          </span>
        </span>
      </Label>
    </group>
  );
}

export function KanbanBoardScene({
  progress,
  reduced,
  labels,
  palette,
}: {
  progress: MotionValue<number>;
  reduced: boolean;
  labels: KanbanSceneLabels;
  palette: ScenePalette;
}) {
  const board = useRef<Group>(null);
  const cards = useRef<Array<Group | null>>([]);
  const bars = useRef<Array<MeshBasicMaterial | null>>([]);
  const stages = useRef<number[]>([]);
  const agent = useRef<Group>(null);
  const agentRim = useRef<MeshStandardMaterial>(null);
  const grip = useRef<Mesh>(null);
  const compact = useCompact();
  const layout = compact ? COMPACT : WIDE;
  const font = (n: number) => (compact ? Math.max(Math.round(n * 0.82 * 10) / 10, 8.7) : n);
  const boardScale = useFitScale(layout.extent[0], layout.extent[1]);
  const px = useLabelPx(boardScale);
  // New → contact → proposal → won: the funnel's own progression, cool to warm
  // to committed, with the closed column on the brand green.
  const columnTone = [palette.accent.team, palette.accent.tag, palette.accent.wait, palette.accent.ai];
  const columnInk = [palette.ink.team, palette.ink.tag, palette.ink.wait, palette.ink.ai];
  const [colW, colH] = layout.column;
  const visible = labels.cards.slice(0, ROUTES.length);
  const cardH = layout.card[1];
  const agentR = compact ? 0.28 : 0.34;
  /** How far above a card the agent holds it. */
  const reach = 0.42;
  /** Where the agent waits between moves: above the first column, clear of the cards. */
  const home: [number, number] = [layout.columnX[0], SLOT[0] + cardH / 2 + 1.05];

  useDampedProgress(progress, reduced, (current, delta) => {
    cards.current.forEach((card, index) => {
      if (!card || !ROUTES[index]) return;
      const stage = placeCard(card, ROUTES[index], layout.columnX, current);
      const bar = bars.current[index];
      if (bar && stages.current[index] !== stage) {
        bar.color.set(columnTone[stage]);
        stages.current[index] = stage;
      }
    });

    // The agent goes to the card it is about to move, holds it across, and
    // returns to its post. Cards are placed above, so their positions are current.
    let targetX = home[0];
    let targetY = home[1];
    let targetZ = 1.1;
    let acting = 0;
    for (const move of MOVES) {
      const [start, end] = move.window;
      if (current < start - APPROACH || current > end + 0.06) continue;
      const card = cards.current[move.cardIndex];
      if (card) {
        targetX = card.position.x;
        targetY = card.position.y + cardH / 2 + reach;
        targetZ = card.position.z + 0.55;
      }
      acting = current >= start && current <= end ? 1 : 0;
      break;
    }
    if (agent.current) {
      agent.current.position.x = MathUtils.damp(agent.current.position.x, targetX, 6, delta);
      agent.current.position.y = MathUtils.damp(agent.current.position.y, targetY, 6, delta);
      agent.current.position.z = MathUtils.damp(agent.current.position.z, targetZ, 6, delta);
    }
    if (agentRim.current) {
      agentRim.current.emissiveIntensity = MathUtils.damp(
        agentRim.current.emissiveIntensity,
        (0.25 + acting * 0.75) * (palette.dark ? 1 : 0.6),
        6,
        delta,
      );
    }
    if (grip.current) {
      // The line down to the card it has hold of.
      const length = MathUtils.damp(grip.current.scale.y, Math.max(acting * reach, 0.001), 8, delta);
      grip.current.scale.y = length;
      grip.current.position.y = -length / 2 - 0.2;
    }
    if (board.current) {
      board.current.rotation.x = MathUtils.damp(board.current.rotation.x, -0.105 + current * 0.035, 5, delta);
      board.current.rotation.y = MathUtils.damp(board.current.rotation.y, 0.075 - current * 0.15, 5, delta);
    }
  });

  return (
    <>
      <StageLights reduced={reduced} palette={palette} />
      <group ref={board} scale={boardScale} rotation={[-0.105, 0.075, 0]}>
        {layout.columnX.map((x, index) => (
          <group key={x} position={[x, -0.15, 0]}>
            <RoundedBox args={layout.column} radius={R.board} smoothness={3} receiveShadow>
              <Surface color={sheetWell(palette)} roughness={0.72} metalness={0.06} />
            </RoundedBox>
            <mesh position={[0, colH / 2 - HEADER_BAR, 0.13]}>
              <boxGeometry args={[colW - 0.44, 0.025, 0.025]} />
              <meshBasicMaterial color={columnTone[index]} />
            </mesh>
            <Label position={[0, colH / 2 - HEADER_TEXT, 0.2]} width={px(colW - 0.3)} className="select-none text-left">
              <p className="truncate font-mono font-semibold uppercase tracking-[0.14em]" style={{ fontSize: font(9), color: columnInk[index] }}>
                {labels.columns[index]}
              </p>
            </Label>
          </group>
        ))}

        {visible.map((card, index) => (
          <BoardCard
            key={card.title}
            card={card}
            tone={columnTone[ROUTES[index].stops[0]]}
            palette={palette}
            layout={layout}
            font={font}
            px={px}
            compact={compact}
            cardRef={(node) => {
              cards.current[index] = node;
            }}
            barRef={(node) => {
              bars.current[index] = node;
            }}
          />
        ))}

        {/* The agent that works the board: it comes to a card, takes hold of it
            and carries it to the next stage, then goes back to its post. */}
        <group ref={agent} position={[home[0], home[1], 1.1]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[agentR + 0.06, agentR + 0.06, 0.18, 6]} />
            <meshStandardMaterial ref={agentRim} color={palette.accent.ai} emissive={palette.accent.ai} emissiveIntensity={0.25} roughness={0.5} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[agentR, agentR, 0.24, 6]} />
            <Surface color={sheet(palette)} roughness={0.6} />
          </mesh>
          {/* The mark, not the word: a name floating on a token reads as a
              placeholder, and the product already has an icon for this. */}
          <Label position={[0, 0, 0.18]} width={px(agentR * 1.7)} className="flex select-none items-center justify-center">
            <Sparkle size={font(16)} color={palette.ink.ai} style={{ ["--icon-accent" as string]: palette.ink.ai }} />
            <span className="sr-only">{labels.agent}</span>
          </Label>
          <mesh ref={grip} position={[0, -0.2, 0]} scale={[1, 0.001, 1]}>
            <boxGeometry args={[0.035, 1, 0.035]} />
            <meshBasicMaterial color={palette.accent.ai} />
          </mesh>
        </group>
      </group>
    </>
  );
}
