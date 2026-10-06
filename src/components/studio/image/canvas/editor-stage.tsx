"use client";

import type Konva from "konva";
import { memo, useCallback, useEffect, useMemo, useRef, useState, type ComponentProps } from "react";
import { Layer as KonvaLayer, Group, Line, Rect, Stage, Transformer } from "react-konva";

import { gradientFill, LayerNode } from "@/components/studio/canvas/layer-node";
import { LayerStack, type StackNodeExtra } from "@/components/studio/canvas/layer-stack";
import type { CanvasSize, ImageDocument, Layer } from "@/lib/studio/document";
import { clickSelection, layersInRect, nodeResizePatch } from "@/lib/studio/geometry";
import { selectionBounds, translateLayers, updateLayers, withGroupMembers, type Bounds, type LayerPatch } from "@/lib/studio/layers";
import { SNAP_THRESHOLD_SCREEN_PX, snapMove, snapTargets, type SnapGuides, type SnapTargets } from "@/lib/studio/snapping";
import { isEditableTarget } from "@/lib/studio/keymap";
import { cachePixelRatioFor } from "@/lib/studio/paint";
import { followViewport, screenToWorld, wheelZoom, zoomAt, type Point } from "@/lib/studio/viewport";

import { useEditorUi, useImageDoc, useImageEditor } from "../editor-state";
import { CropOverlay } from "./crop-overlay";
import { useCheckerImage } from "./checker";

const GUIDE_COLOR = "#e11d74";
const SELECTION_COLOR = "#6366f1";
const MARQUEE_FILL = "rgba(99,102,241,0.08)";
const ROTATION_SNAPS = [0, 45, 90, 135, 180, 225, 270, 315];
const MIN_BOX_PX = 4;
const LINE_ANCHORS = ["middle-left", "middle-right"];
const RATIO_TYPES = new Set<Layer["type"]>(["image", "icon"]);

type GroupProps = NonNullable<ComponentProps<typeof LayerNode>["groupProps"]>;

interface LayerItemProps extends StackNodeExtra {
  layer: Layer;
  canvas: CanvasSize;
  draggable: boolean;
  concealed: boolean;
  handlers: GroupProps;
}

const LayerItem = memo(function LayerItem({ layer, canvas, draggable, concealed, handlers, composite, onReady, onError }: LayerItemProps) {
  const shown = concealed ? { ...layer, hidden: true } : layer;
  return <LayerNode layer={shown} width={canvas.width} height={canvas.height} composite={composite} onReady={onReady} onError={onError} groupProps={{ ...handlers, draggable }} />;
});

function HoverOutline({ layer, canvas, scale }: { layer: Layer; canvas: CanvasSize; scale: number }) {
  const pad = 3 / scale;
  const width = layer.transform.w * canvas.width + pad * 2;
  const height = layer.transform.h * canvas.height + pad * 2;
  return (
    <Rect
      x={layer.transform.x * canvas.width}
      y={layer.transform.y * canvas.height}
      offsetX={width / 2}
      offsetY={height / 2}
      width={width}
      height={height}
      rotation={layer.transform.rotation}
      stroke={SELECTION_COLOR}
      strokeWidth={1.5 / scale}
      dash={[4 / scale, 3 / scale]}
      listening={false}
    />
  );
}

interface DragSession {
  anchorId: string;
  ids: string[];
  anchorStart: Point;
  bounds: Bounds;
  targets: SnapTargets;
  startDocument: ImageDocument;
}

function shifted(b: Bounds, dx: number, dy: number): Bounds {
  return { left: b.left + dx, right: b.right + dx, top: b.top + dy, bottom: b.bottom + dy };
}

