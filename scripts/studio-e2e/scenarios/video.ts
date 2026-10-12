import { text, type Flow, type Scenario } from "../flow";
import { openPanel, size, waitFor } from "./library";

const CTRL = 2;
const SHIFT = 8;

export async function insertClips(flow: Flow, factories: string[]): Promise<string[]> {
  return flow.eval<string[]>(`(() => {
    const v = harness.video();
    const f = harness.factories;
    const before = new Set(v.root.getState().document.tracks.flatMap((t) => t.clips.map((c) => c.id)));
    v.commands.insertClips([${factories.join(", ")}]);
    v.commands.zoomToFit();
    return v.root.getState().document.tracks.flatMap((t) => t.clips.map((c) => c.id)).filter((id) => !before.has(id));
  })()`);
}

async function clip<T = Record<string, unknown>>(flow: Flow, id: string): Promise<T | null> {
  return flow.eval<T | null>(`harness.video().root.getState().document.tracks.flatMap((t) => t.clips).find((c) => c.id === ${JSON.stringify(id)}) ?? null`);
}

async function select(flow: Flow, ids: string[]): Promise<void> {
  await flow.eval(`harness.video().store.getState().select(${JSON.stringify(ids)})`);
  await flow.settle(250);
}

async function inspectorTab(flow: Flow, group: string): Promise<boolean> {
  const selector = `[role=tablist][aria-label="${text("studio.inspector.groupsLabel")}"] [role=tab]`;
  const name = text(`studio.inspector.groups.${group}`);
  if (!(await flow.exists(selector, name))) return true;
  return flow.click(selector, name);
}

async function seek(flow: Flow, ms: number): Promise<void> {
  await flow.eval(`harness.video().playback.seek(${ms})`);
  await flow.settle(200);
}

const RECT = (start: number, duration: number) => `f.newOverlayClip({ ...f.newShapeLayer('rect'), fill: '#ff0000' }, ${start}, ${duration}, { x: 0.5, y: 0.5, w: 0.3, h: 0.3, rotation: 0, opacity: 1 })`;
const PHOTO = (start: number, duration: number) => `f.newMediaClip('image', 'green-screen', ${start}, ${duration})`;
const FILM = (start: number, duration: number) => `f.newMediaClip('video', 'clip', ${start}, ${duration})`;

