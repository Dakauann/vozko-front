import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

import { isValidChord } from "./chord";
import { CRM_BINDINGS, CRM_SHORTCUT_NAMESPACE, SHORTCUT_SCOPES, bindingsIn, resolveShortcut, scopeLabelKey, type ShortcutScope } from "./crm-bindings";
import type { KeyStroke } from "./stroke";

const LOCALES = ["pt", "en", "es", "de"] as const;

function catalog(locale: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path.resolve(__dirname, `../../i18n/messages/${locale}.json`), "utf8"));
}

function lookup(messages: Record<string, unknown>, dotted: string): unknown {
  return dotted.split(".").reduce<unknown>((node, part) => (node && typeof node === "object" ? (node as Record<string, unknown>)[part] : undefined), messages);
}

function stroke(key: string, extra: Partial<KeyStroke> = {}): KeyStroke {
  return { key, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...extra };
}

function inside(attributes: Record<string, string>, tag = "div"): HTMLElement {
  const container = document.createElement("div");
  Object.entries(attributes).forEach(([name, value]) => container.setAttribute(name, value));
  const child = document.createElement(tag);
  container.appendChild(child);
  return child;
}

describe("the CRM shortcut catalog", () => {
  it.each(LOCALES)("names every binding and every scope in %s", (locale) => {
    const messages = catalog(locale);
    for (const binding of CRM_BINDINGS) {
      const text = lookup(messages, `${CRM_SHORTCUT_NAMESPACE}.${binding.labelKey}`);
      expect(typeof text === "string" && text.trim() !== "", `${locale}: ${binding.id}`).toBe(true);
    }
    for (const scope of SHORTCUT_SCOPES) {
      const text = lookup(messages, `${CRM_SHORTCUT_NAMESPACE}.${scopeLabelKey(scope)}`);
      expect(typeof text === "string" && text.trim() !== "", `${locale}: ${scope}`).toBe(true);
    }
  });

  it("never gives one key two meanings inside a scope", () => {
    for (const scope of SHORTCUT_SCOPES) {
      const keys = bindingsIn(scope).flatMap((binding) => binding.keys);
      expect(new Set(keys).size, scope).toBe(keys.length);
    }
  });

  it("keeps global keys apart from every other scope, since global ones fire everywhere", () => {
    const globalKeys = new Set(bindingsIn("global").flatMap((binding) => binding.keys));
    const others = CRM_BINDINGS.filter((binding) => binding.scope !== "global").flatMap((binding) => binding.keys);
    expect(others.filter((key) => globalKeys.has(key))).toEqual([]);
  });

  it("writes every key as a chord the matcher understands", () => {
    for (const binding of CRM_BINDINGS) {
      for (const key of binding.keys) expect(isValidChord(key), `${binding.id}: ${key}`).toBe(true);
    }
  });

  it("has unique ids", () => {
    const ids = CRM_BINDINGS.map((binding) => binding.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("can express the thread's own find shortcut", () => {
    expect(CRM_BINDINGS.find((binding) => binding.id === "thread.search")).toMatchObject({ scope: "thread", keys: ["Mod+F"] });
  });
});

describe("resolving a stroke inside a scope", () => {
  const window = { platform: "other" as const, attachedToWindow: true };

  it.each<[string, KeyStroke, ShortcutScope, string | null]>([
    ["j moves down the inbox", stroke("j"), "inbox", "inbox.next"],
    ["the down arrow moves down the inbox", stroke("ArrowDown"), "inbox", "inbox.next"],
    ["k moves up the inbox", stroke("k"), "inbox", "inbox.previous"],
    ["Ctrl+K opens the palette", stroke("k", { ctrlKey: true }), "global", "palette.open"],
    ["a question mark opens the help", stroke("?", { shiftKey: true }), "global", "help.open"],
    ["e finishes the open conversation", stroke("e"), "thread", "conversation.finish"],
    ["Ctrl+B makes the selection bold in the composer", stroke("b", { ctrlKey: true }), "composer", "composer.bold"],
    ["Ctrl+Shift+X strikes the selection in the composer", stroke("X", { ctrlKey: true, shiftKey: true }), "composer", "composer.strike"],
    ["r on the list moves to the open conversation composer", stroke("r"), "inbox", "inbox.reply"],
    ["Ctrl+Shift+Enter sends and finishes from the composer", stroke("Enter", { ctrlKey: true, shiftKey: true }), "composer", "composer.sendAndFinish"],
    ["p pins the focused row of the list", stroke("p"), "inbox", "inbox.pin"],
    ["u marks the focused row of the list unread", stroke("u"), "inbox", "inbox.markUnread"],
    ["x picks the focused row of the list", stroke("x"), "inbox", "inbox.select"],
    ["Esc leaves selection mode in the list", stroke("Escape"), "inbox", "inbox.clearSelection"],
    ["p pins the open conversation", stroke("p"), "thread", "conversation.pin"],
    ["u marks the open conversation unread", stroke("u"), "thread", "conversation.markUnread"],
    ["a key bound in another scope does nothing here", stroke("j"), "thread", null],
    ["an unbound key does nothing", stroke("q"), "inbox", null],
  ])("%s", (_name, input, scope, expected) => {
    expect(resolveShortcut(input, scope, window)).toBe(expected);
  });

  it("never fires while the person types, except the composer's own bindings", () => {
    const textarea = document.createElement("textarea");
    expect(resolveShortcut(stroke("e", { target: textarea }), "thread", window)).toBeNull();
    expect(resolveShortcut(stroke("?", { shiftKey: true, target: textarea }), "global", window)).toBeNull();
    expect(resolveShortcut(stroke("b", { ctrlKey: true, target: textarea }), "composer", { platform: "other", attachedToWindow: false })).toBe("composer.bold");
  });

  it("lets the palette open from inside a text field, since Ctrl+K types nothing", () => {
    const textarea = document.createElement("textarea");
    expect(resolveShortcut(stroke("k", { ctrlKey: true, target: textarea }), "global", window)).toBe("palette.open");
  });

  it("stays out of dialogs and menus", () => {
    const button = inside({ role: "dialog" }, "button");
    expect(resolveShortcut(stroke("e", { target: button }), "thread", window)).toBeNull();
    expect(resolveShortcut(stroke("?", { shiftKey: true, target: button }), "global", window)).toBeNull();
  });

  it("fires inside the element it was registered on, even when that element lives in a dialog such as a conversation window", () => {
    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    const threadRoot = document.createElement("div");
    const message = document.createElement("div");
    threadRoot.appendChild(message);
    dialog.appendChild(threadRoot);
    const onRoot = { platform: "other" as const, attachedToWindow: false, root: threadRoot };
    expect(resolveShortcut(stroke("f", { ctrlKey: true, target: message }), "thread", onRoot)).toBe("thread.search");
  });

  it("still stays out of a menu opened inside its own element", () => {
    const threadRoot = document.createElement("div");
    const menu = document.createElement("div");
    menu.setAttribute("role", "menu");
    const item = document.createElement("div");
    menu.appendChild(item);
    threadRoot.appendChild(menu);
    const onRoot = { platform: "other" as const, attachedToWindow: false, root: threadRoot };
    expect(resolveShortcut(stroke("f", { ctrlKey: true, target: item }), "thread", onRoot)).toBeNull();
  });

  it("keeps global bindings out of an unrelated dialog", () => {
    const button = inside({ role: "dialog" }, "button");
    expect(resolveShortcut(stroke("/", { target: button }), "global", window)).toBeNull();
  });

  it("leaves a window listener alone when focus sits inside another scope's area", () => {
    const row = inside({ "data-shortcut-scope": "inbox" });
    expect(resolveShortcut(stroke("e", { target: row }), "thread", window)).toBeNull();
    expect(resolveShortcut(stroke("k", { ctrlKey: true, target: row }), "global", window)).toBe("palette.open");
    expect(resolveShortcut(stroke("j", { target: row }), "inbox", { platform: "other", attachedToWindow: false })).toBe("inbox.next");
  });

  it("uses Cmd on a Mac and refuses Ctrl there", () => {
    const mac = { platform: "mac" as const, attachedToWindow: true };
    expect(resolveShortcut(stroke("k", { metaKey: true }), "global", mac)).toBe("palette.open");
    expect(resolveShortcut(stroke("k", { ctrlKey: true }), "global", mac)).toBeNull();
  });
});
