"use client";

import { memo, useState, type DragEvent, type MouseEvent as ReactMouseEvent, type RefObject } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  ControlButton,
  MarkerType,
  MiniMap,
  Panel,
  ViewportPortal,
  useStore,
  type Edge,
  type Node,
  type NodeTypes,
  type OnEdgesChange,
  type OnNodesChange,
  type Connection,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";

import { LightPool } from "@/components/brand/light-pool";
import { BrandLogo } from "@/components/brand-logo";
import { ArrowClockwise, ArrowCounterClockwise, MagnifyingGlass, Trash, TreeStructure, X } from "@/components/icons";
import ElevatedButton from "@/components/elevated-design/button";
import { browserStorage } from "@/lib/browser-storage";
import type { NodeDefinition, RunDetail, WorkflowGraph, HandleDefinition } from "@/lib/workflows/types";

import { CanvasContextMenu } from "./canvas-context-menu";
import { hasSelectedEdge, selectedNodeCount } from "./canvas-selection";
import { HoveredNodeContext, type HoverStore } from "./edge-activity";
import type { ObstacleIndex } from "./edge-routing";
import { NodeDebugContext, type NodeDebugStore } from "./node-debug-marks";
import { NodeContextMenu } from "./node-debug-section";
import { RunOverlayContext, type RunOverlayStore } from "./run-overlay";
import { ObstacleIndexContext, SmartBezierEdge, SmartConnectionLine } from "./smart-edge";
import type { NodeSearch } from "./use-node-search";
import { VersionRunCanvas, type VersionFocus } from "./version-run-canvas";
import { GroupNode, WorkflowNode } from "./workflow-node";
import { WorkflowSearch } from "./workflow-search";

const NODE_TYPES: NodeTypes = { workflowNode: WorkflowNode, groupNode: GroupNode };

const EDGE_TYPES = { smartBezier: SmartBezierEdge };

const FIT_VIEW_OPTIONS = { padding: 0.2, maxZoom: 1 };

const DELETE_KEYS = ["Backspace", "Delete"];

const MULTI_SELECT_KEYS = ["Shift", "Meta", "Control"];

const SELECT_HINT_DISMISSED_KEY = "vozko.workflows.selectHint.dismissed";

const DEFAULT_EDGE_OPTIONS = {
  type: "smartBezier",
  animated: false,
  markerEnd: {
    type: MarkerType.ArrowClosed,
    width: 16,
    height: 16,
  },
  style: {
    strokeWidth: 2,
    stroke: "hsl(var(--border-strong))",
  },
};

export interface VersionView {
  runId: string;
  version: number;
  graph: WorkflowGraph;
  handles: Record<string, HandleDefinition[]>;
}

interface CanvasBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CanvasMenuPoint {
  x: number;
  y: number;
}

export interface NodeMenuState extends CanvasMenuPoint {
  nodeId: string;
  debuggable: boolean;
}

export interface PaneMenuState extends CanvasMenuPoint {
  flowPos: { x: number; y: number };
}

interface CanvasChromeProps {
  onTidyUp: () => void;
  onOpenSearch: () => void;
}

interface UndoRedoProps {
  onUndo: () => void;
  onRedo: () => void;
}

const CanvasChrome = memo(function CanvasChrome({ onTidyUp, onOpenSearch }: CanvasChromeProps) {
  const t = useTranslations("workflowsPage");
  const { resolvedTheme } = useTheme();
  return (
    <>
      <Controls className="!bg-background !border-border !shadow-md [&>button]:!bg-background [&>button]:!border-border [&>button]:!fill-foreground">
        <ControlButton onClick={onTidyUp} title={t("tidyUp")}>
          <TreeStructure />
        </ControlButton>
        <ControlButton onClick={onOpenSearch} title="Buscar nós (Ctrl+F)">
          <MagnifyingGlass />
        </ControlButton>
      </Controls>
      <MiniMap
        className="!bg-background !border-border border rounded !mb-20"
        nodeColor="hsl(var(--primary))"
        maskColor="hsl(var(--muted) / 0.7)"
      />

      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-[5] opacity-35 pointer-events-none select-none">
        <BrandLogo
          useWhite={resolvedTheme === "dark"}
          size="sm"
          textClassName="text-muted-foreground"
        />
      </div>
    </>
  );
});

const CanvasLightPool = memo(function CanvasLightPool({ bounds }: { bounds: CanvasBounds }) {
  return (
    <ViewportPortal>
      <div
        style={{
          position: "absolute",
          left: bounds.x,
          top: bounds.y,
          width: bounds.width,
          height: bounds.height,
          zIndex: -1,
          pointerEvents: "none",
        }}
      >
        <LightPool tone="quiet" />
      </div>
    </ViewportPortal>
  );
});

