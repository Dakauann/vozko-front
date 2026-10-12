import { describe, expect, it } from "vitest";

import { moveLayersToArtboard } from "./artboards";
import { componentOf, resolvedSurface } from "./components";
import {
  addInstance,
  clipboardComponents,
  createComponent,
  detachInstance,
  pastedContent,
  resetOverrides,
  setComponent,
  setOverrides,
  settleComponents,
  swapComponent,
} from "./component-edits";
import { imageDocument, type Artboard, type ImageDocument, type Layer, type Transform } from "./document";
import { deleteArtboards, editArtboard } from "./artboards";
import { deleteLayers, updateLayers } from "./layers";
import { documentIssue } from "./validate";

function box(x: number, y: number, w: number, h: number, rotation = 0): Transform {
  return { x, y, w, h, rotation, opacity: 1 };
}

const background: Layer = { id: "bg", type: "shape", shape: "rect", fill: "#eeeeee", transform: box(0.5, 0.5, 1, 1) };
const button: Layer = { id: "btn", type: "shape", shape: "rect", fill: "#111111", radius: 0.5, transform: box(0.5, 0.8, 0.4, 0.1), groupId: "cta" };
const label: Layer = { id: "label", type: "text", text: "Saiba mais", fontId: "inter", fontSize: 0.03, fill: "#ffffff", transform: box(0.5, 0.8, 0.3, 0.05), groupId: "cta" };
const title: Layer = { id: "title", type: "text", text: "Oferta", fontId: "inter", fontSize: 0.08, fill: "#111111", transform: box(0.5, 0.3, 0.8, 0.12) };

function post(layers: Layer[] = [background, button, label, title]): Artboard {
  return { id: "post", x: 0, y: 0, canvas: { width: 1000, height: 1000, background: "#ffffff" }, layers, groups: [{ id: "cta" }] };
}

function made(doc: ImageDocument = imageDocument([post()])) {
  const result = createComponent(doc, ["btn", "label"], "Botão");
  if (!result.ok) throw new Error(result.reason);
  return result;
}

function host(doc: ImageDocument): Artboard {
  return doc.artboards.find((a) => a.id === "post")!;
}

function instanceOf(doc: ImageDocument): Layer {
  return host(doc).layers.find((l) => l.type === "instance")!;
}

describe("creating a component", () => {
  it("moves the selection into a component artboard and leaves an instance that draws the same", () => {
    const { document, componentId, instanceId } = made();
    expect(documentIssue("image", document)).toBeNull();
    const component = componentOf(document, componentId)!;
    expect(component.name).toBe("Botão");
    expect(component.canvas).toEqual({ width: 400, height: 100, background: "" });
    expect(component.layers.map((l) => l.id)).toEqual(["btn", "label"]);
    expect(host(document).layers.map((l) => l.id)).toEqual(["bg", instanceId, "title"]);
    const parts = resolvedSurface(document, host(document)).layers.filter((l) => l.id.startsWith(`${instanceId};`));
    expect(parts.map((p) => p.id)).toEqual([`${instanceId};btn`, `${instanceId};label`]);
    for (const [part, original] of [[parts[0], button], [parts[1], label]] as const) {
      expect(part.transform.x).toBeCloseTo(original.transform.x, 6);
      expect(part.transform.y).toBeCloseTo(original.transform.y, 6);
      expect(part.transform.w).toBeCloseTo(original.transform.w, 6);
      expect(part.transform.h).toBeCloseTo(original.transform.h, 6);
    }
    expect(parts[1].fontSize).toBeCloseTo(0.03, 6);
  });

  it("pads a small selection up to the smallest artboard side", () => {
    const tiny: Layer = { ...title, id: "tiny", transform: box(0.5, 0.5, 0.05, 0.02) };
    const result = createComponent(imageDocument([post([background, tiny])]), ["tiny"]);
    if (!result.ok) throw new Error(result.reason);
    const component = componentOf(result.document, result.componentId)!;
    expect(component.canvas.width).toBe(100);
    expect(component.canvas.height).toBe(100);
    const [part] = resolvedSurface(result.document, host(result.document)).layers.filter((l) => l.id.includes(";"));
    expect(part.transform.w).toBeCloseTo(0.05, 6);
    expect(part.transform.x).toBeCloseTo(0.5, 6);
  });

  it("keeps the instance inside the group the selection lived in", () => {
    const result = createComponent(imageDocument([post()]), ["btn"]);
    if (!result.ok) throw new Error(result.reason);
    expect(host(result.document).layers.find((l) => l.id === result.instanceId)?.groupId).toBe("cta");
  });

  it("refuses locked layers, instances and selections inside a component", () => {
    expect(createComponent(imageDocument([post([background, { ...button, locked: true }, label, title])]), ["btn"])).toEqual({ ok: false, reason: "locked" });
    const { document, instanceId, componentId } = made();
    expect(createComponent(document, [instanceId])).toEqual({ ok: false, reason: "instance" });
    expect(createComponent(document, ["btn"])).toEqual({ ok: false, reason: "component" });
    expect(createComponent(document, ["ghost"])).toEqual({ ok: false, reason: "missing" });
    expect(componentOf(document, componentId)).toBeDefined();
  });
});

