"use client";

import { useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from "react";

import { placedPivot, turnedAbout } from "@/lib/studio/clip-placement";
import { moveBox, resizeBox, rotateBox, type Handle } from "@/lib/studio/clip-transform";
import type { Anchor, CanvasSize, Transform } from "@/lib/studio/document";
import { frameSnapTargets, snapFrameMove, type FrameScene, type FrameSnap } from "@/lib/studio/frame-layout";
import { SNAP_THRESHOLD_SCREEN_PX } from "@/lib/studio/snapping";
import { clipLookup, leaders } from "@/lib/studio/parenting";

import { useVideoEditor } from "../editor-context";

export type TransformGestureKind = { kind: "move" } | { kind: "resize"; handle: Handle } | { kind: "rotate" };

export interface GestureBase {
  box: Transform;
  anchor: Anchor;
}

export interface GestureMember {
  clipId: string;
  box: Transform;
}

const MOVE_SLOP_PX = 3;

interface Session {
  clipId: string;
  kind: TransformGestureKind;
  base: GestureBase;
  x: number;
  y: number;
  pointerId: number;
  started: boolean;
  group: readonly GestureMember[];
  scene: FrameScene | null;
}

export interface TransformGestureHandlers {
  onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerCancel: () => void;
}

export interface TransformGesture {
  dragging: boolean;
  snap: FrameSnap | null;
  active: () => boolean;
  begin: (clipId: string, base: GestureBase, kind: TransformGestureKind, event: ReactPointerEvent<HTMLElement>, group?: readonly GestureMember[]) => void;
  handlers: TransformGestureHandlers;
}

function members(session: Session): GestureMember[] {
  return [{ clipId: session.clipId, box: session.base.box }, ...session.group];
}

function nextTransform(session: Session, event: ReactPointerEvent<HTMLElement>, frame: DOMRect, canvas: CanvasSize): Transform {
  const { box, anchor } = session.base;
  const aspect = canvas.width / canvas.height;
  const dx = (event.clientX - session.x) / frame.width;
  const dy = (event.clientY - session.y) / frame.height;
  if (session.kind.kind === "resize") {
    const corner = session.kind.handle.length === 2;
    return resizeBox(box, session.kind.handle, dx, dy, { aspect, keepRatio: corner !== event.shiftKey });
  }
  const pivot = placedPivot(box, anchor, aspect);
  const center = { x: frame.left + pivot.x * frame.width, y: frame.top + pivot.y * frame.height };
  const turned = rotateBox(box, center, { x: event.clientX, y: event.clientY }, event.shiftKey ? 15 : 0);
  return turnedAbout(box, pivot, anchor, turned.rotation, aspect);
}

export function useTransformGesture(frameRef: RefObject<HTMLDivElement | null>, canvas: CanvasSize): TransformGesture {
  const { store, view, commands } = useVideoEditor();
  const [dragging, setDragging] = useState(false);
  const [snap, setSnap] = useState<FrameSnap | null>(null);
  const session = useRef<Session | null>(null);

  const start = (current: Session) => {
    current.started = true;
    if (current.kind.kind === "move") {
      const { playheadMs, safeArea } = view.getState();
      current.scene = frameSnapTargets(store.getState().document, playheadMs, members(current).map((member) => member.clipId), safeArea);
    }
    setDragging(true);
    store.getState().beginTransaction();
  };

  const moveAll = (current: Session, scene: FrameScene, event: ReactPointerEvent<HTMLElement>, frame: DOMRect) => {
    const threshold = view.getState().snapping && !event.altKey ? (SNAP_THRESHOLD_SCREEN_PX * canvas.width) / frame.width : null;
    const all = members(current);
    const leading = new Set(leaders(clipLookup(store.getState().document), all.map((member) => member.clipId)));
    const moving = all.filter((member) => leading.has(member.clipId));
    const snapped = snapFrameMove(
      moving.map((member) => member.box),
      (event.clientX - current.x) / frame.width,
      (event.clientY - current.y) / frame.height,
      canvas,
      scene,
      threshold,
    );
    for (const member of moving) commands.editTransform(member.clipId, moveBox(member.box, snapped.dx, snapped.dy));
    setSnap(snapped);
  };

  const finish = (commit: boolean) => {
    const current = session.current;
    session.current = null;
    setDragging(false);
    setSnap(null);
    if (!current?.started) return;
    if (commit) store.getState().commitTransaction();
    else store.getState().cancelTransaction();
  };

  return {
    dragging,
    snap,
    active: () => session.current !== null,
    begin: (clipId, base, kind, event, group = []) => {
      if (event.button !== 0) return;
      event.stopPropagation();
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      const created: Session = { clipId, kind, base, x: event.clientX, y: event.clientY, pointerId: event.pointerId, started: false, group: kind.kind === "move" ? group : [], scene: null };
      session.current = created;
      if (kind.kind !== "move") start(created);
    },
    handlers: {
      onPointerMove: (event) => {
        const current = session.current;
        const frame = frameRef.current?.getBoundingClientRect();
        if (!current || !frame || current.pointerId !== event.pointerId) return;
        if (!current.started) {
          if (Math.hypot(event.clientX - current.x, event.clientY - current.y) < MOVE_SLOP_PX) return;
          start(current);
        }
        if (current.scene) moveAll(current, current.scene, event, frame);
        else commands.editTransform(current.clipId, nextTransform(current, event, frame, canvas));
      },
      onPointerUp: (event) => {
        if (session.current?.pointerId === event.pointerId) finish(true);
      },
      onPointerCancel: () => finish(false),
    },
  };
}
