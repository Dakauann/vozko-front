import { IMAGE_DOCUMENT_VERSION, IMAGE_SCHEMA, STUDIO_LIMITS, type Artboard, type ImageSurface, type Layer, type StudioGroup } from "./document";
import { ancestry, baseOf, familyOf, groupParents } from "./groups";
import { linksOf, withoutLinks, type StudioStyle } from "./shared-styles";
import { parseDocument } from "./validate";

export const CLIPBOARD_PREFIX = "vozko-studio-layers:";

export interface ClipboardContent {
  layers: Layer[];
  groups: StudioGroup[];
  components?: Artboard[];
  styles?: StudioStyle[];
}

export function clipboardOf(doc: ImageSurface, ids: readonly string[]): ClipboardContent {
  const wanted = new Set(familyOf(doc, ids));
  const parents = groupParents(doc);
  const travels = (groupId: string) => {
    const base = baseOf(doc, groupId);
    return base === null || wanted.has(base);
  };
  const nearest = (groupId: string | null | undefined) => ancestry(parents, groupId).find(travels);
  const layers = doc.layers
    .filter((l) => wanted.has(l.id))
    .map((l): Layer => {
      const copy: Layer = { ...l };
      const groupId = nearest(l.groupId);
      if (groupId) copy.groupId = groupId;
      else delete copy.groupId;
      return copy;
    });
  const used = new Set(layers.flatMap((l) => ancestry(parents, l.groupId).filter(travels)));
  const groups = (doc.groups ?? [])
    .filter((g) => used.has(g.id))
    .map((g): StudioGroup => {
      const copy: StudioGroup = { ...g };
      const parentId = nearest(parents.get(g.id));
      if (parentId) copy.parentId = parentId;
      else delete copy.parentId;
      return copy;
    });
  return { layers, groups };
}

export function encodeClipboard(content: ClipboardContent): string {
  return `${CLIPBOARD_PREFIX}${JSON.stringify(content)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function decodeClipboard(text: string): ClipboardContent | null {
  if (!text.startsWith(CLIPBOARD_PREFIX) || text.length - CLIPBOARD_PREFIX.length > STUDIO_LIMITS.maxDocumentBytes) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(text.slice(CLIPBOARD_PREFIX.length));
  } catch {
    return null;
  }
  if (!isRecord(raw) || !Array.isArray(raw.layers) || raw.layers.length === 0) return null;
  if (Object.keys(raw).some((key) => key !== "layers" && key !== "groups" && key !== "components" && key !== "styles")) return null;
  if ((raw.components !== undefined && !Array.isArray(raw.components)) || (raw.styles !== undefined && !Array.isArray(raw.styles))) return null;
  const plain = (layer: unknown) => (isRecord(layer) ? withoutLinks(layer as unknown as Layer) : layer);
  const components = ((raw.components as unknown[] | undefined) ?? []).map((component) => (isRecord(component) && Array.isArray(component.layers) ? { ...component, layers: component.layers.map(plain) } : component));
  const parsed = parseDocument("image", {
    schema: IMAGE_SCHEMA,
    version: IMAGE_DOCUMENT_VERSION,
    artboards: [
      {
        id: "clipboard",
        x: 0,
        y: 0,
        canvas: { width: STUDIO_LIMITS.minCanvasSide, height: STUDIO_LIMITS.minCanvasSide, background: "" },
        layers: raw.layers.map(plain),
        ...(raw.groups === undefined ? {} : { groups: raw.groups }),
      },
      ...components,
    ],
    ...(raw.styles === undefined ? {} : { styles: raw.styles }),
  });
  if (!parsed.ok) return null;
  const [pasted, ...snapshots] = parsed.document.artboards;
  if (snapshots.some((c) => !c.component)) return null;
  const layers = pasted.layers.map((layer, i) => ({ ...layer, ...linksOf((raw.layers as unknown[])[i]) }));
  const styles = parsed.document.styles ?? [];
  return { layers, groups: pasted.groups ?? [], ...(snapshots.length > 0 ? { components: snapshots } : {}), ...(styles.length > 0 ? { styles } : {}) };
}
