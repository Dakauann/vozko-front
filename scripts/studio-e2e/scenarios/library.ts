import { text, type Editor, type Flow, type Point, type Scenario } from "../flow";

interface RegistryItem {
  id: string;
  kind: string;
  name: string;
  subcategory: string | null;
}

interface RegistryCategory {
  id: string;
  panel: "text" | "elements";
  tile: string;
  name: string;
  items: RegistryItem[];
}

const WAIT_MS = 4000;

export function registry(flow: Flow): Promise<RegistryCategory[]> {
  return flow.eval<RegistryCategory[]>(`harness.registry(${JSON.stringify(flow.editor)})`);
}

export async function openPanel(flow: Flow, panel: "text" | "elements"): Promise<boolean> {
  if (flow.editor === "video") return flow.click(`[data-tour=studio-video-${panel}]`);
  const already = await flow.eval<boolean>(`harness.image().ui.getState().panel === ${JSON.stringify(panel)}`);
  return already || flow.click("nav button", text(`studio.image.rail.${panel}`));
}

export async function size(flow: Flow): Promise<number> {
  return flow.eval<number>("harness.size()");
}

export async function waitFor(flow: Flow, expression: string, timeoutMs = WAIT_MS): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await flow.eval<boolean>(`Boolean(${expression})`).catch(() => false)) return true;
    await Bun.sleep(150);
  }
  return false;
}

export async function canvasCenter(flow: Flow): Promise<Point> {
  const selector = flow.editor === "image" ? "[data-studio-canvas]" : "[data-tour=studio-video-preview]";
  return (await flow.find(selector)) ?? { x: 720, y: 400 };
}

async function prepare(flow: Flow, kind: string): Promise<void> {
  if (flow.editor !== "video" || (kind !== "frame" && kind !== "grid")) return;
  await flow.eval(`(() => {
    const v = harness.video();
    const f = harness.factories;
    const before = new Set(v.root.getState().document.tracks.flatMap((t) => t.clips.map((c) => c.id)));
    v.commands.insertClips([f.newMediaClip("image", "swatch", 0, 3000)]);
    v.store.getState().select(v.root.getState().document.tracks.flatMap((t) => t.clips.map((c) => c.id)).filter((id) => !before.has(id)));
  })()`);
  await flow.settle(200);
}

function changed(flow: Flow, size: number, revision: number): string {
  return `harness.size() > ${size} || harness.${flow.editor}().store.getState().revision !== ${revision}`;
}

async function panelSection(flow: Flow, name: string): Promise<boolean> {
  return flow.eval<boolean>(`(() => {
    const visible = (node) => node.getBoundingClientRect().width > 0;
    const headings = [...document.querySelectorAll("section h3, section[aria-label]")].filter(visible);
    return headings.some((node) => (node.tagName === "H3" ? node.textContent.trim() : node.getAttribute("aria-label")) === ${JSON.stringify(name)});
  })()`);
}

async function clearSearch(flow: Flow): Promise<void> {
  if (await flow.exists("button", text("studio.library.clearSearch"))) await flow.button(text("studio.library.clearSearch"));
}

function everyCategory(editor: Editor): Scenario {
  return {
    name: "elements and text panels show every registered library category",
    editor,
    run: async (flow) => {
      const categories = await registry(flow);
      for (const panel of ["text", "elements"] as const) {
        await openPanel(flow, panel);
        await flow.settle(500);
        for (const category of categories.filter((c) => c.panel === panel)) {
          if (category.items.length === 0) continue;
          flow.check(`${panel} panel shows the ${category.name} section`, await panelSection(flow, category.name), category.id);
        }
        await flow.screenshot(`${panel}-panel`);
      }
    },
  };
}