describe("instances", () => {
  it("are added at the component size, fitted inside the artboard", () => {
    const { document, componentId } = made();
    const added = addInstance(document, "post", componentId);
    if (!added.ok) throw new Error(added.reason);
    const layer = host(added.document).layers.at(-1)!;
    expect(layer).toMatchObject({ id: added.instanceId, type: "instance", componentId });
    expect(layer.transform).toEqual(box(0.5, 0.5, 0.4, 0.1));
    const wide = addInstance(document, "post", componentId, { x: 0.2, w: 0.8 });
    if (!wide.ok) throw new Error(wide.reason);
    expect(host(wide.document).layers.at(-1)!.transform).toEqual(box(0.2, 0.5, 0.8, 0.2));
  });

  it("are refused inside a component or without one", () => {
    const { document, componentId } = made();
    expect(addInstance(document, componentId, componentId)).toEqual({ ok: false, reason: "component" });
    expect(addInstance(document, "post", "post")).toEqual({ ok: false, reason: "missing" });
  });

  it("cannot be moved into a component artboard", () => {
    const { document, componentId, instanceId } = made();
    expect(moveLayersToArtboard(document, [instanceId], componentId, "keep-relative")).toBe(document);
  });
});

describe("overrides", () => {
  it("stay sparse: a value equal to the main layer clears the override", () => {
    const { document, instanceId } = made();
    const set = setOverrides(document, instanceId, "label", { text: "Compre agora", fill: "#ffffff" });
    if (!set.ok) throw new Error(set.reason);
    expect(instanceOf(set.document).overrides).toEqual([{ layerId: "label", text: "Compre agora" }]);
    const back = setOverrides(set.document, instanceId, `${instanceId};label`, { text: "Saiba mais" });
    if (!back.ok) throw new Error(back.reason);
    expect(instanceOf(back.document).overrides).toBeUndefined();
  });

  it("refuse fields the main layer cannot take and values that would break it", () => {
    const { document, instanceId } = made();
    expect(setOverrides(document, instanceId, "btn", { text: "Oi" })).toEqual({ ok: false, reason: "field" });
    expect(setOverrides(document, instanceId, "label", { fill: "vermelho" })).toEqual({ ok: false, reason: "invalid" });
    expect(setOverrides(document, instanceId, "ghost", { hidden: true })).toEqual({ ok: false, reason: "missing" });
    const locked = editArtboard(document, "post", (s) => updateLayers(s, [instanceId], { locked: true }));
    expect(setOverrides(locked, instanceId, "label", { text: "Oi" })).toEqual({ ok: false, reason: "locked" });
  });

  it("reset all, one part or named fields", () => {
    const { document, instanceId } = made();
    const set = setOverrides(document, instanceId, "label", { text: "Compre", italic: true });
    if (!set.ok) throw new Error(set.reason);
    const both = setOverrides(set.document, instanceId, "btn", { fill: "#ff0000" });
    if (!both.ok) throw new Error(both.reason);
    expect(instanceOf(resetOverrides(both.document, instanceId, "label", ["italic"])).overrides).toEqual([{ layerId: "label", text: "Compre" }, { layerId: "btn", fill: "#ff0000" }]);
    expect(instanceOf(resetOverrides(both.document, instanceId, "label")).overrides).toEqual([{ layerId: "btn", fill: "#ff0000" }]);
    expect(instanceOf(resetOverrides(both.document, instanceId)).overrides).toBeUndefined();
  });
});

describe("detaching", () => {
  it("writes the parts as plain layers in a group named after the component", () => {
    const { document, instanceId } = made();
    const set = setOverrides(document, instanceId, "label", { text: "Compre" });
    if (!set.ok) throw new Error(set.reason);
    const detached = detachInstance(set.document, instanceId);
    if (!detached.ok) throw new Error(detached.reason);
    expect(documentIssue("image", detached.document)).toBeNull();
    const layers = host(detached.document).layers;
    expect(layers.some((l) => l.type === "instance")).toBe(false);
    const created = layers.filter((l) => detached.ids.includes(l.id));
    expect(created.map((l) => l.text ?? l.shape)).toEqual(["rect", "Compre"]);
    expect(created.every((l) => l.groupId === detached.groupId && !l.locked)).toBe(true);
    const group = host(detached.document).groups?.find((g) => g.id === detached.groupId);
    expect(group).toMatchObject({ name: "Botão" });
    expect(group?.parentId).toBeUndefined();
    expect(created[1].transform.x).toBeCloseTo(label.transform.x, 6);
  });
});

