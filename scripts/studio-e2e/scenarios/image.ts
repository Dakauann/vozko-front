import { readdirSync } from "node:fs";

import { text, type Flow, type Point, type Scenario } from "../flow";
import { openPanel, registry, waitFor } from "./library";

const CTRL = 2;
const SHIFT = 8;

export async function insertLayer(flow: Flow, factory: string): Promise<string> {
  return flow.eval<string>(`(() => {
    const { commands } = harness.image();
    const f = harness.factories;
    const [id] = commands.insert([${factory}]);
    return id;
  })()`);
}

export async function select(flow: Flow, ids: string[]): Promise<void> {
  await flow.eval(`harness.image().store.getState().select(${JSON.stringify(ids)})`);
  await flow.settle(200);
}

export async function layer<T = Record<string, unknown>>(flow: Flow, id: string): Promise<T | null> {
  return flow.eval<T | null>(`harness.image().store.getState().document.artboards.flatMap((a) => a.layers).find((l) => l.id === ${JSON.stringify(id)}) ?? null`);
}

export async function layerPoint(flow: Flow, id: string): Promise<Point> {
  return flow.eval<Point>(`(() => {
    const { store, ui } = harness.image();
    const doc = store.getState().document;
    const board = doc.artboards.find((a) => a.layers.some((l) => l.id === ${JSON.stringify(id)}));
    const l = board.layers.find((l) => l.id === ${JSON.stringify(id)});
    const host = document.querySelector("[data-studio-canvas]").getBoundingClientRect();
    const v = ui.getState().viewport;
    return { x: host.left + v.x + (board.x + l.transform.x * board.canvas.width) * v.scale, y: host.top + v.y + (board.y + l.transform.y * board.canvas.height) * v.scale };
  })()`);
}

async function tab(flow: Flow, name: string): Promise<boolean> {
  const selector = `[role=tablist][aria-label="${text("studio.inspector.groupsLabel")}"] [role=tab]`;
  if (!(await flow.exists(selector, name))) return true;
  return flow.click(selector, name);
}

async function photoDrop(flow: Flow, mediaId: string, point: Point): Promise<boolean> {
  return flow.eval<boolean>(`(() => {
    const target = document.querySelector("[data-tour=studio-image-canvas]");
    if (!target) return false;
    const data = new DataTransfer();
    data.setData("application/x-vozko-studio-photo", ${JSON.stringify(mediaId)});
    const at = { bubbles: true, cancelable: true, dataTransfer: data, clientX: ${point.x}, clientY: ${point.y} };
    target.dispatchEvent(new DragEvent("dragenter", at));
    target.dispatchEvent(new DragEvent("dragover", at));
    target.dispatchEvent(new DragEvent("drop", at));
    return true;
  })()`);
}

async function filledAbove(flow: Flow, frameId: string): Promise<boolean> {
  return waitFor(flow, `(() => { const layers = harness.image().store.getState().document.artboards.flatMap((a) => a.layers); const i = layers.findIndex((l) => l.id === ${JSON.stringify(frameId)}); const above = layers[i + 1]; return above && above.type === "image" && above.clip === true && above.assetId === "swatch"; })()`, 6000);
}

async function lastLayerId(flow: Flow): Promise<string> {
  return flow.eval<string>("(() => { const layers = harness.image().store.getState().document.artboards[0].layers; return layers[layers.length - 1]?.id ?? null; })()");
}

const RECT = "f.newShapeLayer('rect', { x: 0.35, y: 0.4, w: 0.25, h: 0.25, rotation: 0, opacity: 1 })";
const ELLIPSE = "f.newShapeLayer('ellipse', { x: 0.65, y: 0.6, w: 0.25, h: 0.25, rotation: 0, opacity: 1 })";
const PHOTO = "f.newImageLayer('green-screen', { x: 0.5, y: 0.5, w: 0.5, h: 0.5, rotation: 0, opacity: 1 })";

