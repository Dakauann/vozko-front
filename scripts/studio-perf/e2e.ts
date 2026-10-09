import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { dragBy, key, mouse, withHarness, type Devtools } from "./harness";

interface Snapshot {
  active: string | null;
  selection: string[];
  scale: number;
  artboards: { id: string; name: string | null; x: number; y: number; width: number; height: number; background: string; layers: { id: string; text: string | null; x: number; y: number; w: number }[] }[];
}

interface Reply {
  ok: boolean;
  data?: Record<string, unknown>;
  images?: string[];
  error?: { message: string };
}

const results: [string, boolean, string][] = [];

function check(name: string, ok: boolean, detail = "") {
  results.push([name, ok, detail]);
}

const snapshot = (page: Devtools) => page.evaluate<Snapshot>("harness.snapshot()");
const agent = (page: Devtools, name: string, args: unknown) => page.evaluate<Reply>(`harness.agent(${JSON.stringify(name)}, ${JSON.stringify(args)})`);

async function centerOf(page: Devtools, selector: string, text?: string): Promise<{ x: number; y: number } | null> {
  return page.evaluate(`(() => {
    const nodes = [...document.querySelectorAll(${JSON.stringify(selector)})];
    const found = nodes.find((node) => ${text ? `node.textContent.includes(${JSON.stringify(text)})` : "true"});
    if (!found) return null;
    const r = found.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`);
}

async function click(page: Devtools, point: { x: number; y: number }) {
  await mouse(page, "mouseMoved", point.x, point.y, 0);
  await mouse(page, "mousePressed", point.x, point.y, 1);
  await mouse(page, "mouseReleased", point.x, point.y, 1);
  await Bun.sleep(200);
}

async function screenshot(page: Devtools, out: string, name: string) {
  const { data } = (await page.send("Page.captureScreenshot", { format: "png" })) as { data: string };
  writeFileSync(join(out, name), Buffer.from(data, "base64"));
}

function zipEntries(zip: Uint8Array): { name: string; data: Uint8Array }[] {
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  const end = zip.byteLength - 22;
  const count = view.getUint16(end + 10, true);
  let at = view.getUint32(end + 16, true);
  const entries = [];
  for (let i = 0; i < count; i++) {
    const size = view.getUint32(at + 24, true);
    const nameLength = view.getUint16(at + 28, true);
    const local = view.getUint32(at + 42, true);
    const name = new TextDecoder().decode(zip.subarray(at + 46, at + 46 + nameLength));
    const start = local + 30 + view.getUint16(local + 26, true);
    entries.push({ name, data: zip.subarray(start, start + size) });
    at += 46 + nameLength;
  }
  return entries;
}

function pngSize(data: Uint8Array): { width: number; height: number } {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

async function waitForFile(dir: string, suffix: string, timeoutMs = 20_000): Promise<string | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const found = readdirSync(dir).find((name) => name.endsWith(suffix));
    if (found) return join(dir, found);
    await Bun.sleep(250);
  }
  return null;
}

const out = process.env.STUDIO_E2E_OUT ?? join(import.meta.dir, ".e2e");
mkdirSync(out, { recursive: true });

