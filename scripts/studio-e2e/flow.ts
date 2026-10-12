import { writeFileSync } from "node:fs";
import { join } from "node:path";

import messages from "../../src/i18n/messages/pt.json";
import { dragBy, key, mouse, navigate, type Devtools } from "../studio-perf/harness";

export type Editor = "image" | "video";

export interface Point {
  x: number;
  y: number;
}

export interface Check {
  name: string;
  ok: boolean;
  detail: string;
}

export interface Scenario {
  name: string;
  editor: Editor;
  pending?: string;
  run: (flow: Flow) => Promise<void>;
}

export const READY: Record<Editor, string> = {
  image: "Boolean(window.harness && harness.image() && document.querySelector('[data-studio-canvas] canvas'))",
  video: "Boolean(window.harness && harness.video() && document.querySelector('[data-tour=studio-video-timeline]'))",
};

export function text(path: string, values: Record<string, string | number> = {}): string {
  const found = path.split(".").reduce<unknown>((node, part) => (node && typeof node === "object" ? (node as Record<string, unknown>)[part] : undefined), messages);
  if (typeof found !== "string") throw new Error(`missing message ${path}`);
  return Object.entries(values).reduce((line, [name, value]) => line.replaceAll(`{${name}}`, String(value)), found);
}

const QUOTE = JSON.stringify;

export class Flow {
  readonly checks: Check[] = [];
  readonly shots: string[] = [];

  constructor(
    readonly page: Devtools,
    readonly editor: Editor,
    private readonly out: string,
    private readonly prefix: string,
    readonly downloads: string,
  ) {}

  check(name: string, ok: boolean, detail: unknown = ""): boolean {
    this.checks.push({ name, ok, detail: typeof detail === "string" ? detail : JSON.stringify(detail) });
    return ok;
  }

  eval<T>(expression: string): Promise<T> {
    return this.page.evaluate<T>(expression);
  }

  doc<T>(selector: string): Promise<T> {
    const source = this.editor === "image" ? "harness.image().store.getState()" : "harness.video().store.getState()";
    return this.eval<T>(`((state) => (${selector}))(${source})`);
  }

  settle(ms = 250): Promise<void> {
    return this.eval<void>(`harness.settle(${ms})`);
  }

  async open(): Promise<void> {
    await navigate(this.page, `/?editor=${this.editor}&t=${Date.now()}`, READY[this.editor]);
    await this.settle(400);
    this.page.errors.length = 0;
  }

  async find(selector: string, label?: string): Promise<Point | null> {
    return this.eval<Point | null>(`(() => {
      const wanted = ${QUOTE(label ?? null)};
      const visible = (node) => { const r = node.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
      const named = (node) => wanted === null || [node.getAttribute("aria-label"), node.getAttribute("title"), node.textContent].some((value) => (value ?? "").trim() === wanted) || (node.getAttribute("aria-label") ?? "").startsWith(wanted);
      const found = [...document.querySelectorAll(${QUOTE(selector)})].filter(visible).find(named);
      if (!found) return null;
      found.scrollIntoView({ block: "nearest", inline: "nearest" });
      const r = found.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    })()`);
  }

  async count(selector: string): Promise<number> {
    return this.eval<number>(`document.querySelectorAll(${QUOTE(selector)}).length`);
  }

  async exists(selector: string, label?: string): Promise<boolean> {
    return (await this.find(selector, label)) !== null;
  }

  async clickAt(point: Point, modifiers = 0): Promise<void> {
    await mouse(this.page, "mouseMoved", point.x, point.y, 0, modifiers);
    await mouse(this.page, "mousePressed", point.x, point.y, 1, modifiers);
    await mouse(this.page, "mouseReleased", point.x, point.y, 1, modifiers);
    await this.settle(150);
  }

  async click(selector: string, label?: string): Promise<boolean> {
    const point = await this.find(selector, label);
    if (!point) return this.check(`can find ${label ?? selector}`, false, selector);
    await this.clickAt(point);
    return true;
  }

