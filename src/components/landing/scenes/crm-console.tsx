"use client";

import type { MotionValue } from "framer-motion";
import { useRef } from "react";
import { MathUtils, type Group, type Mesh, type MeshBasicMaterial, type MeshStandardMaterial } from "three";
import { Bookmark, ChatCircle, Sparkle, Target, UserCircle } from "@/components/icons";
import { InstagramLogoColor, TelegramLogoColor, WhatsAppLogoColor } from "@/components/icons/channel-logos";
import {
  Bar,
  CHANNEL,
  Label,
  R,
  Slab,
  StageLights,
  arc,
  sheet,
  sheetChip,
  sheetWell,
  smoothWindow,
  smoothstep,
  useCompact,
  useDampedProgress,
  useFitScale,
  useLabelPx,
  type ScenePalette,
  type Vec3,
  type Window,
} from "../scene-kit";

export type CrmChannel = "whatsapp" | "instagram" | "telegram" | "livechat";
export type CrmSceneLabels = {
  inbox: string;
  rows: Array<{ name: string; preview: string; channel: CrmChannel }>;
  thread: { customer: string; ai: string; human: string };
  details: string;
  stageLabel: string;
  stage: string;
  tagsLabel: string;
  tags: string[];
  ownerLabel: string;
  owner: string;
  byAi: string;
  byHuman: string;
};

/** The conversation the scene follows all the way through. */
const OPEN_ROW = 0;

const CHANNEL_MARK = {
  whatsapp: WhatsAppLogoColor,
  instagram: InstagramLogoColor,
  telegram: TelegramLogoColor,
} as const;

function channelTone(channel: CrmChannel, palette: ScenePalette) {
  return channel === "livechat" ? palette.accent.team : CHANNEL[channel];
}

type Panel = { at: [number, number]; size: Vec3 };
type Layout = {
  inbox: Panel;
  thread: Panel;
  details: Panel;
  row: Vec3;
  rowGap: number;
  rowTop: number;
  visibleRows: number;
  extent: [number, number];
};

const WIDE: Layout = {
  inbox: { at: [-3.95, 0], size: [3.0, 5.6, 0.26] },
  thread: { at: [-0.3, 0], size: [3.7, 5.6, 0.3] },
  details: { at: [3.5, 0], size: [2.5, 5.6, 0.26] },
  row: [2.7, 0.8, 0.16],
  rowGap: 0.94,
  rowTop: 1.72,
  visibleRows: 5,
  extent: [10.4, 6.4],
};

// Portrait: the three panes become a column, which is how the product itself
// behaves on a phone. Two rows are enough to say "a queue".
const COMPACT: Layout = {
  inbox: { at: [0, 2.55], size: [3.5, 2.5, 0.22] },
  thread: { at: [0, -0.5], size: [3.5, 3.0, 0.26] },
  details: { at: [0, -3.35], size: [3.5, 2.0, 0.22] },
  row: [3.2, 0.72, 0.14],
  rowGap: 0.84,
  rowTop: 0.6,
  visibleRows: 2,
  extent: [4.0, 8.4],
};

const ARRIVE: Window = [0.0, 0.17];
const OPEN: Window = [0.2, 0.35];
const CUSTOMER: Window = [0.38, 0.46];
const AI_REPLY: Window = [0.5, 0.6];
const CLASSIFY: Window = [0.62, 0.76];
const ASSIGN: Window = [0.8, 0.93];

/** Each row drops in on its own beat, so the queue fills rather than appears. */
const rowWindow = (index: number, total: number): Window => {
  const span = (ARRIVE[1] - ARRIVE[0]) / total;
  return [ARRIVE[0] + index * span, ARRIVE[0] + index * span + span * 1.6];
};

function ChannelMark({ channel, size, palette }: { channel: CrmChannel; size: number; palette: ScenePalette }) {
  if (channel === "livechat") {
    return <ChatCircle size={size} color={palette.accent.team} style={{ ["--icon-accent" as string]: palette.accent.team }} />;
  }
  const Mark = CHANNEL_MARK[channel];
  return (
    <span className="inline-flex shrink-0" style={{ width: size, height: size }}>
      <Mark className="h-full w-full" />
    </span>
  );
}