const UndoRedoPanel = memo(function UndoRedoPanel({ onUndo, onRedo }: UndoRedoProps) {
  return (
    <Panel position="top-left">
      <div className="flex items-center gap-1 bg-background border border-border rounded-lg p-0.5 shadow-sm">
        <button
          onClick={onUndo}
          title="Desfazer (Ctrl+Z)"
          className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground disabled:opacity-30"
        >
          <ArrowCounterClockwise size={15} weight="bold" />
        </button>
        <button
          onClick={onRedo}
          title="Refazer (Ctrl+Y)"
          className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground disabled:opacity-30"
        >
          <ArrowClockwise size={15} weight="bold" />
        </button>
      </div>
    </Panel>
  );
});

const SelectionPanel = memo(function SelectionPanel({ onDeleteSelected }: { onDeleteSelected: () => void }) {
  const t = useTranslations("workflowsPage");
  const selected = useStore(selectedNodeCount);
  const edgeSelected = useStore(hasSelectedEdge);
  const [hintDismissed, setHintDismissed] = useState(() => browserStorage.read(SELECT_HINT_DISMISSED_KEY) === "1");
  if (selected === 0 && !edgeSelected) return null;

  const dismissHint = () => {
    browserStorage.write(SELECT_HINT_DISMISSED_KEY, "1");
    setHintDismissed(true);
  };

  return (
    <Panel position="top-right">
      <div className="flex items-center gap-2">
        {selected === 1 && !hintDismissed && (
          <div className="flex items-center gap-1.5 rounded-[--radius] border border-border bg-card py-1 pl-2.5 pr-1 text-xs text-muted-foreground shadow-sm">
            <span>{t("selectHint.text")}</span>
            <button
              type="button"
              aria-label={t("selectHint.dismiss")}
              title={t("selectHint.dismiss")}
              onClick={dismissHint}
              className="rounded-[--radius] p-1 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X size={12} />
            </button>
          </div>
        )}
        <ElevatedButton
          variant="outline-subtle"
          size="sm"
          title={t("deleteSelection")}
          icon={<Trash size={14} />}
          iconVisible
          onClick={onDeleteSelected}
          className="text-destructive-ink border-border hover:bg-muted"
        />
      </div>
    </Panel>
  );
});

