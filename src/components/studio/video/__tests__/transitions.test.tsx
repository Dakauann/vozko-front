import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/medias", () => ({
  getMediaAction: vi.fn(async () => null),
  listLibraryAction: vi.fn(async () => ({ data: [] })),
  fetchMediaFileAction: vi.fn(async () => ({ data: null, error: "offline" })),
  uploadMediaAction: vi.fn(),
}));

vi.mock("@/app/actions/media-generation", () => ({
  listMediaModelsAction: vi.fn(async () => ({ data: [{ id: "m1", name: "Modelo", default: true }] })),
  requestMediaGenerationAction: vi.fn(),
  getMediaGenerationAction: vi.fn(),
}));

const saveStudioExport = vi.fn();
vi.mock("@/app/actions/studio", () => ({
  saveStudioExportAction: (...args: unknown[]) => saveStudioExport(...args),
  reportStudioCapabilitiesAction: vi.fn(async () => ({ data: true })),
}));

vi.mock("react-konva", () => {
  const Pass = ({ children }: { children?: ReactNode }) => <>{children}</>;
  return { Stage: Pass, Layer: Pass, Group: Pass, Rect: Pass, Text: Pass, Image: Pass, Ellipse: Pass, Line: Pass, Star: Pass, Arrow: Pass };
});

vi.mock("@/components/TourGuide", () => ({ default: () => null }));

import { TooltipProvider } from "@/components/ui/tooltip";
import ptMessages from "@/i18n/messages/pt.json";
import { emptyVideoDocument, newMediaClip, type VideoDocument } from "@/lib/studio/document";
import type { StudioProject } from "@/lib/studio/project";

import { VideoEditor } from "../video-editor";
import { fakeStudio } from "./harness";

function project(): StudioProject<VideoDocument> {
  const document = emptyVideoDocument("story");
  document.tracks[0].clips = [
    { ...newMediaClip("image", "img-a", 0, 2000), id: "c-a" },
    { ...newMediaClip("image", "img-b", 2000, 2000), id: "c-b" },
  ];
  document.durationMs = 4000;
  return { id: "p-1", kind: "video", name: "Vídeo", document, version: 4, createdAt: "", updatedAt: "" };
}

function mount() {
  const studio = fakeStudio();
  render(
    <NextIntlClientProvider locale="pt" messages={ptMessages} timeZone="America/Sao_Paulo">
      <TooltipProvider>
        <VideoEditor project={project()} studio={studio} />
      </TooltipProvider>
    </NextIntlClientProvider>,
  );
  return studio;
}

const pt = ptMessages.studio.video.transitions;
const inspector = () => within(screen.getByRole("complementary", { name: ptMessages.studio.video.inspector.label }));

function lastDocument(studio: ReturnType<typeof fakeStudio>): VideoDocument {
  const calls = vi.mocked(studio.edit).mock.calls;
  return calls[calls.length - 1][0].document as VideoDocument;
}

describe("transitions by hand", { timeout: 15_000 }, () => {
  it("adds a transition on a cut, swaps its kind, edits it and removes it", async () => {
    const studio = mount();
    fireEvent.click(screen.getByRole("button", { name: pt.addAt }));
    expect(lastDocument(studio).tracks[0].transitions).toEqual([expect.objectContaining({ fromClipId: "c-a", toClipId: "c-b", kind: "dissolve" })]);
    expect(screen.getByRole("heading", { name: ptMessages.studio.video.inspector.transitionTitle })).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole("tab", { name: ptMessages.studio.video.panels.tabs.transitions }));
    fireEvent.click(screen.getByRole("tab", { name: ptMessages.studio.video.panels.tabs.transitions }));
    fireEvent.click(await screen.findByRole("button", { name: pt.kinds.push }));
    expect(lastDocument(studio).tracks[0].transitions?.[0]).toMatchObject({ kind: "push", direction: "left" });

    const duration = inspector().getByRole("textbox", { name: pt.duration });
    fireEvent.change(duration, { target: { value: "0.8" } });
    fireEvent.blur(duration);
    expect(lastDocument(studio).tracks[0].transitions?.[0].durationMs).toBe(800);

    fireEvent.change(inspector().getByRole("combobox", { name: pt.options.direction }), { target: { value: "up" } });
    expect(lastDocument(studio).tracks[0].transitions?.[0].direction).toBe("up");

    fireEvent.click(inspector().getByRole("button", { name: pt.remove }));
    expect(lastDocument(studio).tracks[0].transitions).toBeUndefined();
  });

  it("selects a transition from its chip on the timeline", async () => {
    mount();
    fireEvent.click(screen.getByRole("button", { name: pt.addAt }));
    act(() => undefined);
    fireEvent.click(screen.getByRole("button", { name: pt.chip.replace("{kind}", pt.kinds.dissolve) }));
    expect(inspector().getByRole("combobox", { name: pt.kind })).toHaveValue("dissolve");
  });
});