export function CrmScene({
  progress,
  reduced,
  labels,
  palette,
}: {
  progress: MotionValue<number>;
  reduced: boolean;
  labels: CrmSceneLabels;
  palette: ScenePalette;
}) {
  const stage = useRef<Group>(null);
  const rows = useRef<Array<Group | null>>([]);
  const rowSelects = useRef<Array<MeshBasicMaterial | null>>([]);
  const thread = useRef<Group>(null);
  const threadFace = useRef<MeshStandardMaterial>(null);
  const customerBubble = useRef<HTMLDivElement | null>(null);
  const aiBubble = useRef<HTMLDivElement | null>(null);
  const humanBubble = useRef<HTMLDivElement | null>(null);
  const handler = useRef<HTMLDivElement | null>(null);
  const tagChips = useRef<Array<Group | null>>([]);
  const tagLabels = useRef<Array<HTMLDivElement | null>>([]);
  const stageChip = useRef<HTMLDivElement | null>(null);
  const ownerRow = useRef<HTMLDivElement | null>(null);
  const ownerBadge = useRef<Mesh>(null);

  const compact = useCompact();
  const layout = compact ? COMPACT : WIDE;
  const font = (n: number) => (compact ? Math.max(Math.round(n * 0.82 * 10) / 10, 8.7) : n);
  const scale = useFitScale(layout.extent[0], layout.extent[1]);
  const px = useLabelPx(scale);
  const visible = labels.rows.slice(0, layout.visibleRows);
  const tags = labels.tags.slice(0, 2);

  const [rowW, rowH, rowD] = layout.row;
  const rowY = (index: number) => layout.rowTop - index * layout.rowGap;
  const threadHalf = layout.thread.size[1] / 2;
  const detailsHalf = layout.details.size[1] / 2;
  /** Where a tag starts life: on the open conversation, before it is filed. */
  const tagFrom: Vec3 = [layout.thread.at[0], layout.thread.at[1] - 0.4, 0.7];
  const tagTo = (index: number): Vec3 => [layout.details.at[0], layout.details.at[1] + detailsHalf - 2.0 - index * 0.5, 0.3];

  useDampedProgress(progress, reduced, (t, delta) => {
    // 1 — the queue fills, one channel at a time.
    visible.forEach((_, index) => {
      const u = smoothWindow(t, rowWindow(index, visible.length));
      const group = rows.current[index];
      if (group) {
        group.position.set(
          MathUtils.lerp(-2.2, 0, u),
          rowY(index),
          // The opened row lifts off the list and stays lifted.
          index === OPEN_ROW ? 0.18 + smoothWindow(t, OPEN) * 0.3 : 0.18,
        );
        group.scale.setScalar(Math.max(u, 0.001));
      }
      const select = rowSelects.current[index];
      if (select) select.opacity = index === OPEN_ROW ? smoothWindow(t, OPEN) : 0;
    });

    // 2 — the thread opens.
    const opened = smoothWindow(t, OPEN);
    if (thread.current) {
      thread.current.scale.setScalar(Math.max(0.86 + opened * 0.14, 0.001));
      thread.current.position.z = opened * 0.24;
    }
    if (threadFace.current) threadFace.current.opacity = 0.25 + opened * 0.75;

    // 3 — the customer writes, the agent answers, a person closes.
    if (customerBubble.current) customerBubble.current.style.opacity = String(smoothWindow(t, CUSTOMER));
    if (aiBubble.current) aiBubble.current.style.opacity = String(smoothWindow(t, AI_REPLY));
    if (humanBubble.current) humanBubble.current.style.opacity = String(smoothWindow(t, ASSIGN));
    if (handler.current) {
      const handedOver = smoothWindow(t, ASSIGN);
      handler.current.textContent = handedOver > 0.5 ? labels.byHuman : labels.byAi;
      handler.current.style.opacity = String(Math.max(smoothWindow(t, AI_REPLY), handedOver));
      handler.current.style.color = handedOver > 0.5 ? palette.ink.team : palette.ink.ai;
    }

    // 4 — classification files itself into the record.
    tags.forEach((_, index) => {
      const u = smoothWindow(t, [CLASSIFY[0] + index * 0.06, CLASSIFY[1] - 0.06 + index * 0.06]);
      const chip = tagChips.current[index];
      if (chip) {
        const to = tagTo(index);
        chip.position.set(
          MathUtils.lerp(tagFrom[0], to[0], u),
          MathUtils.lerp(tagFrom[1], to[1], u),
          MathUtils.lerp(tagFrom[2], to[2], u) + arc(u) * 0.5,
        );
        chip.scale.setScalar(Math.max(smoothstep(u * 4), 0.001));
      }
      const label = tagLabels.current[index];
      if (label) label.style.opacity = String(smoothstep(u * 4));
    });
    if (stageChip.current) stageChip.current.style.opacity = String(smoothWindow(t, [CLASSIFY[0] + 0.04, CLASSIFY[1]]));

    // 5 — the conversation gets an owner.
    const assigned = smoothWindow(t, ASSIGN);
    if (ownerRow.current) ownerRow.current.style.opacity = String(assigned);
    if (ownerBadge.current) {
      ownerBadge.current.scale.setScalar(Math.max(assigned, 0.001));
      ownerBadge.current.position.z = rowD / 2 + 0.04 + arc(assigned) * 0.3;
    }

    if (stage.current) {
      stage.current.rotation.x = MathUtils.damp(stage.current.rotation.x, -0.08 + t * 0.03, 5, delta);
      stage.current.rotation.y = MathUtils.damp(stage.current.rotation.y, 0.16 - t * 0.26, 5, delta);
    }
  });

  const icon = font(11);

  return (
    <>
      <StageLights reduced={reduced} palette={palette} />
      <group ref={stage} scale={scale} rotation={[-0.08, 0.16, 0]}>
        {/* ── The inbox: every channel, one queue ───────────────────────── */}
        <group position={[layout.inbox.at[0], layout.inbox.at[1], 0]}>
          <Slab size={layout.inbox.size} color={sheetWell(palette)} radius={R.board} roughness={0.8} receiveShadow />
          <Bar
            position={[0, layout.inbox.size[1] / 2 - 0.5, layout.inbox.size[2] / 2 + 0.02]}
            size={[layout.inbox.size[0] - 0.5, 0.03, 0.03]}
            color={palette.accent.ai}
          />
          <Label
            position={[0, layout.inbox.size[1] / 2 - 0.28, 0.24]}
            width={px(layout.inbox.size[0] - 0.4)}
            className="flex select-none items-center gap-1.5 text-left"
          >
            <ChatCircle size={icon} color={palette.ink.ai} style={{ ["--icon-accent" as string]: palette.ink.ai }} />
            <span className="font-mono font-semibold uppercase tracking-[0.15em]" style={{ fontSize: font(9), color: palette.ink.ai }}>
              {labels.inbox}
            </span>
          </Label>
        </group>

        {visible.map((row, index) => (
          <group
            key={row.name}
            ref={(node) => {
              rows.current[index] = node;
            }}
            position={[layout.inbox.at[0], rowY(index), 0.18]}
          >
            <Slab size={layout.row} color={sheet(palette)} roughness={0.58} castShadow />
            <Bar position={[-rowW / 2 + 0.12, 0, rowD / 2 + 0.015]} size={[0.06, rowH * 0.66, 0.02]} color={channelTone(row.channel, palette)} />
            {/* The selection ring the inbox draws on the open conversation. */}
            <mesh position={[0, 0, -0.02]}>
              <boxGeometry args={[rowW + 0.1, rowH + 0.1, 0.1]} />
              <meshBasicMaterial
                ref={(node) => {
                  rowSelects.current[index] = node;
                }}
                color={palette.accent.ai}
                transparent
                opacity={0}
              />
            </mesh>
            <Label position={[0.14, 0, rowD / 2 + 0.03]} width={px(rowW - 0.55)} className="select-none text-left">
              <span className="flex items-center gap-1.5">
                <ChannelMark channel={row.channel} size={font(10)} palette={palette} />
                <span className="truncate font-semibold leading-none" style={{ fontSize: font(11.5), color: palette.panelInk }}>
                  {row.name}
                </span>
              </span>
              <p className="mt-1.5 truncate leading-none" style={{ fontSize: font(9.5), color: palette.panelMuted }}>
                {row.preview}
              </p>
            </Label>
            {index === OPEN_ROW && (
              <>
                <mesh ref={ownerBadge} position={[rowW / 2 - 0.3, -rowH / 2 + 0.22, rowD / 2 + 0.04]} scale={0.001}>
                  <sphereGeometry args={[0.11, 20, 20]} />
                  <meshStandardMaterial color={palette.accent.team} roughness={0.45} />
                </mesh>
              </>
            )}
          </group>
        ))}

        {/* ── The thread: the conversation itself ───────────────────────── */}
        <group ref={thread} position={[layout.thread.at[0], layout.thread.at[1], 0]}>
          <Slab size={layout.thread.size} color={palette.board} radius={R.board} roughness={0.74} receiveShadow />
          {/* The wallpaper the real thread carries, as a face on the panel. */}
          <mesh position={[0, -0.2, layout.thread.size[2] / 2 + 0.01]}>
            <planeGeometry args={[layout.thread.size[0] - 0.24, layout.thread.size[1] - 1.5]} />
            <meshStandardMaterial ref={threadFace} color={sheetWell(palette)} transparent opacity={0.25} roughness={0.9} />
          </mesh>
          <Bar
            position={[0, threadHalf - 0.72, layout.thread.size[2] / 2 + 0.02]}
            size={[layout.thread.size[0] - 0.24, 0.025, 0.025]}
            color={palette.edge}
          />

          <Label position={[0, threadHalf - 0.44, 0.28]} width={px(layout.thread.size[0] - 0.4)} className="flex select-none items-center gap-2 text-left">
            <span
              className="grid shrink-0 place-items-center rounded-full font-semibold"
              style={{ width: font(22), height: font(22), backgroundColor: sheetChip(palette), color: palette.panelMuted, fontSize: font(9) }}
            >
              {labels.rows[OPEN_ROW]?.name.slice(0, 2).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1">
              <p className="truncate font-semibold leading-none" style={{ fontSize: font(12), color: palette.panelInk }}>
                {labels.rows[OPEN_ROW]?.name}
              </p>
              <span className="mt-1 flex items-center gap-1">
                <Sparkle size={font(9)} color={palette.ink.ai} style={{ ["--icon-accent" as string]: palette.ink.ai }} />
                <span
                  ref={handler}
                  className="truncate font-mono uppercase leading-none tracking-[0.14em]"
                  style={{ fontSize: font(8.5), color: palette.ink.ai, opacity: 0 }}
                />
              </span>
            </span>
          </Label>

          <Label position={[0, threadHalf - 1.5, 0.3]} width={px(layout.thread.size[0] - 0.5)} className="select-none">
            <div ref={customerBubble} className="flex justify-start" style={{ opacity: 0 }}>
              <span
                className="inline-block max-w-[88%] rounded-lg rounded-bl-sm px-2 py-1.5 leading-snug"
                style={{ fontSize: font(10), color: palette.panelInk, backgroundColor: palette.bubble }}
              >
                {labels.thread.customer}
              </span>
            </div>
          </Label>
          <Label position={[0, threadHalf - 2.5, 0.3]} width={px(layout.thread.size[0] - 0.5)} className="select-none">
            <div ref={aiBubble} className="flex justify-end" style={{ opacity: 0 }}>
              <span
                className="inline-block max-w-[88%] rounded-lg rounded-br-sm px-2 py-1.5 leading-snug"
                style={{ fontSize: font(10), color: palette.dark ? palette.panelInk : palette.cardInk, backgroundColor: palette.wash }}
              >
                {labels.thread.ai}
              </span>
            </div>
          </Label>
          <Label position={[0, threadHalf - 3.5, 0.3]} width={px(layout.thread.size[0] - 0.5)} className="select-none">
            <div ref={humanBubble} className="flex justify-end" style={{ opacity: 0 }}>
              <span
                className="inline-block max-w-[88%] rounded-lg rounded-br-sm px-2 py-1.5 leading-snug"
                style={{ fontSize: font(10), color: palette.dark ? palette.panelInk : palette.cardInk, backgroundColor: palette.wash }}
              >
                {labels.thread.human}
              </span>
            </div>
          </Label>

          {/* The composer, so the panel reads as a place you type. */}
          <Label position={[0, -threadHalf + 0.42, 0.3]} width={px(layout.thread.size[0] - 0.4)} className="select-none">
            <div className="flex items-center gap-1.5">
              <span
                className="flex flex-1 items-center rounded-full px-2"
                style={{ height: font(21), backgroundColor: palette.bubble, border: `1px solid ${palette.edge}` }}
              >
                <span className="block rounded" style={{ width: "56%", height: 2, backgroundColor: palette.panelMuted, opacity: 0.5 }} />
              </span>
              <span
                className="grid shrink-0 place-items-center rounded-full"
                style={{ width: font(21), height: font(21), backgroundColor: palette.accent.ai }}
              >
                <span
                  className="block"
                  style={{
                    width: 0,
                    height: 0,
                    borderTop: `${font(4)}px solid transparent`,
                    borderBottom: `${font(4)}px solid transparent`,
                    borderLeft: `${font(7)}px solid #0D0F10`,
                    marginLeft: 2,
                  }}
                />
              </span>
            </div>
          </Label>
        </group>

        {/* ── The record: what the conversation writes down ─────────────── */}
        <group position={[layout.details.at[0], layout.details.at[1], 0]}>
          <Slab size={layout.details.size} color={sheetWell(palette)} radius={R.board} roughness={0.8} receiveShadow />
          <Label
            position={[0, detailsHalf - 0.34, 0.24]}
            width={px(layout.details.size[0] - 0.3)}
            className="flex select-none items-center gap-1.5 text-left"
          >
            <UserCircle size={icon} color={palette.panelMuted} style={{ ["--icon-accent" as string]: palette.accent.team }} />
            <span className="truncate font-mono font-semibold uppercase tracking-[0.14em]" style={{ fontSize: font(9), color: palette.panelMuted }}>
              {labels.details}
            </span>
          </Label>

          <Label position={[0, detailsHalf - 1.05, 0.24]} width={px(layout.details.size[0] - 0.3)} className="select-none text-left">
            <p className="font-mono uppercase leading-none tracking-[0.14em]" style={{ fontSize: font(8.5), color: palette.panelMuted }}>
              {labels.stageLabel}
            </p>
            <div ref={stageChip} className="mt-1.5 flex items-center gap-1.5" style={{ opacity: 0 }}>
              <Target size={font(10)} color={palette.ink.wait} style={{ ["--icon-accent" as string]: palette.accent.wait }} />
              <span
                className="inline-block truncate px-1.5 py-1 font-mono font-semibold uppercase tracking-[0.12em]"
                style={{ fontSize: font(8.5), backgroundColor: palette.accent.wait, color: "#0D0F10" }}
              >
                {labels.stage}
              </span>
            </div>
          </Label>

          <Label position={[0, detailsHalf - 1.72, 0.24]} width={px(layout.details.size[0] - 0.3)} className="select-none text-left">
            <p className="font-mono uppercase leading-none tracking-[0.14em]" style={{ fontSize: font(8.5), color: palette.panelMuted }}>
              {labels.tagsLabel}
            </p>
          </Label>

          <Label position={[0, -detailsHalf + 0.72, 0.24]} width={px(layout.details.size[0] - 0.3)} className="select-none text-left">
            <p className="font-mono uppercase leading-none tracking-[0.14em]" style={{ fontSize: font(8.5), color: palette.panelMuted }}>
              {labels.ownerLabel}
            </p>
            <div ref={ownerRow} className="mt-1.5 flex items-center gap-1.5" style={{ opacity: 0 }}>
              <span
                className="grid shrink-0 place-items-center rounded-full font-semibold"
                style={{ width: font(18), height: font(18), backgroundColor: palette.accent.team, color: "#0D0F10", fontSize: font(8) }}
              >
                {labels.owner.slice(0, 2).toUpperCase()}
              </span>
              <span className="truncate font-semibold leading-none" style={{ fontSize: font(10.5), color: palette.panelInk }}>
                {labels.owner}
              </span>
            </div>
          </Label>
        </group>

        {/* The tags themselves, which fly from the conversation to the record. */}
        {tags.map((tag, index) => (
          <group
            key={tag}
            ref={(node) => {
              tagChips.current[index] = node;
            }}
            scale={0.001}
          >
            <Slab size={[1.5, 0.34, 0.1]} color={sheetChip(palette)} radius={R.chip} roughness={0.7} />
            <Label position={[0.04, 0, 0.1]} width={px(1.25)} className="flex select-none items-center gap-1.5 text-left">
              <div
                ref={(node) => {
                  tagLabels.current[index] = node;
                }}
                className="flex min-w-0 items-center gap-1.5"
                style={{ opacity: 0 }}
              >
                <Bookmark size={font(9)} color={palette.ink.tag} style={{ ["--icon-accent" as string]: palette.accent.tag }} />
                <span className="truncate font-semibold leading-none" style={{ fontSize: font(9.5), color: palette.panelInk }}>
                  {tag}
                </span>
              </div>
            </Label>
          </group>
        ))}
      </group>
    </>
  );
}
