"use client";

import type Konva from "konva";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Layer as KonvaLayer, Group, Rect, Stage, Transformer } from "react-konva";

import { DrawOverlay } from "@/components/studio/canvas/vector/draw-overlay";
import { PathEditOverlay } from "@/components/studio/canvas/vector/path-edit-overlay";
import { PenOverlay } from "@/components/studio/canvas/vector/pen-overlay";
import { VectorHint } from "@/components/studio/canvas/vector/vector-hint";
import { gpuRenderingWanted } from "@/components/studio/render/gpu-preference";
import { activeArtboard, artboardAt, artboardBounds, artboardById, artboardOfLayer, artboardsBounds, editArtboard, moveLayersToArtboard, updateArtboard } from "@/lib/studio/artboards";
import type { Artboard, ImageSurface, Layer } from "@/lib/studio/document";
import type { Subpath } from "@/lib/studio/path-nodes";
import { clickSelection, drillSelection, layersInRect, nodeResizePatch } from "@/lib/studio/geometry";
import { familyOf } from "@/lib/studio/groups";
import { changedTransforms, selectionBounds, translateLayers, updateLayers, withGroupMembers, type Bounds, type LayerPatch } from "@/lib/studio/layers";
import { dropParent, reparentOnDrop } from "@/lib/studio/reparent";
import { SNAP_THRESHOLD_SCREEN_PX, snapMove, snapTargets, type SnapGuides, type SnapTargets } from "@/lib/studio/snapping";
import { isEditableTarget } from "@/lib/studio/keymap";
import { followViewport, localViewport, screenToWorld, wheelZoom, zoomAt, type Point } from "@/lib/studio/viewport";

import { useArtboardNames } from "../artboard-names";
import { useEditorUi, useImageDoc, useImageEditor, type DragFeedback as Feedback } from "../editor-state";
import { ArtboardLabels, type ArtboardMove } from "./artboard-labels";
import { ArtboardView, backdropArtboard, LayerOutline, SELECTION_COLOR, type GroupProps } from "./artboard-view";
import { CropOverlay } from "./crop-overlay";
import { DragFeedback, MarqueeBox } from "./drag-feedback";
import { GpuArtboard } from "./gpu-artboard";
import { gestureNodes, placeNodes, settleNodes, stageNodes } from "./stage-nodes";

const ROTATION_SNAPS = [0, 45, 90, 135, 180, 225, 270, 315];
const MIN_BOX_PX = 4;
const MIN_MARQUEE_PX = 3;
const LINE_ANCHORS = ["middle-left", "middle-right"];
const RATIO_TYPES = new Set<Layer["type"]>(["image", "icon"]);

interface PressRecord {
  id: string;
  kept: boolean;
}

interface DragSession {
  artboardId: string;
  origin: Point;
  anchorId: string;
  ids: string[];
  anchorStart: Point;
  bounds: Bounds;
  targets: SnapTargets;
  startSurface: ImageSurface;
  nodes: Map<string, Konva.Node>;
  shift: Point;
}

interface TransformSession {
  artboardId: string;
  startSurface: ImageSurface;
  nodes: Map<string, Konva.Node>;
}

interface MarqueeStart {
  artboardId: string | null;
  point: Point;
}



function shifted(b: Bounds, dx: number, dy: number): Bounds {
  return { left: b.left + dx, right: b.right + dx, top: b.top + dy, bottom: b.bottom + dy };
}

function guidesKey(guides: SnapGuides | null): string {
  return guides ? `${guides.vertical.join(",")}|${guides.horizontal.join(",")}` : "";
}

function sameFeedback(a: Feedback | null, b: Feedback | null): boolean {
  if (a === null || b === null) return a === b;
  return a.artboardId === b.artboardId && a.hostId === b.hostId && a.dropArtboardId === b.dropArtboardId && guidesKey(a.guides) === guidesKey(b.guides);
}

function normalized(b: Bounds): Bounds {
  return { left: Math.min(b.left, b.right), right: Math.max(b.left, b.right), top: Math.min(b.top, b.bottom), bottom: Math.max(b.top, b.bottom) };
}