export default function EditorStage() {
  const { store, ui, commands } = useImageEditor();
  const document = useImageDoc((s) => s.document);
  const selection = useImageDoc((s) => s.selection);
  const viewport = useEditorUi((s) => s.viewport);
  const fit = useEditorUi((s) => s.fit);
  const container = useEditorUi((s) => s.container);
  const crop = useEditorUi((s) => s.crop);
  const editingTextId = useEditorUi((s) => s.editingTextId);
  const hoverLayerId = useEditorUi((s) => s.hoverLayerId);

  const host = useRef<HTMLDivElement>(null);
  const stage = useRef<Konva.Stage>(null);
  const transformer = useRef<Konva.Transformer>(null);
  const drag = useRef<DragSession | null>(null);
  const marqueeStart = useRef<Point | null>(null);
  const pan = useRef<{ pointer: Point; origin: Point } | null>(null);
  const spaceDown = useRef(false);
  const [guides, setGuides] = useState<SnapGuides | null>(null);
  const [marquee, setMarquee] = useState<Bounds | null>(null);
  const [panning, setPanning] = useState(false);
  const [spaceHeld, setSpaceHeld] = useState(false);

  const canvas = document.canvas;
  const canvasKey = `${canvas.width}x${canvas.height}`;

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      const size = { width: Math.round(entry.contentRect.width), height: Math.round(entry.contentRect.height) };
      if (size.width > 0 && size.height > 0) ui.setState({ container: size });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ui]);

  useEffect(() => {
    const state = ui.getState();
    const next = followViewport(fit, state.viewport, container, store.getState().document.canvas);
    if (next !== state.viewport) ui.setState({ viewport: next });
  }, [fit, container, canvasKey, ui, store]);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = element.getBoundingClientRect();
      const { viewport: current } = ui.getState();
      if (event.ctrlKey || event.metaKey) {
        const anchor = { x: event.clientX - rect.left, y: event.clientY - rect.top };
        ui.setState({ viewport: zoomAt(current, wheelZoom(current.scale, event.deltaY), anchor), fit: false });
        return;
      }
      const dx = event.shiftKey && event.deltaX === 0 ? event.deltaY : event.deltaX;
      const dy = event.shiftKey && event.deltaX === 0 ? 0 : event.deltaY;
      ui.setState({ viewport: { ...current, x: current.x - dx, y: current.y - dy }, fit: false });
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, [ui]);

  useEffect(() => {
    const onCanvas = (target: EventTarget | null) => target === window.document.body || (target instanceof Node && Boolean(host.current?.contains(target)));
    const down = (event: KeyboardEvent) => {
      if (event.code !== "Space" || isEditableTarget(event.target) || !onCanvas(event.target)) return;
      event.preventDefault();
      spaceDown.current = true;
      setSpaceHeld(true);
    };
    const up = (event: KeyboardEvent) => {
      if (event.code !== "Space") return;
      spaceDown.current = false;
      setSpaceHeld(false);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
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
      const { viewport: current } = ui.getState();
      pan.current = { pointer: { x: event.clientX, y: event.clientY }, origin: { x: current.x, y: current.y } };
      setPanning(true);
    };
    const move = (event: PointerEvent) => {
      const session = pan.current;
      if (!session) return;
      const { viewport: current } = ui.getState();
      ui.setState({
        viewport: { ...current, x: session.origin.x + event.clientX - session.pointer.x, y: session.origin.y + event.clientY - session.pointer.y },
        fit: false,
      });
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
  }, [ui]);

  const selectedLayers = useMemo(() => {
    const wanted = new Set(selection);
    return document.layers.filter((l) => wanted.has(l.id) && !l.hidden);
  }, [document.layers, selection]);

  const busy = crop !== null;

  useEffect(() => {
    const tr = transformer.current;
    const st = stage.current;
    if (!tr || !st) return;
    const shown = busy ? [] : selectedLayers.filter((l) => l.id !== editingTextId);
    const unlocked = shown.filter((l) => !l.locked);
    const nodes = (unlocked.length > 0 ? unlocked : shown)
      .map((l) => st.findOne((node: Konva.Node) => node.id() === l.id))
      .filter((node): node is Konva.Node => Boolean(node));
    tr.nodes(nodes);
    tr.getLayer()?.batchDraw();
  }, [selectedLayers, busy, editingTextId, document]);

  const pointerWorld = useCallback((): Point | null => {
    const st = stage.current;
    const pointer = st?.getPointerPosition();
    if (!st || !pointer) return null;
    return screenToWorld(ui.getState().viewport, pointer);
  }, [ui]);

  const handlers = useMemo<GroupProps>(() => {
    const layerIdOf = (event: Konva.KonvaEventObject<Event>) => event.currentTarget.id();
    return {
      onMouseDown: (event: Konva.KonvaEventObject<MouseEvent>) => {
        if (event.evt.button !== 0) return;
        event.cancelBubble = true;
        const state = store.getState();
        store.getState().select(clickSelection(state.document, state.selection, layerIdOf(event), event.evt.shiftKey));
      },
      onTouchStart: (event: Konva.KonvaEventObject<TouchEvent>) => {
        event.cancelBubble = true;
        const state = store.getState();
        store.getState().select(clickSelection(state.document, state.selection, layerIdOf(event), false));
      },
      onContextMenu: (event: Konva.KonvaEventObject<PointerEvent>) => {
        const id = layerIdOf(event);
        const state = store.getState();
        if (!state.selection.includes(id)) state.select(withGroupMembers(state.document, [id]));
      },
      onDblClick: (event: Konva.KonvaEventObject<MouseEvent>) => {
        const id = layerIdOf(event);
        const layer = store.getState().document.layers.find((l) => l.id === id);
        if (layer?.type === "text") commands.startTextEdit(id);
        if (layer?.type === "image") commands.startCrop(id);
      },
      onDblTap: (event: Konva.KonvaEventObject<TouchEvent>) => {
        const id = layerIdOf(event);
        const layer = store.getState().document.layers.find((l) => l.id === id);
        if (layer?.type === "text") commands.startTextEdit(id);
      },
      onDragStart: (event: Konva.KonvaEventObject<DragEvent>) => {
        if (drag.current) return;
        const id = layerIdOf(event);
        const state = store.getState();
        const doc = state.document;
        const chosen = state.selection.includes(id) ? state.selection : withGroupMembers(doc, [id]);
        const ids = doc.layers.filter((l) => chosen.includes(l.id) && !l.locked).map((l) => l.id);
        const bounds = selectionBounds(doc, ids);
        if (!bounds) return;
        drag.current = { anchorId: id, ids, anchorStart: { x: event.currentTarget.x(), y: event.currentTarget.y() }, bounds, targets: snapTargets(doc, ids), startDocument: doc };
        state.beginTransaction();
      },
      onDragMove: (event: Konva.KonvaEventObject<DragEvent>) => {
        const session = drag.current;
        if (!session || layerIdOf(event) !== session.anchorId) return;
        const node = event.currentTarget;
        let dx = node.x() - session.anchorStart.x;
        let dy = node.y() - session.anchorStart.y;
        const { snapping: snapOn, viewport: v } = ui.getState();
        if (snapOn && !event.evt.altKey) {
          const snap = snapMove(shifted(session.bounds, dx, dy), session.targets, SNAP_THRESHOLD_SCREEN_PX / v.scale);
          dx += snap.dx;
          dy += snap.dy;
          setGuides(snap.guides.vertical.length + snap.guides.horizontal.length > 0 ? snap.guides : null);
        }
        node.position({ x: session.anchorStart.x + dx, y: session.anchorStart.y + dy });
        const start = session.startDocument;
        store.getState().apply(() => translateLayers(start, session.ids, dx / start.canvas.width, dy / start.canvas.height));
      },
      onDragEnd: (event: Konva.KonvaEventObject<DragEvent>) => {
        if (!drag.current || layerIdOf(event) !== drag.current.anchorId) return;
        drag.current = null;
        setGuides(null);
        store.getState().commitTransaction();
        const doc = store.getState().document;
        const stageNode = event.currentTarget.getStage();
        for (const layer of doc.layers) {
          const node = stageNode?.findOne((candidate: Konva.Node) => candidate.id() === layer.id);
          node?.position({ x: layer.transform.x * doc.canvas.width, y: layer.transform.y * doc.canvas.height });
        }
      },
    };
  }, [store, ui, commands]);

  const onTransformEnd = useCallback(() => {
    const tr = transformer.current;
    if (!tr) return;
    const doc = store.getState().document;
    const patches = new Map<string, LayerPatch>();
    for (const node of tr.nodes()) {
      const layer = doc.layers.find((l) => l.id === node.id());
      if (!layer) continue;
      patches.set(layer.id, nodeResizePatch(layer, { x: node.x(), y: node.y(), scaleX: node.scaleX(), scaleY: node.scaleY(), rotation: node.rotation() }, doc.canvas));
      node.scale({ x: 1, y: 1 });
    }
    store.getState().apply((d) => updateLayers(d, [...patches.keys()], (layer) => patches.get(layer.id) ?? {}));
  }, [store]);

  const onStagePointerDown = (event: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (event.target !== event.target.getStage() && event.target.name() !== "studio-backdrop") return;
    if ("button" in event.evt && event.evt.button !== 0) return;
    if (ui.getState().crop) return;
    const additive = "shiftKey" in event.evt && event.evt.shiftKey;
    if (!additive) store.getState().select([]);
    const point = pointerWorld();
    if (!point) return;
    marqueeStart.current = point;
    setMarquee({ left: point.x, top: point.y, right: point.x, bottom: point.y });
  };

  const onStagePointerMove = () => {
    const start = marqueeStart.current;
    const point = start ? pointerWorld() : null;
    if (!start || !point) return;
    setMarquee({ left: start.x, top: start.y, right: point.x, bottom: point.y });
  };

  const onStagePointerUp = (event: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    const start = marqueeStart.current;
    marqueeStart.current = null;
    if (!start || !marquee) {
      setMarquee(null);
      return;
    }
    setMarquee(null);
    const scale = ui.getState().viewport.scale;
    if (Math.abs(marquee.right - marquee.left) * scale < 3 && Math.abs(marquee.bottom - marquee.top) * scale < 3) return;
    const state = store.getState();
    const hits = layersInRect(state.document, marquee);
    const additive = "shiftKey" in event.evt && event.evt.shiftKey;
    state.select(additive ? withGroupMembers(state.document, [...state.selection, ...hits]) : hits);
  };

  const allLocked = selectedLayers.every((l) => l.locked);
  const single = selectedLayers.length === 1 ? selectedLayers[0] : null;
  const lineLike = single?.type === "shape" && (single.shape === "line" || single.shape === "arrow");
  const keepRatio = selectedLayers.length > 0 && selectedLayers.every((l) => RATIO_TYPES.has(l.type));
  const pattern = useCheckerImage(!canvas.background && !canvas.gradient);
  const hovered = hoverLayerId ? document.layers.find((l) => l.id === hoverLayerId) : undefined;
  const editing = editingTextId;
  const scale = viewport.scale;

  return (
    <div
      ref={host}
      className="absolute inset-0 overflow-hidden bg-muted/60"
      style={{ cursor: panning ? "grabbing" : spaceHeld ? "grab" : undefined }}
      aria-hidden
    >
      {container ? (
        <Stage
          ref={stage}
          width={container.width}
          height={container.height}
          x={viewport.x}
          y={viewport.y}
          scaleX={scale}
          scaleY={scale}
          onMouseDown={onStagePointerDown}
          onTouchStart={onStagePointerDown}
          onMouseMove={onStagePointerMove}
          onTouchMove={onStagePointerMove}
          onMouseUp={onStagePointerUp}
          onTouchEnd={onStagePointerUp}
        >
          <KonvaLayer>
            <Rect
              name="studio-backdrop"
              width={canvas.width}
              height={canvas.height}
              fill={canvas.background || undefined}
              {...gradientFill(canvas.gradient, { x: 0, y: 0, width: canvas.width, height: canvas.height })}
              fillPatternImage={pattern ?? undefined}
              fillPatternScaleX={pattern ? 1 / scale : undefined}
              fillPatternScaleY={pattern ? 1 / scale : undefined}
              shadowColor="#000000"
              shadowOpacity={0.12}
              shadowBlur={16 / scale}
              shadowOffsetY={2 / scale}
            />
            <Group clipX={0} clipY={0} clipWidth={canvas.width} clipHeight={canvas.height}>
              <LayerStack
                layers={document.layers}
                pixelRatio={cachePixelRatio(scale)}
                render={(layer, extra) => (
                  <LayerItem
                    key={layer.id}
                    layer={layer}
                    canvas={canvas}
                    draggable={!layer.locked && !busy && editing !== layer.id}
                    concealed={editing === layer.id || crop?.layerId === layer.id}
                    handlers={handlers}
                    {...extra}
                  />
                )}
              />
            </Group>
          </KonvaLayer>
          <KonvaLayer>
            {hovered && !selection.includes(hovered.id) && !hovered.hidden ? <HoverOutline layer={hovered} canvas={canvas} scale={scale} /> : null}
            {crop ? <CropOverlay /> : null}
            {guides
              ? [
                  ...guides.vertical.map((x) => <Line key={`v${x}`} points={[x, 0, x, canvas.height]} stroke={GUIDE_COLOR} strokeWidth={1 / scale} listening={false} />),
                  ...guides.horizontal.map((y) => <Line key={`h${y}`} points={[0, y, canvas.width, y]} stroke={GUIDE_COLOR} strokeWidth={1 / scale} listening={false} />),
                ]
              : null}
            {marquee ? (
              <Rect
                x={Math.min(marquee.left, marquee.right)}
                y={Math.min(marquee.top, marquee.bottom)}
                width={Math.abs(marquee.right - marquee.left)}
                height={Math.abs(marquee.bottom - marquee.top)}
                fill={MARQUEE_FILL}
                stroke={SELECTION_COLOR}
                strokeWidth={1 / scale}
                listening={false}
              />
            ) : null}
            <Transformer
              ref={transformer}
              rotateEnabled={!allLocked}
              resizeEnabled={!allLocked}
              keepRatio={keepRatio}
              enabledAnchors={lineLike ? LINE_ANCHORS : undefined}
              rotationSnaps={ROTATION_SNAPS}
              rotationSnapTolerance={4}
              flipEnabled={false}
              ignoreStroke
              borderStroke={SELECTION_COLOR}
              anchorStroke={SELECTION_COLOR}
              anchorFill="#ffffff"
              anchorSize={9}
              anchorCornerRadius={2}
              boundBoxFunc={(previous, next) => (Math.abs(next.width) < MIN_BOX_PX || Math.abs(next.height) < MIN_BOX_PX ? previous : next)}
              onTransformEnd={onTransformEnd}
            />
          </KonvaLayer>
        </Stage>
      ) : null}
    </div>
  );
}

function cachePixelRatio(scale: number): number {
  return cachePixelRatioFor(scale, typeof window === "undefined" ? 1 : window.devicePixelRatio);
}
