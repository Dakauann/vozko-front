import { describe, expect, it } from "vitest";

import { componentOf, resolvedSurface } from "../components";
import { emptyArtboard, IMAGE_DOCUMENT_VERSION, IMAGE_SCHEMA, type Artboard, type ImageDocument, type Layer } from "../document";
import { documentIssue } from "../validate";
import { planBatch } from "./batch";
import { applyImageOperation, IMAGE_ID_FIELDS, imageIds, type ImageOpContext, type ImageOperation } from "./image-ops";
import { imageOutline } from "./outline";

function doc(): ImageDocument {
  const main: Artboard = {
    ...emptyArtboard({ width: 1000, height: 1000 }),
    id: "main",
    layers: [
      { id: "pill", type: "shape", shape: "rect", fill: "#111111", transform: { x: 0.5, y: 0.8, w: 0.4, h: 0.1, rotation: 0, opacity: 1 } },
      { id: "label", type: "text", text: "Saiba mais", fontId: "inter", fontSize: 0.03, fill: "#ffffff", transform: { x: 0.5, y: 0.8, w: 0.3, h: 0.05, rotation: 0, opacity: 1 } },
      { id: "photo", type: "image", assetId: "beach", transform: { x: 0.5, y: 0.3, w: 0.2, h: 0.2, rotation: 0, opacity: 1 } },
    ],
  };
  const second: Artboard = { ...emptyArtboard({ width: 1080, height: 1920 }), id: "story", x: 1200 };
  return { schema: IMAGE_SCHEMA, version: IMAGE_DOCUMENT_VERSION, artboards: [main, second] };
}

const ctx: ImageOpContext = {
  naturalSize: (id) => (id === "sunset" || id === "beach" ? { width: 1000, height: 1000 } : undefined),
  icons: ["heart", "star"],
  activeArtboard: "main",
};

function run(ops: ImageOperation[], base: ImageDocument = doc()) {
  return planBatch(base, ops, (d, op) => applyImageOperation(d, op, ctx), IMAGE_ID_FIELDS, imageIds);
}

function done(ops: ImageOperation[], base?: ImageDocument) {
  const plan = run(ops, base);
  if (!plan.ok) throw new Error(`${plan.op}: ${plan.reason}`);
  expect(documentIssue("image", plan.final)).toBeNull();
  return plan;
}

function reason(ops: ImageOperation[], base?: ImageDocument): string {
  const plan = run(ops, base);
  if (plan.ok) throw new Error("expected a refusal");
  return plan.reason;
}

function layersOf(d: ImageDocument, artboardId: string): Layer[] {
  return d.artboards.find((a) => a.id === artboardId)!.layers;
}

const MAKE: ImageOperation = { op: "create_component", ref: "cta", layer_ids: ["pill", "label"], name: "Botão" };