function search(editor: Editor): Scenario {
  return {
    name: "library search finds items, says when nothing matches and clears",
    editor,
    run: async (flow) => {
      const categories = await registry(flow);
      await openPanel(flow, "elements");
      const shapes = categories.find((c) => c.id === "shapes")?.items[0];
      if (!flow.check("the shapes category has a first item to search for", Boolean(shapes))) return;
      const word = shapes!.name.split(/\s+/)[0];
      await flow.fill(flow.librarySearch(), word);
      await flow.settle(300);
      flow.check(`searching "${word}" shows tiles`, (await flow.count("[data-library-item]:not([hidden])")) > 0);
      flow.check(`searching "${word}" shows the matching shape`, await flow.exists(`[data-library-item="${shapes!.id}"]`));
      await flow.screenshot("search-results");
      await flow.fill(flow.librarySearch(), "zzqxw");
      flow.check("a search with no match says so", await flow.eval<boolean>(`[...document.querySelectorAll("[role=status]")].some((n) => n.getBoundingClientRect().width > 0 && n.textContent.includes(${JSON.stringify(text("studio.library.noResults", { query: "zzqxw" }))}))`));
      await clearSearch(flow);
      flow.check("clearing the search brings the categories back", await panelSection(flow, categories.find((c) => c.id === "shapes")!.name));
    },
  };
}

function categoryViews(editor: Editor): Scenario {
  return {
    name: "each library category opens on its own, with subcategory chips",
    editor,
    run: async (flow) => {
      const categories = await registry(flow);
      for (const category of categories.filter((c) => c.items.length > 0 && c.tile !== "action")) {
        await openPanel(flow, category.panel);
        const seeAll = text("studio.library.seeAllIn", { name: category.name });
        if (!(await flow.exists("button", seeAll))) continue;
        await flow.button(seeAll);
        const shown = await flow.eval<string>(`[...document.querySelectorAll("section[aria-label] .readout")].map((n) => n.textContent.trim()).join(" ")`);
        flow.check(`${category.name} opens with its item count`, shown.replace(/\./g, "").includes(String(category.items.length)), `${shown} vs ${category.items.length}`);
        const chips = await flow.eval<string[]>(`[...document.querySelectorAll("section[aria-label] [role=group] button[aria-pressed]")].map((n) => n.textContent.trim())`);
        if (chips.length > 1) {
          await flow.button(chips[1]);
          flow.check(`${category.name} subcategory chip ${chips[1]} filters`, await flow.eval<boolean>(`[...document.querySelectorAll("button[aria-pressed=true]")].some((n) => n.textContent.trim() === ${JSON.stringify(chips[1])})`));
        }
        await flow.screenshot(`category-${category.id}`);
        await flow.button(text("studio.library.back"));
      }
    },
  };
}

function insertEvery(editor: Editor): Scenario {
  return {
    name: "clicking the first tile of every registered category inserts it",
    editor,
    run: async (flow) => {
      const categories = await registry(flow);
      for (const category of categories.filter((c) => c.items.length > 0)) {
        await openPanel(flow, category.panel);
        await clearSearch(flow);
        const item = category.items[0];
        await prepare(flow, item.kind);
        const before = await size(flow);
        const revision = await flow.doc<number>("state.revision");
        const errors = flow.page.errors.length;
        const tile = await flow.find(`[data-library-item="${item.id}"]`);
        if (!flow.check(`${category.name}: the first tile ${item.id} is on the panel`, Boolean(tile))) continue;
        await flow.clickAt(tile!);
        const grew = await waitFor(flow, changed(flow, before, revision));
        flow.check(`${category.name}: clicking ${item.name} (${item.kind}) changes the document`, grew, `size ${before} -> ${await size(flow)}`);
        flow.check(`${category.name}: inserting ${item.id} logs no console error`, flow.page.errors.length === errors, flow.page.errors.slice(errors).join(" | ").slice(0, 300));
        await flow.screenshot(`insert-${category.id}`);
        flow.check(`${category.name}: the data dialog that opens after inserting ${item.id} closes`, await closeDialog(flow));
      }
    },
  };
}

const COLD_ITEM = "shape-rounded";

function coldFirstClick(editor: Editor): Scenario {
  return {
    name: "the first click on a library tile in a freshly opened panel inserts it once",
    editor,
    run: async (flow) => {
      await openPanel(flow, "elements");
      const before = await size(flow);
      const tile = await flow.find(`[data-library-item="${COLD_ITEM}"]`);
      if (!flow.check(`the ${COLD_ITEM} tile is on the panel right after it opens`, Boolean(tile))) return;
      await flow.clickAt(tile!);
      flow.check(`one click on ${COLD_ITEM} inserts it`, await waitFor(flow, `harness.size() > ${before}`), `size ${before} -> ${await size(flow)}`);
      await flow.settle(600);
      flow.check(`one click on ${COLD_ITEM} inserts it exactly once`, (await size(flow)) === before + 1, `size ${before} -> ${await size(flow)}`);
      await flow.screenshot("cold-first-click");
    },
  };
}

