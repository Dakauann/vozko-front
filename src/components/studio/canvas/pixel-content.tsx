"use client";

import type Konva from "konva";
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Group, Image as KonvaImage } from "react-konva";

import type { Layer } from "@/lib/studio/document";
import { paintReach } from "@/lib/studio/layer-paint";
import type { Composite } from "@/lib/studio/paint";
import { maskPlacement } from "@/lib/studio/pixel-space";
import { liveOpFor, type PixelLive, type SurfaceKind } from "@/lib/studio/pixel-surface";
import { repeatSourceId } from "@/lib/studio/repeat-edits";

import { recache, screenRatio, type ContentProps } from "./rich-content";
import { surfaceKey, surfacePicture } from "./surface-canvas";

const SAFETY_PX = 2;

export const PixelLiveContext = createContext<PixelLive | null>(null);

function useSurface(layer: Layer, kind: SurfaceKind) {
  const live = useContext(PixelLiveContext);
  const surface = kind === "paint" ? layer.surface : layer.mask;
  const op = liveOpFor(live, repeatSourceId(layer.id), kind);
  return useMemo(() => (surface ? surfacePicture(surfaceKey(layer.id, kind), surface, op) : null), [layer.id, kind, surface, op]);
}

export function PaintContent({ layer, width, height, composite, ready }: ContentProps) {
  const picture = useSurface(layer, "paint");
  const node = useRef<Konva.Image>(null);

  useEffect(() => {
    node.current?.getLayer()?.batchDraw();
    ready();
  }, [picture, width, height, ready]);

  if (!picture) return null;
  return <KonvaImage ref={node} image={picture.canvas} width={width} height={height} globalCompositeOperation={composite} listening={false} />;
}

interface MaskedContentProps {
  layer: Layer;
  width: number;
  height: number;
  composite: Composite;
  pixelRatio?: number;
  ready: () => void;
  children: (shown: () => void) => ReactNode;
}

export function MaskedContent({ layer, width, height, composite, pixelRatio, ready, children }: MaskedContentProps) {
  const picture = useSurface(layer, "mask");
  const outer = useRef<Konva.Group>(null);
  const [shownAt, setShownAt] = useState(0);
  const shown = useCallback(() => setShownAt((tick) => tick + 1), []);
  const place = maskPlacement(layer, width, height);
  const ratio = pixelRatio ?? screenRatio();

  useLayoutEffect(() => {
    if (shownAt === 0 || !outer.current) return;
    if (!layer.hidden) recache(outer.current, ratio, Math.ceil(paintReach(layer)) + SAFETY_PX);
    ready();
  }, [shownAt, picture, layer, width, height, ratio, ready]);

  return (
    <Group ref={outer} globalCompositeOperation={composite}>
      {children(shown)}
      {picture ? (
        <KonvaImage
          image={picture.canvas}
          x={place.x + (place.flipX ? place.width : 0)}
          y={place.y + (place.flipY ? place.height : 0)}
          width={place.width}
          height={place.height}
          scaleX={place.flipX ? -1 : 1}
          scaleY={place.flipY ? -1 : 1}
          globalCompositeOperation="destination-out"
          listening={false}
        />
      ) : null}
    </Group>
  );
}