function overlaps(a: Bounds, b: Bounds): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function local(point: Point, artboard: Pick<Artboard, "x" | "y">): Point {
  return { x: point.x - artboard.x, y: point.y - artboard.y };
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
  const tool = useEditorUi((s) => s.tool);
  const pathEditId = useEditorUi((s) => s.pathEditId);
  const artboardId = useEditorUi((s) => s.artboardId);
  const renamingId = useEditorUi((s) => s.renamingArtboardId);

  const [gpu, setGpu] = useState(gpuRenderingWanted);
  const fallBack = useCallback(() => setGpu(false), []);
  const host = useRef<HTMLDivElement>(null);
  const stage = useRef<Konva.Stage>(null);
  const transformer = useRef<Konva.Transformer>(null);
  const drag = useRef<DragSession | null>(null);
  const press = useRef<PressRecord | null>(null);
  const transformStart = useRef<TransformSession | null>(null);
  const marqueeStart = useRef<MarqueeStart | null>(null);
  const pan = useRef<{ pointer: Point; origin: Point } | null>(null);
  const spaceDown = useRef(false);
  const artboardGroups = useRef(new Map<string, Konva.Group>());
  const showFeedback = useCallback(
    (next: Feedback | null) => {
      if (!sameFeedback(ui.getState().dragFeedback, next)) ui.setState({ dragFeedback: next });
    },
    [ui],
  );
  const [panning, setPanning] = useState(false);
  const [spaceHeld, setSpaceHeld] = useState(false);

  const active = activeArtboard(document, artboardId);
  const area = artboardsBounds(document);
  const areaKey = `${area.left},${area.top},${area.right},${area.bottom}`;
  const names = useArtboardNames();
  const register = useCallback((id: string, node: Konva.Group | null) => {
    if (node) artboardGroups.current.set(id, node);
    else artboardGroups.current.delete(id);
  }, []);

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
    const next = followViewport(fit, state.viewport, container, artboardsBounds(store.getState().document));
    if (next !== state.viewport) ui.setState({ viewport: next });
  }, [fit, container, areaKey, ui, store]);

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

  const selectionHome = selection.length > 0 ? artboardOfLayer(document, selection[0]) : undefined;
  const selectedLayers = useMemo(() => {
    if (!selectionHome) return [];
    const wanted = new Set(selection);
    return selectionHome.layers.filter((l) => wanted.has(l.id) && !l.hidden);
  }, [selectionHome, selection]);
  const selectedBoards = useMemo(() => new Set(selection.filter((id) => artboardById(document, id))), [document, selection]);

  const pathHome = pathEditId ? artboardOfLayer(document, pathEditId) : undefined;
  const editedPath = pathHome?.layers.find((l) => l.id === pathEditId && l.shape === "path");
  const busy = crop !== null || pathEditId !== null || tool !== "select";

  useEffect(() => {
    if (pathEditId && !editedPath) commands.finishPathEdit();
  }, [pathEditId, editedPath, commands]);

  const pathEditing = useMemo(
    () => ({
      begin: () => store.getState().beginTransaction(),
      change: (patch: LayerPatch) => {
        const id = ui.getState().pathEditId;
        const home = id ? artboardOfLayer(store.getState().document, id) : undefined;
        if (id && home) store.getState().apply((d) => editArtboard(d, home.id, (s) => updateLayers(s, [id], patch)));
      },
      end: () => store.getState().commitTransaction(),
    }),
    [store, ui],
  );
  const createFromPen = useCallback((subpath: Subpath) => commands.insertDrawnPath(subpath, !subpath.closed), [commands]);
  const createFromPencil = useCallback((subpath: Subpath) => commands.insertDrawnPath(subpath, true), [commands]);
  const leaveTool = useCallback(() => commands.setTool("select"), [commands]);

  useEffect(() => {
    const tr = transformer.current;
    const st = stage.current;
    if (!tr || !st) return;
    const shown = busy ? [] : selectedLayers.filter((l) => l.id !== editingTextId);
    const unlocked = shown.filter((l) => !l.locked);
    const found = stageNodes(st, (unlocked.length > 0 ? unlocked : shown).map((l) => l.id));
    tr.nodes([...found.values()]);
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
    const homeOf = (id: string) => artboardOfLayer(store.getState().document, id);
    const pressOn = (id: string, additive: boolean, deep: boolean) => {
      const state = store.getState();
      const home = homeOf(id);
      if (!home) return;
      const sameHome = state.selection.length > 0 && artboardOfLayer(state.document, state.selection[0])?.id === home.id;
      const current = sameHome ? state.selection : [];
      const next = clickSelection(home, current, id, sameHome && additive, deep);
      press.current = { id, kept: !additive && !deep && next.length === current.length && next.every((value, i) => value === current[i]) };
      state.select(next);
    };
    const drillOn = (id: string) => {
      const pressed = press.current;
      press.current = null;
      const home = homeOf(id);
      if (!pressed?.kept || pressed.id !== id || !home) return;
      const state = store.getState();
      const next = drillSelection(home, state.selection, id);
      if (next) state.select(next);
    };
    const openEditor = (id: string, touch: boolean) => {
      const state = store.getState();
      const layer = homeOf(id)?.layers.find((l) => l.id === id);
      if (state.selection.length !== 1 || state.selection[0] !== id || !layer) return;
      if (layer.type === "text") return commands.startTextEdit(id);
      if (touch) return;
      if (layer.type === "image") commands.startCrop(id);
      if (layer.type === "shape" && layer.shape !== "line" && layer.shape !== "arrow") commands.startPathEdit(id);
    };
    return {
      onMouseDown: (event: Konva.KonvaEventObject<MouseEvent>) => {
        if (event.evt.button !== 0) return;
        event.cancelBubble = true;
        pressOn(layerIdOf(event), event.evt.shiftKey, event.evt.ctrlKey || event.evt.metaKey);
      },
      onTouchStart: (event: Konva.KonvaEventObject<TouchEvent>) => {
        event.cancelBubble = true;
        pressOn(layerIdOf(event), false, false);
      },
      onClick: (event: Konva.KonvaEventObject<MouseEvent>) => {
        if (event.evt.button === 0) drillOn(layerIdOf(event));
      },
      onTap: (event: Konva.KonvaEventObject<TouchEvent>) => drillOn(layerIdOf(event)),
      onContextMenu: (event: Konva.KonvaEventObject<PointerEvent>) => {
        const id = layerIdOf(event);
        const home = homeOf(id);
        const state = store.getState();
        if (home && !state.selection.includes(id)) state.select(withGroupMembers(home, [id]));
      },
      onDblClick: (event: Konva.KonvaEventObject<MouseEvent>) => openEditor(layerIdOf(event), false),
      onDblTap: (event: Konva.KonvaEventObject<TouchEvent>) => openEditor(layerIdOf(event), true),
      onDragStart: (event: Konva.KonvaEventObject<DragEvent>) => {
        if (drag.current) return;
        const id = layerIdOf(event);
        const home = homeOf(id);
        if (!home) return;
        const state = store.getState();
        const chosen = state.selection.includes(id) ? state.selection : withGroupMembers(home, [id]);
        const ids = home.layers.filter((l) => chosen.includes(l.id) && !l.locked).map((l) => l.id);
        const bounds = selectionBounds(home, ids);
        if (!bounds) return;
        const family = familyOf(home, ids);
        drag.current = {
          artboardId: home.id,
          origin: { x: home.x, y: home.y },
          anchorId: id,
          ids,
          anchorStart: { x: event.currentTarget.x(), y: event.currentTarget.y() },
          bounds,
          targets: snapTargets(home, family),
          startSurface: home,
          nodes: gestureNodes(event.currentTarget.getStage(), family),
          shift: { x: 0, y: 0 },
        };
      },
      onDragMove: (event: Konva.KonvaEventObject<DragEvent>) => {
        const session = drag.current;
        if (!session || layerIdOf(event) !== session.anchorId) return;
        const node = event.currentTarget;
        let dx = node.x() - session.anchorStart.x;
        let dy = node.y() - session.anchorStart.y;
        const { snapping: snapOn, viewport: v } = ui.getState();
        const snap = snapOn && !event.evt.altKey ? snapMove(shifted(session.bounds, dx, dy), session.targets, SNAP_THRESHOLD_SCREEN_PX / v.scale) : null;
        const shown = snap && snap.guides.vertical.length + snap.guides.horizontal.length > 0 ? snap.guides : null;
        if (snap) {
          dx += snap.dx;
          dy += snap.dy;
        }
        const start = session.startSurface;
        session.shift = { x: dx / start.canvas.width, y: dy / start.canvas.height };
        const moved = changedTransforms(start, translateLayers(start, session.ids, session.shift.x, session.shift.y));
        placeNodes(session.nodes, moved, start.canvas);
        ui.setState({ live: Object.fromEntries(moved) });
        const point = pointerWorld();
        const over = point && !spaceDown.current ? artboardAt(store.getState().document, point) : undefined;
        showFeedback({
          artboardId: session.artboardId,
          guides: shown,
          dropArtboardId: over && over.id !== session.artboardId ? over.id : null,
          hostId: point && !spaceDown.current && (!over || over.id === session.artboardId) ? dropParent(start, session.ids, local(point, session.origin)) : null,
        });
      },
      onDragEnd: (event: Konva.KonvaEventObject<DragEvent>) => {
        const session = drag.current;
        if (!session || layerIdOf(event) !== session.anchorId) return;
        drag.current = null;
        showFeedback(null);
        const point = spaceDown.current ? null : pointerWorld();
        const { x, y } = session.shift;
        const { width, height } = session.startSurface.canvas;
        store.getState().apply((d) => {
          const target = point ? artboardAt(d, point) : undefined;
          if (target && target.id !== session.artboardId) return moveLayersToArtboard(d, session.ids, target.id, "keep-place", { x: x * width, y: y * height });
          const moved = x === 0 && y === 0 ? d : editArtboard(d, session.artboardId, (s) => translateLayers(s, session.ids, x, y));
          return point ? editArtboard(moved, session.artboardId, (s) => reparentOnDrop(s, session.ids, local(point, session.origin))) : moved;
        });
        ui.setState({ live: null });
        const home = artboardById(store.getState().document, session.artboardId);
        if (home) settleNodes(session.nodes, home);
      },
    };
  }, [store, ui, commands, pointerWorld, showFeedback]);

  const transformPatches = useCallback((start: ImageSurface): Map<string, LayerPatch> => {
    const patches = new Map<string, LayerPatch>();
    for (const node of transformer.current?.nodes() ?? []) {
      const layer = start.layers.find((l) => l.id === node.id());
      if (layer) patches.set(layer.id, nodeResizePatch(layer, { x: node.x(), y: node.y(), scaleX: node.scaleX(), scaleY: node.scaleY(), rotation: node.rotation() }, start.canvas));
    }
    return patches;
  }, []);

  const onTransformStart = useCallback(() => {
    const doc = store.getState().document;
    const attached = (transformer.current?.nodes() ?? []).map((node) => node.id());
    const home = attached.length > 0 ? artboardOfLayer(doc, attached[0]) : undefined;
    transformStart.current = home ? { artboardId: home.id, startSurface: home, nodes: gestureNodes(stage.current, familyOf(home, attached)) } : null;
  }, [store]);

  const onTransform = useCallback(() => {
    const session = transformStart.current;
    if (!session) return;
    const start = session.startSurface;
    const patches = transformPatches(start);
    const moved = changedTransforms(start, updateLayers(start, [...patches.keys()], (layer) => patches.get(layer.id) ?? {}));
    placeNodes(session.nodes, moved, start.canvas, new Set(transformer.current?.nodes() ?? []));
    ui.setState({ live: Object.fromEntries(moved) });
  }, [transformPatches, ui]);

  const onTransformEnd = useCallback(() => {
    const session = transformStart.current;
    transformStart.current = null;
    if (session) {
      const patches = transformPatches(session.startSurface);
      store.getState().apply((d) => editArtboard(d, session.artboardId, (s) => updateLayers(s, [...patches.keys()], (layer) => patches.get(layer.id) ?? {})));
    }
    ui.setState({ live: null });
    for (const node of transformer.current?.nodes() ?? []) node.scale({ x: 1, y: 1 });
    const home = session ? artboardById(store.getState().document, session.artboardId) : undefined;
    if (session && home) settleNodes(session.nodes, home);
  }, [store, transformPatches, ui]);

  const onStagePointerDown = (event: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    const target = event.target;
    const onBoard = target === target.getStage();
    const boardId = onBoard ? null : backdropArtboard(target);
    if (!onBoard && boardId === null) return;
    if ("button" in event.evt && event.evt.button !== 0) return;
    if (ui.getState().crop) return;
    const additive = "shiftKey" in event.evt && event.evt.shiftKey;
    if (!additive) store.getState().select([]);
    if (boardId) commands.focusArtboard(boardId);
    const point = pointerWorld();
    if (!point) return;
    marqueeStart.current = { artboardId: boardId, point };
    ui.setState({ marquee: { left: point.x, top: point.y, right: point.x, bottom: point.y } });
  };

  const onStagePointerMove = () => {
    const start = marqueeStart.current;
    const point = start ? pointerWorld() : null;
    if (!start || !point) return;
    ui.setState({ marquee: { left: start.point.x, top: start.point.y, right: point.x, bottom: point.y } });
  };

  const onStagePointerUp = (event: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    const start = marqueeStart.current;
    const marquee = ui.getState().marquee;
    marqueeStart.current = null;
    ui.setState({ marquee: null });
    if (!start || !marquee) return;
    const rect = normalized(marquee);
    const scale = ui.getState().viewport.scale;
    if ((rect.right - rect.left) * scale < MIN_MARQUEE_PX && (rect.bottom - rect.top) * scale < MIN_MARQUEE_PX) return;
    const state = store.getState();
    const additive = "shiftKey" in event.evt && event.evt.shiftKey;
    const board = start.artboardId ? artboardById(state.document, start.artboardId) : undefined;
    if (board) {
      const hits = layersInRect(board, { left: rect.left - board.x, right: rect.right - board.x, top: rect.top - board.y, bottom: rect.bottom - board.y });
      const kept = state.selection.filter((id) => board.layers.some((l) => l.id === id));
      state.select(additive ? withGroupMembers(board, [...kept, ...hits]) : hits);
      return;
    }
    const hits = state.document.artboards.filter((a) => overlaps(artboardBounds(a), rect)).map((a) => a.id);
    const kept = state.selection.filter((id) => artboardById(state.document, id));
    state.select(additive ? [...new Set([...kept, ...hits])] : hits);
  };

  const moveStart = useCallback(
    (id: string): ArtboardMove => {
      const doc = store.getState().document;
      const chosen = store.getState().selection.filter((value) => artboardById(doc, value));
      const ids = chosen.includes(id) ? chosen : [id];
      return { ids, start: new Map(ids.flatMap((value) => {
        const artboard = artboardById(doc, value);
        return artboard ? [[value, { x: artboard.x, y: artboard.y }] as const] : [];
      })) };
    },
    [store],
  );

  const moveArtboards = useCallback(
    (move: ArtboardMove, shift: Point) => {
      const live: Record<string, Point> = {};
      for (const [id, start] of move.start) {
        const place = { x: start.x + shift.x, y: start.y + shift.y };
        artboardGroups.current.get(id)?.position(place);
        live[id] = place;
      }
      ui.setState({ liveOrigins: live });
    },
    [ui],
  );

  const finishMove = useCallback(
    (move: ArtboardMove, shift: Point) => {
      ui.setState({ liveOrigins: null });
      if (shift.x !== 0 || shift.y !== 0) {
        store.getState().apply((d) => [...move.start].reduce((current, [id, start]) => updateArtboard(current, id, { x: start.x + shift.x, y: start.y + shift.y }), d));
      }
      const doc = store.getState().document;
      for (const id of move.ids) {
        const artboard = artboardById(doc, id);
        if (artboard) artboardGroups.current.get(id)?.position({ x: artboard.x, y: artboard.y });
      }
    },
    [store, ui],
  );

  const allLocked = selectedLayers.every((l) => l.locked);
  const single = selectedLayers.length === 1 ? selectedLayers[0] : null;
  const lineLike = single?.type === "shape" && (single.shape === "line" || single.shape === "arrow");
  const keepRatio = selectedLayers.length > 0 && selectedLayers.every((l) => RATIO_TYPES.has(l.type));
  const hoveredHome = hoverLayerId ? artboardOfLayer(document, hoverLayerId) : undefined;
  const hovered = hoveredHome?.layers.find((l) => l.id === hoverLayerId);
  const cropHome = crop ? artboardOfLayer(document, crop.layerId) : undefined;
  const scale = viewport.scale;

  return (
    <div
      ref={host}
      data-studio-canvas
      className="absolute inset-0 overflow-hidden bg-muted/60"
      style={{ cursor: panning ? "grabbing" : spaceHeld ? "grab" : undefined }}
      aria-hidden
    >
      {container && gpu ? <GpuArtboard size={container} onUnavailable={fallBack} /> : null}
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
            {document.artboards.map((artboard) => (
              <ArtboardView
                key={artboard.id}
                artboard={artboard}
                gpu={gpu}
                busy={busy}
                editingTextId={editingTextId}
                croppingId={crop?.layerId ?? null}
                scale={scale}
                handlers={handlers}
                register={register}
              />
            ))}
          </KonvaLayer>
          <KonvaLayer>
            {document.artboards
              .filter((a) => selectedBoards.has(a.id))
              .map((a) => (
                <Rect key={`outline:${a.id}`} x={a.x} y={a.y} width={a.canvas.width} height={a.canvas.height} stroke={SELECTION_COLOR} strokeWidth={1.5 / scale} listening={false} />
              ))}
            {hovered && hoveredHome && !selection.includes(hovered.id) && !hovered.hidden ? (
              <Group x={hoveredHome.x} y={hoveredHome.y} listening={false}>
                <LayerOutline layer={hovered} canvas={hoveredHome.canvas} scale={scale} />
              </Group>
            ) : null}
            {crop && cropHome ? (
              <Group x={cropHome.x} y={cropHome.y}>
                <CropOverlay />
              </Group>
            ) : null}
            <DragFeedback />
            <MarqueeBox />
            <ArtboardLabels
              artboards={document.artboards}
              names={names}
              selected={selectedBoards}
              activeId={active.id}
              renamingId={renamingId}
              scale={scale}
              onSelect={commands.selectArtboard}
              onRename={commands.startRenamingArtboard}
              onMoveStart={moveStart}
              onMove={moveArtboards}
              onMoveEnd={finishMove}
            />
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
              onTransformStart={onTransformStart}
              onTransform={onTransform}
              onTransformEnd={onTransformEnd}
            />
          </KonvaLayer>
        </Stage>
      ) : null}
      {container && tool === "pen" ? <PenOverlay view={localViewport(viewport, active)} onCreate={createFromPen} onCancel={leaveTool} /> : null}
      {container && tool === "draw" ? <DrawOverlay view={localViewport(viewport, active)} onCreate={createFromPencil} /> : null}
      {container && editedPath && pathHome ? (
        <PathEditOverlay
          layer={editedPath}
          canvas={pathHome.canvas}
          view={localViewport(viewport, pathHome)}
          onBegin={pathEditing.begin}
          onChange={pathEditing.change}
          onEnd={pathEditing.end}
          onExit={commands.finishPathEdit}
        />
      ) : null}
      {tool !== "select" ? <VectorHint mode={tool} /> : editedPath ? <VectorHint mode="edit" /> : null}
    </div>
  );
}