async function closeDialog(flow: Flow): Promise<boolean> {
  const open = "[...document.querySelectorAll('[role=dialog]')].some((node) => node.getBoundingClientRect().width > 0)";
  if (!(await flow.eval<boolean>(open))) return true;
  const labels = [text("studio.chart.data.cancel"), text("studio.tables.data.cancel")];
  const found = await Promise.all(labels.map((label) => flow.find("[role=dialog] button", label)));
  const cancel = found.find((point) => point !== null);
  if (!cancel) return false;
  await flow.clickAt(cancel);
  return waitFor(flow, `!(${open})`);
}

function dragToCanvas(editor: Editor): Scenario {
  return {
    name: "dragging a shape from the library onto the canvas drops it there",
    editor,
    run: async (flow) => {
      const categories = await registry(flow);
      const shape = categories.find((c) => c.id === "shapes")?.items[0];
      if (!flow.check("a shape is registered", Boolean(shape))) return;
      await openPanel(flow, "elements");
      const center = await canvasCenter(flow);
      const spot = { x: center.x - 80, y: center.y - 60 };
      const before = await size(flow);
      flow.check("the drag starts from the tile", await flow.dropLibraryItem(shape!.id, spot));
      flow.check("the dropped shape is added", await waitFor(flow, `harness.size() > ${before}`));
      if (editor === "image") {
        const placed = await flow.eval<{ x: number; y: number } | null>(`(() => {
          const { store, ui } = harness.image();
          const doc = store.getState().document;
          const board = doc.artboards[0];
          const layer = board.layers[board.layers.length - 1];
          if (!layer) return null;
          const host = document.querySelector("[data-studio-canvas]").getBoundingClientRect();
          const v = ui.getState().viewport;
          return { x: host.left + v.x + (board.x + layer.transform.x * board.canvas.width) * v.scale, y: host.top + v.y + (board.y + layer.transform.y * board.canvas.height) * v.scale };
        })()`);
        flow.check("the shape lands where it was dropped", Boolean(placed && Math.abs(placed.x - spot.x) < 40 && Math.abs(placed.y - spot.y) < 40), { placed, spot });
      }
      await flow.screenshot("dropped");
    },
  };
}

function kindInsert(editor: Editor, kind: "grid" | "sticker" | "frame", title: string): Scenario {
  return {
    name: title,
    editor,
    run: async (flow) => {
      const categories = await registry(flow);
      const items = categories.flatMap((c) => c.items.map((item) => ({ ...item, panel: c.panel })).filter((item) => item.kind === kind));
      if (!flow.check(`at least one ${kind} item is registered for the ${editor} editor`, items.length > 0)) return;
      for (const item of items.slice(0, 3)) {
        await openPanel(flow, item.panel);
        await flow.fill(flow.librarySearch(), item.name);
        await prepare(flow, item.kind);
        const before = await size(flow);
        const revision = await flow.doc<number>("state.revision");
        const tile = await flow.find(`[data-library-item="${item.id}"]`);
        if (!flow.check(`${item.name} can be found by searching its name`, Boolean(tile))) continue;
        await flow.clickAt(tile!);
        flow.check(`${item.name} is inserted`, await waitFor(flow, changed(flow, before, revision)), `size ${before} -> ${await size(flow)}`);
      }
      await flow.screenshot(kind);
    },
  };
}

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
  inset: number;
}

interface TileInk {
  marks: number;
  background: string;
}

const THEMES = ["light", "dark"] as const;
const PREVIEW_WAIT_MS = 4000;
const MARK_CONTRAST = 2;
const MIN_MARK_PIXELS = 12;
const TILE_INSET = 3;

