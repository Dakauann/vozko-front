"use client";

import { useMemo } from "react";
import { useNodeConnections } from "@xyflow/react";

import { missingOutputHandles } from "@/lib/workflows/edge-outputs";

import type { ShellBranch } from "./message-node-primitives";

export const MISSING_OUTPUT_TITLE = "Conexão de uma saída que não existe mais";

const MISSING_OUTPUT_DOT = "!border-destructive !bg-destructive";

export function useMissingOutputs(nodeId: string, declared: ShellBranch[]): ShellBranch[] {
  const connections = useNodeConnections({ id: nodeId, handleType: "source" });
  const declaredSig = declared.map((b) => b.id).join("|");
  const missing = useMemo(
    () => missingOutputHandles(declaredSig ? declaredSig.split("|") : [], connections.map((c) => c.sourceHandle)),
    [declaredSig, connections],
  );
  return useMemo(
    () =>
      missing.length === 0
        ? declared
        : [...declared, ...missing.map((id) => ({ id, label: id, dot: MISSING_OUTPUT_DOT, missing: true }))],
    [declared, missing],
  );
}

export function MissingOutputRows({
  branches,
  registerRow,
}: {
  branches: ShellBranch[];
  registerRow: (el: HTMLElement | null, id: string) => void;
}) {
  const missing = branches.filter((b) => b.missing);
  if (missing.length === 0) return null;
  return (
    <div className="divide-y divide-border/30 border-t border-border bg-card">
      {missing.map((b) => (
        <div
          key={b.id}
          data-option-id={b.id}
          data-missing-output
          title={MISSING_OUTPUT_TITLE}
          ref={(el) => registerRow(el, b.id)}
          className="flex h-5 items-center justify-end gap-1.5 pr-4"
        >
          <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-destructive" />
          <span className="truncate text-2xs font-semibold text-muted-foreground">Saída removida: {b.id}</span>
        </div>
      ))}
    </div>
  );
}