const passed = await withHarness(async ({ page, downloads }) => {
  await page.evaluate("harness.setup(6, 0)");

  const batch = await agent(page, "edit", {
    operations: [
      { op: "duplicate_artboard", ref: "wide", name: "Versão larga", width: 1920, height: 1080 },
      { op: "update_layer", layer_id: "@wide/layer-5", text: "Versão larga" },
      { op: "add_artboard", ref: "story", name: "Story", width: 1080, height: 1920, background: "#101820" },
      { op: "add_text", artboard_id: "@story", ref: "headline", text: "Story", style: "heading", fill: "#ffffff" },
    ],
  });
  if (!batch.ok) throw new Error(`Elo batch refused: ${JSON.stringify(batch.error ?? batch.data)}`);
  let state = await snapshot(page);
  const [main, wide, story] = state.artboards;
  check("Elo duplicates into a wide version and edits the copy in one batch", batch.ok && wide?.width === 1920 && wide.height === 1080 && wide.layers.length === 6 && wide.layers.some((l) => l.text === "Versão larga"), batch.error?.message ?? "");
  check("the original artboard is left as it was", main?.layers.find((l) => l.id === "layer-5")?.text === "Texto 5");
  check("Elo adds a story artboard with its own background and builds on it", story?.height === 1920 && story.background === "#101820" && story.layers.length === 1 && story.layers[0].text === "Story");
  check("the reply says which copy is which", typeof (batch.data?.copies as Record<string, string> | undefined)?.["layer-5"] === "string");
  check("new artboards sit to the right, in one row, without overlapping", Boolean(wide && story && wide.x >= main.x + main.width && story.x >= wide.x + wide.width && wide.y === main.y && story.y === main.y));

  const sheet = await agent(page, "look", { artboard_id: "all", marks: true });
  const sheetSize = sheet.images?.[0] ? await page.evaluate<{ width: number; height: number }>(`harness.imageSize(${JSON.stringify(sheet.images[0])})`) : null;
  const legend = (sheet.data?.marks as unknown[] | undefined) ?? [];
  check("Elo sees every artboard side by side with unique marks", sheet.ok && (sheet.data?.artboards as unknown[]).length === 3 && legend.length === 13 && (sheetSize?.width ?? 0) > 300, JSON.stringify(sheetSize));
  if (sheet.images?.[0]) writeFileSync(join(out, "look-all.jpg"), Buffer.from(sheet.images[0].split(",")[1], "base64"));
  const single = await agent(page, "look", { artboard_id: wide.id });
  check("Elo looks at one artboard by id", single.ok && single.data?.width === 1920 && Boolean(single.images?.[0]));
  const missing = await agent(page, "look", { artboard_id: "artboard-nowhere" });
  check("Elo is told when an artboard does not exist", !missing.ok);

  await page.evaluate("harness.commands.fit()");
  await page.evaluate("harness.settle()");
  await screenshot(page, out, "1-three-artboards.png");

  const before = await snapshot(page);
  const layerPoint = await page.evaluate<{ x: number; y: number }>(`harness.layerScreen("layer-0")`);
  const storyPoint = await page.evaluate<{ x: number; y: number }>(`harness.artboardCenter(${JSON.stringify(story.id)})`);
  await dragBy(page, layerPoint, storyPoint, 24);
  state = await snapshot(page);
  const movedStory = state.artboards.find((a) => a.id === story.id)!;
  const moved = movedStory.layers.find((l) => l.id === "layer-0");
  check("dragging a layer onto another artboard moves it there", Boolean(moved) && !state.artboards[0].layers.some((l) => l.id === "layer-0"));
  check("the dropped layer stays where it was let go", Boolean(moved && Math.abs(moved.x - 0.5) < 0.05 && Math.abs(moved.y - 0.5) < 0.05), JSON.stringify(moved));
  check("the drag is one undo step", (await page.evaluate<number>("(harness.store.getState().undo(), harness.store.getState().document.artboards[2].layers.length)")) === before.artboards[2].layers.length);
  await page.evaluate("harness.store.getState().redo()");

  const label = await page.evaluate<{ x: number; y: number }>(`harness.labelPoint(${JSON.stringify(main.id)})`);
  const startY = (await snapshot(page)).artboards[0].y;
  await dragBy(page, label, { x: label.x, y: label.y + 200 }, 16);
  state = await snapshot(page);
  check("dragging an artboard name moves the artboard", Math.abs(state.artboards[0].y - startY - 200 / state.scale) < 4 / state.scale, `${state.artboards[0].y} vs ${startY}`);
  check("clicking the name selects the artboard", state.selection.length === 1 && state.selection[0] === main.id);

  await key(page, "n", "KeyN");
  await Bun.sleep(150);
  state = await snapshot(page);
  check("N steps to the next artboard", state.selection.length === 1 && state.selection[0] !== main.id && state.active === state.selection[0]);

  await page.evaluate(`harness.commands.selectArtboard(${JSON.stringify(story.id)}, false)`);
  await key(page, "Delete", "Delete");
  await Bun.sleep(150);
  const afterDelete = (await snapshot(page)).artboards.length;
  await key(page, "z", "KeyZ", 2);
  await Bun.sleep(150);
  const afterUndo = (await snapshot(page)).artboards.length;
  check("Delete removes the selected artboard and Ctrl+Z brings it back", afterDelete === 2 && afterUndo === 3, `${afterDelete} then ${afterUndo}`);

  const exportButton = await centerOf(page, "[data-tour=studio-image-export]");
  if (exportButton) await click(page, exportButton);
  const allPill = await centerOf(page, "[role=dialog] button, [data-radix-popper-content-wrapper] button", "Todas");
  if (allPill) await click(page, allPill);
  const zipButton = await centerOf(page, "[data-radix-popper-content-wrapper] button", "Baixar ZIP");
  if (zipButton) await click(page, zipButton);
  const zipPath = zipButton ? await waitForFile(downloads, ".zip") : null;
  const entries = zipPath ? zipEntries(new Uint8Array(readFileSync(zipPath))) : [];
  state = await snapshot(page);
  const sizes = entries.map((e) => pngSize(e.data));
  const expected = state.artboards.map((a) => ({ width: a.width, height: a.height }));
  check("exporting all artboards downloads one ZIP with a PNG per artboard at its size", entries.length === 3 && JSON.stringify(sizes) === JSON.stringify(expected), `${entries.map((e) => e.name).join(", ")} ${JSON.stringify(sizes)}`);
  check("files are named after their artboards", entries.some((e) => e.name.includes("versao-larga")) && entries.some((e) => e.name.includes("story")));

  const json = await page.evaluate<string>("harness.documentJSON()");
  const reloadIssue = await page.evaluate<unknown>(`harness.reload(${JSON.stringify(json)})`);
  const reloaded = await snapshot(page);
  check("the saved project reads back with every artboard", reloadIssue === null && reloaded.artboards.length === 3);
  writeFileSync(join(out, "document.json"), json);
  if (process.env.STUDIO_E2E_FIXTURE) writeFileSync(process.env.STUDIO_E2E_FIXTURE, JSON.stringify(JSON.parse(json), null, 2) + "\n");
  await page.evaluate("harness.commands.fit()");
  await page.evaluate("harness.settle()");
  await screenshot(page, out, "2-after-edits.png");

  for (const [name, ok, detail] of results) console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok || !detail ? "" : `  (${detail})`}`);
  console.log(`Artifacts in ${out}`);
  return results.every(([, ok]) => ok);
});
process.exit(passed ? 0 : 1);
