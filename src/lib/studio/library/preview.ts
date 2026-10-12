export const PREVIEW_INK = "currentColor";

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

export function previewSvg(body: string, width: number, height = width): string {
  return `<svg xmlns="${SVG_NAMESPACE}" viewBox="0 0 ${width} ${height}" fill="${PREVIEW_INK}" aria-hidden="true">${body}</svg>`;
}