describe("swapping", () => {
  it("keeps the center and width and carries overrides to layers of the same name and type", () => {
    const { document, componentId, instanceId } = made();
    const other: Artboard = { id: "badge", component: true, x: 0, y: 2000, canvas: { width: 200, height: 200, background: "" }, layers: [{ ...label, id: "caption", name: "Texto", groupId: undefined, transform: box(0.5, 0.5, 1, 0.5) }] };
    const named = editArtboard({ ...document, artboards: [...document.artboards, other] }, componentId, (s) => updateLayers(s, ["label"], { name: "Texto" }));
    const set = setOverrides(named, instanceId, "label", { text: "Compre", fontWeight: 700 });
    if (!set.ok) throw new Error(set.reason);
    const swapped = swapComponent(set.document, instanceId, "badge");
    if (!swapped.ok) throw new Error(swapped.reason);
    const layer = instanceOf(swapped.document);
    expect(layer.componentId).toBe("badge");
    expect(layer.transform).toEqual(box(0.5, 0.8, 0.4, 0.4));
    expect(layer.overrides).toEqual([{ layerId: "caption", text: "Compre", fontWeight: 700 }]);
    expect(swapComponent(set.document, instanceId, "post")).toEqual({ ok: false, reason: "missing" });
  });
});

describe("the component flag", () => {
  it("cannot be set on an artboard that holds instances", () => {
    const { document, componentId } = made();
    expect(setComponent(document, "post", true)).toEqual({ ok: false, reason: "instance" });
    const off = setComponent(document, componentId, false);
    if (!off.ok) throw new Error(off.reason);
    expect(componentOf(off.document, componentId)).toBeUndefined();
  });
});

describe("settling", () => {
  it("leaves untouched documents alone", () => {
    const { document } = made();
    expect(settleComponents(document, document)).toBe(document);
    const moved = editArtboard(document, "post", (s) => updateLayers(s, ["title"], { fill: "#ff0000" }));
    expect(settleComponents(document, moved)).toBe(moved);
  });

  it("detaches instances whose component is deleted or unflagged", () => {
    const { document, componentId } = made();
    for (const after of [deleteArtboards(document, [componentId]), (setComponent(document, componentId, false) as { document: ImageDocument }).document]) {
      const settled = settleComponents(document, after);
      expect(documentIssue("image", settled)).toBeNull();
      expect(host(settled).layers.some((l) => l.type === "instance")).toBe(false);
      expect(host(settled).layers.filter((l) => l.text === "Saiba mais")).toHaveLength(1);
    }
  });

  it("prunes overrides of deleted main layers and of paints the main no longer has", () => {
    const { document, componentId, instanceId } = made();
    const set = setOverrides(document, instanceId, "label", { text: "Compre" });
    if (!set.ok) throw new Error(set.reason);
    const withFill = setOverrides(set.document, instanceId, "btn", { fill: "#ff0000" });
    if (!withFill.ok) throw new Error(withFill.reason);
    const deleted = editArtboard(withFill.document, componentId, (s) => deleteLayers(s, ["label"]));
    expect(instanceOf(settleComponents(withFill.document, deleted)).overrides).toEqual([{ layerId: "btn", fill: "#ff0000" }]);
    const gradient = editArtboard(withFill.document, componentId, (s) => updateLayers(s, ["btn"], { gradient: { from: "#000000", to: "#ffffff", angle: 0 } }));
    expect(instanceOf(settleComponents(withFill.document, gradient)).overrides).toEqual([{ layerId: "label", text: "Compre" }]);
  });

  it("detaches an instance that lands inside a component", () => {
    const { document, componentId, instanceId } = made();
    const nested = { ...document, artboards: document.artboards.map((a) => (a.id === componentId ? { ...a, layers: [...a.layers, instanceOf(document)] } : a.id === "post" ? { ...a, layers: a.layers.filter((l) => l.id !== instanceId) } : a)) };
    const settled = settleComponents(document, nested);
    expect(documentIssue("image", settled)).toBeNull();
    expect(componentOf(settled, componentId)!.layers.some((l) => l.type === "instance")).toBe(false);
  });
});

describe("copy and paste", () => {
  it("carry the components and keep the link when the project has them", () => {
    const { document, componentId, instanceId } = made();
    const copied = { layers: [instanceOf(document)], groups: [], components: clipboardComponents(document, [instanceOf(document)]) };
    expect(copied.components.map((c) => c.id)).toEqual([componentId]);
    expect(pastedContent(document, "post", copied).layers).toEqual([instanceOf(document)]);
    const foreign = imageDocument([post([background])]);
    const pasted = pastedContent(foreign, "post", copied);
    expect(pasted.layers.some((l) => l.type === "instance")).toBe(false);
    expect(pasted.layers.map((l) => l.text ?? l.shape)).toEqual(["rect", "Saiba mais"]);
    expect(pasted.groups).toHaveLength(1);
    expect(pastedContent(document, componentId, copied).layers.some((l) => l.type === "instance" || l.id === instanceId)).toBe(false);
  });
});
