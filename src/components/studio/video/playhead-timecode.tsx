"use client";

import { useViewState } from "./editor-context";

export function PlayheadTimecode({ format }: { format: (ms: number) => string }) {
  return <>{useViewState((s) => format(s.playheadMs))}</>;
}
