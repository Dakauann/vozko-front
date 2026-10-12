import { newStudioId, type CanvasSize, type Layer, type Transform } from "./document";
import { localPoint, squareTransform } from "./geometry";
import { tableCellAt } from "./table-parts";
import type { QrSpec } from "./qr";
import type { TableSpec } from "./table";

export const TABLE_SHARE = 0.8;
export const QR_SHARE = 0.3;

const ROW_SHARE = 0.11;
const MAX_TABLE_HEIGHT = 0.9;

export function tableTransform(canvas: CanvasSize, spec: Pick<TableSpec, "rows">, share: number = TABLE_SHARE): Transform {
  return squareTransform(canvas, share, Math.min(MAX_TABLE_HEIGHT, Math.max(ROW_SHARE, spec.rows.length * ROW_SHARE)));
}

export function qrTransform(canvas: CanvasSize, share: number = QR_SHARE): Transform {
  return squareTransform(canvas, share);
}

export function newTableLayer(spec: TableSpec, transform: Transform, name?: string): Layer {
  return { id: newStudioId("l"), type: "table", ...(name ? { name } : {}), transform, table: spec };
}

export function newQrLayer(spec: QrSpec, transform: Transform, name?: string): Layer {
  return { id: newStudioId("l"), type: "qr", ...(name ? { name } : {}), transform, qr: spec };
}

export function tableCellUnder(layer: Layer, canvas: CanvasSize, point: { x: number; y: number }): { row: number; column: number } | null {
  if (!layer.table) return null;
  const inside = localPoint(layer.transform, canvas, point);
  return tableCellAt(layer.table, { width: layer.transform.w * canvas.width, height: layer.transform.h * canvas.height }, inside.x, inside.y);
}
