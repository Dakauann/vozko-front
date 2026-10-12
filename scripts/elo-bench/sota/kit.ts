import type { Layer } from "@/lib/studio/document";

import { CLEAR, path, type Sheet } from "../authoring";
import { source } from "../extended/corpus";

export type Frame = [left: number, top: number, w: number, h: number];

const ARITY: Record<string, number> = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };

interface Command {
  op: string;
  args: number[];
}

function commands(d: string): Command[] {
  const tokens = d.match(/[MLHVCSQTAZ]|-?\d*\.?\d+(?:e-?\d+)?/gi) ?? [];
  const out: Command[] = [];
  let op = "";
  let i = 0;
  while (i < tokens.length) {
    if (/^[A-Za-z]$/.test(tokens[i])) {
      op = tokens[i].toUpperCase();
      i += 1;
      if (op === "Z") {
        out.push({ op, args: [] });
        continue;
      }
    }
    const n = ARITY[op];
    out.push({ op, args: tokens.slice(i, i + n).map(Number) });
    i += n;
    if (op === "M") op = "L";
  }
  return out;
}

function pointsOf(list: readonly Command[]): [number, number][] {
  return list.flatMap(({ op, args }) => {
    if (op === "A") return [[args[5], args[6]] as [number, number]];
    if (op === "H" || op === "V" || op === "Z") return [];
    const pairs: [number, number][] = [];
    for (let k = 0; k + 1 < args.length; k += 2) pairs.push([args[k], args[k + 1]]);
    return pairs;
  });
}

function boundsOf(list: readonly Command[]): Frame {
  const points = pointsOf(list);
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  return [left, top, Math.max(1, Math.max(...xs) - left), Math.max(1, Math.max(...ys) - top)];
}

const fmt = (v: number) => Number(v.toFixed(4)).toString();

function normalized(list: readonly Command[], [left, top, w, h]: Frame): string {
  const x = (v: number) => fmt((v - left) / w);
  const y = (v: number) => fmt((v - top) / h);
  return list
    .map(({ op, args }) => {
      if (op === "Z") return "Z";
      if (op === "H") return `H${x(args[0])}`;
      if (op === "V") return `V${y(args[0])}`;
      if (op === "A") return `A${fmt(args[0] / w)} ${fmt(args[1] / h)} ${args[2]} ${args[3]} ${args[4]} ${x(args[5])} ${y(args[6])}`;
      const pairs: string[] = [];
      for (let k = 0; k + 1 < args.length; k += 2) pairs.push(`${x(args[k])} ${y(args[k + 1])}`);
      return `${op}${pairs.join(" ")}`;
    })
    .join(" ");
}

export function vector(s: Sheet, id: string, d: string, fill: string, extra: Partial<Layer> = {}, frame?: Frame, rotation = 0, opacity = 1): Layer {
  const list = commands(d);
  const box = frame ?? boundsOf(list);
  return path(id, normalized(list, box), s.at(box[0], box[1], box[2], box[3], rotation, opacity), fill, extra);
}

export function line(s: Sheet, id: string, d: string, stroke: string, width: number, extra: Partial<Layer> = {}, frame?: Frame): Layer {
  return vector(s, id, d, CLEAR, { stroke, strokeWidth: width, lineCap: "round", lineJoin: "round", ...extra }, frame);
}

function polar(cx: number, cy: number, r: number, degrees: number): [number, number] {
  const a = (degrees * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

export function sector(s: Sheet, id: string, cx: number, cy: number, outer: number, inner: number, from: number, to: number, fill: string, extra: Partial<Layer> = {}): Layer {
  const sweep = (((to - from) % 360) + 360) % 360;
  const large = sweep > 180 ? 1 : 0;
  const [ax, ay] = polar(cx, cy, outer, from);
  const [bx, by] = polar(cx, cy, outer, to);
  const [chx, chy] = polar(cx, cy, inner, to);
  const [dx, dy] = polar(cx, cy, inner, from);
  const d = `M${ax} ${ay} A${outer} ${outer} 0 ${large} 1 ${bx} ${by} L${chx} ${chy} A${inner} ${inner} 0 ${large} 0 ${dx} ${dy} Z`;
  return vector(s, id, d, fill, extra, [cx - outer, cy - outer, 2 * outer, 2 * outer]);
}

export function arcLine(s: Sheet, id: string, cx: number, cy: number, r: number, from: number, to: number, stroke: string, width: number, extra: Partial<Layer> = {}): Layer {
  const sweep = (((to - from) % 360) + 360) % 360;
  const [ax, ay] = polar(cx, cy, r, from);
  const [bx, by] = polar(cx, cy, r, to);
  return vector(s, id, `M${ax} ${ay} A${r} ${r} 0 ${sweep > 180 ? 1 : 0} 1 ${bx} ${by}`, CLEAR, { stroke, strokeWidth: width, lineCap: "butt", ...extra }, [cx - r, cy - r, 2 * r, 2 * r]);
}

export const dribbble = (slug: string, title: string, popularity: string) => source(`Dribbble (${popularity}, most liked or viewed in its category on 2026-10-11)`, title, `https://dribbble.com/shots/${slug}`);