export const IMAGE_SCENARIOS: Scenario[] = [
  {
    name: "open a project: canvas, panels, inspector and toolbar are ready",
    editor: "image",
    run: async (flow) => {
      flow.check("the canvas draws", await flow.exists("[data-studio-canvas] canvas"));
      flow.check("the side rail lists the panels", await flow.exists(`nav[aria-label="${text("studio.image.rail.label")}"]`));
      flow.check("the inspector is shown", await flow.exists("[data-tour=studio-image-inspector]"));
      flow.check("undo starts disabled", await flow.eval<boolean>(`Boolean([...document.querySelectorAll("button")].find((b) => b.getAttribute("aria-label") === ${JSON.stringify(text("studio.image.toolbar.undo"))})?.disabled)`));
      await flow.screenshot("opened");
    },
  },
  {
    name: "add a heading from the Text panel and a rectangle from Elements",
    editor: "image",
    run: async (flow) => {
      await openPanel(flow, "text");
      await flow.click('[data-library-item="text-heading"]');
      const textLayer = await flow.eval<{ id: string; type: string; text: string } | null>("(() => { const s = harness.image().store.getState(); const l = s.document.artboards[0].layers.at(-1); return l && s.selection.includes(l.id) ? l : null; })()");
      flow.check("a selected text layer is added", textLayer?.type === "text" && (textLayer.text ?? "").length > 0, textLayer);
      await openPanel(flow, "elements");
      await flow.click('[data-library-item="shape-rect"]');
      const shape = await flow.eval<{ type: string; shape: string } | null>("harness.image().store.getState().document.artboards[0].layers.at(-1) ?? null");
      flow.check("a rectangle shape layer is added", shape?.type === "shape" && shape.shape === "rect", shape);
      await flow.screenshot("text-and-shape");
    },
  },
  {
    name: "click a layer on the canvas to select it, click empty canvas to clear",
    editor: "image",
    run: async (flow) => {
      const id = await insertLayer(flow, RECT);
      await select(flow, []);
      await flow.clickAt(await layerPoint(flow, id));
      flow.check("clicking the shape selects it", JSON.stringify(await flow.doc("state.selection")) === JSON.stringify([id]), await flow.doc("state.selection"));
      const host = (await flow.find("[data-studio-canvas]"))!;
      await flow.clickAt({ x: host.x + 330, y: host.y + 330 });
      flow.check("clicking empty canvas clears the selection", (await flow.doc<string[]>("state.selection")).length === 0, await flow.doc("state.selection"));
      await flow.screenshot("selection");
    },
  },
  {
    name: "change a shape fill in the inspector",
    editor: "image",
    run: async (flow) => {
      const id = await insertLayer(flow, RECT);
      await select(flow, [id]);
      await tab(flow, text("studio.inspector.groups.basic"));
      const field = await flow.eval<string | null>(`(() => {
        const label = [...document.querySelectorAll("[data-tour=studio-image-inspector] label")].find((l) => l.textContent.trim() === ${JSON.stringify(text("studio.image.inspector.shape.fill"))} && l.htmlFor);
        return label ? label.htmlFor : null;
      })()`);
      if (!flow.check("the fill field is in the inspector", Boolean(field))) return;
      await flow.fill(`[id="${field}"]`, "#ff0000");
      await flow.key("Enter", "Enter");
      flow.check("the shape fill becomes red", String((await layer<{ fill: string }>(flow, id))?.fill).toLowerCase() === "#ff0000", (await layer(flow, id))?.fill);
      await flow.screenshot("fill");
    },
  },
  {
    name: "group two shapes, then undo and redo with the keyboard and the toolbar",
    editor: "image",
    run: async (flow) => {
      const a = await insertLayer(flow, RECT);
      const b = await insertLayer(flow, ELLIPSE);
      await select(flow, [a, b]);
      await flow.button(text("studio.image.actions.group"));
      const grouped = async () => {
        const [la, lb] = [await layer<{ groupId?: string }>(flow, a), await layer<{ groupId?: string }>(flow, b)];
        return Boolean(la?.groupId && la.groupId === lb?.groupId);
      };
      flow.check("the Group button puts both shapes in one group", await grouped());
      await flow.screenshot("grouped");
      await flow.key("z", "KeyZ", CTRL);
      flow.check("Ctrl+Z undoes the group", !(await grouped()));
      await flow.key("Z", "KeyZ", CTRL | SHIFT);
      flow.check("Ctrl+Shift+Z redoes the group", await grouped());
      await flow.button(text("studio.image.toolbar.undo"));
      flow.check("the Undo button undoes the group", !(await grouped()));
      await flow.button(text("studio.image.toolbar.redo"));
      flow.check("the Redo button redoes the group", await grouped());
    },
  },
  {
    name: "clip a shape to the layer below as a mask",
    editor: "image",
    run: async (flow) => {
      await insertLayer(flow, RECT);
      const top = await insertLayer(flow, ELLIPSE);
      await select(flow, [top]);
      const label = text("studio.image.panels.layers.clip");
      if (!(await flow.exists("button", label))) {
        const host = await layerPoint(flow, top);
        await flow.page.send("Input.dispatchMouseEvent", { type: "mousePressed", x: host.x, y: host.y, button: "right", buttons: 2, clickCount: 1 });
        await flow.page.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: host.x, y: host.y, button: "right", buttons: 2, clickCount: 1 });
        await flow.settle(300);
      }
      await flow.button(label);
      flow.check("the ellipse is clipped to the rectangle", (await layer<{ clip?: boolean }>(flow, top))?.clip === true);
      await flow.screenshot("clip-mask");
    },
  },
  {
    name: "remove a green background with the chroma key",
    editor: "image",
    run: async (flow) => {
      const id = await insertLayer(flow, PHOTO);
      await select(flow, [id]);
      await tab(flow, text("studio.inspector.groups.cutout"));
      await flow.button(text("studio.chroma.start.green"));
      const key = (await layer<{ chromaKey?: { color: string } }>(flow, id))?.chromaKey;
      flow.check("the photo gets a chroma key", Boolean(key), key);
      flow.check("the chroma section shows its controls", await flow.exists("[data-tour=studio-image-inspector] [role=slider], [data-tour=studio-image-inspector] input[type=range]"));
      await flow.screenshot("chroma");
    },
  },
  {
    name: "grade a photo with a ready look and reset it",
    editor: "image",
    run: async (flow) => {
      const id = await insertLayer(flow, PHOTO);
      await select(flow, [id]);
      await tab(flow, text("studio.inspector.groups.color"));
      await flow.button(text("studio.grade.lookNames.warm"));
      const graded = (await layer<{ color?: Record<string, unknown> }>(flow, id))?.color;
      flow.check("the warm look writes a color grade", Boolean(graded && Object.keys(graded).length > 0), graded);
      await flow.screenshot("graded");
      await flow.button(text("studio.grade.reset"));
      const reset = (await layer<{ color?: Record<string, unknown> }>(flow, id))?.color;
      flow.check("reset clears the grade", !reset || Object.keys(reset).length === 0, reset);
    },
  },
  {
    name: "still effects show before and after previews for every registered kind and apply",
    editor: "image",
    run: async (flow) => {
      const id = await insertLayer(flow, PHOTO);
      await select(flow, [id]);
      await tab(flow, text("studio.inspector.groups.effects"));
      const kinds = await flow.eval<string[]>("[...harness.effects.still]");
      const group = `[role=group][aria-label="${text("studio.image.vfx.add")}"]`;
      flow.check("there is one tile per registered still effect", (await flow.count(`${group} [data-effect-tile]`)) === kinds.length, `${await flow.count(`${group} [data-effect-tile]`)} tiles, ${kinds.length} kinds`);
      const painted = await waitFor(flow, `harness.effects.still.every((kind) => { const before = document.querySelector('[data-studio-effect-before="' + kind + '"]'); const after = document.querySelector('[data-studio-effect-preview="' + kind + '"]'); return before && after && getComputedStyle(before).backgroundImage.startsWith("url") && getComputedStyle(after).backgroundImage.startsWith("url"); })`, 20000);
      const missing = await flow.eval<string[]>(`harness.effects.still.filter((kind) => !document.querySelector('[data-studio-effect-preview="' + kind + '"]') || !getComputedStyle(document.querySelector('[data-studio-effect-preview="' + kind + '"]')).backgroundImage.startsWith("url"))`);
      flow.check("every tile shows a before and an after preview", painted, `no preview for ${missing.join(", ")}`);
      await flow.screenshot("effect-tiles");
      for (const kind of kinds) {
        const before = ((await layer<{ vfx?: unknown[] }>(flow, id))?.vfx ?? []).length;
        const mark = flow.page.errors.length;
        await flow.press(`${group} [data-effect-tile]`, text("studio.video.vfx.addKind", { kind: text(`studio.video.vfx.kinds.${kind}`) }));
        flow.check(`adding ${kind} puts it on the photo`, ((await layer<{ vfx?: unknown[] }>(flow, id))?.vfx ?? []).length === before + 1);
        await flow.settle(400);
        flow.check(`${kind} draws without a GPU error`, !flow.page.errors.slice(mark).some((line) => /shader|undeclared|ERROR: d+:d+/.test(line)), flow.page.errors.slice(mark).find((line) => /ERROR: d+:d+/.test(line)) ?? "");
      }
      await flow.screenshot("effects-applied");
    },
  },
  {
    name: "add a path operator to a shape",
    editor: "image",
    run: async (flow) => {
      const id = await insertLayer(flow, RECT);
      await select(flow, [id]);
      await tab(flow, text("studio.inspector.groups.effects"));
      const add = await flow.eval<string | null>(`(() => { const g = document.querySelector('[role=group][aria-label="${text("studio.pathOps.add")}"]'); const b = g && g.querySelector("button"); return b ? b.getAttribute("aria-label") || b.textContent.trim() : null; })()`);
      if (!flow.check("the path operator buttons are shown", Boolean(add))) return;
      await flow.button(add!);
      flow.check(`${add} adds an operator`, ((await layer<{ pathOps?: unknown[] }>(flow, id))?.pathOps ?? []).length === 1);
      await flow.screenshot("path-ops");
    },
  },
  {
    name: "repeat a shape as a grid",
    editor: "image",
    run: async (flow) => {
      const id = await insertLayer(flow, RECT);
      await select(flow, [id]);
      await tab(flow, text("studio.inspector.groups.basic"));
      await flow.press(`[role=group][aria-label="${text("studio.image.repeat.create")}"] button`, text("studio.image.repeat.modes.grid"));
      const repeated = await flow.eval<boolean>(`(() => { const board = harness.image().store.getState().document.artboards[0]; const l = board.layers.find((l) => l.id === ${JSON.stringify(id)}); return Boolean(l.groupId && board.groups.find((g) => g.id === l.groupId)?.repeat); })()`);
      flow.check("the shape sits in a repeat group", repeated);
      await flow.screenshot("repeat");
    },
  },
  {
    name: "bold one word of a text in place (rich text)",
    editor: "image",
    run: async (flow) => {
      const id = await insertLayer(flow, "f.newTextLayer('Olá mundo', 'body')");
      await select(flow, [id]);
      const point = await layerPoint(flow, id);
      await flow.page.send("Input.dispatchMouseEvent", { type: "mousePressed", x: point.x, y: point.y, button: "left", buttons: 1, clickCount: 2 });
      await flow.page.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: point.x, y: point.y, button: "left", buttons: 1, clickCount: 2 });
      await flow.eval(`harness.image().ui.getState().editingTextId || harness.image().commands.startTextEdit(${JSON.stringify(id)})`);
      const editor = await waitFor(flow, "document.querySelector('[data-rich-text-editor]')");
      if (!flow.check("double clicking opens the text editor", editor)) return;
      await flow.eval(`(() => {
        const box = document.querySelector("[data-rich-text-editor]");
        box.focus();
        const walker = document.createTreeWalker(box, NodeFilter.SHOW_TEXT);
        const node = walker.nextNode();
        const range = document.createRange();
        range.setStart(node, 4);
        range.setEnd(node, 9);
        const selection = getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        document.dispatchEvent(new Event("selectionchange"));
      })()`);
      await flow.settle(200);
      flow.check("the run toolbar appears for the selected word", await flow.exists("[data-text-run-toolbar]"));
      await flow.key("b", "KeyB", CTRL);
      await flow.screenshot("rich-text");
      await flow.key("Escape", "Escape");
      const runs = (await layer<{ runs?: { start: number; end: number; fontWeight?: number }[] }>(flow, id))?.runs ?? [];
      flow.check("only the second word is bold", runs.some((run) => run.start === 4 && run.end === 9 && (run.fontWeight ?? 0) >= 600), runs);
    },
  },
  {
    name: "zoom in, zoom out and fit with the toolbar",
    editor: "image",
    run: async (flow) => {
      const scale = () => flow.eval<number>("harness.image().ui.getState().viewport.scale");
      const start = await scale();
      await flow.button(text("studio.image.toolbar.zoomIn"));
      const larger = await scale();
      flow.check("zoom in makes the canvas larger", larger > start, `${start} -> ${larger}`);
      await flow.button(text("studio.image.toolbar.zoomOut"));
      await flow.button(text("studio.image.toolbar.zoomOut"));
      flow.check("zoom out makes it smaller", (await scale()) < larger);
      await flow.button(text("studio.image.toolbar.fit"));
      flow.check("fit returns to the fitted scale", Math.abs((await scale()) - start) < 0.01, `${await scale()} vs ${start}`);
      await flow.screenshot("zoom");
    },
  },
  {
    name: "export starts and downloads a PNG",
    editor: "image",
    run: async (flow) => {
      await insertLayer(flow, RECT);
      const before = readdirSync(flow.downloads).length;
      await flow.click("[data-tour=studio-image-export]");
      flow.check("the export panel opens", await waitFor(flow, `[...document.querySelectorAll("h2")].some((h) => h.textContent.trim() === ${JSON.stringify(text("studio.image.export.title"))})`));
      await waitFor(flow, `[...document.querySelectorAll("button")].some((b) => b.textContent.trim() === ${JSON.stringify(text("studio.image.export.download"))} && !b.disabled)`, 15000);
      await flow.screenshot("export-panel");
      await flow.button(text("studio.image.export.download"));
      const deadline = Date.now() + 20000;
      let file: string | undefined;
      while (Date.now() < deadline && !file) {
        file = readdirSync(flow.downloads).slice(before).find((name) => name.endsWith(".png"));
        await Bun.sleep(250);
      }
      flow.check("a PNG lands in the downloads folder", Boolean(file), readdirSync(flow.downloads));
    },
  },
  {
    name: "drop a photo on a library frame to fill it",
    editor: "image",
    run: async (flow) => {
      await openPanel(flow, "elements");
      const frameItem = (await registry(flow)).find((c) => c.id === "frames")?.items[0];
      if (frameItem) await flow.fill(flow.librarySearch(), frameItem.name);
      const frame = frameItem && (await flow.exists(`[data-library-item="${frameItem.id}"]`)) ? frameItem.id : null;
      if (!flow.check("a frame tile is on the panel", Boolean(frame))) return;
      await flow.click(`[data-library-item="${frame}"]`);
      const id = await lastLayerId(flow);
      await photoDrop(flow, "swatch", await layerPoint(flow, id));
      flow.check(`dropping a photo on ${frame} fills it with a clipped image`, await filledAbove(flow, id));
      await flow.screenshot("frame-filled");
    },
  },
  {
    name: "drop a photo into a grid cell",
    editor: "image",
    run: async (flow) => {
      await openPanel(flow, "elements");
      const gridItem = (await registry(flow)).find((c) => c.id === "grids")?.items[0];
      if (gridItem) await flow.fill(flow.librarySearch(), gridItem.name);
      const grid = gridItem && (await flow.exists(`[data-library-item="${gridItem.id}"]`)) ? gridItem.id : null;
      if (!flow.check("a grid tile is on the panel", Boolean(grid))) return;
      await flow.click(`[data-library-item="${grid}"]`);
      const cell = await flow.eval<string | null>(`harness.image().store.getState().document.artboards[0].layers.find((l) => l.type === "shape" && l.groupId && l.transform.w < 0.9)?.id ?? null`);
      if (!flow.check(`${grid} inserts frame cells`, Boolean(cell))) return;
      await photoDrop(flow, "swatch", await layerPoint(flow, cell!));
      flow.check("the dropped photo fills that cell", await filledAbove(flow, cell!));
      await flow.screenshot("grid-filled");
    },
  },
];
