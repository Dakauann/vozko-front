export const MAX_PATH_COORDINATE = 1000;

type Axis = "x" | "y" | "keep" | "flag";

const AXES: Record<string, readonly Axis[]> = {
  m: ["x", "y"],
  l: ["x", "y"],
  t: ["x", "y"],
  h: ["x"],
  v: ["y"],
  c: ["x", "y", "x", "y", "x", "y"],
  s: ["x", "y", "x", "y"],
  q: ["x", "y", "x", "y"],
  a: ["x", "y", "keep", "flag", "flag", "x", "y"],
  z: [],
};

const TOKEN = /[ \t\n\r\f\v,]*([MmLlHhVvCcSsQqTtAaZz]|[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)/y;
const TRAILING = /^[ \t\n\r\f\v,]*$/;

interface Segment {
  command: string;
  values: number[];
}

function segmentsOf(data: string): Segment[] | null {
  const segments: Segment[] = [];
  TOKEN.lastIndex = 0;
  let match: RegExpExecArray | null;
  let end = 0;
  while ((match = TOKEN.exec(data)) !== null) {
    end = TOKEN.lastIndex;
    const token = match[1];
    if (token.toLowerCase() in AXES) {
      segments.push({ command: token, values: [] });
      continue;
    }
    const value = Number(token);
    const current = segments[segments.length - 1];
    if (!current || !Number.isFinite(value) || Math.abs(value) > MAX_PATH_COORDINATE) return null;
    current.values.push(value);
  }
  return TRAILING.test(data.slice(end)) ? segments : null;
}

function segmentValid({ command, values }: Segment): boolean {
  const axes = AXES[command.toLowerCase()];
  if (axes.length === 0) return values.length === 0;
  if (values.length === 0 || values.length % axes.length !== 0) return false;
  return values.every((value, index) => axes[index % axes.length] !== "flag" || value === 0 || value === 1);
}

export function isValidPath(data: string): boolean {
  const segments = segmentsOf(data);
  if (!segments || segments.length === 0 || segments[0].command.toLowerCase() !== "m") return false;
  return segments.every(segmentValid);
}

function tidy(value: number): string {
  return String(Math.round(value * 1e4) / 1e4 || 0);
}

export function scalePath(data: string, width: number, height: number): string {
  const segments = segmentsOf(data) ?? [];
  return segments
    .map(({ command, values }) => {
      const axes = AXES[command.toLowerCase()];
      const scaled = values.map((value, index) => {
        const axis = axes[index % axes.length];
        return tidy(axis === "x" ? value * width : axis === "y" ? value * height : value);
      });
      return `${command}${scaled.join(" ")}`;
    })
    .join(" ");
}
