"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

import { isEditableTarget } from "@/lib/keyboard/stroke";
import { wheelViewport, type Point, type Viewport } from "@/lib/studio/viewport";

interface ViewportGestureOptions {
  host: RefObject<HTMLElement | null>;
  viewport: () => Viewport;
  setViewport: (next: Viewport) => void;
  claimsSpace: (event: KeyboardEvent) => boolean;
  onSpaceTap?: () => void;
  wheelPans?: () => boolean;
}

interface ViewportGestures {
  spaceDown: RefObject<boolean>;
  spaceHeld: boolean;
  panning: boolean;
}

export function useViewportGestures(options: ViewportGestureOptions): ViewportGestures {
  const { host } = options;
  const latest = useRef(options);
  const pan = useRef<{ pointer: Point; origin: Point } | null>(null);
  const spaceDown = useRef(false);
  const panned = useRef(false);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [panning, setPanning] = useState(false);

  useEffect(() => {
    latest.current = options;
  });

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      const { viewport, setViewport, wheelPans } = latest.current;
      if (!(event.ctrlKey || event.metaKey) && wheelPans && !wheelPans()) return;
      event.preventDefault();
      event.stopPropagation();
      const rect = element.getBoundingClientRect();
      setViewport(wheelViewport(viewport(), event, { x: event.clientX - rect.left, y: event.clientY - rect.top }));
    };
    element.addEventListener("wheel", onWheel, { passive: false, capture: true });
    return () => element.removeEventListener("wheel", onWheel, { capture: true });
  }, [host]);

  useEffect(() => {
    const release = () => {
      spaceDown.current = false;
      setSpaceHeld(false);
    };
    const down = (event: KeyboardEvent) => {
      if (event.code !== "Space" || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
      if (isEditableTarget(event.target) || !(spaceDown.current || latest.current.claimsSpace(event))) return;
      event.preventDefault();
      if (spaceDown.current) return;
      spaceDown.current = true;
      panned.current = false;
      setSpaceHeld(true);
    };
    const up = (event: KeyboardEvent) => {
      if (event.code !== "Space" || !spaceDown.current) return;
      event.preventDefault();
      release();
      if (!panned.current) latest.current.onSpaceTap?.();
    };
    window.addEventListener("keydown", down, { capture: true });
    window.addEventListener("keyup", up, { capture: true });
    window.addEventListener("blur", release);
    return () => {
      window.removeEventListener("keydown", down, { capture: true });
      window.removeEventListener("keyup", up, { capture: true });
      window.removeEventListener("blur", release);
    };
  }, []);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const start = (event: PointerEvent) => {
      if (!(spaceDown.current || event.button === 1)) return;
      event.preventDefault();
      event.stopPropagation();
      element.setPointerCapture(event.pointerId);
      const current = latest.current.viewport();
      pan.current = { pointer: { x: event.clientX, y: event.clientY }, origin: { x: current.x, y: current.y } };
      panned.current = true;
      setPanning(true);
    };
    const move = (event: PointerEvent) => {
      const session = pan.current;
      if (!session) return;
      const { viewport, setViewport } = latest.current;
      setViewport({ ...viewport(), x: session.origin.x + event.clientX - session.pointer.x, y: session.origin.y + event.clientY - session.pointer.y });
    };
    const end = (event: PointerEvent) => {
      if (!pan.current) return;
      pan.current = null;
      setPanning(false);
      if (element.hasPointerCapture(event.pointerId)) element.releasePointerCapture(event.pointerId);
    };
    element.addEventListener("pointerdown", start, { capture: true });
    element.addEventListener("pointermove", move);
    element.addEventListener("pointerup", end);
    element.addEventListener("pointercancel", end);
    return () => {
      element.removeEventListener("pointerdown", start, { capture: true });
      element.removeEventListener("pointermove", move);
      element.removeEventListener("pointerup", end);
      element.removeEventListener("pointercancel", end);
    };
  }, [host]);

  return { spaceDown, spaceHeld, panning };
}