export interface EditorCanvasProps {
  wrapperRef: RefObject<HTMLDivElement | null>;
  onDragOver: (event: DragEvent) => void;
  onDrop: (event: DragEvent) => void;
  onMouseMove: (event: ReactMouseEvent) => void;
  obstacleIndex: ObstacleIndex;
  hoverStore: HoverStore;
  runOverlayStore: RunOverlayStore;
  debugStore: NodeDebugStore;
  versionView: VersionView | null;
  versionToFlow: (graph: WorkflowGraph) => { nodes: Node[]; edges: Edge[] };
  shownRun: RunDetail | null;
  versionFocus: VersionFocus | null;
  onVersionBack: () => void;
  nodes: Node[];
  edges: Edge[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: (connection: Connection) => void;
  onReconnect: (previous: Edge, connection: Connection) => void;
  onNodeClick: (event: ReactMouseEvent, node: Node) => void;
  onNodeDoubleClick: (event: ReactMouseEvent, node: Node) => void;
  onNodeContextMenu: (event: ReactMouseEvent, node: Node) => void;
  onNodeMouseEnter: (event: ReactMouseEvent, node: Node) => void;
  onNodeMouseLeave: () => void;
  onPaneClick: () => void;
  onPaneContextMenu: (event: MouseEvent | ReactMouseEvent) => void;
  onInit: (instance: ReactFlowInstance) => void;
  onMoveStart: (event: MouseEvent | TouchEvent | null) => void;
  onMoveEnd: () => void;
  onNodeDragStart: () => void;
  onNodeDragStop: () => void;
  canvasBounds: CanvasBounds;
  onTidyUp: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onDeleteSelected: () => void;
  search: NodeSearch;
  searchInputRef: RefObject<HTMLInputElement | null>;
  showNodeTestPath: boolean;
  onClearNodeTestPath: () => void;
  nodeMenu: NodeMenuState | null;
  nodeMenuBreakpoint: boolean;
  onConfigureNode: (nodeId: string) => void;
  onRunUntil: (nodeId: string) => void;
  onToggleBreakpoint: (nodeId: string) => void;
  onCloseNodeMenu: () => void;
  paneMenu: PaneMenuState | null;
  paneMenuDefinitions: NodeDefinition[];
  onPaneMenuSelect: (definition: NodeDefinition) => void;
  onClosePaneMenu: () => void;
}

export function EditorCanvas({
  wrapperRef,
  onDragOver,
  onDrop,
  onMouseMove,
  obstacleIndex,
  hoverStore,
  runOverlayStore,
  debugStore,
  versionView,
  versionToFlow,
  shownRun,
  versionFocus,
  onVersionBack,
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onReconnect,
  onNodeClick,
  onNodeDoubleClick,
  onNodeContextMenu,
  onNodeMouseEnter,
  onNodeMouseLeave,
  onPaneClick,
  onPaneContextMenu,
  onInit,
  onMoveStart,
  onMoveEnd,
  onNodeDragStart,
  onNodeDragStop,
  canvasBounds,
  onTidyUp,
  onUndo,
  onRedo,
  onDeleteSelected,
  search,
  searchInputRef,
  showNodeTestPath,
  onClearNodeTestPath,
  nodeMenu,
  nodeMenuBreakpoint,
  onConfigureNode,
  onRunUntil,
  onToggleBreakpoint,
  onCloseNodeMenu,
  paneMenu,
  paneMenuDefinitions,
  onPaneMenuSelect,
  onClosePaneMenu,
}: EditorCanvasProps) {
  const tDebug = useTranslations("workflowDebug");

  return (
    <div
      ref={wrapperRef}
      className="relative flex-1 bg-background"
      onDragOver={onDragOver}
      onDrop={onDrop}
      onMouseMove={onMouseMove}
    >
      <ObstacleIndexContext.Provider value={obstacleIndex}>
      <HoveredNodeContext.Provider value={hoverStore}>
      <RunOverlayContext.Provider value={runOverlayStore}>
      <NodeDebugContext.Provider value={debugStore}>
      {versionView ? (
        <VersionRunCanvas
          key={`${versionView.runId}:${versionView.version}`}
          version={versionView.version}
          graph={versionView.graph}
          toFlow={versionToFlow}
          steps={shownRun?.logs ?? []}
          triggerNodeId={shownRun?.run.triggerNodeId}
          focus={versionFocus}
          nodeTypes={NODE_TYPES}
          edgeTypes={EDGE_TYPES}
          onBack={onVersionBack}
        />
      ) : (
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onReconnect={onReconnect}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        onNodeContextMenu={onNodeContextMenu}
        onNodeMouseEnter={onNodeMouseEnter}
        onNodeMouseLeave={onNodeMouseLeave}
        onPaneClick={onPaneClick}
        onPaneContextMenu={onPaneContextMenu}
        onInit={onInit}
        onMoveStart={onMoveStart}
        onMoveEnd={onMoveEnd}
        onNodeDragStart={onNodeDragStart}
        onNodeDragStop={onNodeDragStop}
        nodeTypes={NODE_TYPES}
        edgeTypes={EDGE_TYPES}
        connectionLineComponent={SmartConnectionLine}
        fitView
        fitViewOptions={FIT_VIEW_OPTIONS}
        minZoom={0.2}
        maxZoom={1.75}
        elevateNodesOnSelect={false}
        onlyRenderVisibleElements
        deleteKeyCode={DELETE_KEYS}
        multiSelectionKeyCode={MULTI_SELECT_KEYS}
        defaultEdgeOptions={DEFAULT_EDGE_OPTIONS}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="hsl(var(--border-strong))"
        />
        <CanvasLightPool bounds={canvasBounds} />
        <CanvasChrome onTidyUp={onTidyUp} onOpenSearch={search.openSearch} />

        <SelectionPanel onDeleteSelected={onDeleteSelected} />

        {search.searchOpen && (
          <Panel position="top-center">
            <WorkflowSearch
              ref={searchInputRef}
              query={search.searchQuery}
              onQueryChange={search.setSearchQuery}
              matchCount={search.searchMatches.length}
              activeIndex={search.searchActiveIndex}
              onNext={() => search.goToMatch(1)}
              onPrev={() => search.goToMatch(-1)}
              onClose={search.closeSearch}
              types={search.searchTypes}
              typeFilter={search.searchTypeFilter}
              onTypeFilterChange={search.setSearchTypeFilter}
            />
          </Panel>
        )}

        <UndoRedoPanel onUndo={onUndo} onRedo={onRedo} />
        {showNodeTestPath && (
          <Panel position="bottom-center">
            <div className="flex items-center gap-2 rounded-[--radius] border border-border bg-card px-3 py-1.5 text-xs shadow-sm">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-primary" />
              <span className="font-medium text-foreground">{tDebug("nodeTest.pathActive")}</span>
              <button
                type="button"
                onClick={onClearNodeTestPath}
                className="rounded-[--radius] font-medium text-primary-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {tDebug("nodeTest.clearPath")}
              </button>
            </div>
          </Panel>
        )}
      </ReactFlow>
      )}
      </NodeDebugContext.Provider>
      </RunOverlayContext.Provider>
      </HoveredNodeContext.Provider>
      </ObstacleIndexContext.Provider>

      {nodeMenu && (
        <NodeContextMenu
          x={nodeMenu.x}
          y={nodeMenu.y}
          nodeId={nodeMenu.nodeId}
          debuggable={nodeMenu.debuggable}
          breakpoint={nodeMenuBreakpoint}
          onConfigure={onConfigureNode}
          onRunUntil={onRunUntil}
          onToggleBreakpoint={onToggleBreakpoint}
          onClose={onCloseNodeMenu}
        />
      )}

      {paneMenu && (
        <CanvasContextMenu
          x={paneMenu.x}
          y={paneMenu.y}
          definitions={paneMenuDefinitions}
          onSelect={onPaneMenuSelect}
          onClose={onClosePaneMenu}
        />
      )}
    </div>
  );
}
