"use client";

import { createContext, useContext } from "react";
import { useStore } from "zustand";

import { useLeaveGuard } from "@/hooks/use-leave-guard";

import { useEditorState } from "./editor-context";
import { exportStatus, type VideoExporter } from "./export/video-exporter";

export const VideoExportContext = createContext<VideoExporter | null>(null);

export function useVideoExport() {
  const exporter = useContext(VideoExportContext);
  if (!exporter) throw new Error("useVideoExport must be used inside VideoExportContext");
  const state = useStore(exporter.store);
  const current = useEditorState((s) => s.document);
  useLeaveGuard(state.preparing !== null && state.preparing.phase !== "saving");
  return { state: exportStatus(state, current), start: exporter.start, reset: exporter.reset };
}
