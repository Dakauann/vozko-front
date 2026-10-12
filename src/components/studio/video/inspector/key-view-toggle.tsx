"use client";

import { useEffect } from "react";

import { ElevatedPillToggle } from "@/components/elevated-design/elevated-pill-toggle";

import { useVideoEditor, useViewState } from "../editor-context";

export type KeyViewMode = "composite" | "matte" | "original";

export function useKeyView(clipId: string): { mode: KeyViewMode; show: (next: KeyViewMode) => void } {
  const { view } = useVideoEditor();
  const chromaView = useViewState((s) => s.chromaView);
  useEffect(() => () => view.setState((state) => (state.chromaView?.clipId === clipId ? { chromaView: null } : state)), [clipId, view]);
  return {
    mode: chromaView?.clipId === clipId ? chromaView.mode : "composite",
    show: (next) => view.setState({ chromaView: next === "composite" ? null : { clipId, mode: next } }),
  };
}

interface KeyViewToggleProps {
  clipId: string;
  label: string;
  labels: Record<KeyViewMode, string>;
}

export function KeyViewToggle({ clipId, label, labels }: KeyViewToggleProps) {
  const { mode, show } = useKeyView(clipId);
  return (
    <ElevatedPillToggle<KeyViewMode>
      aria-label={label}
      value={mode}
      onChange={show}
      className="flex w-full [&>button]:flex-1"
      options={[
        { value: "composite", label: labels.composite },
        { value: "matte", label: labels.matte },
        { value: "original", label: labels.original },
      ]}
    />
  );
}
