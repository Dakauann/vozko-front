"use client";

import { useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from "react";
import { useTranslations } from "next-intl";

import { canvasAspect, msOfFrame, quantizeMs, type Clip } from "@/lib/studio/document";
import {
  axisLocked,
  boxGripAt,
  boxPixelTransform,
  dragSpeedHandle,
  dragValueHandle,
  GRAPH_PAD_PX,
  graphHitAt,
  graphLayer,
  graphProperties,
  graphRange,
  graphTicks,
  graphTransform,
  graphY,
  keysInGraphBox,
  msAtGraphX,
  nudgeHandle,
  readoutAt,
  selectionBox,
  valueAtGraphY,
  valuePerPx,
  type BoxGrip,
  type GraphBox,
  type GraphMode,
  type GraphScale,
} from "@/lib/studio/graph-editor";
import { keyVelocity, transformKeys, type EaseSide } from "@/lib/studio/keyframe-ease";
import { keyTimes } from "@/lib/studio/keyframe-edit";
import { isPathProperty, timedFramesOf, type AnimatedProperty, type KeyframeProperty, type Keyframes, type KeyRef } from "@/lib/studio/keyframes";
import { findClip, snapMs, updateClip } from "@/lib/studio/timeline";
import { msToPx, normalizedRect, pxToMs, snapThresholdMs, type Rect } from "@/lib/studio/timeline-view";
import { cn } from "@/lib/utils";

import { useEditorState, useVideoEditor, useViewState } from "../editor-context";
import { useReactLevels } from "../react-levels";
import { graphTracePoints } from "@/lib/studio/behavior-view";
import { formatValue } from "../property-readout";
import { KeyframeMenu, type KeyMenuTarget } from "./keyframe-menu";
import { useTimelineGeometry } from "./timeline-geometry";

const INKS = ["ink-1", "ink-2", "ink-3", "ink-4", "ink-5"] as const;
const TICK_COUNT = 4;
const DRAG_START_PX = 3;
const NUDGE_PX = 2;
const NUDGE_PX_LARGE = 20;
const INFLUENCE_STEP = 0.01;
const INFLUENCE_STEP_LARGE = 0.1;
const KEY_SIZE = 8;
const HANDLE_RADIUS = 3.5;
const GRIP_SIZE = 6;
const PERCENT = 100;

type Ranges = Partial<Record<AnimatedProperty, readonly [number, number]>>;

interface Edit {
  pointerId: number;
  clientX: number;
  clientY: number;
  base: Keyframes | undefined;
  started: boolean;
}

type Gesture =
  | (Edit & { kind: "handle"; property: AnimatedProperty; atMs: number; side: EaseSide })
  | (Edit & { kind: "keys"; keys: KeyRef[]; anchorMs: number })
  | (Edit & { kind: "box"; keys: KeyRef[]; grip: BoxGrip; box: GraphBox })
  | { kind: "marquee"; pointerId: number; x: number; y: number; selection: KeyRef[] };

const SAME_KEY = (a: KeyRef, b: KeyRef) => a.property === b.property && a.atMs === b.atMs;

function shownValue(property: AnimatedProperty, mode: GraphMode, value: number): string {
  if (isPathProperty(property)) return `${(value * PERCENT).toFixed(1)}%/s`;
  const text = formatValue(property as KeyframeProperty, value);
  return mode === "speed" ? `${text}/s` : text;
}

function shownTime(ms: number): string {
  return `${(ms / 1000).toFixed(2)} s`;
}

function GripMarks({ box }: { box: GraphBox }) {
  const xs = [box.left, (box.left + box.right) / 2, box.right];
  const ys = [box.top, (box.top + box.bottom) / 2, box.bottom];
  return (
    <g aria-hidden className="text-primary">
      <rect x={box.left} y={box.top} width={box.right - box.left} height={box.bottom - box.top} fill="none" stroke="currentColor" strokeDasharray="3 3" />
      {xs.flatMap((x, i) =>
        ys.map((y, j) => (i === 1 && j === 1 ? null : <rect key={`${i}-${j}`} x={x - GRIP_SIZE / 2} y={y - GRIP_SIZE / 2} width={GRIP_SIZE} height={GRIP_SIZE} fill="hsl(var(--background))" stroke="currentColor" />)),
      )}
    </g>
  );
}

export function GraphEditor({ clip, height }: { clip: Clip; height: number }) {
  const t = useTranslations("studio.video.graph");
  const tk = useTranslations("studio.video.keyframes");
  const tb = useTranslations("studio.video.behaviors");
  const { store, view, playback } = useVideoEditor();
  const geometry = useTimelineGeometry();
  const selectedKeys = useViewState((s) => s.selectedKeys);
  const keyProperty = useViewState((s) => s.keyProperty);
  const mode = useViewState((s) => s.graphMode);
  const show = useViewState((s) => s.graphShow);
  const fit = useViewState((s) => s.graphFit);
  const target = useViewState((s) => s.graphTarget);
  const aspect = useEditorState((s) => canvasAspect(s.document));
  const levels = useReactLevels(useEditorState((s) => s.document));
  const hintId = useId();
  const host = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const [frozen, setFrozen] = useState<Ranges | null>(null);
  const [marquee, setMarquee] = useState<Rect | null>(null);
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const [menu, setMenu] = useState<KeyMenuTarget | null>(null);
  const [said, setSaid] = useState("");
  const left = msToPx(clip.startMs, geometry.pxPerSecond);
  const width = Math.max(2, msToPx(clip.durationMs, geometry.pxPerSecond));
  const properties = graphProperties(clip.keyframes, mode, show, keyProperty, selectedKeys);
  const active = properties.includes(keyProperty) ? keyProperty : properties[0];
  const timesOf = (property: AnimatedProperty) => selectedKeys.filter((key) => key.property === property).map((key) => key.atMs);
  const ranges: Ranges = Object.fromEntries(properties.map((property) => [property, frozen?.[property] ?? graphRange(clip.keyframes, property, mode, clip.durationMs, aspect, timesOf(property), fit === "selection" ? timesOf(property) : undefined)]));
  const scaleOf = (property: AnimatedProperty): GraphScale => {
    const [low, high] = ranges[property] ?? [0, 1];
    return { durationMs: clip.durationMs, widthPx: width, heightPx: height, padPx: GRAPH_PAD_PX, low, high };
  };
  const layers = properties.map((property) => graphLayer(clip.keyframes, property, mode, scaleOf(property), aspect, timesOf(property)));
  const traces = new Map(mode === "value" ? properties.map((property) => [property, graphTracePoints(clip, property, scaleOf(property), levels)] as const) : []);
  const isSelected = (key: KeyRef) => selectedKeys.some((other) => SAME_KEY(other, key));
  const shownSelection = selectedKeys.filter((key) => properties.includes(key.property));
  const box = selectionBox(layers.flatMap((layer) => layer.keys.filter(isSelected)));
  const scalesFor = (keys: readonly KeyRef[]) => Object.fromEntries(properties.filter((property) => keys.some((key) => key.property === property)).map((property) => [property, scaleOf(property)]));
  const name = (property: AnimatedProperty) => tk(`properties.${property}`);

  const local = (clientX: number, clientY: number) => {
    const rect = host.current?.getBoundingClientRect();
    return { x: clientX - (rect?.left ?? 0), y: clientY - (rect?.top ?? 0) };
  };

  const locked = () => {
    if (!findClip(store.getState().document, clip.id)?.track.locked) return false;
    view.setState({ notice: { key: "clipLocked", tone: "error" } });
    return true;
  };

  const write = (current: Edit, keyframes: Keyframes | undefined) => {
    const state = store.getState();
    if (current.started) state.cancelTransaction();
    current.started = true;
    state.beginTransaction();
    if (keyframes !== current.base) state.apply((doc) => updateClip(doc, clip.id, { keyframes }));
  };

  const down = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    host.current?.focus();
    const point = local(event.clientX, event.clientY);
    const hit = graphHitAt(layers, point.x, point.y);
    event.currentTarget.setPointerCapture(event.pointerId);
    setFrozen(ranges);
    const edit = { pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY, base: clip.keyframes, started: false };
    if (hit?.kind === "handle") {
      view.setState({ keyProperty: hit.property, graphTarget: hit.side });
      if (!locked()) gesture.current = { ...edit, kind: "handle", property: hit.property, atMs: hit.atMs, side: hit.side };
      return;
    }
    if (hit) {
      const spot = { property: hit.property, atMs: hit.atMs };
      const next = event.shiftKey ? (isSelected(spot) ? selectedKeys.filter((key) => !SAME_KEY(key, spot)) : [...selectedKeys, spot]) : isSelected(spot) ? selectedKeys : [spot];
      view.setState({ selectedKeys: next, keyProperty: hit.property, graphTarget: "keys" });
      const keys = next.filter((key) => properties.includes(key.property));
      gesture.current = { ...edit, kind: "keys", keys: keys.length > 0 ? keys : [spot], anchorMs: hit.atMs };
      return;
    }
    const grip = box ? boxGripAt(box, point.x, point.y) : null;
    if (box && grip) {
      gesture.current = { ...edit, kind: "box", keys: shownSelection, grip, box };
      return;
    }
    gesture.current = { kind: "marquee", pointerId: event.pointerId, x: point.x, y: point.y, selection: event.shiftKey ? selectedKeys : [] };
  };

  const moveKeys = (current: Extract<Gesture, { kind: "keys" }>, dx: number, dy: number, event: ReactPointerEvent<HTMLDivElement>) => {
    const others = keyTimes({ keyframes: current.base }).filter((at) => !current.keys.some((key) => key.atMs === at));
    const { snapping, playheadMs } = view.getState();
    const proposed = current.anchorMs + pxToMs(dx, geometry.pxPerSecond);
    const snapped = snapping ? snapMs(proposed, [playheadMs - clip.startMs, 0, clip.durationMs, ...others], snapThresholdMs(geometry.pxPerSecond)).ms : proposed;
    const deltaMs = Math.round(quantizeMs(snapped) - current.anchorMs);
    const values = mode === "value" ? graphTransform({ pivotX: 0, scaleX: 1, offsetX: 0, pivotY: 0, scaleY: 1, offsetY: dy }, scalesFor(current.keys), "value").values : undefined;
    const edit = transformKeys(current.base ?? {}, current.keys, { time: { pivot: 0, scale: 1, offset: deltaMs }, values });
    write(current, edit ? edit.keyframes : current.base);
    view.setState({ feedback: { deltaMs, x: event.clientX, y: event.clientY }, selectedKeys: edit ? edit.keys : current.keys });
  };

  const move = (event: ReactPointerEvent<HTMLDivElement>) => {
    const point = local(event.clientX, event.clientY);
    const current = gesture.current;
    setHover(point);
    if (!current || current.pointerId !== event.pointerId) return;
    if (current.kind === "marquee") {
      const rect = normalizedRect(current.x, current.y, point.x, point.y);
      setMarquee(rect);
      const hits = keysInGraphBox(layers, rect);
      view.setState({ selectedKeys: [...current.selection, ...hits.filter((hit) => !current.selection.some((key) => SAME_KEY(key, hit)))] });
      return;
    }
    if (current.kind === "handle") {
      const scale = scaleOf(current.property);
      const at = { ms: msAtGraphX(scale, point.x), value: valueAtGraphY(scale, point.y) };
      const drag = mode === "value" ? dragValueHandle : dragSpeedHandle;
      write(current, drag(current.base, current.property, current.atMs, current.side, at, event.altKey, aspect));
      return;
    }
    const raw = { dx: event.clientX - current.clientX, dy: event.clientY - current.clientY };
    if (!current.started && Math.hypot(raw.dx, raw.dy) < DRAG_START_PX) return;
    const { dx, dy } = event.shiftKey ? axisLocked(raw.dx, raw.dy) : raw;
    if (current.kind === "keys") {
      if (!current.started && locked()) {
        gesture.current = null;
        return;
      }
      moveKeys(current, dx, dy, event);
      return;
    }
    if (!current.started && locked()) {
      gesture.current = null;
      return;
    }
    const edit = transformKeys(current.base ?? {}, current.keys, graphTransform(boxPixelTransform(current.box, current.grip, dx, dy), scalesFor(current.keys), mode));
    write(current, edit ? edit.keyframes : current.base);
    view.setState({ selectedKeys: edit ? edit.keys : current.keys });
  };

  const up = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = gesture.current;
    if (!current || current.pointerId !== event.pointerId) return;
    gesture.current = null;
    setFrozen(null);
    setMarquee(null);
    if (current.kind === "marquee") return;
    view.setState({ feedback: null });
    if (current.started) store.getState().commitTransaction();
    else if (current.kind === "keys") playback.seek(clip.startMs + current.anchorMs);
  };

  const context = (event: ReactMouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
    const point = local(event.clientX, event.clientY);
    const hit = graphHitAt(layers, point.x, point.y);
    if (hit) {
      if (!isSelected(hit)) view.setState({ selectedKeys: [{ property: hit.property, atMs: hit.atMs }], keyProperty: hit.property });
      setMenu({ kind: "keys", clipId: clip.id, property: hit.property, atMs: hit.atMs });
      return;
    }
    setMenu(active ? { kind: "lane", clipId: clip.id, property: active, atMs: Math.round(quantizeMs(msAtGraphX(scaleOf(active), point.x))) } : null);
  };

  const announceKeys = (keyframes: Keyframes | undefined, keys: readonly KeyRef[]) => {
    const first = keys[0];
    const value = first ? readoutAt(keyframes, first.property, mode, first.atMs, aspect) : null;
    if (first && value !== null) setSaid(t("announce.key", { name: name(first.property), time: first.atMs, value: shownValue(first.property, mode, value) }));
  };

  const announceHandle = (keyframes: Keyframes | undefined, key: KeyRef, side: EaseSide) => {
    const velocity = keyVelocity(keyframes, key.property, key.atMs, aspect)?.[side];
    if (!velocity) return;
    const speed = velocity.speed === null ? t("announce.noSpeed") : shownValue(key.property, "speed", velocity.speed);
    setSaid(t("announce.handle", { side: t(`targets.${side}`), name: name(key.property), time: key.atMs, influence: Math.round(velocity.influence * PERCENT), speed }));
  };

  const keyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape" && target !== "keys") {
      event.preventDefault();
      view.setState({ graphTarget: "keys" });
      return;
    }
    const step = ({ ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] } as Record<string, [number, number]>)[event.key];
    if (!step || event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    if (shownSelection.length === 0) {
      setSaid(t("announce.select"));
      return;
    }
    if (locked()) return;
    const pixels = event.shiftKey ? NUDGE_PX_LARGE : NUDGE_PX;
    const base = clip.keyframes;
    if (target === "keys") {
      if (step[0] === 0 && mode === "speed") {
        setSaid(t("announce.speedKeys"));
        return;
      }
      const transform = step[0] !== 0 ? { time: { pivot: 0, scale: 1, offset: msOfFrame(step[0] * (event.shiftKey ? 10 : 1)) } } : { values: graphTransform({ pivotX: 0, scaleX: 1, offsetX: 0, pivotY: 0, scaleY: 1, offsetY: step[1] * pixels }, scalesFor(shownSelection), "value").values };
      const edit = transformKeys(base ?? {}, shownSelection, transform);
      if (!edit) {
        view.setState({ notice: { key: "keys.blocked", tone: "error" } });
        return;
      }
      store.getState().apply((doc) => updateClip(doc, clip.id, { keyframes: edit.keyframes }));
      view.setState({ selectedKeys: [...edit.keys, ...selectedKeys.filter((key) => !properties.includes(key.property))] });
      announceKeys(edit.keyframes, edit.keys);
      return;
    }
    const influence = step[0] * (target === "out" ? 1 : -1) * (event.shiftKey ? INFLUENCE_STEP_LARGE : INFLUENCE_STEP);
    const keyframes = shownSelection.reduce((current, key) => nudgeHandle(current, key.property, key.atMs, target, mode, { influence, value: -step[1] * pixels * valuePerPx(scaleOf(key.property)) }, event.altKey, aspect), base);
    if (keyframes === base) {
      setSaid(t("announce.noHandle", { side: t(`targets.${target}`) }));
      return;
    }
    store.getState().apply((doc) => updateClip(doc, clip.id, { keyframes }));
    announceHandle(keyframes, shownSelection[0], target);
  };

  const activeScale = active ? scaleOf(active) : null;
  const ticks = activeScale ? graphTicks(activeScale.low, activeScale.high, TICK_COUNT) : [];
  const readout = hover && active && activeScale ? readoutAt(clip.keyframes, active, mode, msAtGraphX(activeScale, hover.x), aspect) : null;

  return (
    <KeyframeMenu target={menu}>
      <div
        ref={host}
        role="application"
        aria-roledescription={t("roleDescription")}
        aria-label={t(`labels.${mode}`)}
        aria-describedby={hintId}
        tabIndex={0}
        data-graph-editor={mode}
        className="absolute inset-y-0 overflow-hidden border-t border-border-strong bg-background outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        style={{ left, width }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onPointerLeave={() => setHover(null)}
        onContextMenu={context}
        onKeyDown={keyDown}
      >
        <p id={hintId} className="sr-only">
          {t("hint")}
        </p>
        <p aria-live="polite" className="sr-only">
          {said}
        </p>
        {properties.length === 0 ? (
          <p className="absolute inset-0 flex items-center justify-center px-4 text-center text-xs text-muted-foreground">{t(`empty.${mode}`)}</p>
        ) : (
          <>
            <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" width={width} height={height}>
              <g aria-hidden>
                {activeScale
                  ? ticks.map((tick) => (
                      <line key={tick} x1={0} x2={width} y1={graphY(activeScale, tick)} y2={graphY(activeScale, tick)} stroke={tick === 0 && mode === "speed" ? "hsl(var(--border-strong))" : "hsl(var(--border))"} strokeWidth={1} />
                    ))
                  : null}
              </g>
              {layers.map((layer, index) => {
                const emphasis = layer.property === active;
                return (
                  <g key={layer.property} className={INKS[index % INKS.length]} opacity={emphasis ? 1 : 0.4} data-graph-curve={layer.property}>
                    <polyline aria-hidden points={layer.points.map(([x, y]) => `${x},${y}`).join(" ")} fill="none" stroke="currentColor" strokeWidth={emphasis ? 1.75 : 1.25} strokeLinejoin="round" />
                    {traces.get(layer.property)?.length ? (
                      <polyline aria-hidden data-graph-behavior={layer.property} points={traces.get(layer.property)!.map(([x, y]) => `${x},${y}`).join(" ")} fill="none" stroke="currentColor" strokeWidth={1.25} strokeDasharray="4 3" strokeLinejoin="round" />
                    ) : null}
                    {layer.handles.map((handle) => (
                      <g key={`${handle.atMs}-${handle.side}`} aria-label={t("handleAt", { side: t(`targets.${handle.side}`), name: name(layer.property), time: handle.atMs })} data-graph-handle={handle.side}>
                        <line x1={handle.keyXPx} y1={handle.keyYPx} x2={handle.x} y2={handle.y} stroke="currentColor" strokeWidth={1} />
                        <circle cx={handle.x} cy={handle.y} r={HANDLE_RADIUS} fill={target === handle.side ? "currentColor" : "hsl(var(--background))"} stroke="currentColor" />
                      </g>
                    ))}
                    {layer.keys.map((mark) => {
                      const chosen = isSelected(mark);
                      return (
                        <rect
                          key={mark.atMs}
                          aria-label={tk("keyAt", { name: name(layer.property), time: Math.round(mark.atMs) })}
                          data-selected={chosen}
                          x={mark.x - KEY_SIZE / 2}
                          y={mark.y - KEY_SIZE / 2}
                          width={KEY_SIZE}
                          height={KEY_SIZE}
                          transform={`rotate(45 ${mark.x} ${mark.y})`}
                          fill={chosen ? "hsl(var(--primary))" : "hsl(var(--background))"}
                          stroke={chosen ? "hsl(var(--primary))" : "currentColor"}
                          strokeWidth={1.25}
                        />
                      );
                    })}
                  </g>
                );
              })}
              {box ? <GripMarks box={box} /> : null}
              {marquee ? <rect aria-hidden x={marquee.left} y={marquee.top} width={marquee.right - marquee.left} height={marquee.bottom - marquee.top} fill="none" stroke="hsl(var(--primary))" /> : null}
            </svg>
            {activeScale
              ? ticks.map((tick) => (
                  <span key={tick} aria-hidden className="pointer-events-none absolute right-1 -translate-y-1/2 font-mono text-2xs tabular-nums text-muted-foreground" style={{ top: graphY(activeScale, tick) }}>
                    {shownValue(active, mode, tick)}
                  </span>
                ))
              : null}
            <div role="group" aria-label={t("legend")} className="absolute left-1 top-1 flex flex-wrap items-center gap-1">
              {properties.map((property, index) => (
                <button
                  key={property}
                  type="button"
                  aria-pressed={property === active}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => view.setState({ keyProperty: property })}
                  className={cn(
                    "inline-flex h-5 items-center gap-1 rounded-[3px] border px-1.5 text-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    property === active ? "border-border-strong bg-card text-foreground" : "border-transparent bg-background/80 text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span aria-hidden className={cn("h-0.5 w-3 rounded-full bg-current", INKS[index % INKS.length])} />
                  {name(property)}
                  {timedFramesOf(clip.keyframes, property).length < 2 ? <span className="sr-only">{t("singleKey")}</span> : null}
                </button>
              ))}
              {[...traces.values()].some((trace) => trace.length > 0) ? (
                <span className="inline-flex h-5 items-center gap-1 rounded-[3px] bg-background/80 px-1.5 text-2xs text-muted-foreground" data-graph-behavior-legend>
                  <span aria-hidden className="w-3 border-t border-dashed border-current" />
                  {tb("graphTrace")}
                </span>
              ) : null}
            </div>
            {hover && readout !== null && active && activeScale && frozen === null ? (
              <span
                aria-hidden
                className="pointer-events-none absolute whitespace-nowrap rounded-[3px] border border-border-strong bg-popover px-1.5 py-0.5 font-mono text-2xs tabular-nums text-popover-foreground shadow-md"
                style={{ left: Math.min(hover.x + 10, width - 120), top: Math.max(2, hover.y - 22) }}
              >
                {`${shownTime(msAtGraphX(activeScale, hover.x))} · ${shownValue(active, mode, readout)}`}
              </span>
            ) : null}
          </>
        )}
      </div>
    </KeyframeMenu>
  );
}
