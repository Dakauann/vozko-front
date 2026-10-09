"use client";

import { createContext, useContext } from "react";
import { useStore } from "zustand";
import { createStore, type StoreApi } from "zustand/vanilla";

import { activeArtboard } from "@/lib/studio/artboards";
import type { CropFrame } from "@/lib/studio/crop";
import type { Artboard, CanvasSize, ImageCanvas, ImageDocument, Transform } from "@/lib/studio/document";
import type { PixelBox } from "@/lib/studio/geometry";
import type { Bounds } from "@/lib/studio/layers";
import type { SnapGuides } from "@/lib/studio/snapping";
import type { JobErrorCode } from "@/lib/studio/image-edits";
import { useStudioEditor, type StudioEditorState, type StudioEditorStore } from "@/lib/studio/store";
import type { VectorTool } from "@/lib/studio/vector-tools";
import type { Point, Viewport } from "@/lib/studio/viewport";
import type { ImageReference } from "@/lib/media-generation/references";
import type { ImageAspect, MediaGenerationJob } from "@/lib/media-generation/types";

import type { ImageCommands } from "./commands";

export const PANEL_IDS = ["text", "elements", "uploads", "ai"] as const;

export type PanelId = (typeof PANEL_IDS)[number];

export type JobPurpose = "generate" | "edit" | "cutout";

export interface StudioJob {
  id: string;
  purpose: JobPurpose;
  layerId: string | null;
  created: MediaGenerationJob | null;
  settling: boolean;
  error: JobErrorCode | "result_unavailable" | null;
  byAgent: boolean;
}

export interface ImageAiDraft {
  prompt: string;
  model: string | null;
  aspect: ImageAspect | null;
  references: ImageReference[];
}

export const EMPTY_IMAGE_AI_DRAFT: ImageAiDraft = { prompt: "", model: null, aspect: null, references: [] };

export function jobKind(purpose: JobPurpose): "image" | "cutout" {
  return purpose === "cutout" ? "cutout" : "image";
}

export interface CropSession {
  layerId: string;
  frame: CropFrame;
  box: PixelBox;
}

export interface DragFeedback {
  artboardId: string;
  guides: SnapGuides | null;
  hostId: string | null;
  dropArtboardId: string | null;
}

export interface EditorUiState {
  dragFeedback: DragFeedback | null;
  marquee: Bounds | null;
  artboardId: string | null;
  renamingArtboardId: string | null;
  liveOrigins: Record<string, Point> | null;
  viewport: Viewport;
  fit: boolean;
  container: CanvasSize | null;
  panel: PanelId | null;
  rulers: boolean;
  snapping: boolean;
  crop: CropSession | null;
  editingTextId: string | null;
  tool: VectorTool;
  pathEditId: string | null;
  live: Record<string, Transform> | null;
  jobs: StudioJob[];
  clipboard: boolean;
  styleCopied: boolean;
  hoverLayerId: string | null;
  collapsedGroups: string[];
  layersOpen: boolean;
  layersHeight: number;
  aiDraft: ImageAiDraft;
}

export type EditorUiStore = StoreApi<EditorUiState>;

export function createEditorUiStore(): EditorUiStore {
  return createStore<EditorUiState>()(() => ({
    dragFeedback: null,
    marquee: null,
    artboardId: null,
    renamingArtboardId: null,
    liveOrigins: null,
    viewport: { scale: 1, x: 0, y: 0 },
    fit: true,
    container: null,
    panel: "text",
    rulers: false,
    snapping: true,
    crop: null,
    editingTextId: null,
    tool: "select",
    pathEditId: null,
    live: null,
    jobs: [],
    clipboard: false,
    styleCopied: false,
    hoverLayerId: null,
    collapsedGroups: [],
    layersOpen: true,
    layersHeight: 320,
    aiDraft: EMPTY_IMAGE_AI_DRAFT,
  }));
}

export interface ImageEditorContextValue {
  store: StudioEditorStore<ImageDocument>;
  ui: EditorUiStore;
  commands: ImageCommands;
  projectName: string;
}

export const ImageEditorContext = createContext<ImageEditorContextValue | null>(null);

export function useImageEditor(): ImageEditorContextValue {
  const value = useContext(ImageEditorContext);
  if (!value) throw new Error("useImageEditor must be used inside ImageEditorContext");
  return value;
}

export function useImageDoc<T>(selector: (state: StudioEditorState<ImageDocument>) => T): T {
  return useStudioEditor(useImageEditor().store, selector);
}

export function useEditorUi<T>(selector: (state: EditorUiState) => T): T {
  return useStore(useImageEditor().ui, selector);
}

export function currentArtboard(store: StudioEditorStore<ImageDocument>, ui: EditorUiStore): Artboard {
  return activeArtboard(store.getState().document, ui.getState().artboardId);
}

export function useActiveArtboard(): Artboard {
  const id = useEditorUi((s) => s.artboardId);
  return useImageDoc((s) => activeArtboard(s.document, id));
}

export function useActiveCanvas(): ImageCanvas {
  const id = useEditorUi((s) => s.artboardId);
  return useImageDoc((s) => activeArtboard(s.document, id).canvas);
}
