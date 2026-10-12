import { render } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { vi } from "vitest";

import type { StudioProjectHandle } from "@/hooks/use-studio-project";
import { TooltipProvider } from "@/components/ui/tooltip";
import ptMessages from "@/i18n/messages/pt.json";
import type { VideoDocument } from "@/lib/studio/document";

import { VideoEditorContext, type VideoEditorContextValue } from "../editor-context";
import { createVideoEditorRuntime } from "../runtime";

export function fakeStudio(): StudioProjectHandle<"video"> {
  return {
    load: { status: "loading" },
    generation: 0,
    name: "Projeto",
    saveStatus: "saved",
    saveError: null,
    conflict: null,
    edit: vi.fn(),
    flush: vi.fn(async () => undefined),
    committed: () => ({ version: 1, settled: true }),
    retrySave: vi.fn(),
    reloadFromServer: vi.fn(),
    keepMine: vi.fn(),
    reload: vi.fn(),
  };
}

export function renderInEditor(document: VideoDocument, ui: ReactNode) {
  const value: VideoEditorContextValue = { ...createVideoEditorRuntime(document), projectId: "p-1", studio: fakeStudio() };
  const view = render(
    <NextIntlClientProvider locale="pt" messages={ptMessages} timeZone="America/Sao_Paulo">
      <TooltipProvider>
        <VideoEditorContext.Provider value={value}>{ui}</VideoEditorContext.Provider>
      </TooltipProvider>
    </NextIntlClientProvider>,
  );
  return { ...view, editor: value };
}

export interface PreviewLayout {
  area: { width: number; height: number };
  frame: { width: number; height: number };
}

export function stubPreviewLayout({ area, frame }: PreviewLayout): () => void {
  const originals = {
    clientWidth: Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientWidth"),
    clientHeight: Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientHeight"),
    rect: HTMLElement.prototype.getBoundingClientRect,
  };
  window.localStorage.setItem("studio-renderer", "legacy");
  Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, get: () => area.width });
  Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, get: () => area.height });
  HTMLElement.prototype.getBoundingClientRect = function rect() {
    return { left: 0, top: 0, right: frame.width, bottom: frame.height, width: frame.width, height: frame.height, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
  };
  return () => {
    window.localStorage.removeItem("studio-renderer");
    if (originals.clientWidth) Object.defineProperty(HTMLElement.prototype, "clientWidth", originals.clientWidth);
    if (originals.clientHeight) Object.defineProperty(HTMLElement.prototype, "clientHeight", originals.clientHeight);
    HTMLElement.prototype.getBoundingClientRect = originals.rect;
  };
}
