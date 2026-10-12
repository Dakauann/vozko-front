import { boxCorners } from "@/lib/studio/arrange";
import { insideConvex, type Point } from "@/lib/studio/convex";
import type { ImageSurface } from "@/lib/studio/document";

const COLUMNS = 36;
const SYMBOLS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

export function asciiMap(doc: ImageSurface): string {
  const { width, height } = doc.canvas;
  const rows = Math.round((COLUMNS * height) / width);
  const layers = doc.layers.filter((layer) => !layer.hidden);
  const polygons = layers.map((layer) => boxCorners(layer.transform, { width, height }) as Point[]);
  const lines: string[] = [];
  for (let r = 0; r < rows; r++) {
    let line = `${String(r).padStart(2, "0")} `;
    for (let c = 0; c < COLUMNS; c++) {
      const point: Point = [((c + 0.5) / COLUMNS) * width, ((r + 0.5) / rows) * height];
      let top = -1;
      polygons.forEach((polygon, index) => {
        if (insideConvex(point, polygon)) top = index;
      });
      line += top < 0 ? "." : SYMBOLS[top % SYMBOLS.length];
    }
    lines.push(line);
  }
  const header = `   ${Array.from({ length: COLUMNS }, (_, c) => String(c % 10)).join("")}`;
  const legend = layers.map((layer, index) => `${SYMBOLS[index % SYMBOLS.length]}=${layer.id}`).join(" ");
  return [`mapa ${COLUMNS}x${rows}, cada célula mostra a camada de cima naquele ponto (. é o fundo): ${legend}`, header, ...lines].join("\n");
}
