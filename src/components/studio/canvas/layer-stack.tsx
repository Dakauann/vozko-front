"use client";

import type Konva from "konva";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Group } from "react-konva";

import type { Layer } from "@/lib/studio/document";
import { clipRuns, compositeOf, type Composite } from "@/lib/studio/paint";

export const CLIP_GROUP_NAME = "studio-clip-group";

export interface StackNodeExtra {
  composite?: Composite;
  onReady: (layerId: string) => void;
  onError: (layerId: string, error: Error) => void;
}

export type RenderStackNode = (layer: Layer, extra: StackNodeExtra) => ReactNode;

interface LayerStackProps {
  layers: readonly Layer[];
  pixelRatio: number;
  render: RenderStackNode;
  onReady?: (layerId: string) => void;
  onError?: (layerId: string, error: Error) => void;
}

const noop = () => undefined;

function ClipGroup({ run, pixelRatio, render, onReady, onError }: { run: Layer[]; pixelRatio: number; render: RenderStackNode; onReady: (id: string) => void; onError: (id: string, error: Error) => void }) {
  const group = useRef<Konva.Group>(null);
  const [ready, setReady] = useState<ReadonlySet<string>>(() => new Set());
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const node = group.current;
    if (!node || run.some((l) => !ready.has(l.id))) return;
    node.clearCache();
    const rect = node.getClientRect({ relativeTo: node.getParent() ?? undefined });
    if (!run[0].hidden && rect.width >= 1 && rect.height >= 1) node.cache({ pixelRatio: Math.max(pixelRatio, 0.25) });
    node.getLayer()?.batchDraw();
    for (const l of run) onReady(l.id);
  }, [run, ready, tick, pixelRatio, onReady]);

  const memberReady = useCallback((id: string) => {
    setReady((current) => (current.has(id) ? current : new Set([...current, id])));
    setTick((current) => current + 1);
  }, []);
  const memberFailed = useCallback((id: string, error: Error) => onError(id, error), [onError]);
  const [base, ...clipped] = run;

  return (
    <Group ref={group} name={CLIP_GROUP_NAME} visible={!base.hidden} globalCompositeOperation={compositeOf(base.blendMode)}>
      {render(base, { composite: "source-over", onReady: memberReady, onError: memberFailed })}
      {clipped.map((layer) => (
        <Fragment key={layer.id}>{render(layer, { composite: "source-atop", onReady: memberReady, onError: memberFailed })}</Fragment>
      ))}
    </Group>
  );
}

export function LayerStack({ layers, pixelRatio, render, onReady = noop, onError = noop }: LayerStackProps) {
  const runs = useMemo(() => clipRuns(layers), [layers]);
  return (
    <>
      {runs.map((run) =>
        run.length === 1 ? (
          <Fragment key={run[0].id}>{render(run[0], { onReady, onError })}</Fragment>
        ) : (
          <ClipGroup key={run[0].id} run={run} pixelRatio={pixelRatio} render={render} onReady={onReady} onError={onError} />
        ),
      )}
    </>
  );
}
