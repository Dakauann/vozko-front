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
