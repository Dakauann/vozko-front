import type Konva from "konva";

type SceneCanvas = Parameters<Konva.Layer["drawScene"]>[0];
type HitCanvas = Parameters<Konva.Layer["drawHit"]>[0];
type DrawTop = Parameters<Konva.Layer["drawScene"]>[1];

export function lazyHitGraph(layer: Konva.Layer): () => void {
  const drawHit = layer.drawHit;
  const getIntersection = layer.getIntersection;
  let stale = true;
  layer.drawHit = function (this: Konva.Layer, canvas?: HitCanvas, top?: DrawTop) {
    if (canvas) return drawHit.call(this, canvas, top);
    stale = true;
    return this;
  };
  layer.getIntersection = function (this: Konva.Layer, pos: Konva.Vector2d) {
    if (stale && this.shouldDrawHit()) {
      stale = false;
      drawHit.call(this);
    }
    return getIntersection.call(this, pos);
  };
  return () => {
    layer.drawHit = drawHit;
    layer.getIntersection = getIntersection;
  };
}

export function sceneless(layer: Konva.Layer): () => void {
  const drawScene = layer.drawScene;
  layer.drawScene = function (this: Konva.Layer, canvas?: SceneCanvas, top?: DrawTop) {
    return canvas ? drawScene.call(this, canvas, top) : this;
  };
  layer.getCanvas().getContext().clear();
  return () => {
    layer.drawScene = drawScene;
    layer.batchDraw();
  };
}
