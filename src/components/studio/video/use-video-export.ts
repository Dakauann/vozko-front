"use client";

import { createContext, useContext, useEffect } from "react";
import { useStore } from "zustand";

import { useEditorState } from "./editor-context";
import { exportStatus, type VideoExporter } from "./export/video-exporter";

export const VideoExportContext = createContext<VideoExporter | null>(null);

function useLeaveGuard(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const hold = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", hold);
    return () => window.removeEventListener("beforeunload", hold);
  }, [active]);
}

export function useVideoExport() {
  const exporter = useContext(VideoExportContext);
  if (!exporter) throw new Error("useVideoExport must be used inside VideoExportContext");
  const state = useStore(exporter.store);
  const current = useEditorState((s) => s.document);
  useLeaveGuard(state.preparing !== null && state.preparing.phase !== "saving");
  return { state: exportStatus(state, current), start: exporter.start, reset: exporter.reset };
}
