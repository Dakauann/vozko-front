const FALLBACK_QUALITIES = [0.82, 0.68, 0.55, 0.42];

export const MAX_CAPTURE_URL_CHARS = 2_000_000;

export function canvasOf(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
}

export function encodeWithin(canvas: HTMLCanvasElement, maxChars: number = MAX_CAPTURE_URL_CHARS): string {
  for (const quality of FALLBACK_QUALITIES) {
    const url = canvas.toDataURL("image/jpeg", quality);
    if (url.length <= maxChars) return url;
  }
  const half = canvasOf(canvas.width / 2, canvas.height / 2);
  half.getContext("2d")!.drawImage(canvas, 0, 0, half.width, half.height);
  return encodeWithin(half, maxChars);
}
