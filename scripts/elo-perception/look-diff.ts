import type { ImageSurface, Layer } from "@/lib/studio/document";
import type { Effect } from "@/lib/studio/layer-paint";
import { rounded } from "@/lib/studio/agent/perception";

const BOX_FIELDS = ["x", "y", "w", "h", "rotation", "opacity"] as const;
const STYLE_FIELDS = ["fill", "stroke", "strokeWidth", "fontSize", "fontWeight", "text", "radius", "blendMode"] as const;
const EFFECT_FIELDS = ["x", "y", "blur", "spread", "opacity", "color"] as const;
const KIND_NAMES: Record<string, string> = { text: "texto", image: "imagem", shape: "forma", icon: "ícone" };
const EFFECT_NAMES: Record<string, string> = { "drop-shadow": "sombra", "inner-shadow": "sombra interna", "outer-glow": "brilho", "inner-glow": "brilho interno" };

function shown(value: unknown): string {
  if (value === undefined) return "nada";
  return typeof value === "number" ? String(rounded(value, 3)) : JSON.stringify(value);
}

function changes(name: string, before: Record<string, unknown>, after: Record<string, unknown>, fields: readonly string[]): string[] {
  return fields.filter((field) => before[field] !== after[field]).map((field) => `${name}${field} ${shown(before[field])}→${shown(after[field])}`);
}

function effectChanges(before: readonly Effect[], after: readonly Effect[]): string[] {
  const ids = [...new Set([...before, ...after].map((effect) => effect.id))];
  return ids.flatMap((id) => {
    const [old, now] = [before.find((e) => e.id === id), after.find((e) => e.id === id)];
    const label = EFFECT_NAMES[(now ?? old)!.type] ?? (now ?? old)!.type;
    if (!old) return [`${label} ${id} nova`];
    if (!now) return [`${label} ${id} removida`];
    const fields = changes("", old as unknown as Record<string, unknown>, now as unknown as Record<string, unknown>, EFFECT_FIELDS);
    return fields.length > 0 ? [`${label} ${id}: ${fields.join(", ")}`] : [];
  });
}

function layerChanges(before: Layer, after: Layer, z: [number, number]): string[] {
  const parts = [
    ...changes("", before.transform as unknown as Record<string, unknown>, after.transform as unknown as Record<string, unknown>, BOX_FIELDS),
    ...changes("", before as unknown as Record<string, unknown>, after as unknown as Record<string, unknown>, STYLE_FIELDS),
    ...(before.hidden !== after.hidden ? [after.hidden ? "escondida" : "visível"] : []),
    ...(z[0] !== z[1] ? [`ordem ${z[0]}→${z[1]}`] : []),
    ...effectChanges(before.effects ?? [], after.effects ?? []),
  ];
  return parts.length > 0 ? [`${after.id}: ${parts.join("; ")}`] : [];
}

export function lookDiff(before: ImageSurface, after: ImageSurface): string[] {
  const old = new Map(before.layers.map((layer, z) => [layer.id, { layer, z }]));
  const added = after.layers.filter((layer) => !old.has(layer.id)).map((layer) => `nova: ${layer.id} (${KIND_NAMES[layer.type] ?? layer.type})`);
  const removed = before.layers.filter((layer) => !after.layers.some((l) => l.id === layer.id)).map((layer) => `removida: ${layer.id}`);
  const kept = after.layers.filter((layer) => old.has(layer.id));
  const keptBefore = before.layers.filter((layer) => kept.some((l) => l.id === layer.id));
  const changed = kept
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id))
    .flatMap((layer) => layerChanges(old.get(layer.id)!.layer, layer, [keptBefore.findIndex((l) => l.id === layer.id), kept.indexOf(layer)]));
  return [...added, ...removed, ...changed];
}
