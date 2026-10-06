"use client";

import { createContext, useContext } from "react";
import { useStore } from "zustand";
import { createStore, type StoreApi } from "zustand/vanilla";

import type { CropFrame } from "@/lib/studio/crop";
import type { CanvasSize, ImageDocument } from "@/lib/studio/document";
import type { PixelBox } from "@/lib/studio/geometry";
import type { JobErrorCode } from "@/lib/studio/image-edits";
import { useStudioEditor, type StudioEditorState, type StudioEditorStore } from "@/lib/studio/store";
import type { Viewport } from "@/lib/studio/viewport";
import type { MediaGenerationJob } from "@/lib/media-generation/types";

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
}

export interface CropSession {
  layerId: string;
  frame: CropFrame;
  box: PixelBox;
}

export interface EditorUiState {
  viewport: Viewport;
  fit: boolean;
  container: CanvasSize | null;
  panel: PanelId | null;
  rulers: boolean;
  snapping: boolean;
  crop: CropSession | null;
  editingTextId: string | null;
  jobs: StudioJob[];
  clipboard: boolean;
  styleCopied: boolean;
  hoverLayerId: string | null;
  collapsedGroups: string[];
  layersOpen: boolean;
  layersHeight: number;
}

export type EditorUiStore = StoreApi<EditorUiState>;

export function createEditorUiStore(): EditorUiStore {
  return createStore<EditorUiState>()(() => ({
    viewport: { scale: 1, x: 0, y: 0 },
    fit: true,
    container: null,
    panel: "text",
    rulers: false,
    snapping: true,
    crop: null,
    editingTextId: null,
    jobs: [],
    clipboard: false,
    styleCopied: false,
    hoverLayerId: null,
    collapsedGroups: [],
    layersOpen: true,
    layersHeight: 320,
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
