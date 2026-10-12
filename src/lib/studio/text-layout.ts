import type { TextAlign } from "./document";
import type { LaidLine } from "./text-animation";

export interface TextFlow {
  lines: readonly { text: string; width: number }[];
  align: TextAlign;
  box: { x: number; y: number; width: number; height: number };
  lineHeightPx: number;
  letterSpacingPx: number;
  measure: (text: string) => number;
}

function lineStart(flow: TextFlow, width: number): number {
  if (flow.align === "center") return flow.box.x + (flow.box.width - width) / 2;
  if (flow.align === "right") return flow.box.x + flow.box.width - width;
  return flow.box.x;
}

export function laidLines(flow: TextFlow): LaidLine[] {
  const top = flow.box.y + (flow.box.height - flow.lines.length * flow.lineHeightPx) / 2;
  return flow.lines.map((line, index) => {
    const start = lineStart(flow, line.width);
    const letters = [...line.text];
    return {
      top: top + index * flow.lineHeightPx,
      height: flow.lineHeightPx,
      chars: letters.map((char, i) => {
        const left = start + flow.measure(letters.slice(0, i).join("")) + i * flow.letterSpacingPx;
        return { char, left, right: left + flow.measure(char) };
      }),
    };
  });
}