  async press(selector: string, label?: string): Promise<boolean> {
    const done = await this.eval<boolean>(`(() => {
      const wanted = ${QUOTE(label ?? null)};
      const named = (node) => wanted === null || [node.getAttribute("aria-label"), node.getAttribute("title"), node.textContent].some((value) => (value ?? "").trim() === wanted) || (node.getAttribute("aria-label") ?? "").startsWith(wanted);
      const found = [...document.querySelectorAll(${QUOTE(selector)})].find(named);
      if (!found) return false;
      found.click();
      return true;
    })()`);
    await this.settle(150);
    if (!done) this.check(`can find ${label ?? selector}`, false, selector);
    return done;
  }

  async button(label: string): Promise<boolean> {
    return this.click("button, [role=button], [role=menuitem], [role=tab], [role=option], [role=menuitemcheckbox], [role=radio]", label);
  }

  async type(value: string): Promise<void> {
    await this.page.send("Input.insertText", { text: value });
    await this.settle(100);
  }

  async fill(selector: string, value: string): Promise<boolean> {
    const point = await this.find(selector);
    if (!point) return this.check(`can find field ${selector}`, false);
    await this.clickAt(point);
    await this.eval(`(() => { const field = document.activeElement; if (field && typeof field.select === "function") field.select(); })()`);
    await this.type(value);
    return true;
  }

  librarySearch(): string {
    return this.editor === "image" ? "#studio-image-panel input[type=search]" : "[role=tabpanel][data-state=active] input[type=search]";
  }

  async key(name: string, code: string, modifiers = 0): Promise<void> {
    await key(this.page, name, code, modifiers);
    await this.settle(150);
  }

  async drag(from: Point, to: Point, steps = 20): Promise<void> {
    await dragBy(this.page, from, to, steps);
    await this.settle(150);
  }

  async dropLibraryItem(itemId: string, target: Point): Promise<boolean> {
    const dropped = await this.eval<boolean>(`(() => {
      const source = document.querySelector('[data-library-item=${QUOTE(itemId)}]');
      const target = document.elementFromPoint(${target.x}, ${target.y});
      if (!source || !target) return false;
      const data = new DataTransfer();
      source.dispatchEvent(new DragEvent("dragstart", { bubbles: true, cancelable: true, dataTransfer: data }));
      const at = { bubbles: true, cancelable: true, dataTransfer: data, clientX: ${target.x}, clientY: ${target.y} };
      target.dispatchEvent(new DragEvent("dragenter", at));
      target.dispatchEvent(new DragEvent("dragover", at));
      target.dispatchEvent(new DragEvent("drop", at));
      source.dispatchEvent(new DragEvent("dragend", { bubbles: true, dataTransfer: data }));
      return true;
    })()`);
    await this.settle(600);
    return dropped;
  }

  async labels(selector = "button, [role=tab], [role=menuitem], input, select"): Promise<string[]> {
    return this.eval<string[]>(`[...document.querySelectorAll(${QUOTE(selector)})].filter((n) => n.getBoundingClientRect().width > 0).map((n) => (n.getAttribute("aria-label") || n.getAttribute("title") || n.textContent || "").trim()).filter(Boolean)`);
  }

  async screenshot(name: string): Promise<void> {
    const file = `${this.prefix}-${name}.png`;
    const { data } = (await this.page.send("Page.captureScreenshot", { format: "png" })) as { data: string };
    writeFileSync(join(this.out, file), Buffer.from(data, "base64"));
    this.shots.push(file);
  }

  async frames(ms: number): Promise<{ frames: number; longest: number }> {
    return this.eval(`new Promise((done) => {
      const gaps = []; let last = performance.now(); const end = last + ${ms};
      const tick = (now) => { gaps.push(now - last); last = now; if (now < end) requestAnimationFrame(tick); else done({ frames: gaps.length, longest: Math.round(Math.max(...gaps)) }); };
      requestAnimationFrame(tick);
    })`);
  }
}