const INK_PROBE = `async (data, inset, threshold) => {
  const image = new Image();
  image.src = "data:image/png;base64," + data;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0);
  const { data: pixels, width, height } = context.getImageData(0, 0, canvas.width, canvas.height);
  const linear = (c) => (c / 255 <= 0.03928 ? c / 255 / 12.92 : ((c / 255 + 0.055) / 1.055) ** 2.4);
  const luminance = (i) => 0.2126 * linear(pixels[i]) + 0.7152 * linear(pixels[i + 1]) + 0.0722 * linear(pixels[i + 2]);
  const inside = [];
  for (let y = inset; y < height - inset; y++) for (let x = inset; x < width - inset; x++) inside.push((y * width + x) * 4);
  const counts = new Map();
  for (const i of inside) {
    const key = ((pixels[i] >> 3) << 10) | ((pixels[i + 1] >> 3) << 5) | (pixels[i + 2] >> 3);
    const seen = counts.get(key);
    if (seen) seen.count += 1;
    else counts.set(key, { count: 1, at: i });
  }
  const mode = [...counts.values()].sort((a, b) => b.count - a.count)[0];
  if (!mode) return { marks: 0, background: "none" };
  const under = luminance(mode.at);
  const marks = inside.filter((i) => {
    const [light, dark] = [luminance(i), under].sort((a, b) => b - a);
    return (light + 0.05) / (dark + 0.05) >= threshold;
  }).length;
  return { marks, background: "rgb(" + pixels[mode.at] + " " + pixels[mode.at + 1] + " " + pixels[mode.at + 2] + ")" };
}`;

async function setTheme(flow: Flow, theme: (typeof THEMES)[number]): Promise<void> {
  await flow.eval(`document.documentElement.classList.toggle("dark", ${theme === "dark"})`);
  await flow.settle(200);
}

async function tileBox(flow: Flow, itemId: string): Promise<Box | null> {
  return flow.eval<Box | null>(`(() => {
    const tile = [...document.querySelectorAll(${JSON.stringify(`[data-library-item="${itemId}"]`)})].find((node) => node.getBoundingClientRect().width > 0);
    if (!tile) return null;
    tile.scrollIntoView({ block: "center", inline: "nearest" });
    const preview = tile.querySelector("[data-library-preview]");
    const box = (preview ?? tile).getBoundingClientRect();
    return { x: box.left, y: box.top, width: box.width, height: box.height, inset: preview ? 0 : ${TILE_INSET} };
  })()`);
}

async function tileInk(flow: Flow, { inset, ...box }: Box): Promise<TileInk> {
  const { data } = (await flow.page.send("Page.captureScreenshot", { format: "png", clip: { ...box, scale: 1 } })) as { data: string };
  return flow.eval<TileInk>(`(${INK_PROBE})(${JSON.stringify(data)}, ${inset}, ${MARK_CONTRAST})`);
}

async function inkedTile(flow: Flow, itemId: string): Promise<TileInk | null> {
  const deadline = Date.now() + PREVIEW_WAIT_MS;
  let last: TileInk | null = null;
  while (Date.now() < deadline) {
    const box = await tileBox(flow, itemId);
    if (box && box.width > box.inset * 2 && box.height > box.inset * 2) {
      last = await tileInk(flow, box);
      if (last.marks >= MIN_MARK_PIXELS) return last;
    }
    await Bun.sleep(200);
  }
  return last;
}

function previewsVisible(editor: Editor): Scenario {
  return {
    name: "library preview tiles are not blank in the light and dark themes",
    editor,
    run: async (flow) => {
      const categories = (await registry(flow)).filter((category) => category.items.length > 0);
      for (const theme of THEMES) {
        await setTheme(flow, theme);
        for (const panel of ["elements", "text"] as const) {
          await openPanel(flow, panel);
          await clearSearch(flow);
          await flow.settle(300);
          const inPanel = categories.filter((c) => c.panel === panel);
          for (const category of inPanel) {
            const item = category.items[0];
            const ink = await inkedTile(flow, item.id);
            flow.check(`${theme}: the first ${category.name} tile ${item.id} shows its preview`, Boolean(ink && ink.marks >= MIN_MARK_PIXELS), ink ?? "tile not found");
          }
          if (inPanel.length > 0) await tileBox(flow, inPanel[0].items[0].id);
          await flow.screenshot(`${theme}-${panel}-previews`);
        }
      }
      await setTheme(flow, "light");
    },
  };
}

export const LIBRARY_SCENARIOS: Scenario[] = (["image", "video"] as const).flatMap((editor) => [
  coldFirstClick(editor),
  everyCategory(editor),
  previewsVisible(editor),
  search(editor),
  categoryViews(editor),
  insertEvery(editor),
  dragToCanvas(editor),
  kindInsert(editor, "frame", "frames from the library insert"),
  kindInsert(editor, "grid", "grids from the library insert"),
  kindInsert(editor, "sticker", "stickers from the library insert"),
]);