describe("component operations", () => {
  it("make a component from layers and place instances in another artboard", () => {
    const plan = done([MAKE, { op: "add_instance", ref: "copy", component_id: "@cta", artboard_id: "story", y: 0.9, w: 0.6 }]);
    const [instanceId, componentId] = plan.created.cta;
    expect(componentOf(plan.final, componentId)?.name).toBe("Botão");
    expect(layersOf(plan.final, "main").find((l) => l.id === instanceId)?.type).toBe("instance");
    const copy = layersOf(plan.final, "story").find((l) => l.id === plan.created.copy[0])!;
    expect(copy).toMatchObject({ type: "instance", componentId });
    expect(copy.transform.w).toBeCloseTo(0.6);
    expect(copy.transform.y).toBeCloseTo(0.9);
  });

  it("override parts sparsely and reset them", () => {
    const plan = done([
      MAKE,
      { op: "set_overrides", layer_id: "@cta", part_id: "label", text: "Compre agora", font_weight: 700 },
      { op: "set_overrides", layer_id: "@cta", part_id: "pill", fill: "#e4003a" },
      { op: "reset_overrides", layer_id: "@cta", part_id: "label", reset: ["font_weight"] },
    ]);
    const instance = layersOf(plan.final, "main").find((l) => l.type === "instance")!;
    expect(instance.overrides).toEqual([{ layerId: "label", text: "Compre agora" }, { layerId: "pill", fill: "#e4003a" }]);
    const cleared = done([{ op: "reset_overrides", layer_id: instance.id }], plan.final);
    expect(layersOf(cleared.final, "main").find((l) => l.id === instance.id)?.overrides).toBeUndefined();
  });

  it("accept a resolved part id and refuse fields the part cannot take", () => {
    const made = done([MAKE]).final;
    const instance = layersOf(made, "main").find((l) => l.type === "instance")!;
    done([{ op: "set_overrides", layer_id: instance.id, part_id: `${instance.id};label`, hidden: true }], made);
    expect(reason([{ op: "set_overrides", layer_id: instance.id, part_id: "pill", text: "Oi" }], made)).toContain("aceita: fill, hidden");
    expect(reason([{ op: "set_overrides", layer_id: instance.id, part_id: "ghost", hidden: true }], made)).toContain("não é parte");
    expect(reason([{ op: "set_overrides", layer_id: instance.id, part_id: "pill", fill: "vermelho" }], made)).toContain("inválid");
    expect(reason([{ op: "set_overrides", layer_id: "pill", part_id: "pill", fill: "#000000" }], made)).toContain("não é uma instância");
  });

  it("swap photos through the library only", () => {
    const made = done([{ op: "create_component", ref: "card", layer_ids: ["photo"] }]).final;
    const instance = layersOf(made, "main").find((l) => l.type === "instance")!;
    const swapped = done([{ op: "set_overrides", layer_id: instance.id, part_id: "photo", media_id: "sunset" }], made).final;
    expect(layersOf(swapped, "main").find((l) => l.id === instance.id)?.overrides).toEqual([{ layerId: "photo", assetId: "sunset" }]);
    expect(reason([{ op: "set_overrides", layer_id: instance.id, part_id: "photo", media_id: "nowhere" }], made)).toContain("biblioteca");
  });

  it("detach, swap and turn the flag on and off", () => {
    const made = done([MAKE, { op: "add_artboard", ref: "badge", width: 200, height: 200 }, { op: "update_artboard", artboard_id: "@badge", component: true }]);
    const [instanceId, componentId] = made.created.cta;
    const badge = made.created.badge[0];
    const swapped = done([{ op: "swap_component", layer_id: instanceId, component_id: badge }], made.final).final;
    expect(layersOf(swapped, "main").find((l) => l.id === instanceId)?.componentId).toBe(badge);
    const detached = done([{ op: "detach_instance", layer_id: instanceId }], made.final);
    expect(layersOf(detached.final, "main").some((l) => l.type === "instance")).toBe(false);
    const unflagged = done([{ op: "update_artboard", artboard_id: componentId, component: false }], made.final).final;
    expect(layersOf(unflagged, "main").some((l) => l.type === "instance")).toBe(false);
    expect(reason([{ op: "update_artboard", artboard_id: "main", component: true }], made.final)).toContain("instâncias");
  });

  it("refuse structure edits on parts and moves into a component", () => {
    const made = done([MAKE]);
    const [instanceId, componentId] = made.created.cta;
    expect(reason([{ op: "update_layer", layer_id: `${instanceId};label`, text: "Oi" }], made.final)).toContain("set_overrides");
    expect(reason([{ op: "move_to_artboard", layer_ids: [instanceId], artboard_id: componentId }], made.final)).toContain("componente");
    expect(reason([{ op: "create_component", layer_ids: [instanceId] }], made.final)).toContain("instância");
  });

  it("deleting a component detaches its instances in the same step", () => {
    const made = done([MAKE]);
    const [, componentId] = made.created.cta;
    const after = done([{ op: "delete_artboard", artboard_id: componentId }], made.final).final;
    expect(layersOf(after, "main").filter((l) => l.text === "Saiba mais")).toHaveLength(1);
  });

  it("show components, instance counts, overrides and resolved part text in the outline", () => {
    const made = done([MAKE, { op: "set_overrides", layer_id: "@cta", part_id: "label", text: "Compre" }]);
    const [instanceId, componentId] = made.created.cta;
    const outline = imageOutline(made.final, { detail: "summary", asset: () => undefined, playheadMs: 0, selection: [], jobs: [], activeArtboard: "main" });
    const component = outline.artboards.find((a) => a.id === componentId)!;
    expect(component).toMatchObject({ component: true, instances: 1 });
    const instance = outline.artboards.find((a) => a.id === "main")!.layers.find((l) => l.id === instanceId)!;
    expect(instance).toMatchObject({ type: "instance", component: componentId, overrides: [{ part_id: "label", text: "Compre" }] });
    expect(instance.parts).toEqual([
      { id: `${instanceId};pill`, part_id: "pill", type: "shape", fill: "#111111" },
      { id: `${instanceId};label`, part_id: "label", type: "text", text: "Compre", fill: "#ffffff" },
    ]);
    expect(resolvedSurface(made.final, made.final.artboards[0]).layers).toHaveLength(3);
  });
});
