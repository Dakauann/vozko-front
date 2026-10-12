function svgCursor(body: string, fallback: string): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 20 20'>${body}</svg>`;
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}") 10 10, ${fallback}`;
}

function outlined(path: string): string {
  return `<path d='${path}' fill='none' stroke='black' stroke-width='3'/><path d='${path}' fill='none' stroke='white' stroke-width='1.2'/>`;
}

const SIDE_ARROWS = "<path d='M1 10l3.5-3.5v7zM19 10l-3.5-3.5v7z' fill='white' stroke='black' stroke-width='1'/>";

export const BLADE_CURSOR = svgCursor(`${outlined("M10 1v18")}<path d='M6 4h8l-2 4h-4z' fill='white' stroke='black' stroke-width='1'/>`, "crosshair");

export const ROLL_CURSOR = svgCursor(`${outlined("M6 3h3v14H6M14 3h-3v14h3")}${SIDE_ARROWS}`, "col-resize");

export const SLIDE_CURSOR = svgCursor(`${outlined("M8 5H6v10h2M12 5h2v10h-2M4 10h2M14 10h2")}${SIDE_ARROWS}`, "ew-resize");
