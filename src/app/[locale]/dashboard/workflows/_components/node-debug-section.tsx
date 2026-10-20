"use client";

import { useEffect, useMemo, useRef, type ReactNode } from "react";
import type { Edge } from "@xyflow/react";
import { useTranslations } from "next-intl";

import { Circle, GearSix, Play } from "@/components/icons";
import ElevatedButton from "@/components/elevated-design/button";
import { pinEdgeOptions, type NodePin } from "@/lib/workflows/node-pin";
import { isDebuggableBehavior, isPinnableBehavior } from "@/lib/workflows/node-test-behavior";
import type { WorkflowRunLog } from "@/lib/workflows/types";

import { useTestBehaviorOf } from "./node-previews/node-definitions";
import { PinnedOutputSection } from "./pinned-output-section";
import { getDomainEdgeLabel } from "./workflow-graph";

export interface NodeDebugControls {
  breakpoints: ReadonlySet<string>;
  unsaved: boolean;
  onToggleBreakpoint: (nodeId: string) => void;
  onRunUntil: (nodeId: string) => void;
  onPinChange: (nodeId: string, pin: NodePin | null) => void;
  onShowTestPath: (steps: WorkflowRunLog[]) => void;
}

const MENU_ITEM =
  "flex w-full items-center gap-2 rounded-[--radius] px-2.5 py-1.5 text-left text-xs text-foreground hover:bg-muted focus-visible:bg-muted focus-visible:outline-none";

function NodeMenuItem({ onSelect, children }: { onSelect: () => void; children: ReactNode }) {
  return (
    <button type="button" role="menuitem" className={MENU_ITEM} onClick={onSelect}>
      {children}
    </button>
  );
}

export function NodeContextMenu({
  x,
  y,
  nodeId,
  debuggable,
  breakpoint,
  onConfigure,
  onRunUntil,
  onToggleBreakpoint,
  onClose,
}: {
  x: number;
  y: number;
  nodeId: string;
  debuggable: boolean;
  breakpoint: boolean;
  onConfigure: (nodeId: string) => void;
  onRunUntil: (nodeId: string) => void;
  onToggleBreakpoint: (nodeId: string) => void;
  onClose: () => void;
}) {
  const t = useTranslations("workflowDebug.node");
  const tMenu = useTranslations("workflowsPage.nodeMenu");
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    menuRef.current?.querySelector<HTMLButtonElement>("[role=menuitem]")?.focus();
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent && event.key !== "Escape") return;
      if (event instanceof MouseEvent && menuRef.current?.contains(event.target as globalThis.Node)) return;
      onClose();
    };
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", close);
    };
  }, [onClose]);

  const choose = (action: (nodeId: string) => void) => () => {
    action(nodeId);
    onClose();
  };

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label={tMenu("title")}
      style={{ left: x, top: y }}
      className="fixed z-[65] min-w-[200px] rounded-[--radius] border border-border bg-card p-1 shadow-lg"
    >
      <NodeMenuItem onSelect={choose(onConfigure)}>
        <GearSix size={12} />
        {tMenu("configure")}
      </NodeMenuItem>
      {debuggable && (
        <>
          <NodeMenuItem onSelect={choose(onRunUntil)}>
            <Play size={12} weight="fill" />
            {t("runUntil")}
          </NodeMenuItem>
          <NodeMenuItem onSelect={choose(onToggleBreakpoint)}>
            <Circle size={12} weight="fill" className="text-destructive-ink" />
            {breakpoint ? t("removeBreakpoint") : t("addBreakpoint")}
          </NodeMenuItem>
        </>
      )}
    </div>
  );
}

export function NodeDebugSection({
  nodeId,
  nodeType,
  pin,
  edges,
  debug,
}: {
  nodeId: string;
  nodeType: string;
  pin: NodePin | undefined;
  edges: readonly Edge[];
  debug: NodeDebugControls;
}) {
  const t = useTranslations("workflowDebug.node");
  const behavior = useTestBehaviorOf()(nodeType);
  const edgeLabels = useMemo(
    () => pinEdgeOptions(edges.map((edge) => ({ source: edge.source, label: getDomainEdgeLabel(edge) })), nodeId),
    [edges, nodeId],
  );
  if (!isDebuggableBehavior(behavior)) return null;
  const hasBreakpoint = debug.breakpoints.has(nodeId);

  return (
    <div className="space-y-3">
      <section aria-label={t("debugTitle")} className="space-y-2 rounded-lg border border-border p-3">
        <p className="text-xs font-medium text-foreground">{t("debugTitle")}</p>
        <div className="flex flex-wrap gap-1.5">
          <ElevatedButton
            variant="outline-subtle"
            size="sm"
            iconVisible
            icon={<Play size={12} weight="fill" />}
            title={t("runUntil")}
            onClick={() => debug.onRunUntil(nodeId)}
          />
          <ElevatedButton
            variant={hasBreakpoint ? "primary" : "outline-subtle"}
            size="sm"
            iconVisible
            icon={<Circle size={12} weight="fill" className={hasBreakpoint ? undefined : "text-destructive-ink"} />}
            title={hasBreakpoint ? t("removeBreakpoint") : t("addBreakpoint")}
            aria-pressed={hasBreakpoint}
            onClick={() => debug.onToggleBreakpoint(nodeId)}
          />
        </div>
        <p className="text-2xs leading-relaxed text-muted-foreground">{t("breakpointHint")}</p>
      </section>
      {isPinnableBehavior(behavior) && (
        <PinnedOutputSection nodeId={nodeId} pin={pin} edgeLabels={edgeLabels} unsaved={debug.unsaved} onChange={debug.onPinChange} />
      )}
    </div>
  );
}
