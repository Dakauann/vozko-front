"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { VideoDocument } from "@/lib/studio/document";
import { isExportOutdated, startVideoExport, type ExportedVideo, type ExportFailureCode, type ExportPhase } from "@/lib/studio/export";

import { useStudioTelemetry } from "../telemetry/studio-telemetry";
import { useEditorState, useVideoEditor } from "./editor-context";
import { exportLocally } from "./export/browser-export";

export type VideoExportState =
  | { status: "idle" }
  | { status: "preparing"; phase: ExportPhase }
  | { status: "done"; result: ExportedVideo; outdated: boolean }
  | { status: "failed"; code: ExportFailureCode };

interface FinishedExport {
  result: ExportedVideo;
  document: VideoDocument;
}

function useLeaveGuard(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const hold = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", hold);
    return () => window.removeEventListener("beforeunload", hold);
  }, [active]);
}

export function useVideoExport() {
  const { projectId, store, studio, assets } = useVideoEditor();
  const telemetry = useStudioTelemetry();
  const [preparing, setPreparing] = useState<ExportPhase | null>(null);
  const [failure, setFailure] = useState<ExportFailureCode | null>(null);
  const [finished, setFinished] = useState<FinishedExport | null>(null);
  const current = useEditorState((s) => s.document);
  const busy = useRef(false);

  const start = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setFailure(null);
    setFinished(null);
    store.getState().commitTransaction();
    try {
      const outcome = await startVideoExport({
        flush: studio.flush,
        committed: studio.committed,
        document: () => store.getState().document,
        local: async (document, onPhase) => {
          const local = await exportLocally(projectId, document, onPhase);
          if (local.status === "done") telemetry?.exported();
          else telemetry?.exportFailed(local.reason);
          return local;
        },
        onPhase: setPreparing,
      });
      if (outcome.status === "failed") {
        setFailure(outcome.code);
        return;
      }
      setFinished({ result: outcome.result, document: outcome.document });
      void assets.loadLibrary();
    } finally {
      setPreparing(null);
      busy.current = false;
    }
  }, [projectId, store, studio, assets, telemetry]);

  const reset = useCallback(() => {
    setFailure(null);
    setFinished(null);
  }, []);

  useLeaveGuard(preparing !== null && preparing.phase !== "saving");

  let state: VideoExportState = { status: "idle" };
  if (preparing) state = { status: "preparing", phase: preparing };
  else if (failure) state = { status: "failed", code: failure };
  else if (finished) state = { status: "done", result: finished.result, outdated: isExportOutdated(finished.document, current) };

  return { state, start, reset };
}