export const VIDEO_SCENARIOS: Scenario[] = [
  {
    name: "open a project: preview, timeline, inspector and transport are ready",
    editor: "video",
    run: async (flow) => {
      flow.check("the preview is shown", await flow.exists("[data-tour=studio-video-preview]"));
      flow.check("the timeline is shown", await flow.exists("[data-tour=studio-video-timeline]"));
      flow.check("the inspector is shown", await flow.exists("[data-tour=studio-video-inspector]"));
      flow.check("the play button is there", await flow.exists("button", text("studio.video.transport.play")));
      await flow.screenshot("opened");
    },
  },
  {
    name: "add a heading from the Text panel and a rectangle from Elements",
    editor: "video",
    run: async (flow) => {
      await openPanel(flow, "text");
      await flow.click('[data-library-item="text-heading"]');
      const heading = await flow.eval<{ type: string; layer?: { type: string } } | null>("(() => { const s = harness.video().store.getState(); const c = s.document.tracks.flatMap((t) => t.clips).find((c) => s.selection.includes(c.id)); return c ?? null; })()");
      flow.check("a selected text overlay clip is added", heading?.type === "overlay" && heading.layer?.type === "text", heading);
      await openPanel(flow, "elements");
      await flow.click('[data-library-item="shape-rect"]');
      const shape = await flow.eval<{ layer?: { type: string; shape?: string } } | null>("(() => { const s = harness.video().store.getState(); return s.document.tracks.flatMap((t) => t.clips).find((c) => s.selection.includes(c.id)) ?? null; })()");
      flow.check("a rectangle overlay clip is added", shape?.layer?.type === "shape" && shape.layer.shape === "rect", shape);
      flow.check("both clips show on the timeline", (await flow.count("[data-clip-id]")) >= 2);
      await flow.screenshot("text-and-shape");
    },
  },
  {
    name: "keyframe a property and animate the fill color",
    editor: "video",
    run: async (flow) => {
      const [id] = await insertClips(flow, [RECT(0, 3000)]);
      await select(flow, [id]);
      await seek(flow, 0);
      await inspectorTab(flow, "animation");
      await flow.button(text("studio.video.keyframes.add"));
      const moment = Object.keys((await clip<{ keyframes?: Record<string, unknown[]> }>(flow, id))?.keyframes ?? {});
      flow.check("Add keyframe keys the clip at the playhead", moment.length > 0, moment);
      await inspectorTab(flow, "basic");
      const fillName = text("studio.video.layer.fill");
      await flow.button(text("studio.video.keyframes.keyHere", { name: fillName }));
      await seek(flow, 1500);
      const field = await flow.eval<string | null>(`(() => { const label = [...document.querySelectorAll("[data-tour=studio-video-inspector] label")].find((l) => l.textContent.trim() === ${JSON.stringify(fillName)} && l.htmlFor && document.getElementById(l.htmlFor)?.type !== "color"); return label ? label.htmlFor : null; })()`);
      if (!flow.check("the fill color field is in the inspector", Boolean(field))) return;
      await flow.fill(`[id="${field}"]`, "#00ff00");
      await flow.key("Enter", "Enter");
      const keys = (await clip<{ keyframes?: { fill?: { atMs: number }[] } }>(flow, id))?.keyframes?.fill ?? [];
      flow.check("the fill has a key at the start and one at 1.5 s", keys.length === 2, keys);
      await flow.screenshot("color-keys");
    },
  },
  {
    name: "add a transition at a cut, then swap its kind from the panel",
    editor: "video",
    run: async (flow) => {
      await insertClips(flow, [RECT(0, 2000)]);
      await insertClips(flow, [`{ ...${RECT(2000, 2000)} }`]);
      await flow.eval("harness.video().commands.zoomToFit()");
      const transitions = () => flow.eval<{ kind: string }[]>("harness.video().root.getState().document.tracks.flatMap((t) => t.transitions ?? [])");
      if (await flow.exists("button", text("studio.video.transitions.addAt"))) await flow.button(text("studio.video.transitions.addAt"));
      else flow.check("the + button shows at the cut between two clips", false, "both clips may have landed on different tracks");
      flow.check("a transition is added at the cut", (await transitions()).length === 1, await transitions());
      if ((await transitions()).length === 0) return;
      await flow.click("[data-transition-id]");
      await flow.click("[data-tour=studio-video-transitions]");
      await flow.button(text("studio.video.transitions.kinds.push"));
      flow.check("picking Push in the panel swaps the kind", (await transitions())[0]?.kind === "push", await transitions());
      await flow.screenshot("transition");
    },
  },
  {
    name: "add an ellipse mask to a clip",
    editor: "video",
    run: async (flow) => {
      const [id] = await insertClips(flow, [RECT(0, 3000)]);
      await select(flow, [id]);
      await inspectorTab(flow, "cutout");
      await flow.press("button", text("studio.video.masks.addShape", { shape: text("studio.video.masks.shapes.ellipse") }));
      flow.check("the clip gets one mask", ((await clip<{ masks?: unknown[] }>(flow, id))?.masks ?? []).length === 1);
      await flow.screenshot("mask");
    },
  },
  {
    name: "chroma key a green photo and luma key another",
    editor: "video",
    run: async (flow) => {
      const [photo] = await insertClips(flow, [PHOTO(0, 3000)]);
      await select(flow, [photo]);
      await inspectorTab(flow, "cutout");
      await flow.button(text("studio.chroma.start.green"));
      flow.check("the photo clip gets a chroma key", Boolean((await clip<{ chromaKey?: unknown }>(flow, photo))?.chromaKey));
      await flow.screenshot("chroma");
      const [dark] = await insertClips(flow, [PHOTO(3000, 2000)]);
      await select(flow, [dark]);
      await inspectorTab(flow, "cutout");
      await flow.button(text("studio.luma.start.dark"));
      flow.check("the second clip gets a luma key", Boolean((await clip<{ lumaKey?: unknown }>(flow, dark))?.lumaKey));
    },
  },
  {
    name: "effects panel shows before and after previews for every registered effect and adds an effect clip",
    editor: "video",
    run: async (flow) => {
      await flow.click("[data-tour=studio-video-effects]");
      const kinds = await flow.eval<string[]>("[...harness.effects.video]");
      const group = `[role=group][aria-label="${text("studio.video.vfx.title")}"]`;
      flow.check("there is one tile per registered effect", (await flow.count(`${group} [data-effect-tile]`)) === kinds.length, `${await flow.count(`${group} [data-effect-tile]`)} tiles, ${kinds.length} kinds`);
      const painted = await waitFor(flow, `harness.effects.video.every((kind) => [...document.querySelectorAll('[data-studio-effect-preview="' + kind + '"], [data-studio-effect-before="' + kind + '"]')].filter((n) => getComputedStyle(n).backgroundImage.startsWith("url")).length >= 2)`, 30000);
      const missing = await flow.eval<string[]>(`harness.effects.video.filter((kind) => [...document.querySelectorAll('[data-studio-effect-preview="' + kind + '"], [data-studio-effect-before="' + kind + '"]')].filter((n) => getComputedStyle(n).backgroundImage.startsWith("url")).length < 2)`);
      flow.check("every tile shows a before and an after preview", painted, `no preview for ${missing.join(", ")}`);
      await flow.screenshot("effects-panel");
      const before = await size(flow);
      await flow.press(`${group} [data-effect-tile]`, text("studio.video.vfx.panelAdd", { kind: text(`studio.video.vfx.kinds.${kinds[0]}`) }));
      flow.check("clicking the first tile adds an effect clip", await waitFor(flow, `harness.size() > ${before}`));
    },
  },
  {
    name: "apply every registered effect to a clip from the inspector",
    editor: "video",
    run: async (flow) => {
      const [id] = await insertClips(flow, [PHOTO(0, 3000)]);
      await select(flow, [id]);
      await inspectorTab(flow, "effects");
      const kinds = await flow.eval<string[]>("[...harness.effects.video]");
      const group = `[role=group][aria-label="${text("studio.video.vfx.add")}"]`;
      for (const kind of kinds) {
        const count = ((await clip<{ vfx?: unknown[] }>(flow, id))?.vfx ?? []).length;
        const mark = flow.page.errors.length;
        await flow.press(`${group} [data-effect-tile]`, text("studio.video.vfx.addKind", { kind: text(`studio.video.vfx.kinds.${kind}`) }));
        flow.check(`adding ${kind} puts it on the clip`, ((await clip<{ vfx?: unknown[] }>(flow, id))?.vfx ?? []).length === count + 1);
        await flow.settle(400);
        flow.check(`${kind} draws without a GPU error`, !flow.page.errors.slice(mark).some((line) => /shader|undeclared|ERROR: d+:d+/.test(line)), flow.page.errors.slice(mark).find((line) => /ERROR: d+:d+/.test(line)) ?? "");
      }
      await flow.screenshot("clip-effects");
    },
  },
  {
    name: "add a path operator and a repeater to a shape clip",
    editor: "video",
    run: async (flow) => {
      const [id] = await insertClips(flow, [RECT(0, 3000)]);
      await select(flow, [id]);
      await inspectorTab(flow, "effects");
      const add = await flow.eval<string | null>(`(() => { const g = document.querySelector('[role=group][aria-label="${text("studio.pathOps.add")}"]'); const b = g && g.querySelector("button"); return b ? b.getAttribute("aria-label") : null; })()`);
      if (flow.check("the path operator buttons are shown", Boolean(add))) {
        await flow.button(add!);
        flow.check(`${add} adds an operator`, ((await clip<{ layer: { pathOps?: unknown[] } }>(flow, id))?.layer.pathOps ?? []).length === 1);
      }
      const preset = await flow.eval<string | null>(`(() => {
        const section = [...document.querySelectorAll("section[aria-labelledby]")].find((s) => s.querySelector("h3")?.textContent.trim().startsWith(${JSON.stringify(text("studio.video.repeat.title"))}));
        const button = section && [...section.querySelectorAll("button")].find((b) => (b.getAttribute("title") || b.getAttribute("aria-label") || "").startsWith("Aplicar"));
        return button ? (button.getAttribute("aria-label") || button.getAttribute("title")) : null;
      })()`);
      if (flow.check("the repeater presets are shown", Boolean(preset))) {
        await flow.button(preset!);
        flow.check(`${preset} sets a repeater`, Boolean((await clip<{ repeat?: unknown }>(flow, id))?.repeat));
      }
      await flow.screenshot("path-ops-repeater");
    },
  },
  {
    name: "group two clips with Ctrl+G and undo it",
    editor: "video",
    run: async (flow) => {
      const [a] = await insertClips(flow, [RECT(0, 2000)]);
      const [b] = await insertClips(flow, [RECT(2000, 2000)]);
      await select(flow, []);
      const first = await flow.find(`[data-clip-id="${a}"]`);
      const second = await flow.find(`[data-clip-id="${b}"]`);
      if (!flow.check("both clips are on the timeline", Boolean(first && second))) return;
      await flow.clickAt(first!);
      await flow.clickAt(second!, SHIFT);
      flow.check("shift click selects both clips", (await flow.doc<string[]>("state.selection")).length === 2, await flow.doc("state.selection"));
      await flow.key("g", "KeyG", CTRL);
      const grouped = await flow.eval<boolean>("harness.video().root.getState().document.tracks.flatMap((t) => t.clips).some((c) => c.type === 'group')");
      flow.check("Ctrl+G replaces them with a group clip", grouped);
      await flow.screenshot("grouped");
      await flow.key("z", "KeyZ", CTRL);
      flow.check("Ctrl+Z brings the two clips back", !(await flow.eval<boolean>("harness.video().root.getState().document.tracks.flatMap((t) => t.clips).some((c) => c.type === 'group')")));
    },
  },
  {
    name: "bold one word of a text clip in place (rich text)",
    editor: "video",
    run: async (flow) => {
      const [id] = await insertClips(flow, ["f.newOverlayClip(f.newTextLayer('Olá mundo', 'body'), 0, 3000)"]);
      await select(flow, [id]);
      await seek(flow, 500);
      await inspectorTab(flow, "basic");
      if (await flow.exists("button", text("studio.video.layer.editOnPreview"))) await flow.button(text("studio.video.layer.editOnPreview"));
      else await flow.eval(`harness.video().commands.startTextEdit(${JSON.stringify(id)})`);
      if (!flow.check("the text editor opens on the preview", await waitFor(flow, "document.querySelector('[data-rich-text-editor]')"))) return;
      await flow.eval(`(() => {
        const box = document.querySelector("[data-rich-text-editor]");
        box.focus();
        const node = document.createTreeWalker(box, NodeFilter.SHOW_TEXT).nextNode();
        const range = document.createRange();
        range.setStart(node, 4);
        range.setEnd(node, 9);
        getSelection().removeAllRanges();
        getSelection().addRange(range);
        document.dispatchEvent(new Event("selectionchange"));
      })()`);
      await flow.settle(200);
      flow.check("the run toolbar appears", await flow.exists("[data-text-run-toolbar]"));
      await flow.key("b", "KeyB", CTRL);
      await flow.screenshot("rich-text");
      await flow.key("Escape", "Escape");
      const runs = (await clip<{ layer: { runs?: { start: number; end: number; fontWeight?: number }[] } }>(flow, id))?.layer.runs ?? [];
      flow.check("only the second word is bold", runs.some((run) => run.start === 4 && run.end === 9 && (run.fontWeight ?? 0) >= 600), runs);
    },
  },
  {
    name: "grade a clip with a ready look",
    editor: "video",
    run: async (flow) => {
      const [id] = await insertClips(flow, [PHOTO(0, 3000)]);
      await select(flow, [id]);
      await inspectorTab(flow, "color");
      await flow.button(text("studio.grade.lookNames.warm"));
      const color = (await clip<{ color?: Record<string, unknown> }>(flow, id))?.color;
      flow.check("the warm look writes a grade on the clip", Boolean(color && Object.keys(color).length > 0), color);
      await flow.screenshot("graded");
    },
  },
  {
    name: "remap time with a speed curve preset",
    editor: "video",
    run: async (flow) => {
      const [id] = await insertClips(flow, [FILM(0, 4000)]);
      await select(flow, [id]);
      await inspectorTab(flow, "speed");
      const preset = await flow.eval<string | null>(`(() => { const g = document.querySelector('[role=group][aria-label="${text("studio.video.speed.curve.title")}"]'); const b = g && g.querySelector("button"); return b ? (b.getAttribute("aria-label") || b.textContent.trim()) : null; })()`);
      if (!flow.check("the speed curve presets are shown", Boolean(preset))) return;
      await flow.button(preset!);
      flow.check(`${preset} writes a speed curve`, ((await clip<{ keyframes?: { speed?: unknown[] } }>(flow, id))?.keyframes?.speed ?? []).length > 1);
      flow.check("the curve editor appears", await flow.exists(`svg[aria-label="${text("studio.video.speed.curve.graph")}"]`));
      await flow.screenshot("speed-curve");
    },
  },
  {
    name: "zoom the timeline in, out and to fit",
    editor: "video",
    run: async (flow) => {
      await insertClips(flow, [RECT(0, 3000)]);
      const px = () => flow.eval<number>("harness.video().view.getState().pxPerSecond");
      const start = await px();
      await flow.click("[data-tour=studio-video-timeline] button", text("studio.video.timeline.bar.zoomIn"));
      const larger = await px();
      flow.check("zoom in widens the timeline", larger > start, `${start} -> ${larger}`);
      await flow.click("[data-tour=studio-video-timeline] button", text("studio.video.timeline.bar.zoomOut"));
      await flow.click("[data-tour=studio-video-timeline] button", text("studio.video.timeline.bar.zoomOut"));
      flow.check("zoom out narrows it", (await px()) < larger);
      await flow.click("[data-tour=studio-video-timeline] button", text("studio.video.timeline.bar.zoomFit"));
      flow.check("zoom to fit lands on a positive scale", (await px()) > 0);
      await flow.screenshot("timeline-zoom");
    },
  },
  {
    name: "preview playback runs without freezing and pauses",
    editor: "video",
    run: async (flow) => {
      await insertClips(flow, [RECT(0, 6000), FILM(0, 4000)]);
      await seek(flow, 0);
      await flow.button(text("studio.video.transport.play"));
      const motion = await flow.frames(2000);
      const head = await flow.eval<number>("harness.video().view.getState().playheadMs");
      flow.check("the playhead moves while playing", head > 800, `${head} ms after 2 s`);
      flow.check("the page keeps drawing frames", motion.frames > 40, motion);
      flow.check("no frame takes longer than 250 ms", motion.longest < 250, motion);
      await flow.screenshot("playing");
      await flow.button(text("studio.video.transport.pause"));
      flow.check("pause stops playback", !(await flow.eval<boolean>("harness.video().view.getState().playing")));
    },
  },
  {
    name: "undo and redo an insert with the toolbar and the keyboard",
    editor: "video",
    run: async (flow) => {
      await openPanel(flow, "elements");
      const before = await size(flow);
      await flow.click('[data-library-item="shape-rect"]');
      flow.check("the shape is inserted", (await size(flow)) === before + 1);
      await flow.button(text("studio.video.toolbar.undo"));
      flow.check("Undo removes it", (await size(flow)) === before);
      await flow.button(text("studio.video.toolbar.redo"));
      flow.check("Redo brings it back", (await size(flow)) === before + 1);
      await flow.clickAt((await flow.find("[data-tour=studio-video-timeline]"))!);
      await flow.key("z", "KeyZ", CTRL);
      flow.check("Ctrl+Z removes it", (await size(flow)) === before);
      await flow.key("Z", "KeyZ", CTRL | SHIFT);
      flow.check("Ctrl+Shift+Z brings it back", (await size(flow)) === before + 1);
    },
  },
  {
    name: "export starts from the toolbar",
    editor: "video",
    run: async (flow) => {
      await insertClips(flow, [RECT(0, 1000)]);
      await flow.click("[data-tour=studio-video-export] button");
      flow.check("the export panel opens", await waitFor(flow, `[...document.querySelectorAll("[data-radix-popper-content-wrapper]")].some((n) => n.textContent.includes(${JSON.stringify(text("studio.video.export.title"))}))`));
      await flow.screenshot("export-panel");
      await flow.button(text("studio.video.export.start"));
      const started = await waitFor(flow, `document.querySelector("[data-tour=studio-video-export]").textContent.includes(${JSON.stringify(text("studio.video.export.exporting"))}) || document.querySelector("[aria-live=polite] [role=progressbar]") || document.querySelector("[data-radix-popper-content-wrapper] [role=status]")`, 10000);
      flow.check("the export starts", started);
      const failed = await flow.eval<string | null>("document.querySelector('[data-radix-popper-content-wrapper] [role=alert]')?.textContent ?? null");
      flow.check("the export does not fail right away", failed === null, failed);
      await flow.screenshot("exporting");
    },
  },
];
